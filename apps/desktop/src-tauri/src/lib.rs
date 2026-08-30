mod lifecycle;
mod project_files;

use lifecycle::AppLifecycleState;
use project_files::ProjectFileRegistry;
use tauri::{Emitter, Manager};

const EXIT_REQUESTED_EVENT: &str = "led-studio://exit-requested";

fn request_frontend_exit(app: &tauri::AppHandle) -> bool {
    let lifecycle = app.state::<AppLifecycleState>();

    if !lifecycle.should_intercept_exit() {
        return false;
    }

    if app.emit_to("main", EXIT_REQUESTED_EVENT, ()).is_err() {
        lifecycle.allow_exit();
        app.exit(0);
    }

    true
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppLifecycleState::default())
        .manage(ProjectFileRegistry::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            lifecycle::exit_app,
            lifecycle::register_exit_listener,
            lifecycle::unregister_exit_listener,
            project_files::open_project,
            project_files::release_project_file,
            project_files::save_project,
            project_files::save_project_as,
        ])
        .build(tauri::generate_context!())
        .expect("error while building LED Studio");

    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            if request_frontend_exit(app_handle) {
                api.prevent_exit();
            }
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
            if request_frontend_exit(app_handle) {
                api.prevent_close();
            }
        }
        _ => {}
    });
}
