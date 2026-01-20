import { useState, useCallback } from "react";
import { scan, type ScanRequest, type ScanResponse } from "../api/client";

interface UseScreenerState {
  data: ScanResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface UseScreenerReturn extends UseScreenerState {
  executeScan: (tickers: string[], columns?: string[]) => Promise<void>;
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

  const executeScan = useCallback(
    async (tickers: string[], columns: string[] = DEFAULT_COLUMNS) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Build request with ticker filter
        const request: ScanRequest = {
          columns,
          filters: [
            {
              field: "name",
              op: "in",
              value: tickers.map((t) => `NASDAQ:${t}`),
            },
          ],
          limit: tickers.length,
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
    clearError,
    clearData,
  };
}
