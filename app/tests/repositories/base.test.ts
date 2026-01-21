import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { existsSync, rmSync, mkdirSync } from "fs";
import { resolve } from "path";
import Database from "better-sqlite3";
import { BaseRepository, DatabaseError, type BaseEntity, type CreateEntity } from "../../src/server/db/repositories/base";

/** Test entity matching watchlists table structure */
interface TestWatchlist extends BaseEntity {
  name: string;
  description: string | null;
}

describe("BaseRepository", () => {
  const testDbPath = resolve(process.cwd(), "data", "repo-test.db");
  let db: Database.Database;
  let repo: BaseRepository<TestWatchlist>;

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

    // Create test table
    db.exec(`
      CREATE TABLE watchlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    repo = new BaseRepository<TestWatchlist>(db, "watchlists");
  });

  afterAll(() => {
    // Clean up test database
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

  describe("create", () => {
    it("should create entity and return with id", () => {
      const data: CreateEntity<TestWatchlist> = {
        name: "My Watchlist",
        description: "Test description",
      };

      const created = repo.create(data);

      expect(created.id).toBe(1);
      expect(created.name).toBe("My Watchlist");
      expect(created.description).toBe("Test description");
      expect(created.created_at).toBeDefined();
    });

    it("should throw on unique constraint violation", () => {
      repo.create({ name: "Unique", description: null });

      expect(() => repo.create({ name: "Unique", description: null })).toThrow(DatabaseError);
    });
  });

  describe("findById", () => {
    it("should find existing entity", () => {
      const created = repo.create({ name: "Test", description: null });

      const found = repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.name).toBe("Test");
    });

    it("should return undefined for non-existent id", () => {
      const found = repo.findById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("findByIdOrThrow", () => {
    it("should return entity when exists", () => {
      const created = repo.create({ name: "Test", description: null });

      const found = repo.findByIdOrThrow(created.id);

      expect(found.name).toBe("Test");
    });

    it("should throw when not found", () => {
      expect(() => repo.findByIdOrThrow(999)).toThrow(DatabaseError);
      expect(() => repo.findByIdOrThrow(999)).toThrow(/not found/);
    });
  });

  describe("findAll", () => {
    beforeEach(() => {
      repo.create({ name: "Alpha", description: null });
      repo.create({ name: "Beta", description: null });
      repo.create({ name: "Gamma", description: null });
    });

    it("should return all entities", () => {
      const all = repo.findAll();
      expect(all).toHaveLength(3);
    });

    it("should order by column ascending", () => {
      const all = repo.findAll("name", "asc");
      expect(all[0]?.name).toBe("Alpha");
      expect(all[2]?.name).toBe("Gamma");
    });

    it("should order by column descending", () => {
      const all = repo.findAll("name", "desc");
      expect(all[0]?.name).toBe("Gamma");
      expect(all[2]?.name).toBe("Alpha");
    });
  });

  describe("findBy", () => {
    beforeEach(() => {
      repo.create({ name: "Test1", description: "GroupA" });
      repo.create({ name: "Test2", description: "GroupA" });
      repo.create({ name: "Test3", description: "GroupB" });
    });

    it("should find all matching entities", () => {
      const found = repo.findBy("description", "GroupA");
      expect(found).toHaveLength(2);
    });

    it("should return empty array when no matches", () => {
      const found = repo.findBy("description", "NonExistent");
      expect(found).toHaveLength(0);
    });
  });

  describe("findOneBy", () => {
    beforeEach(() => {
      repo.create({ name: "Test1", description: "Unique" });
      repo.create({ name: "Test2", description: "Duplicate" });
      repo.create({ name: "Test3", description: "Duplicate" });
    });

    it("should find single entity", () => {
      const found = repo.findOneBy("description", "Unique");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Test1");
    });

    it("should return first match when multiple exist", () => {
      const found = repo.findOneBy("description", "Duplicate");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Test2");
    });

    it("should return undefined when no match", () => {
      const found = repo.findOneBy("description", "NonExistent");
      expect(found).toBeUndefined();
    });
  });

  describe("update", () => {
    it("should update entity and return updated version", () => {
      const created = repo.create({ name: "Original", description: null });

      const updated = repo.update(created.id, { name: "Updated", description: "New desc" });

      expect(updated.name).toBe("Updated");
      expect(updated.description).toBe("New desc");
      expect(updated.updated_at).toBeDefined();
    });

    it("should only update provided fields", () => {
      const created = repo.create({ name: "Original", description: "Keep this" });

      const updated = repo.update(created.id, { name: "Updated" });

      expect(updated.name).toBe("Updated");
      expect(updated.description).toBe("Keep this");
    });

    it("should throw when entity not found", () => {
      expect(() => repo.update(999, { name: "Updated" })).toThrow(DatabaseError);
      expect(() => repo.update(999, { name: "Updated" })).toThrow(/not found/);
    });
  });

  describe("delete", () => {
    it("should delete entity and return true", () => {
      const created = repo.create({ name: "ToDelete", description: null });

      const deleted = repo.delete(created.id);

      expect(deleted).toBe(true);
      expect(repo.findById(created.id)).toBeUndefined();
    });

    it("should return false when entity not found", () => {
      const deleted = repo.delete(999);
      expect(deleted).toBe(false);
    });
  });

  describe("deleteOrThrow", () => {
    it("should delete entity without error when exists", () => {
      const created = repo.create({ name: "ToDelete", description: null });

      expect(() => repo.deleteOrThrow(created.id)).not.toThrow();
      expect(repo.findById(created.id)).toBeUndefined();
    });

    it("should throw when entity not found", () => {
      expect(() => repo.deleteOrThrow(999)).toThrow(DatabaseError);
    });
  });

  describe("count", () => {
    it("should return 0 for empty table", () => {
      expect(repo.count()).toBe(0);
    });

    it("should return correct count", () => {
      repo.create({ name: "Test1", description: null });
      repo.create({ name: "Test2", description: null });
      repo.create({ name: "Test3", description: null });

      expect(repo.count()).toBe(3);
    });
  });

  describe("exists", () => {
    it("should return true when entity exists", () => {
      const created = repo.create({ name: "Test", description: null });
      expect(repo.exists(created.id)).toBe(true);
    });

    it("should return false when entity does not exist", () => {
      expect(repo.exists(999)).toBe(false);
    });
  });

  describe("transaction", () => {
    it("should commit successful transaction", () => {
      repo.transaction(() => {
        repo.create({ name: "Trans1", description: null });
        repo.create({ name: "Trans2", description: null });
      });

      expect(repo.count()).toBe(2);
    });

    it("should rollback on error", () => {
      expect(() =>
        repo.transaction(() => {
          repo.create({ name: "Trans1", description: null });
          throw new Error("Abort transaction");
        })
      ).toThrow("Abort transaction");

      expect(repo.count()).toBe(0);
    });
  });
});
