import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { screenerRoutes } from "./routes/screener.js";

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
});

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

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Server listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
