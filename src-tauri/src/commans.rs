use tauri::{AppHandle, Manager};
use crate::config::{Settings, LoginData};
use std::process::Command;

// Komenda do zapisywania danych logowania
#[tauri::command]
pub fn save_login(
    platform: String,
    username: String,
    password: String,
    remember: bool,
) -> Result<(), String> {
    let mut settings = Settings::load()?;
    if remember {
        settings.saved_logins.insert(platform, LoginData { username, password });
    } else {
        settings.saved_logins.remove(&platform);
    }
    settings.save()?;
    Ok(())
}

// Komenda do wczytywania danych logowania
#[tauri::command]
pub fn load_logins() -> Result<Settings, String> {
    Settings::load()
}

// Komenda do restartu aplikacji
#[tauri::command]
pub fn restart_app(app: AppHandle) -> Result<(), String> {
    tauri::api::process::restart(&app.env());
    Ok(())
}

// Komenda do akcji systemowych
#[tauri::command]
pub fn system_action(action: String) -> Result<(), String> {
    match action.as_str() {
        "reboot" => Command::new("reboot").spawn().map_err(|e| e.to_string())?,
        "poweroff" => Command::new("poweroff").spawn().map_err(|e| e.to_string())?,
        "sway_exit" => Command::new("swaymsg").arg("exit").spawn().map_err(|e| e.to_string())?,
        _ => return Err("Invalid action".to_string()),
    };
    Ok(())
}

// Komenda do wczytania odszyfrowanego hasła dla platformy
#[tauri::command]
pub fn get_decrypted_password(platform: String) -> Result<String, String> {
    let settings = Settings::load()?;
    settings.decrypt_password(&platform)
}
