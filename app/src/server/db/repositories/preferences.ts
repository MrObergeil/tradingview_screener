/**
 * User preferences repository for managing settings and favorite fields.
 */

import type Database from "better-sqlite3";
import { DatabaseError } from "./base.js";

/** User preference entity */
export interface UserPreference {
  key: string;
  value: string;
  updated_at: string;
}

/** Favorite field entity */
export interface FavoriteField {
  id: number;
  field_name: string;
  display_order: number;
}

/** Known preference keys */
export type PreferenceKey =
  | "theme"
  | "defaultColumns"
  | "resultsPerPage"
  | "autoRefresh"
  | "refreshInterval";

/**
 * Repository for user preferences and favorite fields.
 */
export class PreferencesRepository {
  constructor(private readonly db: Database.Database) {}

  // ============ User Preferences (Key-Value) ============

  /**
   * Get a preference value by key.
   */
  get(key: PreferenceKey): string | undefined {
    try {
      const sql = "SELECT value FROM user_preferences WHERE key = ?";
      const row = this.db.prepare(sql).get(key) as { value: string } | undefined;
      return row?.value;
    } catch (err) {
      throw new DatabaseError("Failed to get preference", "get", "user_preferences", err);
    }
  }

  /**
   * Get a preference with a default value if not set.
   */
  getOrDefault(key: PreferenceKey, defaultValue: string): string {
    return this.get(key) ?? defaultValue;
  }

  /**
   * Get a preference as JSON, with optional default.
   */
  getJson<T>(key: PreferenceKey, defaultValue?: T): T | undefined {
    const value = this.get(key);
    if (value === undefined) return defaultValue;
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set a preference value.
   */
  set(key: PreferenceKey, value: string): void {
    try {
      const sql = `
        INSERT INTO user_preferences (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `;
      this.db.prepare(sql).run(key, value);
    } catch (err) {
      throw new DatabaseError("Failed to set preference", "set", "user_preferences", err);
    }
  }

  /**
   * Set a preference as JSON.
   */
  setJson<T>(key: PreferenceKey, value: T): void {
    this.set(key, JSON.stringify(value));
  }

  /**
   * Delete a preference.
   */
  delete(key: PreferenceKey): boolean {
    try {
      const sql = "DELETE FROM user_preferences WHERE key = ?";
      const result = this.db.prepare(sql).run(key);
      return result.changes > 0;
    } catch (err) {
      throw new DatabaseError("Failed to delete preference", "delete", "user_preferences", err);
    }
  }

  /**
   * Get all preferences.
   */
  getAll(): Record<string, string> {
    try {
      const sql = "SELECT key, value FROM user_preferences";
      const rows = this.db.prepare(sql).all() as UserPreference[];
      const prefs: Record<string, string> = {};
      for (const row of rows) {
        prefs[row.key] = row.value;
      }
      return prefs;
    } catch (err) {
      throw new DatabaseError("Failed to get all preferences", "getAll", "user_preferences", err);
    }
  }

  /**
   * Set multiple preferences at once.
   */
  setMany(preferences: Record<string, string>): void {
    const sql = `
      INSERT INTO user_preferences (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `;
    const stmt = this.db.prepare(sql);

    this.db.transaction(() => {
      for (const [key, value] of Object.entries(preferences)) {
        stmt.run(key, value);
      }
    })();
  }

  // ============ Favorite Fields ============

  /**
   * Get all favorite fields ordered by display_order.
   */
  getFavoriteFields(): FavoriteField[] {
    try {
      const sql = "SELECT * FROM favorite_fields ORDER BY display_order ASC, field_name ASC";
      return this.db.prepare(sql).all() as FavoriteField[];
    } catch (err) {
      throw new DatabaseError("Failed to get favorite fields", "getFavoriteFields", "favorite_fields", err);
    }
  }

  /**
   * Get favorite field names only.
   */
  getFavoriteFieldNames(): string[] {
    return this.getFavoriteFields().map((f) => f.field_name);
  }

  /**
   * Add a field to favorites.
   */
  addFavoriteField(fieldName: string): FavoriteField {
    try {
      // Get max order
      const maxOrder = this.db
        .prepare("SELECT MAX(display_order) as max FROM favorite_fields")
        .get() as { max: number | null };
      const order = (maxOrder.max ?? -1) + 1;

      const sql = "INSERT INTO favorite_fields (field_name, display_order) VALUES (?, ?)";
      const result = this.db.prepare(sql).run(fieldName, order);

      return {
        id: result.lastInsertRowid as number,
        field_name: fieldName,
        display_order: order,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        throw new DatabaseError(`Field "${fieldName}" is already a favorite`, "addFavoriteField", "favorite_fields", err);
      }
      throw new DatabaseError("Failed to add favorite field", "addFavoriteField", "favorite_fields", err);
    }
  }

  /**
   * Remove a field from favorites.
   */
  removeFavoriteField(fieldName: string): boolean {
    try {
      const sql = "DELETE FROM favorite_fields WHERE field_name = ?";
      const result = this.db.prepare(sql).run(fieldName);
      return result.changes > 0;
    } catch (err) {
      throw new DatabaseError("Failed to remove favorite field", "removeFavoriteField", "favorite_fields", err);
    }
  }

  /**
   * Check if a field is a favorite.
   */
  isFavoriteField(fieldName: string): boolean {
    try {
      const sql = "SELECT 1 FROM favorite_fields WHERE field_name = ? LIMIT 1";
      return this.db.prepare(sql).get(fieldName) !== undefined;
    } catch (err) {
      throw new DatabaseError("Failed to check favorite field", "isFavoriteField", "favorite_fields", err);
    }
  }

  /**
   * Reorder favorite fields.
   */
  reorderFavoriteFields(fieldNames: string[]): void {
    const sql = "UPDATE favorite_fields SET display_order = ? WHERE field_name = ?";
    const stmt = this.db.prepare(sql);

    this.db.transaction(() => {
      fieldNames.forEach((name, index) => {
        stmt.run(index, name);
      });
    })();
  }

  /**
   * Set favorite fields (replaces all existing).
   */
  setFavoriteFields(fieldNames: string[]): void {
    this.db.transaction(() => {
      // Clear existing
      this.db.prepare("DELETE FROM favorite_fields").run();

      // Add new ones
      const sql = "INSERT INTO favorite_fields (field_name, display_order) VALUES (?, ?)";
      const stmt = this.db.prepare(sql);
      fieldNames.forEach((name, index) => {
        stmt.run(name, index);
      });
    })();
  }
}
