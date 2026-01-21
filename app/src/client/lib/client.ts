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
  markets?: string[];
  columns: string[];
  filters?: Filter[];
  orderBy?: OrderBy;
  limit?: number;
  offset?: number;
}

/** Options for executing a scan */
export interface ScanOptions {
  markets: string[];
  filters: Filter[];
  tickers?: string[];
  columns: string[];
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

/** Single ticker result from search */
export interface TickerResult {
  name: string;
  description: string;
  exchange: string;
  type: string;
}

/** Ticker search response */
export interface TickerSearchResponse {
  results: TickerResult[];
  count: number;
}

/** Field metadata */
export interface FieldInfo {
  name: string;
  displayName: string;
  type: "number" | "string" | "percent";
  category: string;
}

/** Fields list response */
export interface FieldsResponse {
  fields: FieldInfo[];
  categories: string[];
}

// ============ Watchlist Types ============

/** Watchlist summary (from list endpoint) */
export interface WatchlistSummary {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  created_at: string;
  updated_at: string;
}

/** Watchlist item with tags */
export interface WatchlistItem {
  id: number;
  watchlist_id: number;
  ticker: string;
  notes: string | null;
  tags: string[];
  added_at: string;
}

/** Full watchlist with items */
export interface Watchlist extends WatchlistSummary {
  items: WatchlistItem[];
}

/** Create/update watchlist request */
export interface WatchlistInput {
  name: string;
  description?: string;
}

/** Add item request */
export interface AddItemInput {
  ticker: string;
  notes?: string;
  tags?: string[];
}

/** Import request */
export interface ImportInput {
  name: string;
  description?: string;
  data: string;
  format?: "csv" | "json" | "text" | "tradingview";
}

/** Import response */
export interface ImportResponse {
  watchlist: WatchlistSummary;
  imported: number;
  skipped: string[];
  format: string;
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

/**
 * Search for tickers by name or description.
 */
export async function searchTickers(
  query: string,
  limit = 10
): Promise<TickerSearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`/api/tickers/search?${params}`);

  if (!response.ok) {
    throw new Error(`Ticker search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get available fields with metadata.
 */
export async function getFields(): Promise<FieldsResponse> {
  const response = await fetch("/api/fields");

  if (!response.ok) {
    throw new Error(`Failed to fetch fields: ${response.statusText}`);
  }

  return response.json();
}

// ============ Watchlist API ============

/**
 * Get all watchlists.
 */
export async function getWatchlists(): Promise<WatchlistSummary[]> {
  const response = await fetch("/api/watchlists");

  if (!response.ok) {
    throw new Error(`Failed to fetch watchlists: ${response.statusText}`);
  }

  const data = await response.json();
  return data.watchlists;
}

/**
 * Get single watchlist with items.
 */
export async function getWatchlist(id: number): Promise<Watchlist> {
  const response = await fetch(`/api/watchlists/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Watchlist not found");
    }
    throw new Error(`Failed to fetch watchlist: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new watchlist.
 */
export async function createWatchlist(input: WatchlistInput): Promise<WatchlistSummary> {
  const response = await fetch("/api/watchlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to create watchlist: ${response.statusText}`);
  }

  return data as WatchlistSummary;
}

/**
 * Update a watchlist.
 */
export async function updateWatchlist(id: number, input: WatchlistInput): Promise<WatchlistSummary> {
  const response = await fetch(`/api/watchlists/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to update watchlist: ${response.statusText}`);
  }

  return data as WatchlistSummary;
}

/**
 * Delete a watchlist.
 */
export async function deleteWatchlist(id: number): Promise<void> {
  const response = await fetch(`/api/watchlists/${id}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete watchlist: ${response.statusText}`);
  }
}

/**
 * Add item to watchlist.
 */
export async function addWatchlistItem(
  watchlistId: number,
  input: AddItemInput
): Promise<WatchlistItem> {
  const response = await fetch(`/api/watchlists/${watchlistId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to add item: ${response.statusText}`);
  }

  return data as WatchlistItem;
}

/**
 * Update watchlist item.
 */
export async function updateWatchlistItem(
  watchlistId: number,
  itemId: number,
  input: { notes?: string; tags?: string[] }
): Promise<WatchlistItem> {
  const response = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to update item: ${response.statusText}`);
  }

  return data as WatchlistItem;
}

/**
 * Remove item from watchlist.
 */
export async function removeWatchlistItem(watchlistId: number, itemId: number): Promise<void> {
  const response = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to remove item: ${response.statusText}`);
  }
}

/**
 * Import tickers into a new watchlist.
 */
export async function importWatchlist(input: ImportInput): Promise<ImportResponse> {
  const response = await fetch("/api/watchlists/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to import: ${response.statusText}`);
  }

  return data as ImportResponse;
}

/**
 * Export watchlist.
 */
export function getExportUrl(watchlistId: number, format: "csv" | "json" = "csv"): string {
  return `/api/watchlists/${watchlistId}/export?format=${format}`;
}

// ============ Screener Config Types ============

/** Screener configuration data */
export interface ScreenerConfigData {
  columns: string[];
  filters: Filter[];
  orderBy?: OrderBy;
}

/** Screener config summary */
export interface ScreenerConfig {
  id: number;
  name: string;
  description: string | null;
  config: ScreenerConfigData;
  is_preset: number;
  created_at: string;
  updated_at: string;
}

/** Create/update config input */
export interface ConfigInput {
  name: string;
  description?: string;
  config: ScreenerConfigData;
}

// ============ Screener Config API ============

/**
 * Get all screener configs.
 */
export async function getConfigs(includePresets = true): Promise<ScreenerConfig[]> {
  const params = new URLSearchParams({ includePresets: String(includePresets) });
  const response = await fetch(`/api/configs?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch configs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.configs;
}

/**
 * Get single screener config.
 */
export async function getConfig(id: number): Promise<ScreenerConfig> {
  const response = await fetch(`/api/configs/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Config not found");
    }
    throw new Error(`Failed to fetch config: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new screener config.
 */
export async function createConfig(input: ConfigInput): Promise<ScreenerConfig> {
  const response = await fetch("/api/configs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to create config: ${response.statusText}`);
  }

  return data as ScreenerConfig;
}

/**
 * Update a screener config.
 */
export async function updateConfig(
  id: number,
  input: Partial<ConfigInput>
): Promise<ScreenerConfig> {
  const response = await fetch(`/api/configs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to update config: ${response.statusText}`);
  }

  return data as ScreenerConfig;
}

/**
 * Delete a screener config.
 */
export async function deleteConfig(id: number): Promise<void> {
  const response = await fetch(`/api/configs/${id}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    const data: unknown = await response.json();
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to delete config: ${response.statusText}`);
  }
}

/**
 * Duplicate a screener config.
 */
export async function duplicateConfig(id: number, newName: string): Promise<ScreenerConfig> {
  const response = await fetch(`/api/configs/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to duplicate config: ${response.statusText}`);
  }

  return data as ScreenerConfig;
}

// ============ Preferences Types ============

/** Favorite field */
export interface FavoriteField {
  id: number;
  field_name: string;
  display_order: number;
}

// ============ Preferences API ============

/**
 * Get all preferences.
 */
export async function getPreferences(): Promise<Record<string, string>> {
  const response = await fetch("/api/preferences");

  if (!response.ok) {
    throw new Error(`Failed to fetch preferences: ${response.statusText}`);
  }

  const data = await response.json();
  return data.preferences;
}

/**
 * Get a single preference.
 */
export async function getPreference(key: string): Promise<string | null> {
  const response = await fetch(`/api/preferences/${encodeURIComponent(key)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch preference: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value;
}

/**
 * Set a preference.
 */
export async function setPreference(key: string, value: string): Promise<void> {
  const response = await fetch(`/api/preferences/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    const data: unknown = await response.json();
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to set preference: ${response.statusText}`);
  }
}

/**
 * Set multiple preferences.
 */
export async function setPreferences(preferences: Record<string, string>): Promise<void> {
  const response = await fetch("/api/preferences/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences }),
  });

  if (!response.ok) {
    throw new Error(`Failed to set preferences: ${response.statusText}`);
  }
}

/**
 * Get favorite fields.
 */
export async function getFavoriteFields(): Promise<FavoriteField[]> {
  const response = await fetch("/api/favorites/fields");

  if (!response.ok) {
    throw new Error(`Failed to fetch favorite fields: ${response.statusText}`);
  }

  const data = await response.json();
  return data.fields;
}

/**
 * Add a favorite field.
 */
export async function addFavoriteField(fieldName: string): Promise<FavoriteField> {
  const response = await fetch("/api/favorites/fields", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fieldName }),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (isApiError(data)) {
      throw new Error(data.error);
    }
    throw new Error(`Failed to add favorite field: ${response.statusText}`);
  }

  return data as FavoriteField;
}

/**
 * Remove a favorite field.
 */
export async function removeFavoriteField(fieldName: string): Promise<void> {
  const response = await fetch(`/api/favorites/fields/${encodeURIComponent(fieldName)}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to remove favorite field: ${response.statusText}`);
  }
}

/**
 * Set all favorite fields (replace).
 */
export async function setFavoriteFields(fieldNames: string[]): Promise<void> {
  const response = await fetch("/api/favorites/fields", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fieldNames }),
  });

  if (!response.ok) {
    throw new Error(`Failed to set favorite fields: ${response.statusText}`);
  }
}
