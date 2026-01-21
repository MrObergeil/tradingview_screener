import Fastify from "fastify";
import cors from "@fastify/cors";
import type Database from "better-sqlite3";
import { config } from "./config.js";
import { screenerRoutes } from "./routes/screener.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { screenerConfigRoutes } from "./routes/screenerConfig.js";
import { preferencesRoutes } from "./routes/preferences.js";
import { getDatabase, closeDatabase } from "./db/index.js";

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
});

// Initialize database on startup
const db: Database.Database = getDatabase();
app.log.info(`Database initialized at ${config.databasePath}`);

// Attach database to app for route access
(app as unknown as { db: typeof db }).db = db;

// Register CORS for local development
await app.register(cors, {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// Health endpoint for this service
app.get("/api/health", async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "tv-screener-app",
  };
});

// Register screener routes (proxy to Python service)
await app.register(screenerRoutes);

// Register watchlist routes (local database)
await app.register(watchlistRoutes);

// Register screener config routes (saved presets)
await app.register(screenerConfigRoutes);

// Register preferences routes (user settings)
await app.register(preferencesRoutes);

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  await app.close();
  closeDatabase();
  app.log.info("Database connection closed");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Server listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    closeDatabase();
    process.exit(1);
  }
};

start();

export { app, db };
