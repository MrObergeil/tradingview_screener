/**
 * Database schema definitions and migrations.
 * Based on spec_v2.md schema specification.
 */

import type Database from "better-sqlite3";

/** Current schema version */
export const SCHEMA_VERSION = 1;

/** SQL statements to create all tables */
const SCHEMA_SQL = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Watchlists
CREATE TABLE IF NOT EXISTS watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist items (tickers)
CREATE TABLE IF NOT EXISTS watchlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    notes TEXT,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
    UNIQUE(watchlist_id, ticker)
);

-- Watchlist item tags
CREATE TABLE IF NOT EXISTS watchlist_item_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_item_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (watchlist_item_id) REFERENCES watchlist_items(id) ON DELETE CASCADE,
    UNIQUE(watchlist_item_id, tag)
);

-- Saved screener configurations
CREATE TABLE IF NOT EXISTS screener_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    config TEXT NOT NULL,
    momentum_config TEXT,
    is_preset INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    rule_type TEXT NOT NULL,
    target_id INTEGER,
    target_ticker TEXT,
    conditions TEXT NOT NULL,
    cooldown_minutes INTEGER DEFAULT 60,
    sound_enabled INTEGER DEFAULT 0,
    sound_file TEXT,
    last_triggered_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Alert cooldown tracking
CREATE TABLE IF NOT EXISTS alert_cooldowns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    last_triggered_at TEXT NOT NULL,
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
    UNIQUE(alert_rule_id, ticker)
);

-- Momentum configurations
CREATE TABLE IF NOT EXISTS momentum_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_default INTEGER DEFAULT 0,
    config TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_rule_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    triggered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

-- User preferences (key-value store)
CREATE TABLE IF NOT EXISTS user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Favorite fields
CREATE TABLE IF NOT EXISTS favorite_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0
);

-- Keyboard shortcuts
CREATE TABLE IF NOT EXISTS keyboard_shortcuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL UNIQUE,
    shortcut TEXT NOT NULL,
    is_default INTEGER DEFAULT 1
);

-- Scan statistics
CREATE TABLE IF NOT EXISTS scan_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_type TEXT NOT NULL,
    config_id INTEGER,
    results_count INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Top performers tracking
CREATE TABLE IF NOT EXISTS top_performers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL UNIQUE,
    appearances INTEGER DEFAULT 1,
    highest_momentum_score INTEGER,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_ticker ON watchlist_items(ticker);
CREATE INDEX IF NOT EXISTS idx_watchlist_item_tags_item ON watchlist_item_tags(watchlist_item_id);
CREATE INDEX IF NOT EXISTS idx_alert_cooldowns_rule ON alert_cooldowns(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at);
CREATE INDEX IF NOT EXISTS idx_scan_stats_scanned ON scan_stats(scanned_at);
`;

/**
 * Get current schema version from database.
 * Returns 0 if schema_version table doesn't exist.
 */
export function getCurrentVersion(db: Database.Database): number {
  try {
    const row = db.prepare("SELECT MAX(version) as version FROM schema_version").get() as { version: number | null };
    return row.version ?? 0;
  } catch {
    // Table doesn't exist
    return 0;
  }
}

/**
 * Run database migrations to bring schema up to date.
 * Uses simple version-based migration strategy.
 */
export function runMigrations(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db);

  if (currentVersion >= SCHEMA_VERSION) {
    return; // Already up to date
  }

  // Run schema creation in a transaction
  db.transaction(() => {
    // Apply the full schema (uses IF NOT EXISTS for safety)
    db.exec(SCHEMA_SQL);

    // Record the migration
    db.prepare("INSERT OR REPLACE INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION);
  })();
}

/**
 * List of all table names in the schema.
 */
export const TABLE_NAMES = [
  "schema_version",
  "watchlists",
  "watchlist_items",
  "watchlist_item_tags",
  "screener_configs",
  "alert_rules",
  "alert_cooldowns",
  "momentum_configs",
  "alert_history",
  "user_preferences",
  "favorite_fields",
  "keyboard_shortcuts",
  "scan_stats",
  "top_performers",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
