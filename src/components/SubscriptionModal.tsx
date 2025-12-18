import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SubscriptionModal.module.css';
import { subscribeToEarnings } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticker: string;
    companyName: string;
    nextEarningsDate?: string; // We might not know this always, but ideally we do
}

export function SubscriptionModal({ isOpen, onClose, ticker, companyName, nextEarningsDate }: SubscriptionModalProps) {
    const [notifyWhen, setNotifyWhen] = useState<'DAY_BEFORE' | 'DAY_OF'>('DAY_BEFORE');
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const { token, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated) {
            // Save intent to subscribe after login
            const pendingSub = {
                ticker,
                companyName,
                nextEarningsDate,
                notifyWhen
            };
            localStorage.setItem('pending_subscription', JSON.stringify(pendingSub));

            onClose();
            navigate('/login', { state: { message: 'Please log in to subscribe to notifications.' } });
            return;
        }

        const estimatedDate = nextEarningsDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        setStatus('LOADING');
        const success = await subscribeToEarnings({
            email: '', // Not used anymore if token is passed
            ticker,
            companyName,
            earningsDate: estimatedDate,
            notifyWhen
        }, token || undefined);

        if (success) {
            setStatus('SUCCESS');
            setTimeout(() => {
                onClose();
                setStatus('IDLE');
            }, 2000);
        } else {
            setStatus('ERROR');
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                <h3 className={styles.title}>Get Earnings Notifications</h3>
                <p className={styles.subtitle}>
                    Stay updated on <strong>{companyName} ({ticker})</strong> earnings.
                </p>

                {status === 'SUCCESS' ? (
                    <div className={styles.successMessage}>
                        ✅ Subscribed successfully! check your email.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.form}>

                        <div className={styles.field}>
                            <label>Notify me</label>
                            <select
                                value={notifyWhen}
                                onChange={e => setNotifyWhen(e.target.value as any)}
                                className={styles.select}
                            >
                                <option value="DAY_BEFORE">1 Day Before</option>
                                <option value="DAY_OF">Day of Earnings</option>
                            </select>
                        </div>

                        {nextEarningsDate ? (
                            <p className={styles.info}>Next Earnings: {new Date(nextEarningsDate).toLocaleDateString()}</p>
                        ) : (
                            // No manual input, just inform user date is estimated/placeholder if we wanted, 
                            // but user said "only two options is enough", so keeping it clean.
                            <p className={styles.info} style={{ color: '#888' }}>Earnings date to be announced.</p>
                        )}

                        {status === 'ERROR' && <p className={styles.error}>Failed. Check console (API endpoint might be missing).</p>}

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={status === 'LOADING'}
                        >
                            {status === 'LOADING' ? 'Subscribing...' : 'Subscribe'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
