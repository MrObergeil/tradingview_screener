import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { existsSync, rmSync, mkdirSync } from "fs";
import { resolve } from "path";
import Database from "better-sqlite3";
import { WatchlistRepository, type Watchlist } from "../../src/server/db/repositories/watchlist";
import { runMigrations } from "../../src/server/db/schema";
import { DatabaseError } from "../../src/server/db/repositories/base";

describe("WatchlistRepository", () => {
  const testDbPath = resolve(process.cwd(), "data", "watchlist-test.db");
  let db: Database.Database;
  let repo: WatchlistRepository;

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

    // Create fresh database with schema
    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
    runMigrations(db);

    repo = new WatchlistRepository(db);
  });

  afterAll(() => {
    if (db?.open) {
      db.close();
    }
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

  describe("Watchlist CRUD", () => {
    it("should create a watchlist", () => {
      const watchlist = repo.create({ name: "Tech Stocks", description: "Technology companies" });

      expect(watchlist.id).toBe(1);
      expect(watchlist.name).toBe("Tech Stocks");
      expect(watchlist.description).toBe("Technology companies");
    });

    it("should find watchlist by name", () => {
      repo.create({ name: "Tech Stocks", description: null });

      const found = repo.findByName("Tech Stocks");

      expect(found).toBeDefined();
      expect(found?.name).toBe("Tech Stocks");
    });

    it("should return undefined for non-existent name", () => {
      const found = repo.findByName("NonExistent");
      expect(found).toBeUndefined();
    });

    it("should update watchlist", () => {
      const watchlist = repo.create({ name: "Original", description: null });

      const updated = repo.update(watchlist.id, { name: "Updated", description: "New desc" });

      expect(updated.name).toBe("Updated");
      expect(updated.description).toBe("New desc");
    });

    it("should delete watchlist", () => {
      const watchlist = repo.create({ name: "ToDelete", description: null });

      const deleted = repo.delete(watchlist.id);

      expect(deleted).toBe(true);
      expect(repo.findById(watchlist.id)).toBeUndefined();
    });

    it("should enforce unique names", () => {
      repo.create({ name: "Unique", description: null });

      expect(() => repo.create({ name: "Unique", description: null })).toThrow();
    });
  });

  describe("findAllWithCounts", () => {
    it("should return watchlists with item counts", () => {
      const wl1 = repo.create({ name: "List1", description: null });
      const wl2 = repo.create({ name: "List2", description: null });
      repo.create({ name: "List3", description: null }); // Empty

      repo.addItem(wl1.id, "AAPL");
      repo.addItem(wl1.id, "MSFT");
      repo.addItem(wl2.id, "GOOGL");

      const results = repo.findAllWithCounts();

      expect(results).toHaveLength(3);
      expect(results.find((w) => w.name === "List1")?.itemCount).toBe(2);
      expect(results.find((w) => w.name === "List2")?.itemCount).toBe(1);
      expect(results.find((w) => w.name === "List3")?.itemCount).toBe(0);
    });
  });

  describe("findWithItems", () => {
    it("should return watchlist with items and tags", () => {
      const watchlist = repo.create({ name: "Test", description: null });
      const item1 = repo.addItem(watchlist.id, "AAPL", "Apple Inc");
      const item2 = repo.addItem(watchlist.id, "MSFT");

      repo.addItemTag(item1.id, "tech");
      repo.addItemTag(item1.id, "mega-cap");
      repo.addItemTag(item2.id, "tech");

      const result = repo.findWithItems(watchlist.id);

      expect(result).toBeDefined();
      expect(result?.items).toHaveLength(2);
      expect(result?.itemCount).toBe(2);

      const aaplItem = result?.items.find((i) => i.ticker === "AAPL");
      expect(aaplItem?.notes).toBe("Apple Inc");
      expect(aaplItem?.tags).toContain("tech");
      expect(aaplItem?.tags).toContain("mega-cap");
    });

    it("should return undefined for non-existent watchlist", () => {
      const result = repo.findWithItems(999);
      expect(result).toBeUndefined();
    });
  });

  describe("Watchlist Items", () => {
    let watchlist: Watchlist;

    beforeEach(() => {
      watchlist = repo.create({ name: "Test Watchlist", description: null });
    });

    it("should add item to watchlist", () => {
      const item = repo.addItem(watchlist.id, "AAPL", "Apple Inc");

      expect(item.id).toBeDefined();
      expect(item.ticker).toBe("AAPL");
      expect(item.notes).toBe("Apple Inc");
      expect(item.watchlist_id).toBe(watchlist.id);
    });

    it("should uppercase ticker", () => {
      const item = repo.addItem(watchlist.id, "aapl");
      expect(item.ticker).toBe("AAPL");
    });

    it("should get all items in watchlist", () => {
      repo.addItem(watchlist.id, "AAPL");
      repo.addItem(watchlist.id, "MSFT");
      repo.addItem(watchlist.id, "GOOGL");

      const items = repo.getItems(watchlist.id);

      expect(items).toHaveLength(3);
    });

    it("should get item by ticker", () => {
      repo.addItem(watchlist.id, "AAPL", "Apple");

      const item = repo.getItem(watchlist.id, "AAPL");

      expect(item).toBeDefined();
      expect(item?.notes).toBe("Apple");
    });

    it("should get item by ticker case-insensitive", () => {
      repo.addItem(watchlist.id, "AAPL");

      const item = repo.getItem(watchlist.id, "aapl");

      expect(item).toBeDefined();
      expect(item?.ticker).toBe("AAPL");
    });

    it("should prevent duplicate tickers in same watchlist", () => {
      repo.addItem(watchlist.id, "AAPL");

      expect(() => repo.addItem(watchlist.id, "AAPL")).toThrow(DatabaseError);
      expect(() => repo.addItem(watchlist.id, "AAPL")).toThrow(/already exists/);
    });

    it("should allow same ticker in different watchlists", () => {
      const watchlist2 = repo.create({ name: "Second", description: null });

      repo.addItem(watchlist.id, "AAPL");
      const item2 = repo.addItem(watchlist2.id, "AAPL");

      expect(item2.ticker).toBe("AAPL");
    });

    it("should add multiple items", () => {
      const result = repo.addItems(watchlist.id, ["AAPL", "MSFT", "GOOGL"]);

      expect(result.added).toHaveLength(3);
      expect(result.skipped).toHaveLength(0);
    });

    it("should skip duplicates when adding multiple items", () => {
      repo.addItem(watchlist.id, "AAPL");

      const result = repo.addItems(watchlist.id, ["AAPL", "MSFT", "AAPL"]);

      expect(result.added).toHaveLength(1); // Only MSFT
      expect(result.skipped).toContain("AAPL");
    });

    it("should update item notes", () => {
      const item = repo.addItem(watchlist.id, "AAPL", "Original");

      const updated = repo.updateItemNotes(item.id, "Updated notes");

      expect(updated.notes).toBe("Updated notes");
    });

    it("should remove item by ticker", () => {
      repo.addItem(watchlist.id, "AAPL");

      const removed = repo.removeItem(watchlist.id, "AAPL");

      expect(removed).toBe(true);
      expect(repo.getItem(watchlist.id, "AAPL")).toBeUndefined();
    });

    it("should return false when removing non-existent item", () => {
      const removed = repo.removeItem(watchlist.id, "NOTEXIST");
      expect(removed).toBe(false);
    });

    it("should remove item by id", () => {
      const item = repo.addItem(watchlist.id, "AAPL");

      const removed = repo.removeItemById(item.id);

      expect(removed).toBe(true);
      expect(repo.getItems(watchlist.id)).toHaveLength(0);
    });

    it("should cascade delete items when watchlist deleted", () => {
      repo.addItem(watchlist.id, "AAPL");
      repo.addItem(watchlist.id, "MSFT");

      repo.delete(watchlist.id);

      // Items should be deleted via cascade
      const items = db.prepare("SELECT * FROM watchlist_items WHERE watchlist_id = ?").all(watchlist.id);
      expect(items).toHaveLength(0);
    });
  });

  describe("Item Tags", () => {
    let watchlist: Watchlist;
    let itemId: number;

    beforeEach(() => {
      watchlist = repo.create({ name: "Test", description: null });
      const item = repo.addItem(watchlist.id, "AAPL");
      itemId = item.id;
    });

    it("should add tag to item", () => {
      repo.addItemTag(itemId, "tech");

      const tags = repo.getItemTags(itemId);

      expect(tags).toContain("tech");
    });

    it("should lowercase tags", () => {
      repo.addItemTag(itemId, "TECH");

      const tags = repo.getItemTags(itemId);

      expect(tags).toContain("tech");
    });

    it("should ignore duplicate tags", () => {
      repo.addItemTag(itemId, "tech");
      repo.addItemTag(itemId, "tech");

      const tags = repo.getItemTags(itemId);

      expect(tags).toHaveLength(1);
    });

    it("should get all tags for item", () => {
      repo.addItemTag(itemId, "tech");
      repo.addItemTag(itemId, "mega-cap");
      repo.addItemTag(itemId, "growth");

      const tags = repo.getItemTags(itemId);

      expect(tags).toHaveLength(3);
      expect(tags).toContain("growth");
      expect(tags).toContain("mega-cap");
      expect(tags).toContain("tech");
    });

    it("should set all tags (replace existing)", () => {
      repo.addItemTag(itemId, "old-tag");

      repo.setItemTags(itemId, ["new-tag1", "new-tag2"]);

      const tags = repo.getItemTags(itemId);

      expect(tags).toHaveLength(2);
      expect(tags).not.toContain("old-tag");
      expect(tags).toContain("new-tag1");
      expect(tags).toContain("new-tag2");
    });

    it("should deduplicate tags when setting", () => {
      repo.setItemTags(itemId, ["tech", "TECH", "Tech"]);

      const tags = repo.getItemTags(itemId);

      expect(tags).toHaveLength(1);
      expect(tags).toContain("tech");
    });

    it("should remove tag from item", () => {
      repo.addItemTag(itemId, "tech");
      repo.addItemTag(itemId, "growth");

      const removed = repo.removeItemTag(itemId, "tech");

      expect(removed).toBe(true);
      expect(repo.getItemTags(itemId)).not.toContain("tech");
      expect(repo.getItemTags(itemId)).toContain("growth");
    });

    it("should get all unique tags across watchlists", () => {
      const watchlist2 = repo.create({ name: "Second", description: null });
      const item2 = repo.addItem(watchlist2.id, "MSFT");

      repo.addItemTag(itemId, "tech");
      repo.addItemTag(itemId, "mega-cap");
      repo.addItemTag(item2.id, "tech");
      repo.addItemTag(item2.id, "value");

      const allTags = repo.getAllTags();

      expect(allTags).toHaveLength(3); // tech, mega-cap, value (no duplicates)
      expect(allTags).toContain("tech");
      expect(allTags).toContain("mega-cap");
      expect(allTags).toContain("value");
    });

    it("should cascade delete tags when item deleted", () => {
      repo.addItemTag(itemId, "tech");
      repo.addItemTag(itemId, "growth");

      repo.removeItemById(itemId);

      // Tags should be deleted via cascade
      const tags = db.prepare("SELECT * FROM watchlist_item_tags WHERE watchlist_item_id = ?").all(itemId);
      expect(tags).toHaveLength(0);
    });
  });
});
