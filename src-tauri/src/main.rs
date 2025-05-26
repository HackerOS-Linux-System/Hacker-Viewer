use tauri::{
    Manager, SystemTray, SystemTrayEvent, CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem,
    AppHandle,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize)]
struct LoginData {
    username: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct Settings {
    interface_scale: f32,
    brightness: i32,
    gpu_acceleration: bool,
    saved_logins: std::collections::HashMap<String, LoginData>,
}

#[tauri::command]
fn save_login(platform: String, username: String, password: String, remember: bool) -> Result<(), String> {
    let config_path = Path::new("config.json");
    let mut settings: Settings = if config_path.exists() {
        let data = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())?
    } else {
        Settings {
            interface_scale: 1.0,
            brightness: 50,
            gpu_acceleration: true,
            saved_logins: std::collections::HashMap::new(),
        }
    };

    if remember {
        settings.saved_logins.insert(platform.clone(), LoginData { username, password });
    } else {
        settings.saved_logins.remove(&platform);
    }

    fs::write(config_path, serde_json::to_string(&settings).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_logins() -> Result<Settings, String> {
    let config_path = Path::new("config.json");
    if config_path.exists() {
        let data = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())
    } else {
        Ok(Settings {
            interface_scale: 1.0,
            brightness: 50,
            gpu_acceleration: true,
            saved_logins: std::collections::HashMap::new(),
        })
    }
}

#[tauri::command]
fn restart_app(app: AppHandle) -> Result<(), String> {
    tauri::api::process::restart(&app.env());
    Ok(())
}

#[tauri::command]
fn system_action(action: String) -> Result<(), String> {
    match action.as_str() {
        "reboot" => std::process::Command::new("reboot").spawn().map_err(|e| e.to_string())?,
        "poweroff" => std::process::Command::new("poweroff").spawn().map_err(|e| e.to_string())?,
        "sway_exit" => std::process::Command::new("swaymsg").arg("exit").spawn().map_err(|e| e.to_string())?,
        _ => return Err("Invalid action".to_string()),
    };
    Ok(())
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let system_tray_menu = SystemTrayMenu::new()
        .add_item(quit)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("restart".to_string(), "Restart App"))
        .add_item(CustomMenuItem::new("reboot".to_string(), "Reboot System"))
        .add_item(CustomMenuItem::new("poweroff".to_string(), "Power Off"))
        .add_item(CustomMenuItem::new("sway_exit".to_string(), "Exit Sway"));

    let system_tray = SystemTray::new().with_menu(system_tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => app.exit(0),
                "restart" => restart_app(app.clone()).unwrap_or_else(|e| eprintln!("Failed to restart: {}", e)),
                "reboot" => system_action("reboot".to_string()).unwrap_or_else(|e| eprintln!("Failed to reboot: {}", e)),
                "poweroff" => system_action("poweroff".to_string()).unwrap_or_else(|e| eprintln!("Failed to poweroff: {}", e)),
                "sway_exit" => system_action("sway_exit".to_string()).unwrap_or_else(|e| eprintln!("Failed to exit sway: {}", e)),
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![save_login, load_logins, restart_app, system_action])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
                              }
