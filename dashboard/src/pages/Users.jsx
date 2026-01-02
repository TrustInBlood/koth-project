import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import './Users.css';

function Users() {
    const [users, setUsers] = useState([]);
    const { get, loading, error } = useApi();

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            // This endpoint would need to be implemented
            const data = await get('/api/users');
            setUsers(data.users || []);
        } catch (err) {
            // Expected to fail until endpoint is implemented
            console.log('Users endpoint not yet implemented');
        }
    }

    return (
        <div className="users-page">
            <header className="page-header">
                <h2>Users</h2>
                <button onClick={fetchUsers} className="refresh-btn" disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </header>

            {error && <div className="error">{error}</div>}

            <div className="users-table-container">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>ID</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="empty-state">
                                    No users found
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="user-cell">
                                            <img
                                                src={user.avatar || '/default-avatar.png'}
                                                alt={user.username}
                                                className="user-avatar-small"
                                            />
                                            <span>{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="mono">{user.id}</td>
                                    <td>
                                        <span className={`status-badge ${user.isBanned ? 'banned' : 'active'}`}>
                                            {user.isBanned ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button className="action-btn">View</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Users;
