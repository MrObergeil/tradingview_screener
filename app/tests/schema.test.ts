import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { existsSync, rmSync, mkdirSync } from "fs";
import { resolve } from "path";
import Database from "better-sqlite3";
import { runMigrations, getCurrentVersion, SCHEMA_VERSION, TABLE_NAMES } from "../src/server/db/schema";

describe("Database Schema", () => {
  const testDbPath = resolve(process.cwd(), "data", "schema-test.db");
  let db: Database.Database;

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    // Ensure directory exists
    const dbDir = resolve(process.cwd(), "data");
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Create fresh database
    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
  });

  afterAll(() => {
    // Clean up test database
    if (db?.open) {
      db.close();
    }
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    // Also clean up WAL files
    if (existsSync(testDbPath + "-wal")) {
      rmSync(testDbPath + "-wal");
    }
    if (existsSync(testDbPath + "-shm")) {
      rmSync(testDbPath + "-shm");
    }
  });

  it("should report version 0 for empty database", () => {
    const version = getCurrentVersion(db);
    expect(version).toBe(0);
  });

  it("should run migrations successfully", () => {
    runMigrations(db);
    const version = getCurrentVersion(db);
    expect(version).toBe(SCHEMA_VERSION);
  });

  it("should create all tables", () => {
    runMigrations(db);

    // Query sqlite_master for table names
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);

    // Check all expected tables exist
    for (const tableName of TABLE_NAMES) {
      expect(tableNames).toContain(tableName);
    }
  });

  it("should be idempotent (running twice is safe)", () => {
    runMigrations(db);
    const version1 = getCurrentVersion(db);

    // Run again
    runMigrations(db);
    const version2 = getCurrentVersion(db);

    expect(version1).toBe(version2);
    expect(version2).toBe(SCHEMA_VERSION);
  });

  describe("Watchlists table", () => {
    beforeEach(() => {
      runMigrations(db);
    });

    it("should insert and query watchlists", () => {
      const insert = db.prepare("INSERT INTO watchlists (name, description) VALUES (?, ?)");
      const result = insert.run("My Watchlist", "Test description");

      expect(result.changes).toBe(1);

      const select = db.prepare("SELECT * FROM watchlists WHERE id = ?");
      const watchlist = select.get(result.lastInsertRowid) as {
        id: number;
        name: string;
        description: string;
        created_at: string;
        updated_at: string;
      };

      expect(watchlist.name).toBe("My Watchlist");
      expect(watchlist.description).toBe("Test description");
      expect(watchlist.created_at).toBeDefined();
    });

    it("should enforce unique watchlist names", () => {
      const insert = db.prepare("INSERT INTO watchlists (name) VALUES (?)");
      insert.run("Unique Name");

      expect(() => insert.run("Unique Name")).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe("Watchlist items table", () => {
    beforeEach(() => {
      runMigrations(db);
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Test Watchlist");
    });

    it("should insert watchlist items", () => {
      const insert = db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker, notes) VALUES (?, ?, ?)");
      const result = insert.run(1, "AAPL", "Great company");

      expect(result.changes).toBe(1);

      const select = db.prepare("SELECT * FROM watchlist_items WHERE id = ?");
      const item = select.get(result.lastInsertRowid) as {
        id: number;
        watchlist_id: number;
        ticker: string;
        notes: string;
      };

      expect(item.ticker).toBe("AAPL");
      expect(item.notes).toBe("Great company");
    });

    it("should enforce unique ticker per watchlist", () => {
      const insert = db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)");
      insert.run(1, "AAPL");

      expect(() => insert.run(1, "AAPL")).toThrow(/UNIQUE constraint failed/);
    });

    it("should allow same ticker in different watchlists", () => {
      db.prepare("INSERT INTO watchlists (name) VALUES (?)").run("Second Watchlist");

      const insert = db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)");
      insert.run(1, "AAPL");
      insert.run(2, "AAPL"); // Same ticker, different watchlist

      const count = db.prepare("SELECT COUNT(*) as count FROM watchlist_items WHERE ticker = ?").get("AAPL") as {
        count: number;
      };
      expect(count.count).toBe(2);
    });

    it("should cascade delete items when watchlist is deleted", () => {
      const insert = db.prepare("INSERT INTO watchlist_items (watchlist_id, ticker) VALUES (?, ?)");
      insert.run(1, "AAPL");
      insert.run(1, "MSFT");

      // Delete watchlist
      db.prepare("DELETE FROM watchlists WHERE id = ?").run(1);

      // Items should be deleted
      const count = db.prepare("SELECT COUNT(*) as count FROM watchlist_items").get() as { count: number };
      expect(count.count).toBe(0);
    });
  });

  describe("Screener configs table", () => {
    beforeEach(() => {
      runMigrations(db);
    });

    it("should store JSON config", () => {
      const config = JSON.stringify({
        columns: ["name", "close", "volume"],
        filters: [{ field: "close", op: "gte", value: 50 }],
      });

      const insert = db.prepare("INSERT INTO screener_configs (name, description, config) VALUES (?, ?, ?)");
      const result = insert.run("Tech Screener", "Finds tech stocks", config);

      const select = db.prepare("SELECT * FROM screener_configs WHERE id = ?");
      const row = select.get(result.lastInsertRowid) as {
        id: number;
        name: string;
        config: string;
      };

      const parsedConfig = JSON.parse(row.config);
      expect(parsedConfig.columns).toContain("name");
      expect(parsedConfig.filters).toHaveLength(1);
    });
  });

  describe("User preferences table", () => {
    beforeEach(() => {
      runMigrations(db);
    });

    it("should store and retrieve preferences", () => {
      const insert = db.prepare("INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)");
      insert.run("theme", JSON.stringify("dark"));
      insert.run("columns", JSON.stringify(["name", "close", "volume"]));

      const select = db.prepare("SELECT value FROM user_preferences WHERE key = ?");
      const theme = select.get("theme") as { value: string };
      const columns = select.get("columns") as { value: string };

      expect(JSON.parse(theme.value)).toBe("dark");
      expect(JSON.parse(columns.value)).toEqual(["name", "close", "volume"]);
    });

    it("should update existing preferences", () => {
      const insert = db.prepare("INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)");
      insert.run("theme", JSON.stringify("light"));
      insert.run("theme", JSON.stringify("dark")); // Update

      const count = db.prepare("SELECT COUNT(*) as count FROM user_preferences WHERE key = ?").get("theme") as {
        count: number;
      };
      expect(count.count).toBe(1);

      const select = db.prepare("SELECT value FROM user_preferences WHERE key = ?");
      const theme = select.get("theme") as { value: string };
      expect(JSON.parse(theme.value)).toBe("dark");
    });
  });
});
