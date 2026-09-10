mod core;
mod utils;

use core::{
    device::{get_device_listener_state, start_device_listening},
    gamepad::{start_gamepad_listing, stop_gamepad_listing},
    growth::{
        self, growth_equip, growth_export, growth_get_state, growth_import, growth_reset,
        growth_set_outfit_theme, growth_set_thresholds, growth_update_settings, growth_set_growth_theme,
        growth_set_weekly_plan, growth_use_weekly_thresholds,
    },
    prevent_default, setup,
};
use tauri::{Manager, WindowEvent, generate_handler};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_custom_window::{
    MAIN_WINDOW_LABEL, PREFERENCE_WINDOW_LABEL, show_preference_window,
};
use utils::fs_extra::copy_dir;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();

            growth::initialize(app_handle).map_err(std::io::Error::other)?;

            let main_window = app.get_webview_window(MAIN_WINDOW_LABEL).unwrap();

            let preference_window = app.get_webview_window(PREFERENCE_WINDOW_LABEL).unwrap();

            setup::default(&app_handle, main_window.clone(), preference_window.clone());

            Ok(())
        })
        .invoke_handler(generate_handler![
            copy_dir,
            start_device_listening,
            get_device_listener_state,
            start_gamepad_listing,
            stop_gamepad_listing,
            growth_get_state,
            growth_update_settings,
            growth_equip,
            growth_export,
            growth_import,
            growth_reset,
            growth_set_thresholds,
            growth_set_outfit_theme,
            growth_set_growth_theme,
            growth_set_weekly_plan,
            growth_use_weekly_thresholds
        ])
        .plugin(tauri_plugin_admin_status::init())
        .plugin(tauri_plugin_custom_window::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pinia::init())
        .plugin(prevent_default::init())
        .plugin(tauri_plugin_single_instance::init(
            |app_handle, _argv, _cwd| {
                show_preference_window(app_handle);
            },
        ))
        .plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .filter(|metadata| !metadata.target().contains("gilrs"))
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_macos_permissions::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_locale::init())
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                let _ = window.hide();

                api.prevent_close();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| match event {
        tauri::RunEvent::Exit => growth::shutdown(app_handle),
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => {
            show_preference_window(app_handle);
        }
        _ => {
            let _ = app_handle;
        }
    });
}
