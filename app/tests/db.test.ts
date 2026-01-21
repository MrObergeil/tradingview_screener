import { describe, it, expect, afterAll } from "vitest";
import { existsSync, rmSync, mkdirSync } from "fs";
import { resolve } from "path";
import Database from "better-sqlite3";

describe("Database Connection", () => {
  const testDbPath = resolve(process.cwd(), "data", "test.db");

  afterAll(() => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  it("should create database file and connect", () => {
    // Ensure directory exists
    const dbDir = resolve(process.cwd(), "data");
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(testDbPath);
    expect(db.open).toBe(true);

    // Enable WAL mode
    db.pragma("journal_mode = WAL");
    const journalMode = db.pragma("journal_mode", { simple: true });
    expect(journalMode).toBe("wal");

    // Enable foreign keys
    db.pragma("foreign_keys = ON");
    const foreignKeys = db.pragma("foreign_keys", { simple: true });
    expect(foreignKeys).toBe(1);

    db.close();
    expect(db.open).toBe(false);
  });

  it("should create tables and perform basic operations", () => {
    const db = new Database(testDbPath);

    // Create a test table
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert a row
    const insert = db.prepare("INSERT INTO test_items (name) VALUES (?)");
    const result = insert.run("test item");
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeGreaterThan(0);

    // Query the row
    const select = db.prepare("SELECT * FROM test_items WHERE id = ?");
    const row = select.get(result.lastInsertRowid) as { id: number; name: string; created_at: string };
    expect(row.name).toBe("test item");
    expect(row.created_at).toBeDefined();

    db.close();
  });

  it("should support transactions", () => {
    const db = new Database(testDbPath);

    // Start a transaction
    const insertMany = db.transaction((items: string[]) => {
      const insert = db.prepare("INSERT INTO test_items (name) VALUES (?)");
      for (const item of items) {
        insert.run(item);
      }
      return items.length;
    });

    const count = insertMany(["item1", "item2", "item3"]);
    expect(count).toBe(3);

    // Verify all items inserted
    const countQuery = db.prepare("SELECT COUNT(*) as count FROM test_items");
    const result = countQuery.get() as { count: number };
    expect(result.count).toBeGreaterThanOrEqual(3);

    db.close();
  });
});
