import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_SIGNATURE_HEADER,
  PARTY_SERVICE_CONTEXT_AUDIENCE,
  PARTY_SERVICE_CONTEXT_SOURCE,
  SECURITY_CONTEXT_AUDIENCE,
  SECURITY_CONTEXT_MAX_ENCODED_LENGTH,
  SECURITY_CONTEXT_SOURCE,
  signSecurityContext,
} from "@gst/security-context";
import { InternalContextGuard } from "../src/security/internal-context.guard.js";

const secret = "party-service-test-secret-32-bytes-long";
const base = {
  secret,
  source: PARTY_SERVICE_CONTEXT_SOURCE,
  audience: PARTY_SERVICE_CONTEXT_AUDIENCE,
  requestId: "req-1",
  correlationId: "corr-1",
  userId: "user-1",
  sessionId: "session-1",
  businessId: "business-1",
} as const;

function guard() {
  return new InternalContextGuard({
    get: (key: string) =>
      key === "PARTY_SERVICE_HMAC_SECRET" ? secret : undefined,
  } as never);
}
function execution(headers: Record<string, string>) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as never;
}
function signedHeaders(
  overrides: Partial<Parameters<typeof signSecurityContext>[0]> = {},
  headerOverrides: Record<string, string> = {},
) {
  const signed = signSecurityContext({ ...base, ...overrides });
  return {
    "x-request-id": base.requestId,
    "x-correlation-id": base.correlationId,
    [INTERNAL_CONTEXT_HEADER]: signed.encodedContext,
    [INTERNAL_SIGNATURE_HEADER]: signed.signature,
    ...headerOverrides,
  };
}
function expectRejected(headers: Record<string, string>) {
  expect(() => guard().canActivate(execution(headers))).toThrow(
    UnauthorizedException,
  );
}

describe("party-service internal context guard", () => {
  it("accepts a monolith party-service context with business scope", () => {
    expect(guard().canActivate(execution(signedHeaders()))).toBe(true);
  });

  it("rejects missing context, signature and malformed or oversized payloads before business execution", () => {
    expectRejected({});
    const headers = signedHeaders();
    const { [INTERNAL_SIGNATURE_HEADER]: _signature, ...withoutSignature } =
      headers;
    expectRejected(withoutSignature);
    expectRejected({
      "x-request-id": base.requestId,
      "x-correlation-id": base.correlationId,
      [INTERNAL_CONTEXT_HEADER]: "not***base64url",
      [INTERNAL_SIGNATURE_HEADER]: headers[INTERNAL_SIGNATURE_HEADER]!,
    });
    expectRejected({
      "x-request-id": base.requestId,
      "x-correlation-id": base.correlationId,
      [INTERNAL_CONTEXT_HEADER]: "x".repeat(
        SECURITY_CONTEXT_MAX_ENCODED_LENGTH + 1,
      ),
      [INTERNAL_SIGNATURE_HEADER]: headers[INTERNAL_SIGNATURE_HEADER]!,
    });
  });

  it("rejects wrong secret, wrong source, wrong audience and gateway A06 context", () => {
    const wrongSecret = signSecurityContext({
      ...base,
      secret: "wrong-party-service-secret-32-bytes",
    });
    expectRejected({
      "x-request-id": base.requestId,
      "x-correlation-id": base.correlationId,
      [INTERNAL_CONTEXT_HEADER]: wrongSecret.encodedContext,
      [INTERNAL_SIGNATURE_HEADER]: wrongSecret.signature,
    });
    expectRejected(signedHeaders({ source: SECURITY_CONTEXT_SOURCE }));
    expectRejected(signedHeaders({ audience: SECURITY_CONTEXT_AUDIENCE }));
    expectRejected(
      signedHeaders({
        source: SECURITY_CONTEXT_SOURCE,
        audience: SECURITY_CONTEXT_AUDIENCE,
        businessId: undefined,
      }),
    );
  });

  it("rejects expired, future-issued, missing userId and missing businessId", () => {
    expectRejected(signedHeaders({ nowMs: Date.now() - 120_000 }));
    expectRejected(signedHeaders({ nowMs: Date.now() + 120_000 }));
    expectRejected(signedHeaders({ userId: undefined as unknown as string }));
    expectRejected(signedHeaders({ businessId: undefined }));
  });

  it("rejects request, correlation and tampered business binding mismatches", () => {
    expectRejected(signedHeaders({}, { "x-request-id": "other" }));
    expectRejected(signedHeaders({}, { "x-correlation-id": "other" }));
    const signed = signSecurityContext(base);
    const payload = JSON.parse(
      Buffer.from(signed.encodedContext, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.businessId = "business-evil";
    const tampered = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    expectRejected({
      "x-request-id": base.requestId,
      "x-correlation-id": base.correlationId,
      [INTERNAL_CONTEXT_HEADER]: tampered,
      [INTERNAL_SIGNATURE_HEADER]: signed.signature,
    });
  });
});
