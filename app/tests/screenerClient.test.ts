import { describe, it, expect } from "vitest";
import { ScreenerClient, ScreenerServiceError } from "../src/server/services/screenerClient.js";

describe("ScreenerClient", () => {
  // These tests require the Python screener service to be running on localhost:8001
  const client = new ScreenerClient("http://localhost:8001");

  describe("health", () => {
    it("should return health status from Python service", async () => {
      const response = await client.health();
      expect(response.status).toBe("ok");
      expect(response.timestamp).toBeDefined();
    });
  });

  describe("scan", () => {
    it("should execute basic scan", async () => {
      const response = await client.scan({
        columns: ["name", "close", "volume"],
        limit: 5,
      });

      expect(response.totalCount).toBeGreaterThan(0);
      expect(response.results).toHaveLength(5);
      expect(response.durationMs).toBeGreaterThan(0);
      expect(response.timestamp).toBeDefined();
    });

    it("should execute scan with filters", async () => {
      const response = await client.scan({
        columns: ["name", "close", "market_cap_basic"],
        filters: [{ field: "market_cap_basic", op: "gt", value: 100000000000 }],
        limit: 5,
      });

      expect(response.totalCount).toBeGreaterThan(0);
      for (const result of response.results) {
        const marketCap = result["market_cap_basic"] as number | null;
        if (marketCap !== null) {
          expect(marketCap).toBeGreaterThan(100000000000);
        }
      }
    });

    it("should execute scan with ordering", async () => {
      const response = await client.scan({
        columns: ["name", "volume"],
        orderBy: { field: "volume", direction: "desc" },
        limit: 10,
      });

      const volumes = response.results
        .map((r) => r["volume"] as number | null)
        .filter((v): v is number => v !== null);

      // Check volumes are in descending order
      for (let i = 1; i < volumes.length; i++) {
        const prev = volumes[i - 1];
        const curr = volumes[i];
        if (prev !== undefined && curr !== undefined) {
          expect(prev).toBeGreaterThanOrEqual(curr);
        }
      }
    });
  });

  describe("error handling", () => {
    it("should throw ScreenerServiceError on invalid request", async () => {
      await expect(
        client.scan({
          columns: ["name"],
          filters: [{ field: "close", op: "between", value: 50 }], // Invalid: should be array
        })
      ).rejects.toThrow(ScreenerServiceError);
    });

    it("should handle connection errors", async () => {
      const badClient = new ScreenerClient("http://localhost:9999");
      await expect(badClient.health()).rejects.toThrow(ScreenerServiceError);
    });
  });
});
