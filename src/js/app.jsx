import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/shell';
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
    "Prime Video": "https://www.amazon.com/gp/video/storefront",
    "Disney": "https://www.disneyplus.com",
    "YouTube": "https://www.youtube.com",
    "Twitch": "https://www.twitch.tv",
    "Eleven Sports": "https://www.elevensports.pl",
    "Netflix": "https://www.netflix.com",
    "HBO": "https://www.hbomax.com",
};

function App() {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState("Prime Video");
    const [logins, setLogins] = useState({});
    const [cinemaMode, setCinemaMode] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [scale, setScale] = useState(1.0);
    const [brightness, setBrightness] = useState(50);
    const [gpuAcceleration, setGpuAcceleration] = useState(true);

    useEffect(() => {
        invoke('load_logins').then(settings => {
            setLogins(settings.saved_logins);
            setScale(settings.interface_scale);
            setBrightness(settings.brightness);
            setGpuAcceleration(settings.gpu_acceleration);
        }).catch(err => console.error('Failed to load settings:', err));

        // Skróty klawiszowe
        const handleKeyPress = (e) => {
            if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                const platform = Object.keys(platforms)[index];
                if (platform) setActiveTab(platform);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    const handleLogin = async (platform) => {
        const username = document.getElementById(`${platform}_username`).value;
        const password = document.getElementById(`${platform}_password`).value;
        const token = document.getElementById(`${platform}_token`).value;
        const remember = document.getElementById(`${platform}_remember`).checked;

        try {
            await invoke('save_login', { platform, username, password, token, remember });
            await open(platforms[platform]);
        } catch (error) {
            alert(t('login_failed', { error }));
        }
    };

    const toggleCinemaMode = () => {
        setCinemaMode(!cinemaMode);
        document.documentElement.style.setProperty('--scale', scale);
        if (cinemaMode) {
            document.querySelector('.tab-bar').style.display = 'flex';
            document.querySelector('.login-container').style.display = 'flex';
            document.querySelector('.settings-button').style.display = 'block';
            document.querySelector('.hacker-menu-button').style.display = 'block';
        } else {
            document.querySelector('.tab-bar').style.display = 'none';
            document.querySelector('.login-container').style.display = 'none';
            document.querySelector('.settings-button').style.display = 'none';
            document.querySelector('.hacker-menu-button').style.display = 'none';
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
            });
            setSettingsOpen(false);
        } catch (error) {
            alert(t('settings_failed', { error }));
        }
    };

    return (
        <div className="tab-container" style={{ filter: `brightness(${brightness}%)` }}>
            <button className="settings-button" onClick={() => setSettingsOpen(true)}>
                {t('settings')}
            </button>
            <button className="hacker-menu-button" onClick={() => invoke('system_action', { action: 'show_menu' })}>
                {t('hacker_menu')}
            </button>
            <div className="tab-bar">
                {Object.keys(platforms).map(platform => (
                    <div
                        key={platform}
                        className={`tab ${activeTab === platform ? 'active' : ''}`}
                        onClick={() => setActiveTab(platform)}
                    >
                        {platform}
                    </div>
                ))}
            </div>
            <div className="login-container">
                <input
                    id={`${activeTab}_username`}
                    type="text"
                    placeholder={t('username')}
                    defaultValue={logins[activeTab]?.username || ''}
                />
                <input
                    id={`${activeTab}_password`}
                    type="password"
                    placeholder={t('password')}
                    defaultValue={logins[activeTab]?.password || ''}
                />
                <input
                    id={`${activeTab}_token`}
                    type="text"
                    placeholder={t('token')}
                    defaultValue={logins[activeTab]?.token || ''}
                />
                <input id={`${activeTab}_remember`} type="checkbox" />
                <label htmlFor={`${activeTab}_remember`}>{t('remember')}</label>
                <button onClick={() => handleLogin(activeTab)}>{t('login')}</button>
                <button onClick={toggleCinemaMode}>{t('cinema_mode')}</button>
            </div>
            <iframe
                src={platforms[activeTab]}
                className="webview"
                title={activeTab}
            />
            {settingsOpen && (
                <div className="settings-dialog">
                    <h2>{t('settings')}</h2>
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
                    <button onClick={handleSettingsSave}>{t('save')}</button>
                    <button onClick={() => setSettingsOpen(false)}>{t('cancel')}</button>
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
