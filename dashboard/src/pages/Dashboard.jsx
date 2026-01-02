import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useSocket } from '../context/SocketContext';
import Card from '../components/Card';
import './Dashboard.css';

function Dashboard() {
    const [stats, setStats] = useState(null);
    const { get, loading, error } = useApi();
    const { connected } = useSocket();

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const data = await get('/api/stats');
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }

    function formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    }

    function formatMemory(bytes) {
        const mb = bytes / 1024 / 1024;
        return `${mb.toFixed(1)} MB`;
    }

    if (loading && !stats) {
        return <div className="loading">Loading stats...</div>;
    }

    if (error) {
        return <div className="error">Error: {error}</div>;
    }

    return (
        <div className="dashboard">
            <header className="page-header">
                <h2>Dashboard</h2>
                <button onClick={fetchStats} className="refresh-btn" disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </header>

            <div className="stats-grid">
                <Card
                    title="Total Users"
                    value={stats?.users?.total ?? 0}
                    subtitle="Registered users"
                />
                <Card
                    title="Banned Users"
                    value={stats?.users?.banned ?? 0}
                    subtitle="Currently banned"
                />
                <Card
                    title="Uptime"
                    value={stats ? formatUptime(stats.uptime) : '-'}
                    subtitle="Bot uptime"
                />
                <Card
                    title="Memory Usage"
                    value={stats ? formatMemory(stats.memory?.heapUsed ?? 0) : '-'}
                    subtitle="Heap memory"
                />
            </div>

            <div className="status-section">
                <h3>System Status</h3>
                <div className="status-items">
                    <div className="status-item">
                        <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
                        <span>WebSocket</span>
                        <span className="status-label">{connected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="status-item">
                        <span className="status-dot online"></span>
                        <span>API Server</span>
                        <span className="status-label">Running</span>
                    </div>
                    <div className="status-item">
                        <span className="status-dot online"></span>
                        <span>Database</span>
                        <span className="status-label">Connected</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
