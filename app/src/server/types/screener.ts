/**
 * TypeScript types for the Python screener service API.
 * These match the Pydantic models in screener-service/src/models.py
 */

/** Filter operators supported by tradingview-screener */
export type FilterOperator =
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq"
  | "neq"
  | "between"
  | "not_between"
  | "in"
  | "not_in";

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Single filter condition */
export interface Filter {
  field: string;
  op: FilterOperator;
  value: number | string | number[] | string[];
}

/** Sort configuration */
export interface OrderBy {
  field: string;
  direction: SortDirection;
}

/** Request body for /scan endpoint */
export interface ScanRequest {
  markets?: string[];
  columns: string[];
  filters?: Filter[];
  orderBy?: OrderBy;
  limit?: number;
  offset?: number;
}

/** Response body from /scan endpoint */
export interface ScanResponse {
  totalCount: number;
  results: Record<string, unknown>[];
  timestamp: string;
  durationMs: number;
}

/** Health check response */
export interface HealthResponse {
  status: string;
  timestamp: string;
}

/** Error response from Python service */
export interface ErrorResponse {
  detail: string;
}

/** Single ticker result from search */
export interface TickerResult {
  name: string;
  description: string;
  exchange: string;
  type: string;
}

/** Response body from /tickers/search endpoint */
export interface TickerSearchResponse {
  results: TickerResult[];
  count: number;
}
