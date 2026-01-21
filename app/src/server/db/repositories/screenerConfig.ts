/**
 * Screener configuration repository for managing saved filter/column presets.
 */

import type Database from "better-sqlite3";
import { BaseRepository, DatabaseError, type BaseEntity } from "./base.js";

/** Filter configuration */
export interface FilterConfig {
  field: string;
  op: string;
  value: number | string | number[] | string[];
}

/** Screener configuration stored as JSON */
export interface ScreenerConfigData {
  columns: string[];
  filters: FilterConfig[];
  orderBy?: {
    field: string;
    direction: "asc" | "desc";
  };
}

/** Screener config entity */
export interface ScreenerConfig extends BaseEntity {
  name: string;
  description: string | null;
  config: string; // JSON string of ScreenerConfigData
  momentum_config: string | null;
  is_preset: number; // 0 or 1
}

/** Screener config with parsed data */
export interface ScreenerConfigWithData extends Omit<ScreenerConfig, "config"> {
  config: ScreenerConfigData;
}

/**
 * Repository for screener configuration operations.
 */
export class ScreenerConfigRepository extends BaseRepository<ScreenerConfig> {
  constructor(db: Database.Database) {
    super(db, "screener_configs");
  }

  /**
   * Find config by name.
   */
  findByName(name: string): ScreenerConfig | undefined {
    return this.findOneBy("name", name);
  }

  /**
   * Get all configs, optionally filtering by preset status.
   */
  findAllConfigs(includePresets = true): ScreenerConfig[] {
    try {
      if (includePresets) {
        return this.findAll("name", "asc");
      }
      const sql = "SELECT * FROM screener_configs WHERE is_preset = 0 ORDER BY name ASC";
      return this.db.prepare(sql).all() as ScreenerConfig[];
    } catch (err) {
      throw new DatabaseError("Failed to find configs", "findAllConfigs", this.tableName, err);
    }
  }

  /**
   * Get only preset configs.
   */
  findPresets(): ScreenerConfig[] {
    try {
      const sql = "SELECT * FROM screener_configs WHERE is_preset = 1 ORDER BY name ASC";
      return this.db.prepare(sql).all() as ScreenerConfig[];
    } catch (err) {
      throw new DatabaseError("Failed to find presets", "findPresets", this.tableName, err);
    }
  }

  /**
   * Create a new config with parsed data.
   */
  createConfig(
    name: string,
    configData: ScreenerConfigData,
    description?: string,
    isPreset = false
  ): ScreenerConfig {
    try {
      return this.create({
        name: name.trim(),
        description: description?.trim() ?? null,
        config: JSON.stringify(configData),
        momentum_config: null,
        is_preset: isPreset ? 1 : 0,
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        throw new DatabaseError(`Config "${name}" already exists`, "createConfig", this.tableName, err);
      }
      throw new DatabaseError("Failed to create config", "createConfig", this.tableName, err);
    }
  }

  /**
   * Update config data.
   */
  updateConfig(
    id: number,
    configData: ScreenerConfigData,
    name?: string,
    description?: string
  ): ScreenerConfig {
    const updates: Partial<ScreenerConfig> = {
      config: JSON.stringify(configData),
    };

    if (name !== undefined) {
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description.trim() || null;
    }

    return this.update(id, updates);
  }

  /**
   * Get config with parsed data.
   */
  findByIdWithData(id: number): ScreenerConfigWithData | undefined {
    const config = this.findById(id);
    if (!config) return undefined;

    return {
      ...config,
      config: JSON.parse(config.config) as ScreenerConfigData,
    };
  }

  /**
   * Get all configs with parsed data.
   */
  findAllWithData(includePresets = true): ScreenerConfigWithData[] {
    const configs = this.findAllConfigs(includePresets);
    return configs.map((c) => ({
      ...c,
      config: JSON.parse(c.config) as ScreenerConfigData,
    }));
  }

  /**
   * Duplicate an existing config.
   */
  duplicate(id: number, newName: string): ScreenerConfig {
    const original = this.findById(id);
    if (!original) {
      throw new DatabaseError(`Config with id ${id} not found`, "duplicate", this.tableName);
    }

    return this.create({
      name: newName.trim(),
      description: original.description,
      config: original.config,
      momentum_config: original.momentum_config,
      is_preset: 0, // Duplicates are never presets
    });
  }
}
