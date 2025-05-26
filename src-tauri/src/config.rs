use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use ring::aead::{AEAD, LessSafeKey, Nonce, UnboundKey};
use ring::rand::{SecureRandom, SystemRandom};
use ring::aead::chacha20_poly1305::CHACHA20_POLY1305;

// Struktura dla danych logowania
#[derive(Serialize, Deserialize, Clone)]
pub struct LoginData {
    pub username: String,
    pub password: String,
}

// Struktura dla ustawień aplikacji
#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub interface_scale: f32,
    pub brightness: i32,
    pub gpu_acceleration: bool,
    pub saved_logins: HashMap<String, LoginData>,
}

// Klucz do szyfrowania
const ENCRYPTION_KEY: &[u8; 32] = b"super-secret-key-1234567890123456"; // W produkcji użyj bezpiecznego klucza

impl Settings {
    // Wczytywanie ustawień z pliku
    pub fn load() -> Result<Self, String> {
        let config_path = Path::new("config.json");
        if config_path.exists() {
            let data = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
            let settings: Settings = serde_json::from_str(&data).map_err(|e| e.to_string())?;
            Ok(settings)
        } else {
            Ok(Settings {
                interface_scale: 1.0,
                brightness: 50,
                gpu_acceleration: true,
                saved_logins: HashMap::new(),
            })
        }
    }

    // Zapisywanie ustawień do pliku z szyfrowaniem haseł
    pub fn save(&self) -> Result<(), String> {
        let config_path = Path::new("config.json");
        let mut settings = self.clone();

        // Szyfrowanie haseł
        let rand = SystemRandom::new();
        for login in settings.saved_logins.values_mut() {
            let mut nonce_bytes = [0u8; 12];
            rand.fill(&mut nonce_bytes).map_err(|e| e.to_string())?;
            let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes).map_err(|e| e.to_string())?;
            let key = LessSafeKey::new(
                UnboundKey::new(&CHACHA20_POLY1305, ENCRYPTION_KEY).map_err(|e| e.to_string())?
            );
            let encrypted_password = key
                .seal_in_place_append_tag(nonce, Aad::empty(), login.password.as_bytes_mut())
                .map_err(|e| e.to_string())?;
            login.password = base64::encode(encrypted_password); // Zakoduj do base64 dla zapisu
        }

        let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
        let mut file = File::create(config_path).map_err(|e| e.to_string())?;
        file.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    }

    // Odszyfrowanie hasła
    pub fn decrypt_password(&self, platform: &str) -> Result<String, String> {
        if let Some(login) = self.saved_logins.get(platform) {
            let encrypted_data = base64::decode(&login.password).map_err(|e| e.to_string())?;
            let nonce_bytes = &encrypted_data[..12];
            let ciphertext = &encrypted_data[12..];
            let nonce = Nonce::try_assume_unique_for_key(nonce_bytes).map_err(|e| e.to_string())?;
            let key = LessSafeKey::new(
                UnboundKey::new(&CHACHA20_POLY1305, ENCRYPTION_KEY).map_err(|e| e.to_string())?
            );
            let decrypted = key
                .open_in_place(nonce, Aad::empty(), &mut ciphertext.to_vec())
                .map_err(|e| e.to_string())?;
            String::from_utf8(decrypted.to_vec()).map_err(|e| e.to_string())
        } else {
            Err("No login data found for platform".to_string())
        }
    }
}
