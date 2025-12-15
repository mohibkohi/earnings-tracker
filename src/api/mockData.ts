export interface Company {
  symbol: string;
  name: string;
  exchange: string;
}

export interface EarningsData {
  symbol: string;
  quarter: string;
  year: number;
  reportDate: string;
  epsEstimated: number;
  epsActual: number;
  revenue?: string; // e.g. "52.7B"
}

export const COMPANIES: Company[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', exchange: 'NASDAQ' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
];

export const EARNINGS_HISTORY: EarningsData[] = [
  // Microsoft
  { symbol: 'MSFT', quarter: 'Q1', year: 2024, reportDate: '2023-10-24', epsEstimated: 2.65, epsActual: 2.99, revenue: '56.5B' },
  { symbol: 'MSFT', quarter: 'Q4', year: 2023, reportDate: '2023-07-25', epsEstimated: 2.55, epsActual: 2.69, revenue: '56.2B' },
  { symbol: 'MSFT', quarter: 'Q3', year: 2023, reportDate: '2023-04-25', epsEstimated: 2.23, epsActual: 2.45, revenue: '52.9B' },
  { symbol: 'MSFT', quarter: 'Q2', year: 2023, reportDate: '2023-01-24', epsEstimated: 2.30, epsActual: 2.32, revenue: '52.7B' },
  
  // Apple
  { symbol: 'AAPL', quarter: 'Q4', year: 2023, reportDate: '2023-11-02', epsEstimated: 1.39, epsActual: 1.46, revenue: '89.5B' },
  { symbol: 'AAPL', quarter: 'Q3', year: 2023, reportDate: '2023-08-03', epsEstimated: 1.19, epsActual: 1.26, revenue: '81.8B' },
  { symbol: 'AAPL', quarter: 'Q2', year: 2023, reportDate: '2023-05-04', epsEstimated: 1.43, epsActual: 1.52, revenue: '94.8B' },
  
  // Google
  { symbol: 'GOOGL', quarter: 'Q3', year: 2023, reportDate: '2023-10-24', epsEstimated: 1.45, epsActual: 1.55, revenue: '76.69B' },
  { symbol: 'GOOGL', quarter: 'Q2', year: 2023, reportDate: '2023-07-25', epsEstimated: 1.34, epsActual: 1.44, revenue: '74.6B' },

  // Tesla
  { symbol: 'TSLA', quarter: 'Q3', year: 2023, reportDate: '2023-10-18', epsEstimated: 0.73, epsActual: 0.66, revenue: '23.35B' },
  { symbol: 'TSLA', quarter: 'Q2', year: 2023, reportDate: '2023-07-19', epsEstimated: 0.82, epsActual: 0.91, revenue: '24.93B' },
];
