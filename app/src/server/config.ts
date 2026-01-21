import { resolve } from "path";

export const config = {
  port: parseInt(process.env["APP_PORT"] ?? "3000", 10),
  host: process.env["APP_HOST"] ?? "0.0.0.0",
  logLevel: process.env["APP_LOG_LEVEL"] ?? "info",

  // Python screener service URL
  screenerServiceUrl:
    process.env["SCREENER_SERVICE_URL"] ?? "http://localhost:8001",

  // SQLite database path
  databasePath: process.env["DATABASE_PATH"] ?? resolve(process.cwd(), "data", "tvscreener.db"),
} as const;
