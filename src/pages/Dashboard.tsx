import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';

interface Subscription {
    ticker: string;
    companyName: string;
    earningsDate: string;
    notifyWhen: 'DAY_BEFORE' | 'DAY_OF';
    createdAt: string;
}

export default function Dashboard() {
    const { token, user } = useAuth();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const API_URL = import.meta.env.VITE_SUBSCRIBE_API_URL || 'https://m93v61t8oh.execute-api.us-east-1.amazonaws.com';

    useEffect(() => {
        fetchSubscriptions();
    }, [token]);

    const fetchSubscriptions = async () => {
        if (!token) return;

        try {
            const response = await fetch(`${API_URL}/subscriptions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch subscriptions');

            const data = await response.json();
            setSubscriptions(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUnsubscribe = async (ticker: string) => {
        if (!token) return;

        if (!confirm(`Are you sure you want to stop notifications for ${ticker}?`)) return;

        try {
            const response = await fetch(`${API_URL}/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ticker })
            });

            if (!response.ok) throw new Error('Failed to unsubscribe');

            setSubscriptions(subscriptions.filter(s => s.ticker !== ticker));
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (loading) return <div className={styles.loading}>Loading your dashboard...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Welcome, {user?.email}</h1>
            </header>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.grid}>
                {subscriptions.length === 0 ? (
                    <div className={styles.emptyState}>
                        <h3>No subscriptions yet.</h3>
                        <p>Search for stocks on the home page to start receiving notifications.</p>
                    </div>
                ) : (
                    subscriptions.map(sub => (
                        <div key={sub.ticker} className={styles.card}>
                            <div className={styles.ticker}>{sub.ticker}</div>
                            <div className={styles.name}>{sub.companyName}</div>
                            <div className={styles.info}>
                                Next Earnings: <strong>{new Date(sub.earningsDate).toLocaleDateString()}</strong>
                            </div>
                            <div className={styles.info}>
                                Notify: <strong>{sub.notifyWhen === 'DAY_BEFORE' ? '1 Day Before' : 'Day of'}</strong>
                            </div>
                            <button
                                className={styles.removeBtn}
                                onClick={() => handleUnsubscribe(sub.ticker)}
                            >
                                Unsubscribe
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
