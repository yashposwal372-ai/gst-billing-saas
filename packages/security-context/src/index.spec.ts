import { describe, expect, it } from "vitest";
import {
  PARTY_SERVICE_CONTEXT_AUDIENCE,
  PARTY_SERVICE_CONTEXT_SOURCE,
  SECURITY_CONTEXT_AUDIENCE,
  SECURITY_CONTEXT_SOURCE,
  SECURITY_CONTEXT_MAX_ENCODED_LENGTH,
  signSecurityContext,
  verifySecurityContext,
} from "./index.js";

const secret = "s".repeat(40);
const base = {
  secret,
  requestId: "req-1",
  correlationId: "corr-1",
  userId: "user-1",
  sessionId: "session-1",
  nowMs: 1_000_000,
};

function signed() {
  return signSecurityContext(base);
}

describe("security context signing and verification", () => {
  it("verifies a valid signed context", () => {
    const context = signed();
    expect(
      verifySecurityContext({
        secret,
        encodedContext: context.encodedContext,
        signature: context.signature,
        expectedRequestId: "req-1",
        expectedCorrelationId: "corr-1",
        nowMs: 1_000_100,
      }),
    ).toMatchObject({ userId: "user-1", sessionId: "session-1" });
  });

  it("rejects tampered payloads and signatures", () => {
    const context = signed();
    const payload = JSON.parse(
      Buffer.from(context.encodedContext, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.userId = "user-2";
    const tamperedPayload = Buffer.from(
      JSON.stringify(payload),
      "utf8",
    ).toString("base64url");
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: tamperedPayload,
        signature: context.signature,
      }),
    ).toThrow(/signature/);
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: context.encodedContext,
        signature: `${context.signature.slice(0, -1)}A`,
      }),
    ).toThrow(/signature/);
  });

  it("rejects request and correlation binding mismatches", () => {
    const context = signed();
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: context.encodedContext,
        signature: context.signature,
        expectedRequestId: "other",
        nowMs: 1_000_100,
      }),
    ).toThrow(/request/);
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: context.encodedContext,
        signature: context.signature,
        expectedCorrelationId: "other",
        nowMs: 1_000_100,
      }),
    ).toThrow(/correlation/);
  });

  it("rejects expired and future-issued contexts", () => {
    const context = signed();
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: context.encodedContext,
        signature: context.signature,
        nowMs: 1_061_000,
      }),
    ).toThrow(/expired/);
    const future = signSecurityContext({ ...base, nowMs: 2_000_000 });
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: future.encodedContext,
        signature: future.signature,
        nowMs: 1_000_000,
      }),
    ).toThrow(/future/);
  });

  it("rejects wrong audience, version, oversized and malformed payloads", () => {
    const context = signed();
    const mutate = (patch: Record<string, unknown>) => {
      const payload = JSON.parse(
        Buffer.from(context.encodedContext, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      return Buffer.from(
        JSON.stringify({ ...payload, ...patch }),
        "utf8",
      ).toString("base64url");
    };
    const wrongAudience = mutate({ aud: "other" });
    const wrongVersion = mutate({ v: 2 });
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: wrongAudience,
        signature: context.signature,
      }),
    ).toThrow(/audience|signature/);
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: wrongVersion,
        signature: context.signature,
      }),
    ).toThrow(/version|signature/);
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: "x".repeat(SECURITY_CONTEXT_MAX_ENCODED_LENGTH + 1),
        signature: context.signature,
      }),
    ).toThrow(/large/);
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: "not***base64url",
        signature: context.signature,
      }),
    ).toThrow(/malformed/);
    expect(SECURITY_CONTEXT_AUDIENCE).toBe("gst-internal-services");
  });
  it("keeps gateway and party-service trust domains separate", () => {
    const gateway = signSecurityContext(base);
    expect(
      verifySecurityContext({
        secret,
        encodedContext: gateway.encodedContext,
        signature: gateway.signature,
        expectedSource: SECURITY_CONTEXT_SOURCE,
        expectedAudience: SECURITY_CONTEXT_AUDIENCE,
        nowMs: 1_000_100,
      }),
    ).toMatchObject({
      source: SECURITY_CONTEXT_SOURCE,
      aud: SECURITY_CONTEXT_AUDIENCE,
    });
    expect(() =>
      verifySecurityContext({
        secret,
        encodedContext: gateway.encodedContext,
        signature: gateway.signature,
        expectedSource: PARTY_SERVICE_CONTEXT_SOURCE,
        expectedAudience: PARTY_SERVICE_CONTEXT_AUDIENCE,
        requireBusinessId: true,
        nowMs: 1_000_100,
      }),
    ).toThrow(/source|audience|businessId/);
    const party = signSecurityContext({
      ...base,
      source: PARTY_SERVICE_CONTEXT_SOURCE,
      audience: PARTY_SERVICE_CONTEXT_AUDIENCE,
      businessId: "business-1",
    });
    expect(
      verifySecurityContext({
        secret,
        encodedContext: party.encodedContext,
        signature: party.signature,
        expectedSource: PARTY_SERVICE_CONTEXT_SOURCE,
        expectedAudience: PARTY_SERVICE_CONTEXT_AUDIENCE,
        requireBusinessId: true,
        nowMs: 1_000_100,
      }),
    ).toMatchObject({
      source: PARTY_SERVICE_CONTEXT_SOURCE,
      aud: PARTY_SERVICE_CONTEXT_AUDIENCE,
      businessId: "business-1",
    });
    expect(() =>
      verifySecurityContext({
        secret: "x".repeat(40),
        encodedContext: party.encodedContext,
        signature: party.signature,
        expectedSource: PARTY_SERVICE_CONTEXT_SOURCE,
        expectedAudience: PARTY_SERVICE_CONTEXT_AUDIENCE,
        requireBusinessId: true,
        nowMs: 1_000_100,
      }),
    ).toThrow(/signature/);
  });
});
