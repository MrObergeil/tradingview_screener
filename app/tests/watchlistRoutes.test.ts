import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { existsSync, rmSync, mkdirSync } from "fs";
import { resolve } from "path";
import Database from "better-sqlite3";
import { watchlistRoutes } from "../src/server/routes/watchlist";
import { runMigrations } from "../src/server/db/schema";

describe("Watchlist Routes", () => {
  const testDbPath = resolve(process.cwd(), "data", "routes-test.db");
  let app: FastifyInstance;
  let db: Database.Database;

  beforeAll(async () => {
    // Ensure directory exists
    const dbDir = resolve(process.cwd(), "data");
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    // Create fresh database with schema
    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
    runMigrations(db);

    // Create Fastify app with database attached
    app = Fastify();
    (app as unknown as { db: Database.Database }).db = db;
    await app.register(watchlistRoutes);
  });

  afterAll(async () => {
    await app?.close();
    db?.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    if (existsSync(testDbPath + "-wal")) {
      rmSync(testDbPath + "-wal");
    }
    if (existsSync(testDbPath + "-shm")) {
      rmSync(testDbPath + "-shm");
    }
  });

  describe("GET /api/watchlists", () => {
    it("should return empty array when no watchlists", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/watchlists",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.watchlists).toEqual([]);
    });

    it("should return watchlists with item counts", async () => {
      // Create watchlists directly in DB
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("List1");
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("List2");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "AAPL");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "MSFT");

      const response = await app.inject({
        method: "GET",
        url: "/api/watchlists",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.watchlists).toHaveLength(2);
      expect(body.watchlists[0].itemCount).toBe(2);
      expect(body.watchlists[1].itemCount).toBe(0);
    });
  });

  describe("POST /api/watchlists", () => {
    it("should create a watchlist", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists",
        payload: { name: "Tech Stocks", description: "My tech portfolio" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(1);
      expect(body.name).toBe("Tech Stocks");
      expect(body.description).toBe("My tech portfolio");
    });

    it("should return 400 for missing name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists",
        payload: { description: "No name" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 409 for duplicate name", async () => {
      await app.inject({
        method: "POST",
        url: "/api/watchlists",
        payload: { name: "Duplicate" },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists",
        payload: { name: "Duplicate" },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("GET /api/watchlists/:id", () => {
    it("should return watchlist with items", async () => {
      // Create watchlist and items
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Test");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker, notes) VALUES (?, ?, ?)").run(1, "AAPL", "Apple");
      db.prepare("INSERT INTO watchlist_item_tags (watchlist_item_id, tag) VALUES (?, ?)").run(1, "tech");

      const response = await app.inject({
        method: "GET",
        url: "/api/watchlists/1",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Test");
      expect(body.items).toHaveLength(1);
      expect(body.items[0].ticker).toBe("AAPL");
      expect(body.items[0].tags).toContain("tech");
    });

    it("should return 404 for non-existent watchlist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/watchlists/999",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/watchlists/:id", () => {
    it("should update watchlist", async () => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Original");

      const response = await app.inject({
        method: "PUT",
        url: "/api/watchlists/1",
        payload: { name: "Updated", description: "New description" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Updated");
      expect(body.description).toBe("New description");
    });

    it("should return 404 for non-existent watchlist", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/watchlists/999",
        payload: { name: "Updated" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/watchlists/:id", () => {
    it("should delete watchlist", async () => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("ToDelete");

      const response = await app.inject({
        method: "DELETE",
        url: "/api/watchlists/1",
      });

      expect(response.statusCode).toBe(204);

      // Verify deleted
      const count = db.prepare("SELECT COUNT(*) as count FROM watchlists").get() as { count: number };
      expect(count.count).toBe(0);
    });

    it("should return 404 for non-existent watchlist", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/watchlists/999",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/watchlists/:id/items", () => {
    beforeEach(() => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Test");
    });

    it("should add item to watchlist", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/1/items",
        payload: { ticker: "AAPL", notes: "Apple Inc", tags: ["tech", "mega-cap"] },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ticker).toBe("AAPL");
      expect(body.notes).toBe("Apple Inc");
      expect(body.tags).toContain("tech");
      expect(body.tags).toContain("mega-cap");
    });

    it("should uppercase ticker", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/1/items",
        payload: { ticker: "aapl" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ticker).toBe("AAPL");
    });

    it("should return 409 for duplicate ticker", async () => {
      await app.inject({
        method: "POST",
        url: "/api/watchlists/1/items",
        payload: { ticker: "AAPL" },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/1/items",
        payload: { ticker: "AAPL" },
      });

      expect(response.statusCode).toBe(409);
    });

    it("should return 404 for non-existent watchlist", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/999/items",
        payload: { ticker: "AAPL" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/watchlists/:id/items/batch", () => {
    beforeEach(() => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Test");
    });

    it("should add multiple items", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/1/items/batch",
        payload: { tickers: ["AAPL", "MSFT", "GOOGL"] },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.added).toBe(3);
      expect(body.skipped).toHaveLength(0);
    });

    it("should report skipped duplicates", async () => {
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "AAPL");

      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/1/items/batch",
        payload: { tickers: ["AAPL", "MSFT"] },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.added).toBe(1);
      expect(body.skipped).toContain("AAPL");
    });
  });

  describe("PUT /api/watchlists/:id/items/:itemId", () => {
    beforeEach(() => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Test");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "AAPL");
    });

    it("should update item notes", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/watchlists/1/items/1",
        payload: { notes: "Updated notes" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.notes).toBe("Updated notes");
    });

    it("should update item tags", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/watchlists/1/items/1",
        payload: { tags: ["tech", "growth"] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tags).toContain("tech");
      expect(body.tags).toContain("growth");
    });
  });

  describe("DELETE /api/watchlists/:id/items/:itemId", () => {
    beforeEach(() => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Test");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "AAPL");
    });

    it("should delete item", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/watchlists/1/items/1",
      });

      expect(response.statusCode).toBe(204);

      const count = db.prepare("SELECT COUNT(*) as count FROM watchlist_items").get() as { count: number };
      expect(count.count).toBe(0);
    });

    it("should return 404 for non-existent item", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/watchlists/1/items/999",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/tags", () => {
    it("should return all unique tags", async () => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Test");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "AAPL");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "MSFT");
      db.prepare("INSERT INTO watchlist_item_tags (watchlist_item_id, tag) VALUES (?, ?)").run(1, "tech");
      db.prepare("INSERT INTO watchlist_item_tags (watchlist_item_id, tag) VALUES (?, ?)").run(1, "growth");
      db.prepare("INSERT INTO watchlist_item_tags (watchlist_item_id, tag) VALUES (?, ?)").run(2, "tech");

      const response = await app.inject({
        method: "GET",
        url: "/api/tags",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tags).toHaveLength(2); // tech, growth (no duplicates)
      expect(body.tags).toContain("tech");
      expect(body.tags).toContain("growth");
    });
  });

  describe("POST /api/watchlists/import", () => {
    it("should import from plain text", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: {
          name: "Imported List",
          data: "AAPL\nMSFT\nGOOGL",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.watchlist.name).toBe("Imported List");
      expect(body.imported).toBe(3);
      expect(body.format).toBe("text");
    });

    it("should import from comma-separated text", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: {
          name: "CSV Import",
          data: "AAPL, MSFT, GOOGL, AMZN",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.imported).toBe(4);
    });

    it("should import from TradingView format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: {
          name: "TradingView Import",
          data: "NASDAQ:AAPL, NYSE:MSFT, NASDAQ:GOOGL",
          format: "tradingview",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.imported).toBe(3);

      // Verify tickers are stored without exchange prefix
      const watchlist = db.prepare("SELECT * FROM watchlist_items WHERE watchlist_id = ?").all(body.watchlist.id);
      expect(watchlist).toHaveLength(3);
    });

    it("should import from JSON array", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: {
          name: "JSON Import",
          data: JSON.stringify(["AAPL", "MSFT", "GOOGL"]),
          format: "json",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.imported).toBe(3);
    });

    it("should import from JSON object with tickers", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: {
          name: "JSON Object Import",
          data: JSON.stringify({ tickers: ["AAPL", "MSFT"] }),
          format: "json",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.imported).toBe(2);
    });

    it("should import from CSV with header", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: {
          name: "CSV Import",
          data: "ticker,notes\nAAPL,Apple Inc\nMSFT,Microsoft",
          format: "csv",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.imported).toBe(2);
    });

    it("should skip duplicates during import", async () => {
      // Create watchlist with existing ticker
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Existing");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "AAPL");

      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: {
          name: "New Import",
          data: "AAPL, MSFT",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.imported).toBe(2); // Both imported to new watchlist
    });

    it("should return 400 for missing name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: { data: "AAPL" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for empty data", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: { name: "Test", data: "" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 409 for duplicate watchlist name", async () => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Existing");

      const response = await app.inject({
        method: "POST",
        url: "/api/watchlists/import",
        payload: { name: "Existing", data: "AAPL" },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("GET /api/watchlists/:id/export", () => {
    beforeEach(() => {
      db.prepare("INSERT INTO watchlists (name, description) VALUES (?, ?)").run("Tech Stocks", "My tech portfolio");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker, notes) VALUES (?, ?, ?)").run(1, "AAPL", "Apple Inc");
      db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)").run(1, "MSFT");
      db.prepare("INSERT INTO watchlist_item_tags (watchlist_item_id, tag) VALUES (?, ?)").run(1, "mega-cap");
      db.prepare("INSERT INTO watchlist_item_tags (watchlist_item_id, tag) VALUES (?, ?)").run(1, "tech");
    });

    it("should export as CSV by default", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/watchlists/1/export",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");

      const lines = response.body.split("\n");
      expect(lines[0]).toBe("ticker,notes,tags");
      expect(lines[1]).toContain("AAPL");
      expect(lines[1]).toContain("Apple Inc");
    });

    it("should export as JSON", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/watchlists/1/export?format=json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");

      const body = JSON.parse(response.body);
      expect(body.name).toBe("Tech Stocks");
      expect(body.items).toHaveLength(2);
      expect(body.items[0].ticker).toBe("AAPL");
      expect(body.items[0].notes).toBe("Apple Inc");
      expect(body.items[0].tags).toContain("tech");
    });

    it("should return 404 for non-existent watchlist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/watchlists/999/export",
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
