import React from 'react';

const SettingsDialog = ({ settings, onSave, onClose, t }) => {
    const [localSettings, setLocalSettings] = React.useState(settings);

    const handleChange = (key, value) => {
        setLocalSettings({ ...localSettings, [key]: value });
    };

    return (
        <div className="settings-dialog">
            <h2 className="text-xl font-bold text-white mb-6">{t('settings')}</h2>
            <label>{t('interface_scale')}</label>
            <input
                type="range"
                min="50"
                max="200"
                value={localSettings.scale * 100}
                onChange={e => handleChange('scale', e.target.value / 100)}
            />
            <label>{t('brightness')}</label>
            <input
                type="number"
                min="0"
                max="100"
                value={localSettings.brightness}
                onChange={e => handleChange('brightness', parseInt(e.target.value))}
            />
            <label>
                <input
                    type="checkbox"
                    checked={localSettings.gpuAcceleration}
                    onChange={e => handleChange('gpuAcceleration', e.target.checked)}
                />
                {t('gpu_acceleration')}
            </label>
            <label>
                <input
                    type="checkbox"
                    checked={localSettings.hdrEnabled}
                    onChange={e => handleChange('hdrEnabled', e.target.checked)}
                />
                {t('hdr_enabled')}
            </label>
            <label>{t('theme')}</label>
            <select value={localSettings.theme} onChange={e => handleChange('theme', e.target.value)}>
                <option value="dark">{t('dark')}</option>
                <option value="light">{t('light')}</option>
            </select>
            <label>{t('language')}</label>
            <select value={localSettings.language} onChange={e => handleChange('language', e.target.value)}>
                <option value="en">English</option>
                <option value="pl">Polski</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
                <option value="ru">Русский</option>
                <option value="ja">日本語</option>
            </select>
            <div className="flex gap-4 mt-6">
                <button
                    onClick={() => onSave(localSettings)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg flex-1"
                >
                    {t('save')}
                </button>
                <button
                    onClick={onClose}
                    className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg flex-1"
                >
                    {t('cancel')}
                </button>
            </div>
        </div>
    );
};

export default SettingsDialog;
