import { Link } from 'react-router-dom';
import { UPCOMING_EARNINGS } from '../api/mockData';
import styles from './UpcomingEarnings.module.css';

export function UpcomingEarnings() {
    return (
        <div className={styles.container}>
            <h3 className={styles.title}>🚀 Top Upcoming Earnings</h3>
            <ul className={styles.list}>
                {UPCOMING_EARNINGS.map((item) => (
                    <li key={item.symbol}>
                        <Link
                            to={`/company/${item.symbol}`}
                            state={{ company: { symbol: item.symbol, name: item.name, exchange: 'US' } }}
                            className={styles.item}
                        >
                            <div className={styles.companyInfo}>
                                <span className={styles.symbol}>{item.symbol}</span>
                                <span className={styles.name}>{item.name}</span>
                            </div>
                            <div className={styles.meta}>
                                <span className={styles.date}>
                                    {new Date(item.reportDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                                <span className={styles.estimate}>Est. EPS: ${item.estimate}</span>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
