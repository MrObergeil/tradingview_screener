import { useCallback, useRef, useState } from "react";
import TickerInput from "./components/TickerInput";
import BasicFilters from "./components/BasicFilters";
import { ResultsTable, type StockResult } from "./components/ResultsTable";
import { useScreener } from "./hooks/useScreener";
import type { Filter } from "./lib/client";

export default function App() {
  const { data, isLoading, error, executeScan, setFilters, clearError } = useScreener();

  // Track last scanned tickers for re-scanning with new filters
  const [lastTickers, setLastTickers] = useState<string[]>([]);

  // Track which tickers are actually invalid (don't exist at all)
  const [invalidTickers, setInvalidTickers] = useState<string[]>([]);

  // Ref to track valid tickers (ones that exist) - persists across filter changes
  const validTickersRef = useRef<Set<string>>(new Set());

  // Handle ticker scan - validates which tickers exist (without filters)
  const handleScan = useCallback(
    async (tickers: string[]) => {
      setLastTickers(tickers);
      setInvalidTickers([]);
      validTickersRef.current = new Set();

      // Clear filters for initial validation scan
      setFilters([]);
      const response = await executeScan(tickers);

      // After scan, determine which tickers are valid
      if (response?.results) {
        const foundNames = new Set(
          (response.results as Array<{ name?: string }>).map((r) =>
            r.name?.toUpperCase() ?? ""
          )
        );
        validTickersRef.current = foundNames;

        const notFound = tickers.filter(
          (t) => !foundNames.has(t.toUpperCase())
        );
        setInvalidTickers(notFound);
      }
    },
    [executeScan, setFilters]
  );

  // Handle filter changes - re-scan with filters (don't update invalid tickers)
  const handleFiltersApply = useCallback(
    (filters: Filter[]) => {
      setFilters(filters);
      if (lastTickers.length > 0) {
        void executeScan(lastTickers);
      }
    },
    [setFilters, executeScan, lastTickers]
  );

  // Cast results to StockResult[] for type safety
  const results: StockResult[] = data?.results ?? [];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white py-4 px-6 shadow-md">
        <h1 className="text-2xl font-bold">TV Screener+</h1>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Ticker Input */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Enter Tickers</h2>
          <TickerInput onScan={handleScan} isLoading={isLoading} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <BasicFilters onApply={handleFiltersApply} isLoading={isLoading} />
        </div>

        {/* Error Display */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 font-medium"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Not Found Warning */}
        {invalidTickers.length > 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              <span className="font-medium">Tickers not found: </span>
              {invalidTickers.join(", ")}
            </p>
          </div>
        ) : null}

        {/* Results Display */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">
              {data ? `Results (${data.totalCount} total)` : "Results"}
            </h2>
            {data ? (
              <span className="text-sm text-gray-500">
                Loaded in {data.durationMs}ms
              </span>
            ) : null}
          </div>
          <ResultsTable results={results} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}
