use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use ring::aead::{Aead, LessSafeKey, Nonce, UnboundKey, AAD};
use ring::rand::{SecureRandom, SystemRandom};
use ring::aead::chacha20_poly1305::CHACHA20_POLY1305;
use keyring::Entry;
use log::error;

#[derive(Serialize, Deserialize, Clone)]
pub struct LoginData {
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub token: String,
}

#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub interface_scale: f32,
    pub brightness: i32,
    pub gpu_acceleration: bool,
    pub theme: String,
    pub language: String,
    pub hdr_enabled: bool, // Added for HDR support
    pub saved_logins: HashMap<String, LoginData>,
}

fn get_encryption_key() -> Result<[u8; 32], String> {
    let entry = Entry::new("hacker-viewer", "encryption-key")
        .map_err(|e| format!("Failed to access keyring: {}", e))?;
    let key = match entry.get_password() {
        Ok(key) => key,
        Err(_) => {
            let mut key_bytes = [0u8; 32];
            SystemRandom::new()
                .fill(&mut key_bytes)
                .map_err(|e| format!("Failed to generate key: {}", e))?;
            let key_str = base64::encode(&key_bytes);
            entry
                .set_password(&key_str)
                .map_err(|e| format!("Failed to save key: {}", e))?;
            key_str
        }
    };
    let key_bytes = base64::decode(&key)
        .map_err(|e| format!("Failed to decode key: {}", e))?;
    if key_bytes.len() != 32 {
        return Err("Invalid key length".to_string());
    }
    let mut result = [0u8; 32];
    result.copy_from_slice(&key_bytes);
    Ok(result)
}

impl Settings {
    pub fn load() -> Result<Self, String> {
        let config_path = Path::new("config.json");
        if config_path.exists() {
            let data = fs::read_to_string(config_path)
                .map_err(|e| format!("Failed to read config: {}", e))?;
            let settings: Settings = serde_json::from_str(&data)
                .map_err(|e| format!("Failed to parse config: {}", e))?;
            Ok(settings)
        } else {
            Ok(Settings {
                interface_scale: 1.0,
                brightness: 50,
                gpu_acceleration: true,
                theme: "dark".to_string(),
                language: "en".to_string(),
                hdr_enabled: true,
                saved_logins: HashMap::new(),
            })
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let config_path = Path::new("config.json");
        let mut settings = self.clone();
        let key_bytes = get_encryption_key()?;
        let key = LessSafeKey::new(
            UnboundKey::new(&CHACHA20_POLY1305, &key_bytes)
                .map_err(|e| format!("Failed to create encryption key: {}", e))?,
        );
        let rand = SystemRandom::new();

        for login in settings.saved_logins.values_mut() {
            if !login.password.is_empty() {
                let mut nonce_bytes = [0u8; 12];
                rand.fill(&mut nonce_bytes)
                    .map_err(|e| format!("Failed to generate nonce: {}", e))?;
                let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes)
                    .map_err(|e| format!("Invalid nonce: {}", e))?;
                let mut password_bytes = login.password.as_bytes().to_vec();
                key.seal_in_place_append_tag(nonce, AAD::empty(), &mut password_bytes)
                    .map_err(|e| format!("Encryption failed: {}", e))?;
                login.password = base64::encode(&[&nonce_bytes[..], &password_bytes[..]].concat());
            }
            if !login.token.is_empty() {
                let mut nonce_bytes = [0u8; 12];
                rand.fill(&mut nonce_bytes)
                    .map_err(|e| format!("Failed to generate nonce: {}", e))?;
                let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes)
                    .map_err(|e| format!("Invalid nonce: {}", e))?;
                let mut token_bytes = login.token.as_bytes().to_vec();
                key.seal_in_place_append_tag(nonce, AAD::empty(), &mut token_bytes)
                    .map_err(|e| format!("Encryption failed: {}", e))?;
                login.token = base64::encode(&[&nonce_bytes[..], &token_bytes[..]].concat());
            }
        }

        let data = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        let mut file = File::create(config_path)
            .map_err(|e| format!("Failed to create config file: {}", e))?;
        file.write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write config: {}", e))?;
        Ok(())
    }

    pub fn decrypt_data(&self, platform: &str, field: &str) -> Result<String, String> {
        let login = self.saved_logins.get(platform)
            .ok_or_else(|| format!("No login data found for platform: {}", platform))?;
        let data = match field {
            "password" => &login.password,
            "token" => &login.token,
            _ => return Err("Invalid field".to_string()),
        };
        if data.is_empty() {
            return Err(format!("No {} data for platform: {}", field, platform));
        }

        let key_bytes = get_encryption_key()?;
        let key = LessSafeKey::new(
            UnboundKey::new(&CHACHA20_POLY1305, &key_bytes)
                .map_err(|e| format!("Failed to create encryption key: {}", e))?,
        );
        let encrypted_data = base64::decode(data)
            .map_err(|e| format!("Failed to decode {}: {}", field, e))?;
        let nonce_bytes = encrypted_data
            .get(..12)
            .ok_or_else(|| format!("Invalid nonce length for {}", field))?;
        let ciphertext = encrypted_data
            .get(12..)
            .ok_or_else(|| format!("Invalid ciphertext for {}", field))?;
        let nonce = Nonce::try_assume_unique_for_key(nonce_bytes)
            .map_err(|e| format!("Invalid nonce: {}", e))?;
        let mut decrypted_data = ciphertext.to_vec();
        key.open_in_place(nonce, AAD::empty(), &mut decrypted_data)
            .map_err(|e| format!("Decryption failed: {}", e))?;
        String::from_utf8(decrypted_data)
            .map_err(|e| format!("Failed to convert decrypted {} to string: {}", field, e))
    }
}
