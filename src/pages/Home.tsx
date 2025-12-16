import { SearchBar } from '../components/SearchBar';
import { UpcomingEarnings } from '../components/UpcomingEarnings';
import styles from './Home.module.css';

export function Home() {
    return (
        <div className={styles.container}>
            <div className={styles.hero}>
                <h1 className={styles.title}>
                    Track Company <span className={styles.highlight}>Earnings</span>
                </h1>
                <p className={styles.subtitle}>
                    Search for a public company to view their latest quarterly earnings reports, EPS estimates, and revenue data.
                </p>
                <div className={styles.searchWrapper}>
                    <SearchBar />
                </div>
                <UpcomingEarnings />
            </div>
        </div>
    );
}
