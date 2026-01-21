/**
 * SQLite database connection using better-sqlite3.
 * Provides a singleton connection with WAL mode for better concurrency.
 */

import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { config } from "../config";
import { runMigrations } from "./schema.js";

let db: Database.Database | null = null;

/**
 * Get the database connection (singleton).
 * Creates the database file and parent directories if they don't exist.
 * Runs migrations automatically on first connection.
 */
export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure parent directory exists
  const dbDir = dirname(config.databasePath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection
  db = new Database(config.databasePath);

  // Enable WAL mode for better concurrency
  db.pragma("journal_mode = WAL");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Run migrations to ensure schema is up to date
  runMigrations(db);

  return db;
}

/**
 * Close the database connection.
 * Should be called on graceful shutdown.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Check if the database is connected.
 */
export function isDatabaseConnected(): boolean {
  return db !== null && db.open;
}
