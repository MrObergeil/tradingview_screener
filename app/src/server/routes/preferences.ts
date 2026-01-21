/**
 * User preferences API routes.
 */

import type { FastifyInstance } from "fastify";
import { PreferencesRepository, type PreferenceKey } from "../db/repositories/preferences.js";
import { DatabaseError } from "../db/repositories/base.js";
import type Database from "better-sqlite3";

/** Request body for setting a preference */
interface SetPreferenceBody {
  value: string;
}

/** Request body for setting multiple preferences */
interface SetPreferencesBody {
  preferences: Record<string, string>;
}

/** Request body for favorite fields */
interface FavoriteFieldBody {
  fieldName: string;
}

/** Request body for reordering fields */
interface ReorderFieldsBody {
  fieldNames: string[];
}

/** Route params with preference key */
interface PreferenceParams {
  key: string;
}

/**
 * Register preferences routes.
 */
export async function preferencesRoutes(app: FastifyInstance) {
  const db = (app as unknown as { db: Database.Database }).db;
  const repo = new PreferencesRepository(db);

  // ============ User Preferences ============

  /**
   * GET /api/preferences - Get all preferences
   */
  app.get("/api/preferences", async () => {
    const preferences = repo.getAll();
    return { preferences };
  });

  /**
   * GET /api/preferences/:key - Get single preference
   */
  app.get<{ Params: PreferenceParams }>(
    "/api/preferences/:key",
    async (request, reply) => {
      const value = repo.get(request.params.key as PreferenceKey);
      if (value === undefined) {
        return reply.status(404).send({ error: "Preference not found" });
      }
      return { key: request.params.key, value };
    }
  );

  /**
   * PUT /api/preferences/:key - Set a preference
   */
  app.put<{ Params: PreferenceParams; Body: SetPreferenceBody }>(
    "/api/preferences/:key",
    async (request, reply) => {
      const { key } = request.params;
      const { value } = request.body;

      if (value === undefined || value === null) {
        return reply.status(400).send({ error: "Value is required" });
      }

      repo.set(key as PreferenceKey, String(value));
      return { key, value: String(value) };
    }
  );

  /**
   * DELETE /api/preferences/:key - Delete a preference
   */
  app.delete<{ Params: PreferenceParams }>(
    "/api/preferences/:key",
    async (request, reply) => {
      const deleted = repo.delete(request.params.key as PreferenceKey);
      if (!deleted) {
        return reply.status(404).send({ error: "Preference not found" });
      }
      return reply.status(204).send();
    }
  );

  /**
   * POST /api/preferences/batch - Set multiple preferences
   */
  app.post<{ Body: SetPreferencesBody }>(
    "/api/preferences/batch",
    async (request, reply) => {
      const { preferences } = request.body;

      if (!preferences || typeof preferences !== "object") {
        return reply.status(400).send({ error: "Preferences object is required" });
      }

      repo.setMany(preferences);
      return { updated: Object.keys(preferences).length };
    }
  );

  // ============ Favorite Fields ============

  /**
   * GET /api/favorites/fields - Get favorite fields
   */
  app.get("/api/favorites/fields", async () => {
    const fields = repo.getFavoriteFields();
    return { fields };
  });

  /**
   * POST /api/favorites/fields - Add favorite field
   */
  app.post<{ Body: FavoriteFieldBody }>(
    "/api/favorites/fields",
    async (request, reply) => {
      const { fieldName } = request.body;

      if (!fieldName || typeof fieldName !== "string") {
        return reply.status(400).send({ error: "Field name is required" });
      }

      try {
        const field = repo.addFavoriteField(fieldName.trim());
        return reply.status(201).send(field);
      } catch (err) {
        if (err instanceof DatabaseError && err.message.includes("already a favorite")) {
          return reply.status(409).send({ error: "Field is already a favorite" });
        }
        throw err;
      }
    }
  );

  /**
   * DELETE /api/favorites/fields/:fieldName - Remove favorite field
   */
  app.delete<{ Params: { fieldName: string } }>(
    "/api/favorites/fields/:fieldName",
    async (request, reply) => {
      const deleted = repo.removeFavoriteField(request.params.fieldName);
      if (!deleted) {
        return reply.status(404).send({ error: "Favorite field not found" });
      }
      return reply.status(204).send();
    }
  );

  /**
   * PUT /api/favorites/fields/reorder - Reorder favorite fields
   */
  app.put<{ Body: ReorderFieldsBody }>(
    "/api/favorites/fields/reorder",
    async (request, reply) => {
      const { fieldNames } = request.body;

      if (!fieldNames || !Array.isArray(fieldNames)) {
        return reply.status(400).send({ error: "Field names array is required" });
      }

      repo.reorderFavoriteFields(fieldNames);
      return { reordered: fieldNames.length };
    }
  );

  /**
   * PUT /api/favorites/fields - Set all favorite fields (replace)
   */
  app.put<{ Body: ReorderFieldsBody }>(
    "/api/favorites/fields",
    async (request, reply) => {
      const { fieldNames } = request.body;

      if (!fieldNames || !Array.isArray(fieldNames)) {
        return reply.status(400).send({ error: "Field names array is required" });
      }

      repo.setFavoriteFields(fieldNames);
      return { set: fieldNames.length };
    }
  );
}
