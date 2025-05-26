import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { WebviewWindow } from '@tauri-apps/api/window';
import ReactDOM from 'react-dom';

const platforms = {
    "Prime Video": "https://www.amazon.com/gp/video/storefront",
    "Disney": "https://www.disneyplus.com",
    "YouTube": "https://www.youtube.com",
    "Twitch": "https://www.twitch.tv",
    "Eleven Sports": "https://www.elevensports.pl",
    "Netflix": "https://www.netflix.com",
    "HBO": "https://www.hbomax.com"
};

function App() {
    const [activeTab, setActiveTab] = useState("Prime Video");
    const [logins, setLogins] = useState({});
    const [cinemaMode, setCinemaMode] = useState(false);

    useEffect(() => {
        invoke('load_logins').then(settings => setLogins(settings.saved_logins));
    }, []);

    const handleLogin = async (platform) => {
        const username = document.getElementById(`${platform}_username`).value;
        const password = document.getElementById(`${platform}_password`).value;
        const remember = document.getElementById(`${platform}_remember`).checked;

        try {
            await invoke('save_login', { platform, username, password, remember });
            const webview = WebviewWindow.getByLabel(platform);
            webview.setUrl(platforms[platform]);
        } catch (error) {
            alert(`Login failed: ${error}`);
        }
    };

    const toggleCinemaMode = () => {
        setCinemaMode(!cinemaMode);
        const webview = WebviewWindow.getByLabel(activeTab);
        if (cinemaMode) {
            webview.setFullscreen(false);
            document.querySelector('.tab-bar').style.display = 'flex';
            document.querySelector('.login-container').style.display = 'flex';
        } else {
            webview.setFullscreen(true);
            document.querySelector('.tab-bar').style.display = 'none';
            document.querySelector('.login-container').style.display = 'none';
        }
    };

    return (
        <div className="tab-container">
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
                    placeholder="Username"
                    defaultValue={logins[activeTab]?.username || ''}
                />
                <input
                    id={`${activeTab}_password`}
                    type="password"
                    placeholder="Password"
                    defaultValue={logins[activeTab]?.password || ''}
                />
                <input id={`${activeTab}_remember`} type="checkbox" />
                <label htmlFor={`${activeTab}_remember`}>Remember</label>
                <button onClick={() => handleLogin(activeTab)}>Login</button>
                <button onClick={toggleCinemaMode}>Cinema Mode</button>
            </div>
            <div className="webview">
                <iframe
                    src={platforms[activeTab]}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={activeTab}
                />
            </div>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
