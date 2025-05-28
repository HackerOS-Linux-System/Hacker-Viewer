import React, { useState, useEffect } from 'react';
import { invoke, open } from '@tauri-apps/api';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom/client';
import i18n from 'i18next';
import HttpBackend from 'i18next-http-backend';

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
    const [language, setLanguage] = useState('en');
    const [error, setError] = useState('');

    useEffect(() => {
        invoke('load_logins').then(settings => {
            setLogins(settings.saved_logins || {});
            setScale(settings.interface_scale || 1.0);
            setBrightness(settings.brightness || 50);
            setGpuAcceleration(settings.gpu_acceleration !== false);
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
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.setProperty('--scale', scale);
    }, [theme, scale]);

    const handleLogin = async (platform) => {
        const username = document.getElementById(`${platform}_username`).value;
        const password = document.getElementById(`${platform}_password`).value;
        const token = document.getElementById(`${platform}_token`).value;
        const remember = document.getElementById(`${platform}_remember`).checked;

        try {
            if (!token) {
                // Attempt to fetch token (placeholder)
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
            document.querySelector(selector).style.display = cinemaMode ? 'flex' : 'none';
        });
        if (!cinemaMode) {
            document.querySelector('.webview').requestFullscreen();
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    const handleSettingsSave = async () => {
        try {
            await invoke('save_login', {
                platform: 'settings',
                username: '',
                password: '',
                token: '',
                remember: true,
                interface_scale: scale,
                brightness,
                gpu_acceleration: gpuAcceleration,
                theme,
                language,
            });
            i18n.changeLanguage(language);
            setSettingsOpen(false);
            setError('');
        } catch (error) {
            setError(t('settings_failed', { error }));
        }
    };

    return (
        <div className="tab-container">
            {error && <div className="bg-red-500 text-white p-2 rounded mb-2">{error}</div>}
            <button className="settings-button hover:scale-110" onClick={() => setSettingsOpen(true)}>
                <img src="/assets/icons/settings.png" alt="Settings" />
                {t('settings')}
            </button>
            <button className="hacker-menu-button hover:scale-110" onClick={() => invoke('system_action', { action: 'show_menu' })}>
                <img src="/assets/icons/hacker-menu.png" alt="Hacker Menu" />
                {t('hacker_menu')}
            </button>
            <div className="tab-bar" style={{ display: cinemaMode ? 'none' : 'flex' }}>
                {Object.keys(platforms).map(platform => (
                    <div
                        key={platform}
                        className={`tab ${activeTab === platform ? 'active' : ''}`}
                        onClick={() => setActiveTab(platform)}
                    >
                        <img src={platforms[platform].icon} alt={platform} />
                        {platform}
                    </div>
                ))}
            </div>
            <div className="login-container" style={{ display: cinemaMode ? 'none' : 'flex' }}>
                <input
                    id={`${activeTab}_username`}
                    type="text"
                    placeholder={t('username')}
                    defaultValue={logins[activeTab]?.username || ''}
                    className="p-2 border border-gray-600 rounded bg-gray-700 text-white"
                />
                <input
                    id={`${activeTab}_password`}
                    type="password"
                    placeholder={t('password')}
                    defaultValue={logins[activeTab]?.password || ''}
                    className="p-2 border border-gray-600 rounded bg-gray-700 text-white"
                />
                <input
                    id={`${activeTab}_token`}
                    type="text"
                    placeholder={t('token')}
                    defaultValue={logins[activeTab]?.token || ''}
                    className="p-2 border border-gray-600 rounded bg-gray-700 text-white"
                />
                <div className="flex items-center">
                    <input id={`${activeTab}_remember`} type="checkbox" className="mr-2" />
                    <label htmlFor={`${activeTab}_remember`} className="text-gray-300">{t('remember')}</label>
                </div>
                <button onClick={() => handleLogin(activeTab)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded">
                    {t('login')}
                </button>
                <button onClick={toggleCinemaMode} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded">
                    {t('cinema_mode')}
                </button>
            </div>
            <iframe
                src={platforms[activeTab].url}
                className="webview"
                title={activeTab}
            />
            {settingsOpen && (
                <div className="settings-dialog">
                    <h2 className="text-lg font-bold text-white mb-4">{t('settings')}</h2>
                    <label>{t('interface_scale')}</label>
                    <input
                        type="range"
                        min="50"
                        max="200"
                        value={scale * 100}
                        onChange={e => setScale(e.target.value / 100)}
                    />
                    <label>{t('brightness')}</label>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={brightness}
                        onChange={e => setBrightness(parseInt(e.target.value))}
                    />
                    <label>
                        <input
                            type="checkbox"
                            checked={gpuAcceleration}
                            onChange={e => setGpuAcceleration(e.target.checked)}
                        />
                        {t('gpu_acceleration')}
                    </label>
                    <label>{t('theme')}</label>
                    <select value={theme} onChange={e => setTheme(e.target.value)}>
                        <option value="dark">{t('dark')}</option>
                        <option value="light">{t('light')}</option>
                    </select>
                    <label>{t('language')}</label>
                    <select value={language} onChange={e => setLanguage(e.target.value)}>
                        <option value="en">English</option>
                        <option value="pl">Polski</option>
                        <option value="es">Español</option>
                        <option value="de">Deutsch</option>
                    </select>
                    <div className="flex gap-2 mt-4">
                        <button onClick={handleSettingsSave} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded flex-1">
                            {t('save')}
                        </button>
                        <button onClick={() => setSettingsOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded flex-1">
                            {t('cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
