use std::io;
use std::sync::Arc;

use interprocess::local_socket::tokio::{prelude::*, Stream};
use interprocess::local_socket::ListenerOptions;
use peeps_core::mcp::{ToolRequest, ToolResponse};
use peeps_core::protocol::HookInput;
use peeps_core::{ipc, paths};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

use crate::state::App;

/// Accepts one connection per hook call from `peeps-hook`.
pub async fn serve(app: Arc<App>) -> io::Result<()> {
    std::fs::create_dir_all(paths::data_dir())?;
    ipc::clear_stale_socket()?;
    let listener = ListenerOptions::new()
        .name(ipc::socket_name()?)
        .create_tokio()?;
    loop {
        let connection = listener.accept().await?;
        let app = app.clone();
        tokio::spawn(async move {
            if let Err(error) = handle(connection, &app).await {
                eprintln!("peeps: hook connection failed: {error}");
            }
        });
    }
}

async fn handle(connection: Stream, app: &App) -> io::Result<()> {
    let (read, mut write) = tokio::io::split(connection);
    let mut lines = BufReader::new(read).lines();
    let Some(line) = lines.next_line().await? else {
        return Ok(());
    };
    let value: serde_json::Value = serde_json::from_str(&line).map_err(io::Error::other)?;
    if value.get("peeps_tool").is_some() {
        let request: ToolRequest = serde_json::from_value(value).map_err(io::Error::other)?;
        let response = match crate::tools::call(app, &request.peeps_tool, request.args).await {
            Ok(text) => ToolResponse {
                text: Some(text),
                error: None,
            },
            Err(error) => ToolResponse {
                text: None,
                error: Some(error),
            },
        };
        let mut text = serde_json::to_string(&response)?;
        text.push('\n');
        write.write_all(text.as_bytes()).await?;
        return write.flush().await;
    }
    let input: HookInput = serde_json::from_value(value).map_err(io::Error::other)?;

    let reply = tokio::select! {
        reply = app.on_hook(input) => reply,
        _ = hook_gone(&mut lines) => return Ok(()),
    };
    if let Some(reply) = reply {
        let mut text = serde_json::to_string(&reply)?;
        text.push('\n');
        write.write_all(text.as_bytes()).await?;
        write.flush().await?;
    }
    Ok(())
}

/// Resolves when the hook process closes its end, e.g. when the user answered in the terminal.
async fn hook_gone<R: tokio::io::AsyncBufRead + Unpin>(lines: &mut tokio::io::Lines<R>) {
    while let Ok(Some(_)) = lines.next_line().await {}
}
