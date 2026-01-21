/**
 * Screener configuration API routes.
 */

import type { FastifyInstance } from "fastify";
import { ScreenerConfigRepository, type ScreenerConfigData } from "../db/repositories/screenerConfig.js";
import { DatabaseError } from "../db/repositories/base.js";
import type Database from "better-sqlite3";

/** Request body for creating/updating a config */
interface ConfigBody {
  name: string;
  description?: string;
  config: ScreenerConfigData;
}

/** Request body for updating config data only */
interface UpdateConfigBody {
  name?: string;
  description?: string;
  config?: ScreenerConfigData;
}

/** Route params with config ID */
interface ConfigParams {
  id: string;
}

/** Query params for listing configs */
interface ListQuery {
  includePresets?: string;
}

/**
 * Register screener config routes.
 */
export async function screenerConfigRoutes(app: FastifyInstance) {
  const db = (app as unknown as { db: Database.Database }).db;
  const repo = new ScreenerConfigRepository(db);

  /**
   * GET /api/configs - List all configs
   */
  app.get<{ Querystring: ListQuery }>(
    "/api/configs",
    async (request) => {
      const includePresets = request.query.includePresets !== "false";
      const configs = repo.findAllWithData(includePresets);
      return { configs };
    }
  );

  /**
   * GET /api/configs/:id - Get single config
   */
  app.get<{ Params: ConfigParams }>(
    "/api/configs/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid config ID" });
      }

      const config = repo.findByIdWithData(id);
      if (!config) {
        return reply.status(404).send({ error: "Config not found" });
      }

      return config;
    }
  );

  /**
   * POST /api/configs - Create a new config
   */
  app.post<{ Body: ConfigBody }>(
    "/api/configs",
    async (request, reply) => {
      const { name, description, config } = request.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return reply.status(400).send({ error: "Name is required" });
      }

      if (!config || !config.columns || !Array.isArray(config.columns)) {
        return reply.status(400).send({ error: "Config with columns array is required" });
      }

      try {
        const created = repo.createConfig(name, config, description);
        return reply.status(201).send({
          ...created,
          config: JSON.parse(created.config),
        });
      } catch (err) {
        if (err instanceof DatabaseError && err.message.includes("already exists")) {
          return reply.status(409).send({ error: "Config with this name already exists" });
        }
        throw err;
      }
    }
  );

  /**
   * PUT /api/configs/:id - Update a config
   */
  app.put<{ Params: ConfigParams; Body: UpdateConfigBody }>(
    "/api/configs/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid config ID" });
      }

      const { name, description, config } = request.body;

      // Check if config exists and is not a preset
      const existing = repo.findById(id);
      if (!existing) {
        return reply.status(404).send({ error: "Config not found" });
      }

      if (existing.is_preset === 1) {
        return reply.status(403).send({ error: "Cannot modify preset configs" });
      }

      try {
        // If config data provided, update it; otherwise just update name/description
        let updated;
        if (config) {
          updated = repo.updateConfig(id, config, name, description);
        } else {
          const updateData: Record<string, unknown> = {};
          if (name !== undefined) updateData["name"] = name.trim();
          if (description !== undefined) updateData["description"] = description.trim() || null;
          updated = repo.update(id, updateData);
        }

        return {
          ...updated,
          config: JSON.parse(updated.config),
        };
      } catch (err) {
        if (err instanceof DatabaseError) {
          if (err.message.includes("not found")) {
            return reply.status(404).send({ error: "Config not found" });
          }
          if (err.cause instanceof Error && err.cause.message.includes("UNIQUE constraint")) {
            return reply.status(409).send({ error: "Config with this name already exists" });
          }
        }
        throw err;
      }
    }
  );

  /**
   * DELETE /api/configs/:id - Delete a config
   */
  app.delete<{ Params: ConfigParams }>(
    "/api/configs/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid config ID" });
      }

      // Check if it's a preset
      const existing = repo.findById(id);
      if (existing?.is_preset === 1) {
        return reply.status(403).send({ error: "Cannot delete preset configs" });
      }

      const deleted = repo.delete(id);
      if (!deleted) {
        return reply.status(404).send({ error: "Config not found" });
      }

      return reply.status(204).send();
    }
  );

  /**
   * POST /api/configs/:id/duplicate - Duplicate a config
   */
  app.post<{ Params: ConfigParams; Body: { name: string } }>(
    "/api/configs/:id/duplicate",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid config ID" });
      }

      const { name } = request.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return reply.status(400).send({ error: "Name is required for duplicate" });
      }

      try {
        const duplicated = repo.duplicate(id, name);
        return reply.status(201).send({
          ...duplicated,
          config: JSON.parse(duplicated.config),
        });
      } catch (err) {
        if (err instanceof DatabaseError) {
          if (err.message.includes("not found")) {
            return reply.status(404).send({ error: "Config not found" });
          }
          if (err.cause instanceof Error && err.cause.message.includes("UNIQUE constraint")) {
            return reply.status(409).send({ error: "Config with this name already exists" });
          }
        }
        throw err;
      }
    }
  );
}
