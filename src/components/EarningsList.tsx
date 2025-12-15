import { useState } from 'react';
import type { EarningsData } from '../api/mockData';
import styles from './EarningsList.module.css';

interface EarningsListProps {
    earnings: EarningsData[];
}

export function EarningsList({ earnings }: EarningsListProps) {
    const [visibleCount, setVisibleCount] = useState(5);

    if (earnings.length === 0) {
        return <div className={styles.emptyState}>No earnings history available.</div>;
    }

    const visibleEarnings = earnings.slice(0, visibleCount);
    const hasMore = visibleCount < earnings.length;

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Earnings History</h2>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Quarter</th>
                            <th>Report Date</th>
                            <th>EPS Estimate</th>
                            <th>EPS Actual</th>
                            <th>Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleEarnings.map((item, index) => {
                            const beat = item.epsActual >= item.epsEstimated;
                            return (
                                <tr key={`${item.symbol}-${item.year}-${item.quarter}-${index}`}>
                                    <td className={styles.quarter}>
                                        <span className={styles.qTag}>{item.quarter}</span>
                                        <span className={styles.year}>{item.year}</span>
                                    </td>
                                    <td>{new Date(item.reportDate).toLocaleDateString()}</td>
                                    <td>${item.epsEstimated.toFixed(2)}</td>
                                    <td className={beat ? styles.beat : styles.miss}>
                                        ${item.epsActual.toFixed(2)}
                                    </td>
                                    <td>{item.revenue || '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {hasMore && (
                <div className={styles.footer}>
                    <button
                        className={styles.loadMoreBtn}
                        onClick={() => setVisibleCount(prev => prev + 5)}
                    >
                        Show More
                    </button>
                </div>
            )}
        </div>
    );
}
