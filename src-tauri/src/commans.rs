use tauri::{AppHandle, Manager};
use crate::config::{Settings, LoginData};
use std::process::Command;
use log::{info, error};
use reqwest::Client;

#[tauri::command]
pub async fn save_login(
    platform: String,
    username: String,
    password: String,
    token: String,
    remember: bool,
    interface_scale: Option<f64>,
    brightness: Option<i32>,
    gpu_acceleration: Option<bool>,
    theme: Option<String>,
    language: Option<String>,
    hdr_enabled: Option<bool>,
) -> Result<(), String> {
    info!("Saving settings for platform: {}", platform);
    let mut settings = Settings::load()?;
    if remember && platform != "settings" {
        settings.saved_logins.insert(platform, LoginData { username, password, token });
    } else if platform != "settings" {
        settings.saved_logins.remove(&platform);
    }
    if let Some(scale) = interface_scale {
        settings.interface_scale = scale as f32;
    }
    if let Some(bright) = brightness {
        settings.brightness = bright;
    }
    if let Some(gpu) = gpu_acceleration {
        settings.gpu_acceleration = gpu;
    }
    if let Some(t) = theme {
        settings.theme = t;
    }
    if let Some(lang) = language {
        settings.language = lang;
    }
    if let Some(hdr) = hdr_enabled {
        settings.hdr_enabled = hdr;
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
        "toggle_fullscreen" => Command::new("swaymsg")
            .arg("fullscreen")
            .arg("toggle")
            .spawn()
            .map_err(|e| format!("Failed to toggle fullscreen: {}", e))?,
        _ => return Err("Invalid action".to_string()),
    };
    Ok(())
}

#[tauri::command]
pub async fn fetch_platform_token(platform: String, username: String, password: String) -> Result<String, String> {
    info!("Fetching token for platform: {}", platform);
    let client = Client::new();
    // Placeholder: Replace with actual API endpoint
    let response = client
        .post(format!("https://api.{}.com/auth", platform.to_lowercase()))
        .json(&serde_json::json!({ "username": username, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch token: {}", e))?;
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    json["token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Token not found in response".to_string())
}
