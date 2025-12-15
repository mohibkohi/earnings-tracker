import { useState, useEffect, useRef } from 'react';
import type { Company } from '../api/mockData';
import { searchCompanies } from '../api/client';
import { SearchResultsDropdown } from './SearchResultsDropdown';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css';

export function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.length < 1) {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                const data = await searchCompanies(query);
                setResults(data);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchResults, 800);
        return () => clearTimeout(timeoutId);
    }, [query]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (company: Company) => {
        setIsOpen(false);
        setQuery(''); // Clear search on select? Or keep it? Let's clear for now.
        navigate(`/company/${company.symbol}`, { state: { company } });
    };

    return (
        <div className="search-container" ref={wrapperRef}>
            <div className="input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search for a company (e.g. MSFT, Apple)..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>

            <SearchResultsDropdown
                results={results}
                onSelect={handleSelect}
                isLoading={isLoading}
                isVisible={isOpen && query.length > 0}
            />
        </div>
    );
}
