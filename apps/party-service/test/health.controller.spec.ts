import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { HealthController } from "../src/health/health.controller.js";

describe("party-service health controller", () => {
  it("live does not require database readiness", () => {
    const controller = new HealthController({ $queryRaw: vi.fn() } as never);
    expect(controller.live()).toEqual({
      status: "ok",
      service: "party-service",
    });
  });

  it("ready checks persistence without exposing connection details", async () => {
    const ready = new HealthController({
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as never);
    await expect(ready.ready()).resolves.toEqual({
      status: "ready",
      service: "party-service",
    });
    const down = new HealthController({
      $queryRaw: vi.fn().mockRejectedValue(new Error("postgresql://secret@db")),
    } as never);
    await expect(down.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await down
      .ready()
      .catch((error: ServiceUnavailableException) =>
        expect(JSON.stringify(error.getResponse())).not.toContain(
          "postgresql://secret",
        ),
      );
  });
});
