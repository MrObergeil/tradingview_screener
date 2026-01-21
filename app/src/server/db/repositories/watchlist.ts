/**
 * Watchlist repository for managing watchlists, items, and tags.
 */

import type Database from "better-sqlite3";
import { BaseRepository, DatabaseError, type BaseEntity } from "./base.js";

/** Watchlist entity */
export interface Watchlist extends BaseEntity {
  name: string;
  description: string | null;
}

/** Watchlist item entity */
export interface WatchlistItem extends BaseEntity {
  watchlist_id: number;
  ticker: string;
  notes: string | null;
  added_at?: string;
}

/** Watchlist item tag entity */
export interface WatchlistItemTag extends BaseEntity {
  watchlist_item_id: number;
  tag: string;
}

/** Watchlist item with tags included */
export interface WatchlistItemWithTags extends WatchlistItem {
  tags: string[];
}

/** Full watchlist with items and tags */
export interface WatchlistWithItems extends Watchlist {
  items: WatchlistItemWithTags[];
  itemCount: number;
}

/**
 * Repository for watchlist operations.
 */
export class WatchlistRepository extends BaseRepository<Watchlist> {
  constructor(db: Database.Database) {
    super(db, "watchlists");
  }

  /**
   * Find watchlist by name.
   */
  findByName(name: string): Watchlist | undefined {
    return this.findOneBy("name", name);
  }

  /**
   * Get watchlist with all items and their tags.
   */
  findWithItems(id: number): WatchlistWithItems | undefined {
    const watchlist = this.findById(id);
    if (!watchlist) return undefined;

    const items = this.getItems(id);
    const itemsWithTags = items.map((item) => ({
      ...item,
      tags: this.getItemTags(item.id),
    }));

    return {
      ...watchlist,
      items: itemsWithTags,
      itemCount: items.length,
    };
  }

  /**
   * Get all watchlists with item counts.
   */
  findAllWithCounts(): (Watchlist & { itemCount: number })[] {
    try {
      const sql = `
        SELECT w.*, COUNT(wi.id) as itemCount
        FROM watchlists w
        LEFT JOIN watchlist_items wi ON w.id = wi.watchlist_id
        GROUP BY w.id
        ORDER BY w.name ASC
      `;
      return this.db.prepare(sql).all() as (Watchlist & { itemCount: number })[];
    } catch (err) {
      throw new DatabaseError("Failed to find watchlists with counts", "findAllWithCounts", this.tableName, err);
    }
  }

  // ============ Watchlist Items ============

  /**
   * Get all items in a watchlist.
   */
  getItems(watchlistId: number): WatchlistItem[] {
    try {
      const sql = "SELECT * FROM watchlist_items WHERE watchlist_id = ? ORDER BY added_at DESC";
      return this.db.prepare(sql).all(watchlistId) as WatchlistItem[];
    } catch (err) {
      throw new DatabaseError("Failed to get items", "getItems", "watchlist_items", err);
    }
  }

  /**
   * Get a single item by watchlist and ticker.
   */
  getItem(watchlistId: number, ticker: string): WatchlistItem | undefined {
    try {
      const sql = "SELECT * FROM watchlist_items WHERE watchlist_id = ? AND ticker = ?";
      return this.db.prepare(sql).get(watchlistId, ticker.toUpperCase()) as WatchlistItem | undefined;
    } catch (err) {
      throw new DatabaseError("Failed to get item", "getItem", "watchlist_items", err);
    }
  }

  /**
   * Add a ticker to a watchlist.
   */
  addItem(watchlistId: number, ticker: string, notes?: string): WatchlistItem {
    try {
      const sql = "INSERT INTO watchlist_items (watchlist_id, ticker, notes) VALUES (?, ?, ?)";
      const result = this.db.prepare(sql).run(watchlistId, ticker.toUpperCase(), notes ?? null);

      const item = this.db.prepare("SELECT * FROM watchlist_items WHERE id = ?").get(result.lastInsertRowid) as WatchlistItem;
      return item;
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        throw new DatabaseError(`Ticker ${ticker} already exists in watchlist`, "addItem", "watchlist_items", err);
      }
      throw new DatabaseError("Failed to add item", "addItem", "watchlist_items", err);
    }
  }

  /**
   * Add multiple tickers to a watchlist.
   * Returns added items and skipped duplicates.
   */
  addItems(
    watchlistId: number,
    tickers: string[]
  ): { added: WatchlistItem[]; skipped: string[] } {
    const added: WatchlistItem[] = [];
    const skipped: string[] = [];

    this.transaction(() => {
      for (const ticker of tickers) {
        try {
          const item = this.addItem(watchlistId, ticker);
          added.push(item);
        } catch (err) {
          if (err instanceof DatabaseError && err.message.includes("already exists")) {
            skipped.push(ticker.toUpperCase());
          } else {
            throw err;
          }
        }
      }
    });

    return { added, skipped };
  }

  /**
   * Update item notes.
   */
  updateItemNotes(itemId: number, notes: string | null): WatchlistItem {
    try {
      const sql = "UPDATE watchlist_items SET notes = ? WHERE id = ?";
      const result = this.db.prepare(sql).run(notes, itemId);

      if (result.changes === 0) {
        throw new DatabaseError(`Item with id ${itemId} not found`, "updateItemNotes", "watchlist_items");
      }

      return this.db.prepare("SELECT * FROM watchlist_items WHERE id = ?").get(itemId) as WatchlistItem;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError("Failed to update item notes", "updateItemNotes", "watchlist_items", err);
    }
  }

  /**
   * Remove a ticker from a watchlist.
   */
  removeItem(watchlistId: number, ticker: string): boolean {
    try {
      const sql = "DELETE FROM watchlist_items WHERE watchlist_id = ? AND ticker = ?";
      const result = this.db.prepare(sql).run(watchlistId, ticker.toUpperCase());
      return result.changes > 0;
    } catch (err) {
      throw new DatabaseError("Failed to remove item", "removeItem", "watchlist_items", err);
    }
  }

  /**
   * Remove item by ID.
   */
  removeItemById(itemId: number): boolean {
    try {
      const sql = "DELETE FROM watchlist_items WHERE id = ?";
      const result = this.db.prepare(sql).run(itemId);
      return result.changes > 0;
    } catch (err) {
      throw new DatabaseError("Failed to remove item", "removeItemById", "watchlist_items", err);
    }
  }

  // ============ Item Tags ============

  /**
   * Get all tags for an item.
   */
  getItemTags(itemId: number): string[] {
    try {
      const sql = "SELECT tag FROM watchlist_item_tags WHERE watchlist_item_id = ? ORDER BY tag";
      const rows = this.db.prepare(sql).all(itemId) as { tag: string }[];
      return rows.map((r) => r.tag);
    } catch (err) {
      throw new DatabaseError("Failed to get item tags", "getItemTags", "watchlist_item_tags", err);
    }
  }

  /**
   * Add a tag to an item.
   */
  addItemTag(itemId: number, tag: string): void {
    try {
      const sql = "INSERT INTO watchlist_item_tags (watchlist_item_id, tag) VALUES (?, ?)";
      this.db.prepare(sql).run(itemId, tag.toLowerCase().trim());
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        // Tag already exists, ignore
        return;
      }
      throw new DatabaseError("Failed to add item tag", "addItemTag", "watchlist_item_tags", err);
    }
  }

  /**
   * Set all tags for an item (replaces existing).
   */
  setItemTags(itemId: number, tags: string[]): void {
    this.transaction(() => {
      // Remove existing tags
      this.db.prepare("DELETE FROM watchlist_item_tags WHERE watchlist_item_id = ?").run(itemId);

      // Add new tags
      const uniqueTags = [...new Set(tags.map((t) => t.toLowerCase().trim()))];
      for (const tag of uniqueTags) {
        if (tag) {
          this.addItemTag(itemId, tag);
        }
      }
    });
  }

  /**
   * Remove a tag from an item.
   */
  removeItemTag(itemId: number, tag: string): boolean {
    try {
      const sql = "DELETE FROM watchlist_item_tags WHERE watchlist_item_id = ? AND tag = ?";
      const result = this.db.prepare(sql).run(itemId, tag.toLowerCase().trim());
      return result.changes > 0;
    } catch (err) {
      throw new DatabaseError("Failed to remove item tag", "removeItemTag", "watchlist_item_tags", err);
    }
  }

  /**
   * Get all unique tags used across all watchlists.
   */
  getAllTags(): string[] {
    try {
      const sql = "SELECT DISTINCT tag FROM watchlist_item_tags ORDER BY tag";
      const rows = this.db.prepare(sql).all() as { tag: string }[];
      return rows.map((r) => r.tag);
    } catch (err) {
      throw new DatabaseError("Failed to get all tags", "getAllTags", "watchlist_item_tags", err);
    }
  }
}
