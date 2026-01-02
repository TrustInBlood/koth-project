import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './Layout.css';

function Layout() {
    const { user, logout } = useAuth();
    const { connected } = useSocket();

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>KOTH</h1>
                    <span className={`status-indicator ${connected ? 'online' : 'offline'}`}>
                        {connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Users
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Settings
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    {user && (
                        <div className="user-info">
                            <img
                                src={user.avatar}
                                alt={user.username}
                                className="user-avatar"
                            />
                            <span className="user-name">{user.username}</span>
                        </div>
                    )}
                    <button onClick={logout} className="logout-btn">
                        Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;
