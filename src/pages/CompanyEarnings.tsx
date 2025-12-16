import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import type { EarningsData } from '../api/mockData';
import { COMPANIES, UPCOMING_EARNINGS } from '../api/mockData';
import { getCompanyEarnings } from '../api/client';
import { EarningsList } from '../components/EarningsList';
import { SubscriptionModal } from '../components/SubscriptionModal';
import styles from './CompanyEarnings.module.css';

export function CompanyEarnings() {
    const { symbol } = useParams<{ symbol: string }>();
    const location = useLocation();
    const [earnings, setEarnings] = useState<EarningsData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [error, setError] = useState<string | null>(null);

    // Prefer passed state, then fallback to mock lookup, then generic fallback
    const company = location.state?.company ||
        COMPANIES.find(c => c.symbol === symbol) ||
        (symbol ? { symbol, name: symbol, exchange: 'US' } : null);

    // Try to find next earnings date from mock UPCOMING or infer from history (risky but okay for MVP)
    // In a real app we'd query the 'Global Quote' or a specific 'Calendar' endpoint.
    const upcomingMatch = UPCOMING_EARNINGS.find(u => u.symbol === symbol);
    // If we have a match in upcoming, use it. Else, we might not know.
    const nextEarningsDate = upcomingMatch?.reportDate || undefined;

    useEffect(() => {
        if (!symbol) return;

        setIsLoading(true);
        setError(null);
        getCompanyEarnings(symbol)
            .then(data => setEarnings(data))
            .catch(err => {
                console.warn(err);
                setError(err.message || 'Failed to load earnings');
            })
            .finally(() => setIsLoading(false));
    }, [symbol]);

    if (!company) {
        return (
            <div className={styles.notFound}>
                <h2>Company Not Found</h2>
                <p>We couldn't find a company with the ticker symbol "{symbol}".</p>
                <Link to="/" className={styles.backLink}>Back to Search</Link>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Link to="/" className={styles.backLink}>← Back to Search</Link>

            <div className={styles.header}>
                <div>
                    <h1 className={styles.companyName}>{company.name}</h1>
                    <div className={styles.meta}>
                        <span className={styles.symbol}>{company.symbol}</span>
                        <span className={styles.exchange}>{company.exchange}</span>
                    </div>
                </div>
                {/* Only show button if we have a date or want to allow loose subs */}
                <button
                    className={styles.subscribeBtn}
                    onClick={() => setIsModalOpen(true)}
                >
                    🔔 Get Notified
                </button>
            </div>

            {isLoading ? (
                <div className={styles.loading}>Loading earnings data...</div>
            ) : error ? (
                <div className={styles.loading} style={{ color: '#ff4444' }}>
                    ⚠️ {error}
                </div>
            ) : (
                <EarningsList earnings={earnings} />
            )}

            <SubscriptionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                ticker={company.symbol}
                companyName={company.name}
                nextEarningsDate={nextEarningsDate} // might be undefined
            />
        </div>
    );
}
