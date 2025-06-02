package main

import (
	"encoding/json"
	"fmt"
	"image/color"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Platform struct {
	Name string
	URL  string
	Icon string
}

type UserProfile struct {
	Name      string
	Credentials map[string]LoginCredentials
}

type LoginCredentials struct {
	Username string
	Password string // Hashed
	Remember bool
}

type Settings struct {
	InterfaceScale float32
	Brightness     int
	GPUAcceleration bool
	Language       string
	Theme          string
	ActiveProfile  string
}

type AppState struct {
	Settings    Settings
	Profiles    map[string]UserProfile
	Favorites   []string
	ActiveTab   string
	CinemaMode  bool
}

var (
	platforms = []Platform{
		{Name: "Prime Video", URL: "https://www.amazon.com/gp/video/storefront", Icon: "prime.png"},
		{Name: "Disney", URL: "https://www.disneyplus.com", Icon: "disney.png"},
		{Name: "YouTube", URL: "https://www.youtube.com", Icon: "youtube.png"},
		{Name: "Twitch", URL: "https://www.twitch.tv", Icon: "twitch.png"},
		{Name: "Eleven Sports", URL: "https://www.elevensports.pl", Icon: "eleven.png"},
		{Name: "Netflix", URL: "https://www.netflix.com", Icon: "netflix.png"},
		{Name: "HBO", URL: "https://www.hbomax.com", Icon: "hbo.png"},
	}
	languages = []struct {
		Name string
		Code string
	}{
		{"English", "en_US"}, {"Polski", "pl_PL"}, {"Español", "es_ES"}, {"Deutsch", "de_DE"},
		{"Français", "fr_FR"}, {"Italiano", "it_IT"}, {"Português", "pt_PT"}, {"Русский", "ru_RU"},
		{"日本語", "ja_JP"}, {"한국어", "ko_KR"}, {"中文", "zh_CN"}, {"العربية", "ar_SA"},
		{"Nederlands", "nl_NL"}, {"Svenska", "sv_SE"}, {"Norsk", "no_NO"}, {"Dansk", "da_DK"},
		{"Suomi", "fi_FI"}, {"Türkçe", "tr_TR"}, {"Ελληνικά", "el_GR"}, {"עברית", "he_IL"},
		{"हिन्दी", "hi_IN"}, {"Magyar", "hu_HU"}, {"Česky", "cs_CZ"}, {"Slovenčina", "sk_SK"},
	}
	configPath = filepath.Join(os.TempDir(), "hacker_viewer_config.json")
	appState   = AppState{
		Settings: Settings{
			InterfaceScale: 1.0,
			Brightness:     50,
			GPUAcceleration: true,
			Language:       "en_US",
			Theme:          "dark",
			ActiveProfile:  "default",
		},
		Profiles: map[string]UserProfile{
			"default": {Name: "Default", Credentials: make(map[string]LoginCredentials)},
		},
		Favorites: []string{},
	}
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
	if err := ioutil.WriteFile(configPath, data, 0600); err != nil {
		log.Printf("Failed to save config: %v", err)
	}
}

func hashPassword(password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash password: %v", err)
		return password
	}
	return string(hash)
}

func verifyPassword(hashed, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password)) == nil
}

func main() {
	// Set Wayland-specific environment variables
	os.Setenv("QT_QPA_PLATFORM", "wayland")
	os.Setenv("QT_LOGGING_RULES", "qt5ct.debug=false;qt5ct.warning=false")
	os.Setenv("QTWEBENGINE_CHROMIUM_FLAGS", "--enable-gpu --enable-features=WebRTCPipeWireCapturer")

	// Load configuration
	loadConfig()

	// Initialize Fyne app
	a := app.NewWithID("com.hacker.viewer")
	a.SetIcon(theme.ComputerIcon()) // Fallback icon
	w := a.NewWindow("Hacker Viewer")
	w.SetMaster()

	// Apply theme
	if appState.Settings.Theme == "light" {
		a.Settings().SetTheme(theme.LightTheme())
	} else {
		a.Settings().SetTheme(theme.DarkTheme())
	}

	// Language selection dialog
	if appState.Settings.Language == "" {
		showLanguageDialog(w)
	}

	// Setup UI
	setupUI(w)

	// Fullscreen
	w.Resize(fyne.NewSize(1920, 1080))
	w.SetFullScreen(true)
	w.ShowAndRun()
}

func showLanguageDialog(w fyne.Window) {
	dialog := dialog.NewCustom("Select Language", "Confirm", createLanguageSelector(w), w)
	dialog.Show()
}

func createLanguageSelector(w fyne.Window) fyne.CanvasObject {
	selector := widget.NewSelect([]string{}, func(selected string) {
		for _, lang := range languages {
			if lang.Name == selected {
				appState.Settings.Language = lang.Code
				saveConfig()
				break
			}
		}
	})
	langNames := make([]string, len(languages))
	for i, lang := range languages {
		langNames[i] = lang.Name
	}
	selector.Options = langNames
	selector.SetSelected("English")
	return container.NewVBox(
		widget.NewLabel("Choose your language:"),
		selector,
	)
}

func setupUI(w fyne.Window) {
	// Header
	settingsBtn := widget.NewButtonWithIcon("", theme.SettingsIcon(), func() {
		showSettingsDialog(w)
	})
	hackerMenuBtn := widget.NewButton("Hacker Menu", func() {
		showHackerMenu(w, hackerMenuBtn)
	})
	logo := canvas.NewImageFromResource(theme.ComputerIcon())
	logo.SetMinSize(fyne.NewSize(64, 64))
	header := container.NewHBox(
		settingsBtn,
		layout.NewSpacer(),
		hackerMenuBtn,
		logo,
	)

	// Tabs
	tabs := container.NewAppTabs()
	for _, platform := range platforms {
		platform := platform // Capture range variable
		content := createPlatformTab(w, platform)
		tab := container.NewTabItemWithIcon(platform.Name, theme.NewThemedResource(theme.FileVideoIcon()), content)
		tabs.Append(tab)
	}
	tabs.OnSelected = func(ti *container.TabItem) {
		appState.ActiveTab = ti.Text
		saveConfig()
	}
	if appState.ActiveTab != "" {
		for i, platform := range platforms {
			if platform.Name == appState.ActiveTab {
				tabs.SelectIndex(i)
				break
			}
		}
	}

	// Profile selector
	profileSelector := widget.NewSelect([]string{}, func(selected string) {
		appState.Settings.ActiveProfile = selected
		saveConfig()
	})
	updateProfileSelector(profileSelector)

	// Main layout
	content := container.NewVBox(
		header,
		widget.NewLabel("Profile:"),
		profileSelector,
		widget.NewButton("New Profile", func() {
			dialog.NewEntryDialog("New Profile", "Enter profile name", func(name string) {
				if name != "" {
					appState.Profiles[name] = UserProfile{Name: name, Credentials: make(map[string]LoginCredentials)}
					appState.Settings.ActiveProfile = name
					updateProfileSelector(profileSelector)
					saveConfig()
				}
			}, w).Show()
		}),
		tabs,
	)
	w.SetContent(content)
}

func updateProfileSelector(selector *widget.Select) {
	profiles := make([]string, 0, len(appState.Profiles))
	for name := range appState.Profiles {
		profiles = append(profiles, name)
	}
	selector.Options = profiles
	selector.SetSelected(appState.Settings.ActiveProfile)
}

func createPlatformTab(w fyne.Window, platform Platform) fyne.CanvasObject {
	usernameEntry := widget.NewEntry()
	usernameEntry.SetPlaceHolder("Username")
	passwordEntry := widget.NewPasswordEntry()
	passwordEntry.SetPlaceHolder("Password")
	rememberCheck := widget.NewCheck("Remember", nil)
	favoriteCheck := widget.NewCheck("Favorite", func(checked bool) {
		if checked {
			if !contains(appState.Favorites, platform.Name) {
				appState.Favorites = append(appState.Favorites, platform.Name)
			}
		} else {
			for i, fav := range appState.Favorites {
				if fav == platform.Name {
					appState.Favorites = append(appState.Favorites[:i], appState.Favorites[i+1:]...)
					break
				}
			}
		}
		saveConfig()
	})
	if contains(appState.Favorites, platform.Name) {
		favoriteCheck.SetChecked(true)
	}
	loginBtn := widget.NewButton("Login", func() {
		username := usernameEntry.Text
		password := passwordEntry.Text
		if username == "" || password == "" {
			dialog.ShowError(fmt.Errorf("username and password required"), w)
			return
		}
		if rememberCheck.Checked {
			appState.Profiles[appState.Settings.ActiveProfile].Credentials[platform.Name] = LoginCredentials{
				Username: username,
				Password: hashPassword(password),
				Remember: true,
			}
			saveConfig()
		}
		// Open URL in external browser (Fyne webview is experimental)
		exec.Command("xdg-open", platform.URL).Start()
	})
	cinemaBtn := widget.NewButton("Cinema Mode", func() {
		appState.CinemaMode = !appState.CinemaMode
		if appState.CinemaMode {
			w.SetFullScreen(true)
			w.SetContent(container.NewMax(widget.NewLabel("Cinema Mode: Use ESC to exit")))
			w.Canvas().SetOnTypedKey(func(key *fyne.KeyEvent) {
				if key.Name == fyne.KeyEscape {
					appState.CinemaMode = false
					setupUI(w)
				}
			})
		} else {
			setupUI(w)
		}
		saveConfig()
	})

	// Load saved credentials
	if creds, exists := appState.Profiles[appState.Settings.ActiveProfile].Credentials[platform.Name]; exists {
		usernameEntry.SetText(creds.Username)
		rememberCheck.SetChecked(creds.Remember)
	}

	return container.NewVBox(
		widget.NewLabel(fmt.Sprintf("Login to %s:", platform.Name)),
		usernameEntry,
		passwordEntry,
		container.NewHBox(rememberCheck, favoriteCheck, loginBtn, cinemaBtn),
		widget.NewLabel("Web view not supported in Fyne; click Login to open in browser"),
	)
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func showSettingsDialog(w fyne.Window) {
	scaleEntry := widget.NewEntry()
	scaleEntry.SetText(fmt.Sprintf("%.2f", appState.Settings.InterfaceScale))
	brightnessSlider := widget.NewSlider(0, 100)
	brightnessSlider.SetValue(float64(appState.Settings.Brightness))
	gpuCheck := widget.NewCheck("Enable GPU Acceleration", nil)
	gpuCheck.SetChecked(appState.Settings.GPUAcceleration)
	themeSelect := widget.NewSelect([]string{"dark", "light"}, func(selected string) {
		appState.Settings.Theme = selected
		if selected == "light" {
			fyne.CurrentApp().Settings().SetTheme(theme.LightTheme())
		} else {
			fyne.CurrentApp().Settings().SetTheme(theme.DarkTheme())
		}
	})
	themeSelect.SetSelected(appState.Settings.Theme)

	content := container.NewVBox(
		widget.NewLabel("Interface Scale:"),
		scaleEntry,
		widget.NewLabel("Brightness:"),
		brightnessSlider,
		gpuCheck,
		widget.NewLabel("Theme:"),
		themeSelect,
	)
	dialog.NewCustom("Settings", "Save", content, func(confirmed bool) {
		if confirmed {
			scale, _ := fyne.ParseFloat(scaleEntry.Text)
			appState.Settings.InterfaceScale = float32(scale)
			appState.Settings.Brightness = int(brightnessSlider.Value)
			appState.Settings.GPUAcceleration = gpuCheck.Checked
			saveConfig()
			fyne.CurrentApp().Settings().SetScale(scale)
		}
	}, w).Show()
}

func showHackerMenu(w fyne.Window, btn *widget.Button) {
	items := []*fyne.MenuItem{
		fyne.NewMenuItem("Restart App", func() {
			executable, _ := os.Executable()
			exec.Command(executable).Start()
			fyne.CurrentApp().Quit()
		}),
		fyne.NewMenuItem("Reboot", func() {
			if err := exec.Command("reboot").Run(); err != nil {
				dialog.ShowError(err, w)
			}
		}),
		fyne.NewMenuItem("Power Off", func() {
			if err := exec.Command("poweroff").Run(); err != nil {
				dialog.ShowError(err, w)
			}
		}),
		fyne.NewMenuItem("Sway Exit", func() {
			if err := exec.Command("swaymsg", "exit").Run(); err != nil {
				dialog.ShowError(err, w)
			}
		}),
		fyne.NewMenuItem("Clear Logins", func() {
			appState.Profiles[appState.Settings.ActiveProfile].Credentials = make(map[string]LoginCredentials)
			saveConfig()
			dialog.ShowInformation("Success", "All logins cleared", w)
		}),
	}
	menu := fyne.NewMenu("Hacker Menu", items...)
	w.Canvas().ShowMenuAt(menu, btn.Position())
}
