/**
 * Frontend API client for the screener backend.
 */

/** Filter operators supported by the screener */
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

/** Single filter condition */
export interface Filter {
  field: string;
  op: FilterOperator;
  value: number | string | number[] | string[];
}

/** Sort configuration */
export interface OrderBy {
  field: string;
  direction: "asc" | "desc";
}

/** Scan request parameters */
export interface ScanRequest {
  columns: string[];
  filters?: Filter[];
  orderBy?: OrderBy;
  limit?: number;
  offset?: number;
}

/** Scan response from the API */
export interface ScanResponse {
  totalCount: number;
  results: Record<string, unknown>[];
  timestamp: string;
  durationMs: number;
}

/** API error response */
export interface ApiError {
  error: string;
  detail?: string;
}

/** Check if response is an error */
function isApiError(data: unknown): data is ApiError {
  return typeof data === "object" && data !== null && "error" in data;
}

/**
 * Execute a screener scan.
 */
export async function scan(request: ScanRequest): Promise<ScanResponse> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.detail ?? data.error);
    }
    throw new Error(`Scan failed: ${response.statusText}`);
  }

  return data as ScanResponse;
}

/**
 * Check API health.
 */
export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}
