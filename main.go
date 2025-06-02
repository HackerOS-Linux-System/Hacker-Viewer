package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type Settings struct {
	InterfaceScale float64 `json:"interface_scale"`
	Brightness     int     `json:"brightness"`
	GPUAcceleration bool   `json:"gpu_acceleration"`
	Language       string `json:"language"`
}

type LoginCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Remember bool   `json:"remember"`
}

type AppState struct {
	Settings      Settings                 `json:"settings"`
	SavedLogins   map[string]LoginCredentials `json:"saved_logins"`
}

var (
	appState = AppState{
		Settings: Settings{
			InterfaceScale: 1.0,
			Brightness:     50,
			GPUAcceleration: true,
			Language:       "en_US",
		},
		SavedLogins: make(map[string]LoginCredentials),
	}
	configPath = "/tmp/hacker_viewer_config.json"
)

func loadConfig() {
	data, err := ioutil.ReadFile(configPath)
	if err != nil {
		log.Println("No config file found, using defaults")
		return
	}
	if err := json.Unmarshal(data, &appState); err != nil {
		log.Printf("Failed to parse config: %v", err)
	}
}

func saveConfig() {
	data, err := json.MarshalIndent(appState, "", "  ")
	if err != nil {
		log.Printf("Failed to marshal config: %v", err)
		return
	}
	if err := ioutil.WriteFile(configPath, data, 0644); err != nil {
		log.Printf("Failed to save config: %v", err)
	}
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
	tmpl, err := template.ParseFiles("static/index.html")
	if err != nil {
		http.Error(w, "Failed to load template", http.StatusInternalServerError)
		return
	}
	tmpl.Execute(w, nil)
}

func settingsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		json.NewEncoder(w).Encode(appState.Settings)
	} else if r.Method == "POST" {
		var newSettings Settings
		if err := json.NewDecoder(r.Body).Decode(&newSettings); err != nil {
			http.Error(w, "Invalid settings data", http.StatusBadRequest)
			return
		}
		appState.Settings = newSettings
		saveConfig()
		w.WriteHeader(http.StatusOK)
	}
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	platform := vars["platform"]
	if r.Method == "GET" {
		credentials, exists := appState.SavedLogins[platform]
		if !exists {
			credentials = LoginCredentials{}
		}
		json.NewEncoder(w).Encode(credentials)
	} else if r.Method == "POST" {
		var credentials LoginCredentials
		if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
			http.Error(w, "Invalid login data", http.StatusBadRequest)
			return
		}
		if credentials.Remember {
			appState.SavedLogins[platform] = credentials
		} else {
			delete(appState.SavedLogins, platform)
		}
		saveConfig()
		w.WriteHeader(http.StatusOK)
	}
}

func clearLoginsHandler(w http.ResponseWriter, r *http.Request) {
	appState.SavedLogins = make(map[string]LoginCredentials)
	saveConfig()
	w.WriteHeader(http.StatusOK)
}

func systemActionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	action := vars["action"]
	var cmd *exec.Cmd

	switch action {
	case "restart-app":
		executable, err := os.Executable()
		if err != nil {
			http.Error(w, "Failed to get executable path", http.StatusInternalServerError)
			return
		}
		cmd = exec.Command(executable)
	case "reboot":
		cmd = exec.Command("reboot")
	case "poweroff":
		cmd = exec.Command("poweroff")
	case "sway-exit":
		cmd = exec.Command("swaymsg", "exit")
	default:
		http.Error(w, "Invalid action", http.StatusBadRequest)
		return
	}

	if err := cmd.Run(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to execute %s: %v", action, err), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func main() {
	// Set Wayland-specific environment variables
	os.Setenv("QT_QPA_PLATFORM", "wayland")
	os.Setenv("QT_LOGGING_RULES", "qt5ct.debug=false;qt5ct.warning=false")
	os.Setenv("QTWEBENGINE_CHROMIUM_FLAGS", "--enable-gpu --enable-features=WebRTCPipeWireCapturer")

	// Load configuration
	loadConfig()

	// Set up router
	r := mux.NewRouter()
	r.HandleFunc("/", indexHandler).Methods("GET")
	r.HandleFunc("/api/settings", settingsHandler).Methods("GET", "POST")
	r.HandleFunc("/api/login/{platform}", loginHandler).Methods("GET", "POST")
	r.HandleFunc("/api/clear-logins", clearLoginsHandler).Methods("POST")
	r.HandleFunc("/api/system/{action}", systemActionHandler).Methods("POST")

	// Serve static files
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// Start server
	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
