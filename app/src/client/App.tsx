import { useCallback, useEffect, useRef, useState } from "react";
import MarketSelector from "./components/MarketSelector";
import FilterBuilder from "./components/FilterBuilder";
import QuickFilters from "./components/QuickFilters";
import TickerInput from "./components/TickerInput";
import ColumnSelector, { DEFAULT_COLUMNS } from "./components/ColumnSelector";
import { ResultsTable, type StockResult } from "./components/ResultsTable";
import Pagination from "./components/Pagination";
import WatchlistPanel from "./components/watchlist/WatchlistPanel";
import ConfigManager from "./components/ConfigManager";
import SettingsPanel from "./components/SettingsPanel";
import ThemeToggle from "./components/ThemeToggle";
import { useScreener } from "./hooks/useScreener";
import { useTheme } from "./hooks/useTheme";
import { getPreference } from "./lib/client";
import type { Filter, ScreenerConfigData } from "./lib/client";

type Tab = "screener" | "watchlists" | "settings";

export default function App() {
  const { data, isLoading, error, executeScan, clearError } = useScreener();
  const { isDark, toggleTheme } = useTheme();

  // Current tab
  const [activeTab, setActiveTab] = useState<Tab>("screener");

  // Market selection (required)
  const [selectedMarket, setSelectedMarket] = useState("america");
  const [markets, setMarkets] = useState<string[]>(["america"]);
  const [exchangeFilter, setExchangeFilter] = useState<string[] | undefined>(undefined);

  // Filters (required - at least one)
  const [currentFilters, setCurrentFilters] = useState<Filter[]>([]);

  // Optional ticker limitation
  const [limitTickers, setLimitTickers] = useState<string[]>([]);
  const [showTickerInput, setShowTickerInput] = useState(false);

  // Track invalid tickers
  const [invalidTickers, setInvalidTickers] = useState<string[]>([]);

  // Track selected columns
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(50);

  // Ref to track valid tickers
  const validTickersRef = useRef<Set<string>>(new Set());

  // Load resultsPerPage preference on mount
  useEffect(() => {
    getPreference("resultsPerPage").then((value) => {
      if (value) {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setResultsPerPage(parsed);
        }
      }
    });
  }, []);

  // Check if scan can be executed (market selected + at least one filter)
  const canScan = currentFilters.length > 0 || limitTickers.length > 0;

  // Build filters including exchange filter if set (memoized to avoid recreation)
  const buildFiltersWithExchange = useCallback(
    (baseFilters: Filter[]): Filter[] => {
      if (!exchangeFilter) return baseFilters;
      return [...baseFilters, { field: "exchange", op: "in" as const, value: exchangeFilter }];
    },
    [exchangeFilter]
  );

  // Helper to check which tickers were found in results
  const checkFoundTickers = useCallback(
    (results: Array<{ name?: string }>, tickersToCheck: string[]): string[] => {
      const foundNames = new Set(
        results.map((r) => r.name?.toUpperCase() ?? "")
      );
      validTickersRef.current = foundNames;
      return tickersToCheck.filter((t) => !foundNames.has(t.toUpperCase()));
    },
    []
  );

  // Handle market change
  const handleMarketChange = useCallback((market: string, newMarkets: string[], newExchangeFilter?: string[]) => {
    setSelectedMarket(market);
    setMarkets(newMarkets);
    setExchangeFilter(newExchangeFilter);
    setCurrentPage(1); // Reset to first page
  }, []);

  // Handle filter changes from FilterBuilder
  const handleFiltersChange = useCallback((filters: Filter[]) => {
    setCurrentFilters(filters);
    setCurrentPage(1); // Reset to first page
  }, []);

  // Handle applying quick filter presets
  const handleApplyQuickFilter = useCallback((presetFilters: Filter[]) => {
    // Merge preset filters with existing filters, avoiding duplicates by field
    const existingFields = new Set(currentFilters.map((f) => f.field));
    const newFilters = presetFilters.filter((f) => !existingFields.has(f.field));
    const mergedFilters = [...currentFilters, ...newFilters];
    setCurrentFilters(mergedFilters);
  }, [currentFilters]);


  // Handle scan execution
  const handleScan = useCallback(async (page = currentPage) => {
    if (!canScan) return;

    setInvalidTickers([]);
    validTickersRef.current = new Set();

    const offset = (page - 1) * resultsPerPage;

    const scanOptions = {
      markets,
      filters: buildFiltersWithExchange(currentFilters),
      columns: selectedColumns,
      limit: resultsPerPage,
      ...(offset > 0 && { offset }),
      ...(limitTickers.length > 0 && { tickers: limitTickers }),
    };

    const response = await executeScan(scanOptions);

    // If scan failed due to invalid range (offset too high), reset to page 1 and retry
    if (!response && page > 1) {
      setCurrentPage(1);
      clearError();
      const retryOptions = {
        markets,
        filters: buildFiltersWithExchange(currentFilters),
        columns: selectedColumns,
        limit: resultsPerPage,
        ...(limitTickers.length > 0 && { tickers: limitTickers }),
      };
      const retryResponse = await executeScan(retryOptions);
      if (retryResponse?.results && limitTickers.length > 0) {
        const notFound = checkFoundTickers(
          retryResponse.results as Array<{ name?: string }>,
          limitTickers
        );
        setInvalidTickers(notFound);
      }
      return;
    }

    // If we had tickers specified, check which ones were found
    if (response?.results && limitTickers.length > 0) {
      const notFound = checkFoundTickers(
        response.results as Array<{ name?: string }>,
        limitTickers
      );
      setInvalidTickers(notFound);
    }
  }, [canScan, executeScan, clearError, markets, currentFilters, limitTickers, selectedColumns, resultsPerPage, currentPage, buildFiltersWithExchange, checkFoundTickers]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    handleScan(page);
  }, [handleScan]);

  // Handle ticker input for limiting results
  const handleTickerLimitChange = useCallback((tickers: string[]) => {
    setLimitTickers(tickers);
    setCurrentPage(1); // Reset to first page
  }, []);

  // Clear ticker limitation
  const handleClearTickers = useCallback(() => {
    setLimitTickers([]);
    setInvalidTickers([]);
    setShowTickerInput(false);
  }, []);

  // Handle loading a saved config
  const handleLoadConfig = useCallback(
    (config: ScreenerConfigData) => {
      // Update columns
      setSelectedColumns(config.columns);

      // Update filters
      setCurrentFilters(config.filters);
    },
    []
  );

  // Handle column changes
  const handleColumnsChange = useCallback((columns: string[]) => {
    setSelectedColumns(columns);
  }, []);

  // Handle scanning tickers from watchlist
  const handleScanFromWatchlist = useCallback(
    async (tickers: string[]) => {
      setActiveTab("screener");
      setLimitTickers(tickers);
      setShowTickerInput(true);
      setCurrentPage(1); // Reset to first page

      // If we have filters, scan immediately
      if (currentFilters.length > 0) {
        setInvalidTickers([]);
        validTickersRef.current = new Set();

        const response = await executeScan({
          markets,
          filters: buildFiltersWithExchange(currentFilters),
          tickers,
          columns: selectedColumns,
          limit: resultsPerPage,
          offset: 0,
        });

        if (response?.results) {
          const notFound = checkFoundTickers(
            response.results as Array<{ name?: string }>,
            tickers
          );
          setInvalidTickers(notFound);
        }
      }
    },
    [currentFilters, markets, selectedColumns, resultsPerPage, executeScan, buildFiltersWithExchange, checkFoundTickers]
  );

  // Cast results to StockResult[] for type safety
  const results: StockResult[] = data?.results ?? [];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      <header className="bg-blue-600 dark:bg-gray-800 text-white py-4 px-6 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">TV Screener+</h1>
          {/* Tab Navigation */}
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab("screener")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === "screener"
                  ? "bg-white text-blue-600 dark:bg-gray-700 dark:text-white"
                  : "text-blue-100 hover:bg-blue-500 dark:hover:bg-gray-700"
              }`}
            >
              Screener
            </button>
            <button
              onClick={() => setActiveTab("watchlists")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === "watchlists"
                  ? "bg-white text-blue-600 dark:bg-gray-700 dark:text-white"
                  : "text-blue-100 hover:bg-blue-500 dark:hover:bg-gray-700"
              }`}
            >
              Watchlists
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === "settings"
                  ? "bg-white text-blue-600 dark:bg-gray-700 dark:text-white"
                  : "text-blue-100 hover:bg-blue-500 dark:hover:bg-gray-700"
              }`}
            >
              Settings
            </button>
          </nav>
          {/* Theme Toggle */}
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6">
        {activeTab === "screener" ? (
          <>
            {/* Filters (Required) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold dark:text-white">
                  Filters <span className="text-sm font-normal text-gray-500 dark:text-gray-300">(required)</span>
                </h2>
                <ConfigManager
                  currentColumns={selectedColumns}
                  currentFilters={currentFilters}
                  onLoadConfig={handleLoadConfig}
                />
              </div>

              {/* Market selector inline */}
              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <MarketSelector
                  selectedMarket={selectedMarket}
                  onMarketChange={handleMarketChange}
                  disabled={isLoading}
                />
              </div>

              {/* Filter builder */}
              <FilterBuilder
                filters={currentFilters}
                onFiltersChange={handleFiltersChange}
                isLoading={isLoading}
              />

              {/* Quick filter presets */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <QuickFilters
                  onApplyPreset={handleApplyQuickFilter}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Optional Ticker Limitation */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold dark:text-white">
                  Limit to Tickers <span className="text-sm font-normal text-gray-500 dark:text-gray-300">(optional)</span>
                </h2>
                {showTickerInput && limitTickers.length > 0 && (
                  <button
                    onClick={handleClearTickers}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {showTickerInput ? (
                <div className="space-y-2">
                  <TickerInput
                    onScan={handleTickerLimitChange}
                    isLoading={isLoading}
                    submitLabel="Set Tickers"
                    initialTickers={limitTickers}
                  />
                  {limitTickers.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Results will be limited to: {limitTickers.join(", ")}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowTickerInput(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  + Add ticker filter
                </button>
              )}
            </div>

            {/* Column Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">Columns</h2>
              <ColumnSelector
                selectedColumns={selectedColumns}
                onColumnsChange={handleColumnsChange}
              />
            </div>

            {/* Scan Button */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <button
                onClick={() => handleScan()}
                disabled={!canScan || isLoading}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Scanning..." : "Scan Market"}
              </button>
              {!canScan && (
                <p className="text-sm text-gray-500 dark:text-gray-300 mt-2 text-center">
                  Add at least one filter or specify tickers to enable scanning
                </p>
              )}
            </div>

            {/* Error Display */}
            {error ? (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between">
                <p className="text-red-700 dark:text-red-400">{error}</p>
                <button
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {/* Not Found Warning */}
            {invalidTickers.length > 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-400">
                  <span className="font-medium">Tickers not found: </span>
                  {invalidTickers.join(", ")}
                </p>
              </div>
            ) : null}

            {/* Results Display */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold dark:text-white">
                  {data ? `Results (${data.totalCount} total)` : "Results"}
                </h2>
                {data ? (
                  <span className="text-sm text-gray-500 dark:text-gray-300">
                    Loaded in {data.durationMs}ms
                  </span>
                ) : null}
              </div>
              <ResultsTable
                results={results}
                isLoading={isLoading}
                columns={selectedColumns}
                onColumnsChange={handleColumnsChange}
              />
              {data && data.totalCount > resultsPerPage && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={data.totalCount}
                  itemsPerPage={resultsPerPage}
                  onPageChange={handlePageChange}
                  isLoading={isLoading}
                />
              )}
            </div>
          </>
        ) : activeTab === "watchlists" ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <WatchlistPanel onScanTickers={handleScanFromWatchlist} />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <SettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
}
