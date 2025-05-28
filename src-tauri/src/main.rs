use tauri::{
    AppHandle, Manager, SystemTray, SystemTrayEvent, CustomMenuItem, SystemTrayMenu,
    SystemTrayMenuItem,
};
use crate::commands::{save_login, load_logins, restart_app, system_action, get_decrypted_data};

mod config;
mod commands;

fn main() {
    env_logger::init(); // Initialize logger

    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let restart = CustomMenuItem::new("restart".to_string(), "Restart App");
    let reboot = CustomMenuItem::new("reboot".to_string(), "Reboot System");
    let poweroff = CustomMenuItem::new("poweroff".to_string(), "Power Off");
    let sway_exit = CustomMenuItem::new("sway_exit".to_string(), "Exit Sway");

    let system_tray_menu = SystemTrayMenu::new()
        .add_item(quit)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(restart)
        .add_item(reboot)
        .add_item(poweroff)
        .add_item(sway_exit);

    let system_tray = SystemTray::new().with_menu(system_tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => app.exit(0),
                "restart" => restart_app(app.clone()).unwrap_or_else(|e| log::error!("Failed to restart: {}", e)),
                "reboot" => system_action("reboot".to_string()).unwrap_or_else(|e| log::error!("Failed to reboot: {}", e)),
                "poweroff" => system_action("poweroff".to_string()).unwrap_or_else(|e| log::error!("Failed to poweroff: {}", e)),
                "sway_exit" => system_action("sway_exit".to_string()).unwrap_or_else(|e| log::error!("Failed to exit sway: {}", e)),
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            save_login,
            load_logins,
            restart_app,
            system_action,
            get_decrypted_data
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
