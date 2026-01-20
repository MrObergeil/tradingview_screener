/**
 * Screener API routes that proxy to the Python service.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  screenerClient,
  ScreenerServiceError,
} from "../services/screenerClient.js";
import type { ScanRequest } from "../types/screener.js";

/** Register screener routes */
export async function screenerRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/scan - Execute a screener scan
   */
  app.post(
    "/api/scan",
    async (
      request: FastifyRequest<{ Body: ScanRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const scanRequest = request.body;
        const result = await screenerClient.scan(scanRequest);
        return result;
      } catch (error) {
        return handleScreenerError(error, reply);
      }
    }
  );

  /**
   * GET /api/screener/health - Check Python service health
   */
  app.get("/api/screener/health", async (_request, reply: FastifyReply) => {
    try {
      const result = await screenerClient.health();
      return result;
    } catch (error) {
      return handleScreenerError(error, reply);
    }
  });
}

/**
 * Handle screener service errors and send appropriate response.
 */
function handleScreenerError(
  error: unknown,
  reply: FastifyReply
): FastifyReply {
  if (error instanceof ScreenerServiceError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      detail: error.detail,
    });
  }

  if (error instanceof Error) {
    return reply.status(500).send({
      error: "Internal server error",
      detail: error.message,
    });
  }

  return reply.status(500).send({
    error: "Internal server error",
    detail: "Unknown error occurred",
  });
}
