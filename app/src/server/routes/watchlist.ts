/**
 * Watchlist API routes.
 */

import type { FastifyInstance } from "fastify";
import { WatchlistRepository, type WatchlistItem } from "../db/repositories/watchlist.js";
import { DatabaseError } from "../db/repositories/base.js";
import type Database from "better-sqlite3";

/** Request body for creating/updating a watchlist */
interface WatchlistBody {
  name: string;
  description?: string;
}

/** Request body for adding an item */
interface AddItemBody {
  ticker: string;
  notes?: string;
  tags?: string[];
}

/** Request body for adding multiple items */
interface AddItemsBody {
  tickers: string[];
}

/** Request body for updating an item */
interface UpdateItemBody {
  notes?: string;
  tags?: string[];
}

/** Request body for importing watchlist */
interface ImportBody {
  name: string;
  description?: string;
  data: string;
  format?: "csv" | "json" | "text" | "tradingview";
}

/** Export format query param */
interface ExportQuery {
  format?: "csv" | "json";
}

/** Route params with watchlist ID */
interface WatchlistParams {
  id: string;
}

/** Route params with watchlist and item IDs */
interface ItemParams {
  id: string;
  itemId: string;
}

/**
 * Register watchlist routes.
 */
export async function watchlistRoutes(app: FastifyInstance) {
  // Get database from app context (set in index.ts)
  const db = (app as unknown as { db: Database.Database }).db;
  const repo = new WatchlistRepository(db);

  // ============ Watchlist CRUD ============

  /**
   * GET /api/watchlists - List all watchlists
   */
  app.get("/api/watchlists", async () => {
    const watchlists = repo.findAllWithCounts();
    return { watchlists };
  });

  /**
   * GET /api/watchlists/:id - Get single watchlist with items
   */
  app.get<{ Params: WatchlistParams }>(
    "/api/watchlists/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid watchlist ID" });
      }

      const watchlist = repo.findWithItems(id);
      if (!watchlist) {
        return reply.status(404).send({ error: "Watchlist not found" });
      }

      return watchlist;
    }
  );

  /**
   * POST /api/watchlists - Create a new watchlist
   */
  app.post<{ Body: WatchlistBody }>(
    "/api/watchlists",
    async (request, reply) => {
      const { name, description } = request.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return reply.status(400).send({ error: "Name is required" });
      }

      try {
        const watchlist = repo.create({
          name: name.trim(),
          description: description?.trim() ?? null,
        });
        return reply.status(201).send(watchlist);
      } catch (err) {
        if (err instanceof DatabaseError && err.cause instanceof Error) {
          if (err.cause.message.includes("UNIQUE constraint")) {
            return reply.status(409).send({ error: "Watchlist with this name already exists" });
          }
        }
        throw err;
      }
    }
  );

  /**
   * PUT /api/watchlists/:id - Update a watchlist
   */
  app.put<{ Params: WatchlistParams; Body: WatchlistBody }>(
    "/api/watchlists/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid watchlist ID" });
      }

      const { name, description } = request.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return reply.status(400).send({ error: "Name is required" });
      }

      try {
        const watchlist = repo.update(id, {
          name: name.trim(),
          description: description?.trim() ?? null,
        });
        return watchlist;
      } catch (err) {
        if (err instanceof DatabaseError) {
          if (err.message.includes("not found")) {
            return reply.status(404).send({ error: "Watchlist not found" });
          }
          if (err.cause instanceof Error && err.cause.message.includes("UNIQUE constraint")) {
            return reply.status(409).send({ error: "Watchlist with this name already exists" });
          }
        }
        throw err;
      }
    }
  );

  /**
   * DELETE /api/watchlists/:id - Delete a watchlist
   */
  app.delete<{ Params: WatchlistParams }>(
    "/api/watchlists/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid watchlist ID" });
      }

      const deleted = repo.delete(id);
      if (!deleted) {
        return reply.status(404).send({ error: "Watchlist not found" });
      }

      return reply.status(204).send();
    }
  );

  // ============ Watchlist Items ============

  /**
   * POST /api/watchlists/:id/items - Add ticker to watchlist
   */
  app.post<{ Params: WatchlistParams; Body: AddItemBody }>(
    "/api/watchlists/:id/items",
    async (request, reply) => {
      const watchlistId = parseInt(request.params.id, 10);
      if (isNaN(watchlistId)) {
        return reply.status(400).send({ error: "Invalid watchlist ID" });
      }

      const { ticker, notes, tags } = request.body;

      if (!ticker || typeof ticker !== "string" || ticker.trim().length === 0) {
        return reply.status(400).send({ error: "Ticker is required" });
      }

      // Verify watchlist exists
      if (!repo.exists(watchlistId)) {
        return reply.status(404).send({ error: "Watchlist not found" });
      }

      try {
        const item = repo.addItem(watchlistId, ticker.trim(), notes?.trim());

        // Add tags if provided
        if (tags && Array.isArray(tags)) {
          repo.setItemTags(item.id, tags);
        }

        return reply.status(201).send({
          ...item,
          tags: repo.getItemTags(item.id),
        });
      } catch (err) {
        if (err instanceof DatabaseError && err.message.includes("already exists")) {
          return reply.status(409).send({ error: `Ticker ${ticker.toUpperCase()} already in watchlist` });
        }
        throw err;
      }
    }
  );

  /**
   * POST /api/watchlists/:id/items/batch - Add multiple tickers
   */
  app.post<{ Params: WatchlistParams; Body: AddItemsBody }>(
    "/api/watchlists/:id/items/batch",
    async (request, reply) => {
      const watchlistId = parseInt(request.params.id, 10);
      if (isNaN(watchlistId)) {
        return reply.status(400).send({ error: "Invalid watchlist ID" });
      }

      const { tickers } = request.body;

      if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        return reply.status(400).send({ error: "Tickers array is required" });
      }

      // Verify watchlist exists
      if (!repo.exists(watchlistId)) {
        return reply.status(404).send({ error: "Watchlist not found" });
      }

      const result = repo.addItems(watchlistId, tickers.map((t) => String(t).trim()));

      return reply.status(201).send({
        added: result.added.length,
        skipped: result.skipped,
        items: result.added,
      });
    }
  );

  /**
   * PUT /api/watchlists/:id/items/:itemId - Update item notes/tags
   */
  app.put<{ Params: ItemParams; Body: UpdateItemBody }>(
    "/api/watchlists/:id/items/:itemId",
    async (request, reply) => {
      const watchlistId = parseInt(request.params.id, 10);
      const itemId = parseInt(request.params.itemId, 10);

      if (isNaN(watchlistId) || isNaN(itemId)) {
        return reply.status(400).send({ error: "Invalid ID" });
      }

      const { notes, tags } = request.body;

      try {
        // Update notes if provided
        let item: WatchlistItem | undefined;
        if (notes !== undefined) {
          item = repo.updateItemNotes(itemId, notes?.trim() ?? null);
        }

        // Update tags if provided
        if (tags !== undefined && Array.isArray(tags)) {
          repo.setItemTags(itemId, tags);
        }

        // Fetch final state
        if (!item) {
          const items = repo.getItems(watchlistId);
          item = items.find((i) => i.id === itemId);
        }

        if (!item) {
          return reply.status(404).send({ error: "Item not found" });
        }

        return {
          ...item,
          tags: repo.getItemTags(itemId),
        };
      } catch (err) {
        if (err instanceof DatabaseError && err.message.includes("not found")) {
          return reply.status(404).send({ error: "Item not found" });
        }
        throw err;
      }
    }
  );

  /**
   * DELETE /api/watchlists/:id/items/:itemId - Remove item from watchlist
   */
  app.delete<{ Params: ItemParams }>(
    "/api/watchlists/:id/items/:itemId",
    async (request, reply) => {
      const itemId = parseInt(request.params.itemId, 10);

      if (isNaN(itemId)) {
        return reply.status(400).send({ error: "Invalid item ID" });
      }

      const deleted = repo.removeItemById(itemId);
      if (!deleted) {
        return reply.status(404).send({ error: "Item not found" });
      }

      return reply.status(204).send();
    }
  );

  // ============ Tags ============

  /**
   * GET /api/tags - Get all unique tags
   */
  app.get("/api/tags", async () => {
    const tags = repo.getAllTags();
    return { tags };
  });

  // ============ Import/Export ============

  /**
   * POST /api/watchlists/import - Import tickers into a new watchlist
   * Supports: CSV, JSON, plain text (one per line), TradingView format
   */
  app.post<{ Body: ImportBody }>(
    "/api/watchlists/import",
    async (request, reply) => {
      const { name, description, data, format } = request.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return reply.status(400).send({ error: "Watchlist name is required" });
      }

      if (!data || typeof data !== "string" || data.trim().length === 0) {
        return reply.status(400).send({ error: "Import data is required" });
      }

      // Parse tickers based on format (auto-detect if not specified)
      let tickers: string[];
      const detectedFormat = format ?? detectFormat(data);

      try {
        tickers = parseTickers(data, detectedFormat);
      } catch (err) {
        return reply.status(400).send({
          error: `Failed to parse import data: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }

      if (tickers.length === 0) {
        return reply.status(400).send({ error: "No valid tickers found in import data" });
      }

      // Create watchlist and add tickers
      try {
        const watchlist = repo.create({
          name: name.trim(),
          description: description?.trim() ?? null,
        });

        const result = repo.addItems(watchlist.id, tickers);

        return reply.status(201).send({
          watchlist,
          imported: result.added.length,
          skipped: result.skipped,
          format: detectedFormat,
        });
      } catch (err) {
        if (err instanceof DatabaseError && err.cause instanceof Error) {
          if (err.cause.message.includes("UNIQUE constraint")) {
            return reply.status(409).send({ error: "Watchlist with this name already exists" });
          }
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/watchlists/:id/export - Export watchlist to CSV or JSON
   */
  app.get<{ Params: WatchlistParams; Querystring: ExportQuery }>(
    "/api/watchlists/:id/export",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid watchlist ID" });
      }

      const watchlist = repo.findWithItems(id);
      if (!watchlist) {
        return reply.status(404).send({ error: "Watchlist not found" });
      }

      const format = request.query.format ?? "csv";

      if (format === "json") {
        return reply
          .header("Content-Type", "application/json")
          .header("Content-Disposition", `attachment; filename="${watchlist.name}.json"`)
          .send({
            name: watchlist.name,
            description: watchlist.description,
            exportedAt: new Date().toISOString(),
            items: watchlist.items.map((item) => ({
              ticker: item.ticker,
              notes: item.notes,
              tags: item.tags,
            })),
          });
      }

      // CSV format
      const csvLines = [
        "ticker,notes,tags",
        ...watchlist.items.map((item) => {
          const notes = item.notes ? `"${item.notes.replace(/"/g, '""')}"` : "";
          const tags = item.tags.length > 0 ? `"${item.tags.join(";")}"` : "";
          return `${item.ticker},${notes},${tags}`;
        }),
      ];

      return reply
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", `attachment; filename="${watchlist.name}.csv"`)
        .send(csvLines.join("\n"));
    }
  );
}

// ============ Import Parsing Utilities ============

type ImportFormat = "csv" | "json" | "text" | "tradingview";

/**
 * Auto-detect import format from data content.
 */
function detectFormat(data: string): ImportFormat {
  const trimmed = data.trim();

  // JSON: starts with { or [
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }

  // CSV: has comma and looks like header row
  if (trimmed.includes(",") && /^[a-zA-Z_,\s]+\n/.test(trimmed)) {
    return "csv";
  }

  // TradingView: contains exchange prefix like "NASDAQ:"
  if (/[A-Z]+:[A-Z]+/.test(trimmed)) {
    return "tradingview";
  }

  // Default to plain text
  return "text";
}

/**
 * Parse tickers from import data based on format.
 */
function parseTickers(data: string, format: ImportFormat): string[] {
  switch (format) {
    case "json":
      return parseJsonTickers(data);
    case "csv":
      return parseCsvTickers(data);
    case "tradingview":
      return parseTradingViewTickers(data);
    case "text":
    default:
      return parseTextTickers(data);
  }
}

/**
 * Parse JSON format: { "tickers": ["AAPL", "MSFT"] } or ["AAPL", "MSFT"]
 */
function parseJsonTickers(data: string): string[] {
  const parsed = JSON.parse(data);

  // Array of strings
  if (Array.isArray(parsed)) {
    return parsed.filter((t) => typeof t === "string").map((t) => t.toUpperCase().trim());
  }

  // Object with tickers array
  if (parsed.tickers && Array.isArray(parsed.tickers)) {
    return parsed.tickers.filter((t: unknown) => typeof t === "string").map((t: string) => t.toUpperCase().trim());
  }

  // Object with items array (our export format)
  if (parsed.items && Array.isArray(parsed.items)) {
    return parsed.items
      .filter((i: unknown) => typeof i === "object" && i !== null && "ticker" in i)
      .map((i: { ticker: string }) => i.ticker.toUpperCase().trim());
  }

  throw new Error("Invalid JSON format: expected array or object with tickers/items property");
}

/**
 * Parse CSV format: ticker column (header optional)
 */
function parseCsvTickers(data: string): string[] {
  const lines = data.trim().split(/\r?\n/);
  const tickers: string[] = [];

  // Check if first line is header
  const firstLine = lines[0]?.toLowerCase() ?? "";
  const hasHeader = firstLine.includes("ticker") || firstLine.includes("symbol");
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Get first column (ticker)
    const columns = line.split(",");
    const ticker = columns[0]?.trim().toUpperCase();

    if (ticker && /^[A-Z]+$/.test(ticker)) {
      tickers.push(ticker);
    }
  }

  return tickers;
}

/**
 * Parse TradingView format: "NASDAQ:AAPL, NYSE:MSFT" or "NASDAQ:AAPL\nNYSE:MSFT"
 */
function parseTradingViewTickers(data: string): string[] {
  // Split by comma, newline, or whitespace
  const parts = data.split(/[,\n\r\s]+/);
  const tickers: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Remove exchange prefix if present (e.g., "NASDAQ:AAPL" -> "AAPL")
    const ticker = trimmed.includes(":") ? trimmed.split(":")[1] : trimmed;

    if (ticker && /^[A-Z]+$/.test(ticker.toUpperCase())) {
      tickers.push(ticker.toUpperCase());
    }
  }

  return tickers;
}

/**
 * Parse plain text format: one ticker per line or comma-separated
 */
function parseTextTickers(data: string): string[] {
  // Split by comma, newline, or whitespace
  const parts = data.split(/[,\n\r\s]+/);
  const tickers: string[] = [];

  for (const part of parts) {
    const ticker = part.trim().toUpperCase();

    // Basic validation: only letters
    if (ticker && /^[A-Z]+$/.test(ticker)) {
      tickers.push(ticker);
    }
  }

  return tickers;
}
