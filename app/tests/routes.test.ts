import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Screener Routes (Integration)", () => {
  // These tests require:
  // 1. Python screener service running on localhost:8001
  // 2. Node.js server running on localhost:3000
  const serverUrl = "http://localhost:3000";

  describe("GET /api/health", () => {
    it("should return Node service health", async () => {
      const response = await fetch(`${serverUrl}/api/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(data.service).toBe("tv-screener-app");
    });
  });

  describe("GET /api/screener/health", () => {
    it("should return Python service health via proxy", async () => {
      const response = await fetch(`${serverUrl}/api/screener/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe("ok");
    });
  });

  describe("POST /api/scan", () => {
    it("should execute scan via proxy", async () => {
      const response = await fetch(`${serverUrl}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: ["name", "close", "volume"],
          limit: 5,
        }),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.totalCount).toBeGreaterThan(0);
      expect(data.results).toHaveLength(5);
      expect(data.durationMs).toBeGreaterThan(0);
    });

    it("should handle filters via proxy", async () => {
      const response = await fetch(`${serverUrl}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: ["name", "close"],
          filters: [{ field: "close", op: "between", value: [50, 100] }],
          limit: 5,
        }),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      for (const result of data.results) {
        const close = result.close as number | null;
        if (close !== null) {
          expect(close).toBeGreaterThanOrEqual(50);
          expect(close).toBeLessThanOrEqual(100);
        }
      }
    });

    it("should forward errors from Python service", async () => {
      const response = await fetch(`${serverUrl}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: ["name"],
          filters: [{ field: "close", op: "between", value: 50 }], // Invalid
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });
});
