import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToEarnings } from '../api/client';
import styles from './Auth.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const successMessage = location.state?.message;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const API_URL = import.meta.env.VITE_SUBSCRIBE_API_URL || 'https://m93v61t8oh.execute-api.us-east-1.amazonaws.com';

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            login(data.token, data.user);

            // Check for pending subscription
            const pendingSubStr = localStorage.getItem('pending_subscription');
            if (pendingSubStr) {
                try {
                    const pendingSub = JSON.parse(pendingSubStr);
                    const estimatedDate = pendingSub.nextEarningsDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                    await subscribeToEarnings({
                        email: '',
                        ticker: pendingSub.ticker,
                        companyName: pendingSub.companyName,
                        earningsDate: estimatedDate,
                        notifyWhen: pendingSub.notifyWhen
                    }, data.token);

                    localStorage.removeItem('pending_subscription');
                } catch (err) {
                    console.error('Failed to process pending subscription:', err);
                }
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>🔐 Welcome Back</h1>
            <p className={styles.subtitle}>Log in to manage your notifications.</p>

            {successMessage && <div style={{ color: 'green', marginBottom: '20px' }}>{successMessage}</div>}
            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                    <label>Email Address</label>
                    <input
                        type="email"
                        className={styles.input}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className={styles.field}>
                    <label>Password</label>
                    <input
                        type="password"
                        className={styles.input}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? 'Logging in...' : 'Log In'}
                </button>
            </form>

            <p className={styles.footer}>
                Don't have an account? <Link to="/signup" className={styles.link}>Sign Up</Link>
            </p>
        </div>
    );
}
