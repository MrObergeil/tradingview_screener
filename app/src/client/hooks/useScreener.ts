import { useState, useCallback } from "react";
import { scan, type ScanRequest, type ScanResponse, type Filter, type ScanOptions } from "../lib/client";

interface UseScreenerState {
  data: ScanResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface UseScreenerReturn extends UseScreenerState {
  executeScan: (options: ScanOptions) => Promise<ScanResponse | null>;
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
 * Supports filter-first workflow with optional ticker filtering.
 */
export function useScreener(): UseScreenerReturn {
  const [state, setState] = useState<UseScreenerState>({
    data: null,
    isLoading: false,
    error: null,
  });

  const executeScan = useCallback(
    async (options: ScanOptions): Promise<ScanResponse | null> => {
      const { markets, filters, tickers, columns, limit, offset } = options;

      // Validate at least one filter exists (unless tickers are specified)
      if (filters.length === 0 && (!tickers || tickers.length === 0)) {
        setState((prev) => ({
          ...prev,
          error: "At least one filter is required for market-wide scans",
        }));
        return null;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Build filters array
        const allFilters: Filter[] = [...filters];

        // Add ticker filter if specified
        if (tickers && tickers.length > 0) {
          allFilters.push({
            field: "name",
            op: "in",
            value: tickers,
          });
        }

        const request: ScanRequest = {
          markets,
          columns: columns.length > 0 ? columns : DEFAULT_COLUMNS,
          filters: allFilters,
          limit: limit ?? (tickers?.length ? Math.max(tickers.length, 50) : 100),
          ...(offset !== undefined && { offset }),
        };

        const response = await scan(request);
        setState({ data: response, isLoading: false, error: null });
        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
        return null;
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
    clearError,
    clearData,
  };
}

export { DEFAULT_COLUMNS };
