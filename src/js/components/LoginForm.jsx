import React, { useState } from 'react';

const LoginForm = ({ platform, logins, onLogin, cinemaMode, t }) => {
    const [username, setUsername] = useState(logins[platform]?.username || '');
    const [password, setPassword] = useState(logins[platform]?.password || '');
    const [token, setToken] = useState(logins[platform]?.token || '');
    const [remember, setRemember] = useState(false);

    const handleSubmit = () => {
        onLogin(platform, username, password, token, remember);
    };

    return (
        <div className="login-container" style={{ display: cinemaMode ? 'none' : 'flex' }}>
            <input
                type="text"
                placeholder={t('username')}
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white text-lg"
            />
            <input
                type="password"
                placeholder={t('password')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white text-lg"
            />
            <input
                type="text"
                placeholder={t('token')}
                value={token}
                onChange={e => setToken(e.target.value)}
                className="p-3 border border-gray-600 rounded-lg bg-gray-700 text-white text-lg"
            />
            <div className="flex items-center">
                <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="mr-2"
                />
                <label className="text-gray-300 text-lg">{t('remember')}</label>
            </div>
            <button
                onClick={handleSubmit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg text-lg"
            >
                {t('login')}
            </button>
            <button
                onClick={() => invoke('system_action', { action: 'toggle_fullscreen' })}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg text-lg"
            >
                {t('cinema_mode')}
            </button>
        </div>
    );
};

export default LoginForm;
