mod assistant;
mod bridge;
mod commands;
mod focus;
mod friends;
mod frontmost;
mod hopping;
mod remind;
mod secrets;
mod state;
mod sync;
mod tools;
mod updates;
mod watch;
mod window;

use std::sync::Arc;

use tauri::{AppHandle, Manager};

use state::App;

/// Brings up the peeps window, which is what someone opening the app wants to see.
fn open_home(handle: &AppHandle) {
    if let Some(home) = handle.get_webview_window(window::HOME) {
        let _ = window::show_home(&home);
    }
}

pub fn run() {
    tauri::Builder::default()
        // Opening peeps again shows the running one rather than starting a second copy.
        .plugin(tauri_plugin_single_instance::init(|handle, _, _| {
            open_home(handle)
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::Pending::default())
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::decide,
            commands::start_focus,
            commands::set_areas,
            commands::stop_focus,
            commands::set_one_thing,
            commands::start_friends,
            commands::add_friend,
            commands::remove_friend,
            commands::react,
            commands::add_note,
            commands::add_product,
            commands::remove_product,
            commands::add_todo,
            commands::set_todo_done,
            commands::edit_todo,
            commands::delete_todo,
            commands::send_chat,
            commands::new_chat,
            commands::set_helper_agent,
            commands::read_profile,
            commands::install_claude,
            commands::write_profile,
            commands::set_sync_folder,
            commands::add_product_path,
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
            commands::install_update,
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
                window::show_home(&home)?;
            }

            let bridge_app = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = bridge::serve(bridge_app).await {
                    eprintln!("peeps: agent bridge stopped: {error}");
                }
            });
            tauri::async_runtime::spawn(remind::run(app.clone()));
            tauri::async_runtime::spawn(remind::setup_nudge(app.clone()));
            tauri::async_runtime::spawn(focus::run(app.clone()));
            tauri::async_runtime::spawn(hopping::run(app.clone()));
            tauri::async_runtime::spawn(friends::heartbeat(app.clone()));
            let listener = app.clone();
            std::thread::spawn(move || friends::listen(listener));
            tauri::async_runtime::spawn(sync::run(app.clone()));
            tauri::async_runtime::spawn(updates::run(app.clone(), tauri_app.handle().clone()));
            tauri::async_runtime::spawn(watch::run(app));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to start peeps")
        .run(|handle, event| {
            // Clicking the Dock icon. The notch window is always visible, so whether any window
            // is showing says nothing about whether the user can see peeps.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                open_home(handle);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (handle, event);
        });
}
