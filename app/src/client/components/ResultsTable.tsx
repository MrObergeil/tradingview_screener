import { memo, useMemo, useState, useCallback, useRef, type DragEvent, type MouseEvent } from "react";

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
  columns?: string[];
  onColumnsChange?: (columns: string[]) => void;
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

/** Column configuration map - defines how each column is displayed */
const COLUMN_CONFIG: Record<string, Omit<Column, "key">> = {
  // Basic info
  name: { label: "Ticker", align: "left", format: (v) => String(v ?? "-"), sortable: true },
  description: { label: "Name", align: "left", format: (v) => String(v ?? "-"), sortable: true },
  sector: { label: "Sector", align: "left", format: (v) => String(v ?? "-"), sortable: true },
  industry: { label: "Industry", align: "left", format: (v) => String(v ?? "-"), sortable: true },
  exchange: { label: "Exchange", align: "left", format: (v) => String(v ?? "-"), sortable: true },
  type: { label: "Type", align: "left", format: (v) => String(v ?? "-"), sortable: true },

  // Price
  close: { label: "Price", align: "right", format: formatPrice, sortable: true },
  open: { label: "Open", align: "right", format: formatPrice, sortable: true },
  high: { label: "High", align: "right", format: formatPrice, sortable: true },
  low: { label: "Low", align: "right", format: formatPrice, sortable: true },
  change: { label: "Change %", align: "right", format: formatPercent, colorFn: getChangeColor, sortable: true },
  change_abs: { label: "Change", align: "right", format: formatPriceChange, colorFn: getChangeColor, sortable: true },

  // Volume
  volume: { label: "Volume", align: "right", format: formatVolume, sortable: true },
  relative_volume_10d_calc: { label: "Rel Vol", align: "right", format: formatNumber, sortable: true },
  average_volume_10d_calc: { label: "Avg Vol", align: "right", format: formatVolume, sortable: true },

  // Fundamental
  market_cap_basic: { label: "Mkt Cap", align: "right", format: formatMarketCap, sortable: true },
  price_earnings_ttm: { label: "P/E", align: "right", format: formatNumber, sortable: true },
  earnings_per_share_basic_ttm: { label: "EPS", align: "right", format: formatPrice, sortable: true },
  dividend_yield_recent: { label: "Div Yield", align: "right", format: formatPercent, sortable: true },
  beta_1_year: { label: "Beta", align: "right", format: formatNumber, sortable: true },

  // Technical
  RSI: { label: "RSI", align: "right", format: formatNumber, sortable: true },
  RSI7: { label: "RSI7", align: "right", format: formatNumber, sortable: true },
  "MACD.macd": { label: "MACD", align: "right", format: formatNumber, sortable: true },
  "Stoch.K": { label: "Stoch", align: "right", format: formatNumber, sortable: true },
  ATR: { label: "ATR", align: "right", format: formatNumber, sortable: true },
  "Volatility.D": { label: "Vol", align: "right", format: formatPercent, sortable: true },

  // Moving Averages
  SMA20: { label: "SMA20", align: "right", format: formatPrice, sortable: true },
  SMA50: { label: "SMA50", align: "right", format: formatPrice, sortable: true },
  SMA200: { label: "SMA200", align: "right", format: formatPrice, sortable: true },
  EMA20: { label: "EMA20", align: "right", format: formatPrice, sortable: true },
  EMA50: { label: "EMA50", align: "right", format: formatPrice, sortable: true },

  // Performance
  "Perf.W": { label: "1W", align: "right", format: formatPercent, colorFn: getChangeColor, sortable: true },
  "Perf.1M": { label: "1M", align: "right", format: formatPercent, colorFn: getChangeColor, sortable: true },
  "Perf.3M": { label: "3M", align: "right", format: formatPercent, colorFn: getChangeColor, sortable: true },
  "Perf.6M": { label: "6M", align: "right", format: formatPercent, colorFn: getChangeColor, sortable: true },
  "Perf.Y": { label: "1Y", align: "right", format: formatPercent, colorFn: getChangeColor, sortable: true },
};

/** Default fallback for unknown columns */
const DEFAULT_COLUMN_CONFIG: Omit<Column, "key"> = {
  label: "",
  align: "right",
  format: (v) => String(v ?? "-"),
  sortable: true,
};

/** Build column definitions from column names */
function buildColumns(columnNames: string[]): Column[] {
  return columnNames.map((key) => {
    const config = COLUMN_CONFIG[key] ?? { ...DEFAULT_COLUMN_CONFIG, label: key };
    return { key, ...config };
  });
}

/** Default column keys */
const DEFAULT_COLUMN_KEYS = ["name", "close", "change", "change_abs", "volume", "market_cap_basic"];

/** Minimum column width in pixels */
const MIN_COLUMN_WIDTH = 60;

/** Default column width in pixels */
const DEFAULT_COLUMN_WIDTH = 120;

/**
 * Results table component for displaying stock scan results.
 * Memoized to prevent unnecessary re-renders.
 */
function ResultsTableComponent({
  results,
  isLoading = false,
  columns: columnNames = DEFAULT_COLUMN_KEYS,
  onColumnsChange,
}: ResultsTableProps) {
  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: "desc",
  });

  // Drag state for column reordering
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Resize state
  const resizeRef = useRef<{
    column: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Build column definitions from column names
  const columns = useMemo(() => buildColumns(columnNames), [columnNames]);

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

  // Drag handlers for column reordering
  const handleDragStart = useCallback((e: DragEvent<HTMLTableCellElement>, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", columnKey);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLTableCellElement>, columnKey: string) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnKey) {
      setDropTarget(columnKey);
    }
  }, [draggedColumn]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLTableCellElement>, targetColumnKey: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnKey || !onColumnsChange) {
      setDraggedColumn(null);
      setDropTarget(null);
      return;
    }

    // Reorder columns
    const newColumns = [...columnNames];
    const draggedIndex = newColumns.indexOf(draggedColumn);
    const targetIndex = newColumns.indexOf(targetColumnKey);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, draggedColumn);
      onColumnsChange(newColumns);
    }

    setDraggedColumn(null);
    setDropTarget(null);
  }, [draggedColumn, columnNames, onColumnsChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDropTarget(null);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: MouseEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    const currentWidth = columnWidths[columnKey] ?? DEFAULT_COLUMN_WIDTH;
    resizeRef.current = {
      column: columnKey,
      startX: e.clientX,
      startWidth: currentWidth,
    };

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      if (!resizeRef.current) return;

      const diff = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeRef.current.startWidth + diff);

      setColumnWidths((prev) => ({
        ...prev,
        [resizeRef.current!.column]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [columnWidths]);

  // Get column width
  const getColumnWidth = useCallback((columnKey: string): number => {
    return columnWidths[columnKey] ?? DEFAULT_COLUMN_WIDTH;
  }, [columnWidths]);

  // Empty state
  if (!isLoading && results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-300">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-400 mb-4"
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
        <p className="text-lg font-medium dark:text-gray-300">No results</p>
        <p className="text-sm mt-1">Enter tickers above and click Scan to see results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {columns.map((col) => {
              const isSorted = sortState.column === col.key;
              const canSort = col.sortable !== false;
              const isDragging = draggedColumn === col.key;
              const isDropTarget = dropTarget === col.key;
              const width = getColumnWidth(col.key);

              return (
                <th
                  key={col.key}
                  draggable={!!onColumnsChange}
                  onDragStart={(e) => handleDragStart(e, col.key)}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.key)}
                  onDragEnd={handleDragEnd}
                  style={{ width: `${width}px`, minWidth: `${MIN_COLUMN_WIDTH}px` }}
                  className={`relative px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${canSort ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none" : ""} ${
                    isDragging ? "opacity-50 bg-blue-100 dark:bg-blue-900" : ""
                  } ${isDropTarget ? "bg-blue-50 dark:bg-blue-900/50 border-l-2 border-blue-400" : ""} ${
                    onColumnsChange ? "cursor-grab active:cursor-grabbing" : ""
                  }`}
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
                      <span className="text-gray-300 dark:text-gray-400 ml-1">⇅</span>
                    ) : null}
                  </span>
                  {/* Resize handle */}
                  <div
                    draggable={false}
                    className="absolute right-0 top-0 h-full w-3 cursor-col-resize hover:bg-blue-200 dark:hover:bg-blue-800 group z-10"
                    onMouseDown={(e) => handleResizeStart(e, col.key)}
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-300 dark:bg-gray-500 group-hover:bg-blue-500" />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {sortedResults.map((result, index) => (
            <tr
              key={result.name ?? index}
              className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {columns.map((col) => {
                const value = result[col.key];
                const colorClass = col.colorFn ? col.colorFn(value) : "";
                const width = getColumnWidth(col.key);
                return (
                  <td
                    key={col.key}
                    style={{ width: `${width}px`, minWidth: `${MIN_COLUMN_WIDTH}px` }}
                    className={`px-4 py-3 whitespace-nowrap text-sm overflow-hidden text-ellipsis ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${col.key === "name" ? "font-medium text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"} ${colorClass}`}
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

function formatNumber(value: unknown): string {
  if (value == null || typeof value !== "number") return "-";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
  if (value == null || typeof value !== "number") return "text-gray-500 dark:text-gray-300";
  if (value > 0) return "text-green-600 dark:text-green-400 font-medium";
  if (value < 0) return "text-red-600 dark:text-red-400 font-medium";
  return "text-gray-500 dark:text-gray-300";
}
