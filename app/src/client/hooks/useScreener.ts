import { useState, useCallback, useRef } from "react";
import { scan, type ScanRequest, type ScanResponse, type Filter } from "../api/client";

interface UseScreenerState {
  data: ScanResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface UseScreenerReturn extends UseScreenerState {
  executeScan: (tickers: string[], columns?: string[], additionalFilters?: Filter[]) => Promise<void>;
  setFilters: (filters: Filter[]) => void;
  clearError: () => void;
  clearData: () => void;
}

/** Default columns to fetch */
const DEFAULT_COLUMNS = [
  "name",
  "close",
  "change",
  "change_abs",
  "volume",
  "market_cap_basic",
];

/**
 * Hook for executing screener scans.
 */
export function useScreener(): UseScreenerReturn {
  const [state, setState] = useState<UseScreenerState>({
    data: null,
    isLoading: false,
    error: null,
  });

  // Store filters in a ref to avoid re-creating executeScan
  const filtersRef = useRef<Filter[]>([]);

  const setFilters = useCallback((filters: Filter[]) => {
    filtersRef.current = filters;
  }, []);

  const executeScan = useCallback(
    async (
      tickers: string[],
      columns: string[] = DEFAULT_COLUMNS,
      additionalFilters: Filter[] = []
    ) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Combine ticker filter with stored filters and additional filters
        const allFilters: Filter[] = [
          {
            field: "name",
            op: "in",
            value: tickers.map((t) => `NASDAQ:${t}`),
          },
          ...filtersRef.current,
          ...additionalFilters,
        ];

        const request: ScanRequest = {
          columns,
          filters: allFilters,
          limit: Math.max(tickers.length, 50), // Allow more results with filters
        };

        const response = await scan(request);
        setState({ data: response, isLoading: false, error: null });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearData = useCallback(() => {
    setState((prev) => ({ ...prev, data: null }));
  }, []);

  return {
    ...state,
    executeScan,
    setFilters,
    clearError,
    clearData,
  };
}
