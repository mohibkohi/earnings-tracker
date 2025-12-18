import { EARNINGS_HISTORY, type Company, type EarningsData } from './mockData';

const API_KEY = import.meta.env.VITE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

interface AlphaVantageSearchMatch {
    '1. symbol': string;
    '2. name': string;
    '3. type': string;
    '4. region': string;
    '8. currency': string;
}

interface AlphaVantageEarnings {
    symbol: string;
    quarterlyEarnings: Array<{
        fiscalDateEnding: string;
        reportedDate: string;
        reportedEPS: string;
        estimatedEPS: string;
        surprise: string;
        surprisePercentage: string;
    }>;
}

export const searchCompanies = async (query: string): Promise<Company[]> => {
    if (!query) return [];

    try {
        const response = await fetch(`${BASE_URL}?function=SYMBOL_SEARCH&keywords=${query}&apikey=${API_KEY}`);
        const data = await response.json();

        // Check for API limit or error
        if (data.Note || data.Information) {
            console.warn('API Limit hit or info:', data);
            return [];
        }

        // Alpha Vantage returns 'bestMatches'
        const matches: AlphaVantageSearchMatch[] = data.bestMatches || [];

        return matches
            .filter(match => match['4. region'] === 'United States') // Filter for US stocks for simplicity
            .map(match => ({
                symbol: match['1. symbol'],
                name: match['2. name'],
                exchange: 'US' // API doesn't always give simple exchange code, simplified.
            }));
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const getCompanyEarnings = async (symbol: string): Promise<EarningsData[]> => {
    // Check Cache
    const cacheKey = `earnings_${symbol.toUpperCase()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                console.log(`Using cached earnings for ${symbol}`);
                return data;
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    try {
        const response = await fetch(`${BASE_URL}?function=EARNINGS&symbol=${symbol}&apikey=${API_KEY}`);
        const data = await response.json();

        if (data.Note || data.Information) {
            console.warn('API Limit hit or info:', data);
            throw new Error(data.Note || data.Information);
        }

        const earnings: AlphaVantageEarnings = data;

        if (!earnings.quarterlyEarnings) return [];

        const formattedEarnings = earnings.quarterlyEarnings.map(q => {
            const date = new Date(q.fiscalDateEnding);
            const quarter = Math.floor((date.getMonth() + 3) / 3);

            return {
                symbol: symbol,
                quarter: `Q${quarter}`,
                year: date.getFullYear(),
                reportDate: q.reportedDate,
                epsEstimated: parseFloat(q.estimatedEPS) || 0,
                epsActual: parseFloat(q.reportedEPS) || 0,
                revenue: '-'
            };
        });

        // Save to Cache
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: formattedEarnings
            }));
        } catch (e) {
            console.warn('Failed to save to local storage', e);
        }

        return formattedEarnings;
    } catch (error) {
        console.error('Earnings error:', error);

        // Fallback to Mock Data
        const mockData = EARNINGS_HISTORY.filter(e => e.symbol === symbol);
        if (mockData.length > 0) {
            console.log(`Falling back to mock data for ${symbol}`);
            return mockData;
        }

        throw error;
    }
};

export interface SubscriptionRequest {
    email: string;
    ticker: string;
    companyName: string;
    earningsDate: string; // YYYY-MM-DD
    notifyWhen: 'DAY_BEFORE' | 'DAY_OF';
}

export const subscribeToEarnings = async (request: SubscriptionRequest): Promise<boolean> => {
    const API_ENDPOINT = import.meta.env.VITE_SUBSCRIBE_API_URL || 'https://m93v61t8oh.execute-api.us-east-1.amazonaws.com';
    console.log('Using API endpoint:', API_ENDPOINT);

    try {
        const response = await fetch(`${API_ENDPOINT}/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Subscription failed', err);
            return false;
        }

        console.log('Subscription successful');
        return true;
    } catch (error) {
        console.error('Subscription error:', error);
        return false;
    }
};
