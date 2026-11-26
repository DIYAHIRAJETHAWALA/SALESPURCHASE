import React, { useState, useEffect, useRef } from 'react';
import { Search, Store, MapPin, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { searchOutlets } from '../api';
import { OutletSearchResult } from '../types';

interface OutletSearchBarProps {
  onSelectOutlet: (outletId: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'default' | 'large';
}

export const OutletSearchBar: React.FC<OutletSearchBarProps> = ({
  onSelectOutlet,
  placeholder = "Search outlet (e.g. Bandra, Adajan, Nanpura...)",
  autoFocus = false,
  size = 'default'
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OutletSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchOutlets(query);
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter' && results.length > 0) {
        handleSelect(results[0].id);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex].id);
      } else if (results.length > 0) {
        handleSelect(results[0].id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (outletId: number) => {
    setIsOpen(false);
    setQuery('');
    onSelectOutlet(outletId);
  };

  const isLarge = size === 'large';

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={`relative flex items-center bg-white rounded-xl border transition-all ${
        isOpen
          ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg'
          : 'border-slate-300 hover:border-slate-400 shadow-sm'
      }`}>
        <div className={`pl-4 flex items-center pointer-events-none ${isLarge ? 'text-blue-600' : 'text-slate-400'}`}>
          {loading ? (
            <Loader2 className={`animate-spin ${isLarge ? 'w-6 h-6' : 'w-4 h-4'}`} />
          ) : (
            <Search className={isLarge ? 'w-6 h-6' : 'w-4 h-4'} />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={`w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium ${
            isLarge ? 'py-4 px-4 text-base' : 'py-2.5 px-3 text-sm'
          }`}
        />

        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
            className="mr-3 text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-100"
          >
            Clear
          </button>
        )}

        <button
          onClick={() => {
            if (results.length > 0) handleSelect(results[0].id);
          }}
          className={`m-1.5 px-4 font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm flex items-center space-x-1.5 ${
            isLarge ? 'py-2.5 text-sm' : 'py-1.5 text-xs'
          }`}
        >
          <span>Search</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-600">
              {results.length} outlet{results.length !== 1 ? 's' : ''} matched
            </span>
            <span className="text-[11px] text-slate-400">Use ↑↓ arrows to navigate, Enter to select</span>
          </div>

          {results.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <Store className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p>No outlets found matching "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by partial name, code, or alias</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80 text-blue-900' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {item.official_name}
                          </span>
                          {item.code && (
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                              {item.code}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                          {item.city && (
                            <span className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                              {item.city}
                            </span>
                          )}
                          {item.aliases.length > 0 && (
                            <span className="text-[11px] text-slate-400 truncate max-w-xs">
                              Aliases: {item.aliases.slice(0, 3).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        item.match_score >= 90
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.match_score}% match
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
