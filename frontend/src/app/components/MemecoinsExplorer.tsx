'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaChartLine, FaRegStar, FaStar, FaInfoCircle, FaSpinner } from 'react-icons/fa';
import Image from 'next/image';
import { fetchTokenData, fetchTokenAIAnalysis, FormattedMemecoin } from '../services/TokenData';

export default function MemecoinsExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('trending');
  const [memecoins, setMemecoins] = useState<FormattedMemecoin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    async function loadHelixData() {
      try {
        setIsLoading(true);
        const data = await fetchTokenData();
        // Fetch AI analysis (risk & potential) and merge into memecoins
        const aiAnalysis = await fetchTokenAIAnalysis();
        const dataWithAI = data.map(coin => {
          const ai = aiAnalysis.find(a => a.id === coin.id);
          return ai ? { ...coin, risk: ai.risk, potential: ai.potential } : coin;
        });
        setMemecoins(dataWithAI);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch helix data:', err);
        setError('Failed to load memecoin data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    loadHelixData();
    intervalId = setInterval(loadHelixData, 60000); // Refresh every 1 minute
    return () => clearInterval(intervalId);
  }, []);

  const toggleFavorite = (id: number) => {
    setMemecoins(prevCoins => 
      prevCoins.map(coin => 
        coin.id === id ? { ...coin, favorite: !coin.favorite } : coin
      )
    );
  };

  const filteredCoins = memecoins.filter(coin => 
    coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedCoins = activeTab === 'trending' 
    ? filteredCoins.sort((a, b) => b.potential - a.potential)
    : activeTab === 'favorites' 
    ? filteredCoins.filter(coin => coin.favorite)
    : activeTab === 'safe' 
    ? filteredCoins.sort((a, b) => a.risk - b.risk)
    : filteredCoins;

  // Sort by age (newest to oldest) for all tabs
  const parseAge = (ageStr: string) => {
    // Example: '2m', '1h', '3d', '5s', '8mo', '1y'
    if (!ageStr) return Number.MAX_SAFE_INTEGER;
    const match = ageStr.match(/(\d+)(mo|[smhdy])/); // 'mo' before 'm'!
    if (!match) return Number.MAX_SAFE_INTEGER;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      case 'mo': return value * 2592000; // 1 month = 30 days
      case 'y': return value * 31536000; // 1 year = 365 days
      default: return Number.MAX_SAFE_INTEGER;
    }
  };
  // Always sort by age (newest first), except for 'safe' tab which sorts by risk
  let sortedCoins: FormattedMemecoin[];
  if (activeTab === 'safe') {
    // Sort by risk ASC (safest first), then by age (newest first)
    sortedCoins = displayedCoins.slice().sort((a, b) => {
      if (a.risk !== b.risk) return a.risk - b.risk;
      return parseAge(a.age) - parseAge(b.age);
    });
  } else {
    // Default: sort by age (newest first)
    sortedCoins = displayedCoins.slice().sort((a, b) => parseAge(a.age) - parseAge(b.age));
  }

  // Create a helper function for opening links
  const openHelixLink = useCallback((url: string) => {
    if (!url) {
      console.error("Attempted to open empty URL");
      return;
    }
    
    console.log("Opening Helix link:", url);
    
    try {
      // Simple direct window open approach
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error("Error opening link:", error);
    }
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-trendpup-primary to-trendpup-accent text-white">
        <h2 className="text-2xl font-semibold">Memecoin Explorer</h2>
        <p className="text-sm opacity-90 mt-1">Discover trending memecoins with AI intelligence</p>
      </div>
      
      <div className="p-4">
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Search coins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-4 pl-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-trendpup-primary focus:border-transparent bg-gray-50 transition-all duration-200"
          />
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        
        <div className="flex mb-6 bg-gray-50 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-3 font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'trending' 
                ? 'bg-white text-trendpup-primary shadow-sm' 
                : 'text-gray-600 hover:text-trendpup-primary'
            }`}
          >
            Trending
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-3 font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'favorites' 
                ? 'bg-white text-trendpup-primary shadow-sm' 
                : 'text-gray-600 hover:text-trendpup-primary'
            }`}
          >
            Favorites
          </button>
          <button
            onClick={() => setActiveTab('safe')}
            className={`px-4 py-3 font-medium rounded-lg transition-all duration-200 ${
              activeTab === 'safe' 
                ? 'bg-white text-trendpup-primary shadow-sm' 
                : 'text-gray-600 hover:text-trendpup-primary'
            }`}
          >
            Safest
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <FaSpinner className="animate-spin text-trendpup-primary text-2xl" />
            <span className="ml-3 text-gray-600">Loading memecoin data...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-trendpup-error">
            <FaInfoCircle className="text-3xl mb-3 inline-block" />
            <p className="text-lg">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Symbol</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Volume</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Market Cap</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">24h Change</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Potential</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Risk</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Favorite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedCoins.length > 0 ? (
                  sortedCoins.map((coin) => (
                    <tr key={coin.id} className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                      onClick={() => openHelixLink(coin.href)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{coin.symbol}{coin.symbol1 ? `/${coin.symbol1}` : ''}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">${coin.price.toFixed(coin.price < 0.001 ? 8 : 6)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">{coin.volume}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">{coin.marketCap}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${coin.change24h >= 0 ? 'text-trendpup-success' : 'text-trendpup-error'}`}>{coin.change24h >= 0 ? '+' : ''}{coin.change24h}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">{coin.age}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-trendpup-primary/10 text-trendpup-primary">
                          {coin.potential}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-trendpup-warning/10 text-trendpup-warning">
                          {coin.risk}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavorite(coin.id);
                          }}
                          className="text-lg transition-colors duration-200"
                        >
                          {coin.favorite ? 
                            <FaStar className="text-trendpup-warning" /> : 
                            <FaRegStar className="text-gray-400 hover:text-trendpup-warning" />
                          }
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      No memecoins found matching your search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}