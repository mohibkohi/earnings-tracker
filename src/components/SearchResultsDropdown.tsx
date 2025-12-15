import type { Company } from '../api/mockData';
import styles from './SearchResultsDropdown.module.css';

interface SearchResultsDropdownProps {
    results: Company[];
    onSelect: (company: Company) => void;
    isLoading: boolean;
    isVisible: boolean;
}

export function SearchResultsDropdown({ results, onSelect, isLoading, isVisible }: SearchResultsDropdownProps) {
    if (!isVisible) return null;

    return (
        <div className={styles.dropdown}>
            {isLoading ? (
                <div className={styles.loadingItem}>Searching...</div>
            ) : results.length > 0 ? (
                results.map((company) => (
                    <button
                        key={company.symbol}
                        className={styles.resultItem}
                        onClick={() => onSelect(company)}
                    >
                        <div className={styles.companyInfo}>
                            <span className={styles.symbol}>{company.symbol}</span>
                            <span className={styles.name}>{company.name}</span>
                        </div>
                        <span className={styles.exchange}>{company.exchange}</span>
                    </button>
                ))
            ) : (
                <div className={styles.noResults}>No companies found</div>
            )}
        </div>
    );
}
