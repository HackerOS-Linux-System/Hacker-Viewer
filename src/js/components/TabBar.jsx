import React from 'react';

const TabBar = ({ platforms, activeTab, setActiveTab, cinemaMode }) => {
    return (
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
    );
};

export default TabBar;
