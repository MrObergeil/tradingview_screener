/**
 * Base repository with generic CRUD operations.
 * Provides typed database access patterns for all entities.
 */

import type Database from "better-sqlite3";
import type { TableName } from "../schema.js";

/** Base entity with id and timestamps */
export interface BaseEntity {
  id: number;
  created_at?: string;
  updated_at?: string;
}

/** Entity without id (for inserts) */
export type CreateEntity<T extends BaseEntity> = Omit<T, "id" | "created_at" | "updated_at">;

/** Partial entity for updates */
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, "id" | "created_at">>;

/** Database error with additional context */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly table: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Base repository class providing generic CRUD operations.
 * Extend this class for entity-specific repositories.
 */
export class BaseRepository<T extends BaseEntity> {
  constructor(
    protected readonly db: Database.Database,
    protected readonly tableName: TableName
  ) {}

  /**
   * Find entity by ID.
   * @returns Entity or undefined if not found
   */
  findById(id: number): T | undefined {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
      return stmt.get(id) as T | undefined;
    } catch (err) {
      throw new DatabaseError(`Failed to find by id`, "findById", this.tableName, err);
    }
  }

  /**
   * Find entity by ID, throwing if not found.
   * @throws DatabaseError if entity not found
   */
  findByIdOrThrow(id: number): T {
    const entity = this.findById(id);
    if (!entity) {
      throw new DatabaseError(`Entity with id ${id} not found`, "findByIdOrThrow", this.tableName);
    }
    return entity;
  }

  /**
   * Find all entities.
   * @param orderBy - Optional column to order by
   * @param direction - Sort direction (default: "asc")
   */
  findAll(orderBy?: keyof T & string, direction: "asc" | "desc" = "asc"): T[] {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      if (orderBy) {
        sql += ` ORDER BY ${orderBy} ${direction.toUpperCase()}`;
      }
      const stmt = this.db.prepare(sql);
      return stmt.all() as T[];
    } catch (err) {
      throw new DatabaseError(`Failed to find all`, "findAll", this.tableName, err);
    }
  }

  /**
   * Find entities matching a condition.
   * @param column - Column to filter by
   * @param value - Value to match
   */
  findBy<K extends keyof T & string>(column: K, value: T[K]): T[] {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${column} = ?`);
      return stmt.all(value) as T[];
    } catch (err) {
      throw new DatabaseError(`Failed to find by ${column}`, "findBy", this.tableName, err);
    }
  }

  /**
   * Find single entity matching a condition.
   * @param column - Column to filter by
   * @param value - Value to match
   */
  findOneBy<K extends keyof T & string>(column: K, value: T[K]): T | undefined {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${column} = ? LIMIT 1`);
      return stmt.get(value) as T | undefined;
    } catch (err) {
      throw new DatabaseError(`Failed to find one by ${column}`, "findOneBy", this.tableName, err);
    }
  }

  /**
   * Create a new entity.
   * @returns Created entity with ID
   */
  create(data: CreateEntity<T>): T {
    try {
      const columns = Object.keys(data);
      const placeholders = columns.map(() => "?").join(", ");
      const values = Object.values(data);

      const sql = `INSERT INTO ${this.tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...values);

      return this.findByIdOrThrow(result.lastInsertRowid as number);
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(`Failed to create`, "create", this.tableName, err);
    }
  }

  /**
   * Update an existing entity.
   * @param id - Entity ID to update
   * @param data - Fields to update
   * @returns Updated entity
   */
  update(id: number, data: UpdateEntity<T>): T {
    try {
      // Add updated_at if not provided and table has it
      const updateData = { ...data, updated_at: new Date().toISOString() };
      const columns = Object.keys(updateData);
      const setClause = columns.map((col) => `${col} = ?`).join(", ");
      const values = Object.values(updateData);

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...values, id);

      if (result.changes === 0) {
        throw new DatabaseError(`Entity with id ${id} not found`, "update", this.tableName);
      }

      return this.findByIdOrThrow(id);
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(`Failed to update`, "update", this.tableName, err);
    }
  }

  /**
   * Delete an entity by ID.
   * @returns true if deleted, false if not found
   */
  delete(id: number): boolean {
    try {
      const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (err) {
      throw new DatabaseError(`Failed to delete`, "delete", this.tableName, err);
    }
  }

  /**
   * Delete entity by ID, throwing if not found.
   */
  deleteOrThrow(id: number): void {
    const deleted = this.delete(id);
    if (!deleted) {
      throw new DatabaseError(`Entity with id ${id} not found`, "deleteOrThrow", this.tableName);
    }
  }

  /**
   * Count all entities.
   */
  count(): number {
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (err) {
      throw new DatabaseError(`Failed to count`, "count", this.tableName, err);
    }
  }

  /**
   * Check if entity exists by ID.
   */
  exists(id: number): boolean {
    try {
      const stmt = this.db.prepare(`SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`);
      return stmt.get(id) !== undefined;
    } catch (err) {
      throw new DatabaseError(`Failed to check existence`, "exists", this.tableName, err);
    }
  }

  /**
   * Run a callback in a transaction.
   * Automatically rolls back on error.
   */
  transaction<R>(fn: () => R): R {
    return this.db.transaction(fn)();
  }
}
