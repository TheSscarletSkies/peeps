mod assistant;
mod bridge;
mod commands;
mod remind;
mod secrets;
mod state;
mod sync;
mod tools;
mod watch;
mod window;

use std::sync::Arc;

use tauri::Manager;

use state::App;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::decide,
            commands::add_note,
            commands::add_product,
            commands::remove_product,
            commands::add_todo,
            commands::set_todo_done,
            commands::edit_todo,
            commands::delete_todo,
            commands::write_draft,
            commands::delete_draft,
            commands::send_chat,
            commands::new_chat,
            commands::set_helper_agent,
            commands::set_sync_folder,
            commands::add_product_path,
            commands::add_schedule,
            commands::delete_schedule,
            commands::hooks_status,
            commands::install_hooks,
            commands::uninstall_hooks,
            commands::set_secret,
            commands::set_tray_size,
            commands::notch,
            commands::float_tray,
            commands::open_home,
            commands::save_image,
            commands::add_calendar,
            commands::remove_calendar,
            commands::set_reminders,
        ])
        .setup(|tauri_app| {
            let app = Arc::new(App::load(tauri_app.handle().clone())?);
            tauri_app.manage(app.clone());

            if let Some(window) = tauri_app.get_webview_window(window::LABEL) {
                let notch = window::notch();
                window::dock(&window, notch.width.max(240.0), notch.height)?;
            }
            if let Some(home) = tauri_app.get_webview_window(window::HOME) {
                // Closing the peeps window only hides it; the pets keep living in the notch.
                let hidden = home.clone();
                home.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = hidden.hide();
                    }
                });
                if app.config().products.is_empty() {
                    window::show_home(&home)?;
                }
            }

            let bridge_app = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = bridge::serve(bridge_app).await {
                    eprintln!("peeps: agent bridge stopped: {error}");
                }
            });
            tauri::async_runtime::spawn(remind::run(app.clone()));
            tauri::async_runtime::spawn(sync::run(app.clone()));
            tauri::async_runtime::spawn(assistant::run_schedules(app.clone()));
            tauri::async_runtime::spawn(watch::run(app));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start peeps");
}
