import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

function Settings() {
    const { user } = useAuth();
    const [saved, setSaved] = useState(false);

    function handleSave() {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="settings-page">
            <header className="page-header">
                <h2>Settings</h2>
            </header>

            <div className="settings-section">
                <h3>Profile</h3>
                <div className="profile-card">
                    <img
                        src={user?.avatar || '/default-avatar.png'}
                        alt={user?.username}
                        className="profile-avatar"
                    />
                    <div className="profile-info">
                        <h4>{user?.username}</h4>
                        <p>ID: {user?.id}</p>
                        {user?.isAdmin && <span className="admin-badge">Admin</span>}
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>Preferences</h3>
                <div className="settings-form">
                    <div className="form-group">
                        <label htmlFor="notifications">
                            <input type="checkbox" id="notifications" defaultChecked />
                            Enable notifications
                        </label>
                    </div>
                    <div className="form-group">
                        <label htmlFor="sounds">
                            <input type="checkbox" id="sounds" />
                            Enable sound alerts
                        </label>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>Danger Zone</h3>
                <div className="danger-zone">
                    <p>These actions are irreversible. Please proceed with caution.</p>
                    <button className="danger-btn" disabled>
                        Delete Account
                    </button>
                </div>
            </div>

            <div className="settings-actions">
                <button onClick={handleSave} className="save-btn">
                    {saved ? 'Saved!' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}

export default Settings;
