import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Health Endpoint", () => {
  let serverUrl: string;
  let serverProcess: { kill: () => void } | null = null;

  beforeAll(async () => {
    // For CI/integration tests, we'd start the server here
    // For now, we'll test against a running server
    serverUrl = "http://localhost:3000";
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it("should return ok status", async () => {
    const response = await fetch(`${serverUrl}/api/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("tv-screener-app");
    expect(data.timestamp).toBeDefined();
  });

  it("should return valid ISO timestamp", async () => {
    const response = await fetch(`${serverUrl}/api/health`);
    const data = await response.json();

    const timestamp = new Date(data.timestamp);
    expect(timestamp.toISOString()).toBe(data.timestamp);
  });
});
