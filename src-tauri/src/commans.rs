use tauri::{AppHandle, Manager};
use crate::config::{Settings, LoginData};
use std::process::Command;
use log::{info, error};

#[tauri::command]
pub fn save_login(
    platform: String,
    username: String,
    password: String,
    token: String,
    remember: bool,
) -> Result<(), String> {
    info!("Saving login for platform: {}", platform);
    let mut settings = Settings::load()?;
    if remember {
        settings.saved_logins.insert(platform, LoginData { username, password, token });
    } else {
        settings.saved_logins.remove(&platform);
    }
    settings.save()?;
    Ok(())
}

#[tauri::command]
pub fn load_logins() -> Result<Settings, String> {
    info!("Loading settings");
    Settings::load()
}

#[tauri::command]
pub fn get_decrypted_data(platform: String, field: String) -> Result<String, String> {
    info!("Decrypting {} for platform: {}", field, platform);
    let settings = Settings::load()?;
    settings.decrypt_data(&platform, &field)
}

#[tauri::command]
pub fn restart_app(app: AppHandle) -> Result<(), String> {
    info!("Restarting application");
    tauri::api::process::restart(&app.env());
    Ok(())
}

#[tauri::command]
pub fn system_action(action: String) -> Result<(), String> {
    info!("Executing system action: {}", action);
    match action.as_str() {
        "reboot" => Command::new("reboot")
            .spawn()
            .map_err(|e| format!("Failed to reboot: {}", e))?,
        "poweroff" => Command::new("poweroff")
            .spawn()
            .map_err(|e| format!("Failed to poweroff: {}", e))?,
        "sway_exit" => Command::new("swaymsg")
            .arg("exit")
            .spawn()
            .map_err(|e| format!("Failed to exit sway: {}", e))?,
        _ => return Err("Invalid action".to_string()),
    };
    Ok(())
}
