import React, { useState, useEffect } from 'react';
import { invoke, open } from '@tauri-apps/api';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom/client';
import i18n from 'i18next';
import HttpBackend from 'i18next-http-backend';
import SettingsDialog from './components/SettingsDialog';
import LoginForm from './components/LoginForm';
import TabBar from './components/TabBar';

i18n.use(HttpBackend).init({
    lng: 'en',
    fallbackLng: 'en',
    backend: { loadPath: '/locales/{{lng}}.json' },
});

const platforms = {
    "Prime Video": { url: "https://www.amazon.com/gp/video/storefront", icon: "/assets/icons/platform-icons/prime-video.png" },
    "Disney": { url: "https://www.disneyplus.com", icon: "/assets/icons/platform-icons/disney.png" },
    "YouTube": { url: "https://www.youtube.com", icon: "/assets/icons/platform-icons/youtube.png" },
    "Twitch": { url: "https://www.twitch.tv", icon: "/assets/icons/platform-icons/twitch.png" },
    "Eleven Sports": { url: "https://www.elevensports.pl", icon: "/assets/icons/platform-icons/eleven-sports.png" },
    "Netflix": { url: "https://www.netflix.com", icon: "/assets/icons/platform-icons/netflix.png" },
    "HBO": { url: "https://www.hbomax.com", icon: "/assets/icons/platform-icons/hbo.png" },
};

function App() {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState("Prime Video");
    const [logins, setLogins] = useState({});
    const [cinemaMode, setCinemaMode] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [theme, setTheme] = useState('dark');
    const [scale, setScale] = useState(1.0);
    const [brightness, setBrightness] = useState(50);
    const [gpuAcceleration, setGpuAcceleration] = useState(true);
    const [hdrEnabled, setHdrEnabled] = useState(true);
    const [language, setLanguage] = useState('en');
    const [error, setError] = useState('');

    useEffect(() => {
        invoke('load_logins').then(settings => {
            setLogins(settings.saved_logins || {});
            setScale(settings.interface_scale || 1.0);
            setBrightness(settings.brightness || 50);
            setGpuAcceleration(settings.gpu_acceleration !== false);
            setHdrEnabled(settings.hdr_enabled !== false);
            setTheme(settings.theme || 'dark');
            setLanguage(settings.language || 'en');
            i18n.changeLanguage(settings.language || 'en');
        }).catch(err => setError(t('settings_failed', { error: err })));

        // Keyboard shortcuts
        const handleKeyPress = (e) => {
            if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
                const index = parseInt(e.key) - 1;
                const platform = Object.keys(platforms)[index];
                if (platform) setActiveTab(platform);
            }
            if (e.key === 'F11') toggleCinemaMode();
            if (e.ctrlKey && e.key === 's') setSettingsOpen(true);
            if (e.ctrlKey && e.key === 'f') invoke('system_action', { action: 'toggle_fullscreen' });
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.setProperty('--scale', scale);
        if (hdrEnabled) {
            document.documentElement.classList.add('hdr');
        } else {
            document.documentElement.classList.remove('hdr');
        }
    }, [theme, scale, hdrEnabled]);

    const handleLogin = async (platform, username, password, token, remember) => {
        try {
            if (!token) {
                const fetchedToken = await invoke('fetch_platform_token', { platform, username, password });
                await invoke('save_login', { platform, username, password, token: fetchedToken, remember });
            } else {
                await invoke('save_login', { platform, username, password, token, remember });
            }
            await open(platforms[platform].url);
            setError('');
        } catch (error) {
            setError(t('login_failed', { error }));
        }
    };

    const toggleCinemaMode = () => {
        setCinemaMode(!cinemaMode);
        const elements = ['.tab-bar', '.login-container', '.settings-button', '.hacker-menu-button'];
        elements.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.style.display = cinemaMode ? 'flex' : 'none';
        });
        if (!cinemaMode) {
            document.querySelector('.webview').requestFullscreen();
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    const handleSettingsSave = async (settings) => {
        try {
            await invoke('save_login', {
                platform: 'settings',
                username: '',
                password: '',
                token: '',
                remember: true,
                interface_scale: settings.scale,
                brightness: settings.brightness,
                gpu_acceleration: settings.gpuAcceleration,
                theme: settings.theme,
                language: settings.language,
                hdr_enabled: settings.hdEnabled,
            });
            i18n.changeLanguage(settings.language);
            setSettingsOpen(false);
            setError('');
        } catch (error) {
            setError(t('settings_failed', { error }));
        }
    };

    return (
        <div className="tab-container">
            {error && <div className="error-banner">{error}</div>}
            <button
                className="settings-button"
                onClick={() => setSettingsOpen(true)}
                aria-label={t('settings')}
            >
                <img src="/assets/icons/settings.png" alt="Settings" />
                {t('settings')}
            </button>
            <button
                className="hacker-menu-button"
                onClick={() => invoke('system_action', { action: 'show_menu' })}
                aria-label={t('hacker_menu')}
            >
                <img src="/assets/icons/hacker-menu.png" alt="Hacker Menu" />
                {t('hacker_menu')}
            </button>
            <TabBar
                platforms={platforms}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                cinemaMode={cinemaMode}
            />
            <LoginForm
                platform={activeTab}
                logins={logins}
                onLogin={handleLogin}
                cinemaMode={cinemaMode}
                t={t}
            />
            <iframe
                src={platforms[activeTab].url}
                className="webview"
                title={activeTab}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            />
            {settingsOpen && (
                <SettingsDialog
                    settings={{ scale, brightness, gpuAcceleration, theme, language, hdrEnabled }}
                    onSave={handleSettingsSave}
                    onClose={() => setSettingsOpen(false)}
                    t={t}
                />
            )}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
