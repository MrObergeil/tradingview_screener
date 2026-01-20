import { memo, useMemo, useState, useCallback } from "react";

/** Stock result row from the API */
export interface StockResult {
  name?: string;
  close?: number | null;
  change?: number | null;
  change_abs?: number | null;
  volume?: number | null;
  market_cap_basic?: number | null;
  [key: string]: unknown;
}

interface ResultsTableProps {
  results: StockResult[];
  isLoading?: boolean;
}

/** Sort direction */
type SortDirection = "asc" | "desc";

/** Sort state */
interface SortState {
  column: string | null;
  direction: SortDirection;
}

/** Column definition for the table */
interface Column {
  key: string;
  label: string;
  align: "left" | "right";
  format: (value: unknown) => string;
  colorFn?: (value: unknown) => string;
  sortable?: boolean;
}

/** Default columns to display */
const DEFAULT_COLUMNS: Column[] = [
  {
    key: "name",
    label: "Ticker",
    align: "left",
    format: (v) => String(v ?? "-"),
    sortable: true,
  },
  {
    key: "close",
    label: "Price",
    align: "right",
    format: formatPrice,
    sortable: true,
  },
  {
    key: "change",
    label: "Change %",
    align: "right",
    format: formatPercent,
    colorFn: getChangeColor,
    sortable: true,
  },
  {
    key: "change_abs",
    label: "Change",
    align: "right",
    format: formatPriceChange,
    colorFn: getChangeColor,
    sortable: true,
  },
  {
    key: "volume",
    label: "Volume",
    align: "right",
    format: formatVolume,
    sortable: true,
  },
  {
    key: "market_cap_basic",
    label: "Market Cap",
    align: "right",
    format: formatMarketCap,
    sortable: true,
  },
];

/**
 * Results table component for displaying stock scan results.
 * Memoized to prevent unnecessary re-renders.
 */
function ResultsTableComponent({ results, isLoading = false }: ResultsTableProps) {
  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: "desc",
  });

  // Memoize column definitions (static)
  const columns = useMemo(() => DEFAULT_COLUMNS, []);

  // Handle column header click for sorting
  const handleSort = useCallback((columnKey: string) => {
    setSortState((prev) => {
      if (prev.column === columnKey) {
        // Toggle direction if same column
        return {
          column: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      // New column, default to descending
      return { column: columnKey, direction: "desc" };
    });
  }, []);

  // Sort results using toSorted for immutability (per react-best-practices)
  const sortedResults = useMemo(() => {
    if (!sortState.column) return results;

    const col = sortState.column;
    const dir = sortState.direction === "asc" ? 1 : -1;

    return results.toSorted((a, b) => {
      const aVal = a[col];
      const bVal = b[col];

      // Handle nulls - push to end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare based on type
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * dir;
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir;
      }

      return 0;
    });
  }, [results, sortState.column, sortState.direction]);

  // Empty state
  if (!isLoading && results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <p className="text-lg font-medium">No results</p>
        <p className="text-sm mt-1">Enter tickers above and click Scan to see results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => {
              const isSorted = sortState.column === col.key;
              const canSort = col.sortable !== false;

              return (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${canSort ? "cursor-pointer hover:bg-gray-100 select-none" : ""}`}
                  onClick={canSort ? () => handleSort(col.key) : undefined}
                  aria-sort={isSorted ? (sortState.direction === "asc" ? "ascending" : "descending") : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.align === "right" && isSorted ? (
                      <SortIndicator direction={sortState.direction} />
                    ) : null}
                    {col.label}
                    {col.align === "left" && isSorted ? (
                      <SortIndicator direction={sortState.direction} />
                    ) : null}
                    {canSort && !isSorted ? (
                      <span className="text-gray-300 ml-1">⇅</span>
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sortedResults.map((result, index) => (
            <tr
              key={result.name ?? index}
              className="hover:bg-gray-50 transition-colors"
            >
              {columns.map((col) => {
                const value = result[col.key];
                const colorClass = col.colorFn ? col.colorFn(value) : "";
                return (
                  <td
                    key={col.key}
                    className={`px-4 py-3 whitespace-nowrap text-sm ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${col.key === "name" ? "font-medium text-gray-900" : "text-gray-700"} ${colorClass}`}
                  >
                    {col.format(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Memoize the component to prevent re-renders when parent state changes
export const ResultsTable = memo(ResultsTableComponent);

/** Sort direction indicator */
function SortIndicator({ direction }: { direction: SortDirection }) {
  return (
    <span className="text-blue-600 font-bold">
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

// ============ Formatting Utilities ============

function formatPrice(value: unknown): string {
  if (value == null || typeof value !== "number") return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPriceChange(value: unknown): string {
  if (value == null || typeof value !== "number") return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: unknown): string {
  if (value == null || typeof value !== "number") return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatVolume(value: unknown): string {
  if (value == null || typeof value !== "number") return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString();
}

function formatMarketCap(value: unknown): string {
  if (value == null || typeof value !== "number") return "-";
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function getChangeColor(value: unknown): string {
  if (value == null || typeof value !== "number") return "text-gray-500";
  if (value > 0) return "text-green-600 font-medium";
  if (value < 0) return "text-red-600 font-medium";
  return "text-gray-500";
}
