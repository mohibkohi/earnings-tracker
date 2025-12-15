import type { Company, EarningsData } from './mockData';

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

export const getCompanyEarnings = async (symbol: string): Promise<EarningsData[]> => {
    try {
        const response = await fetch(`${BASE_URL}?function=EARNINGS&symbol=${symbol}&apikey=${API_KEY}`);
        const data = await response.json();

        if (data.Note || data.Information) {
            console.warn('API Limit hit or info:', data);
            throw new Error(data.Note || data.Information);
        }

        const earnings: AlphaVantageEarnings = data;

        if (!earnings.quarterlyEarnings) return [];

        return earnings.quarterlyEarnings.map(q => {
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
    } catch (error) {
        console.error('Earnings error:', error);
        return [];
    }
};
