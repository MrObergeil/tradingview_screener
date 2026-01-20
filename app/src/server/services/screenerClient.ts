/**
 * Client service for communicating with the Python screener API.
 */

import { ofetch, FetchError } from "ofetch";
import { config } from "../config.js";
import type {
  ScanRequest,
  ScanResponse,
  HealthResponse,
  TickerSearchResponse,
  FieldsResponse,
} from "../types/screener.js";

/** Error thrown when screener service call fails */
export class ScreenerServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "ScreenerServiceError";
  }
}

/**
 * Client for the Python screener service.
 */
export class ScreenerClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? config.screenerServiceUrl;
  }

  /**
   * Execute a screener scan.
   */
  async scan(request: ScanRequest): Promise<ScanResponse> {
    try {
      const response = await ofetch<ScanResponse>(`${this.baseUrl}/scan`, {
        method: "POST",
        body: request,
      });
      return response;
    } catch (error) {
      throw this.handleError(error, "scan");
    }
  }

  /**
   * Check health of the screener service.
   */
  async health(): Promise<HealthResponse> {
    try {
      const response = await ofetch<HealthResponse>(`${this.baseUrl}/health`);
      return response;
    } catch (error) {
      throw this.handleError(error, "health");
    }
  }

  /**
   * Search for tickers by name or description.
   */
  async searchTickers(query: string, limit = 10): Promise<TickerSearchResponse> {
    try {
      const response = await ofetch<TickerSearchResponse>(
        `${this.baseUrl}/tickers/search`,
        {
          query: { q: query, limit },
        }
      );
      return response;
    } catch (error) {
      throw this.handleError(error, "searchTickers");
    }
  }

  /**
   * Get available fields with metadata.
   */
  async getFields(): Promise<FieldsResponse> {
    try {
      const response = await ofetch<FieldsResponse>(`${this.baseUrl}/fields`);
      return response;
    } catch (error) {
      throw this.handleError(error, "getFields");
    }
  }

  /**
   * Handle fetch errors and convert to ScreenerServiceError.
   */
  private handleError(error: unknown, operation: string): ScreenerServiceError {
    if (error instanceof FetchError) {
      const statusCode = error.statusCode ?? 500;
      const detail =
        typeof error.data === "object" && error.data !== null
          ? (error.data as { detail?: string }).detail
          : undefined;

      return new ScreenerServiceError(
        `Screener service ${operation} failed: ${error.message}`,
        statusCode,
        detail
      );
    }

    if (error instanceof Error) {
      return new ScreenerServiceError(
        `Screener service ${operation} failed: ${error.message}`,
        500
      );
    }

    return new ScreenerServiceError(
      `Screener service ${operation} failed: Unknown error`,
      500
    );
  }
}

/** Singleton instance of the screener client */
export const screenerClient = new ScreenerClient();
