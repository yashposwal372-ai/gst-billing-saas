import { createHmac, timingSafeEqual } from 'node:crypto';

export const SECURITY_CONTEXT_VERSION = 1;
export const SECURITY_CONTEXT_SOURCE = 'api-gateway';
export const SECURITY_CONTEXT_AUDIENCE = 'gst-internal-services';
export const PARTY_SERVICE_CONTEXT_SOURCE = 'api-monolith';
export const PARTY_SERVICE_CONTEXT_AUDIENCE = 'party-service';
export const SECURITY_CONTEXT_MAX_AGE_MS = 60_000;
export const SECURITY_CONTEXT_MAX_FUTURE_SKEW_MS = 5_000;
export const SECURITY_CONTEXT_MAX_ENCODED_LENGTH = 2048;
export const INTERNAL_CONTEXT_HEADER = 'X-GST-Internal-Context';
export const INTERNAL_SIGNATURE_HEADER = 'X-GST-Internal-Signature';

export type SecurityContextSource = typeof SECURITY_CONTEXT_SOURCE | typeof PARTY_SERVICE_CONTEXT_SOURCE;
export type SecurityContextAudience = typeof SECURITY_CONTEXT_AUDIENCE | typeof PARTY_SERVICE_CONTEXT_AUDIENCE;

export type SecurityContextPayload = Readonly<{
  v: typeof SECURITY_CONTEXT_VERSION;
  source: SecurityContextSource;
  aud: SecurityContextAudience;
  requestId: string;
  correlationId: string;
  userId: string;
  sessionId?: string;
  businessId?: string;
  issuedAt: number;
  expiresAt: number;
}>;

export type SignSecurityContextInput = Readonly<{
  secret: string;
  requestId: string;
  correlationId: string;
  userId: string;
  sessionId?: string;
  businessId?: string;
  source?: SecurityContextSource;
  audience?: SecurityContextAudience;
  nowMs?: number;
  lifetimeMs?: number;
}>;

export type VerifySecurityContextInput = Readonly<{
  secret: string;
  encodedContext: string;
  signature: string;
  expectedSource?: SecurityContextSource;
  expectedAudience?: SecurityContextAudience;
  requireBusinessId?: boolean;
  expectedRequestId?: string;
  expectedCorrelationId?: string;
  nowMs?: number;
  maxFutureSkewMs?: number;
}>;

export type SignedSecurityContext = Readonly<{
  encodedContext: string;
  signature: string;
  payload: SecurityContextPayload;
}>;

const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_UUID_OR_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const MIN_SECRET_BYTES = 32;

function assertSecret(secret: string): Buffer {
  const bytes = Buffer.from(secret, 'utf8');
  if (bytes.length < MIN_SECRET_BYTES) throw new Error('Internal identity secret must be at least 32 bytes');
  return bytes;
}

function assertId(name: string, value: string): void {
  if (!SAFE_ID.test(value)) throw new Error(`${name} is invalid`);
}

function assertClaim(name: string, value: string): void {
  if (!SAFE_UUID_OR_ID.test(value)) throw new Error(`${name} is invalid`);
}

function canonicalize(payload: SecurityContextPayload): string {
  const ordered: Record<string, unknown> = {
    aud: payload.aud,
    correlationId: payload.correlationId,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    requestId: payload.requestId,
    source: payload.source,
    userId: payload.userId,
    v: payload.v,
  };
  if (payload.businessId !== undefined) ordered.businessId = payload.businessId;
  if (payload.sessionId !== undefined) ordered.sessionId = payload.sessionId;
  return JSON.stringify(ordered);
}

function encodePayload(payload: SecurityContextPayload): string {
  return Buffer.from(canonicalize(payload), 'utf8').toString('base64url');
}

function signEncoded(secret: string, encodedContext: string): string {
  return createHmac('sha256', assertSecret(secret)).update(encodedContext, 'utf8').digest('base64url');
}

function secureEqual(a: string, b: string): boolean {
  if (!BASE64URL.test(a) || !BASE64URL.test(b)) return false;
  const left = Buffer.from(a, 'base64url');
  const right = Buffer.from(b, 'base64url');
  return left.length === right.length && timingSafeEqual(left, right);
}

function isSource(value: unknown): value is SecurityContextSource {
  return value === SECURITY_CONTEXT_SOURCE || value === PARTY_SERVICE_CONTEXT_SOURCE;
}

function isAudience(value: unknown): value is SecurityContextAudience {
  return value === SECURITY_CONTEXT_AUDIENCE || value === PARTY_SERVICE_CONTEXT_AUDIENCE;
}

function parsePayload(encodedContext: string): SecurityContextPayload {
  if (encodedContext.length > SECURITY_CONTEXT_MAX_ENCODED_LENGTH) throw new Error('Internal context is too large');
  if (!BASE64URL.test(encodedContext)) throw new Error('Internal context is malformed');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedContext, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Internal context is malformed');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Internal context is invalid');
  const payload = parsed as Record<string, unknown>;
  if (payload.v !== SECURITY_CONTEXT_VERSION) throw new Error('Unsupported internal context version');
  if (!isSource(payload.source)) throw new Error('Unsupported internal context source');
  if (!isAudience(payload.aud)) throw new Error('Unsupported internal context audience');
  for (const key of ['requestId', 'correlationId', 'userId']) {
    if (typeof payload[key] !== 'string') throw new Error(`Internal context ${key} is required`);
  }
  if (payload.sessionId !== undefined && typeof payload.sessionId !== 'string') throw new Error('Internal context sessionId is invalid');
  if (payload.businessId !== undefined && typeof payload.businessId !== 'string') throw new Error('Internal context businessId is invalid');
  if (typeof payload.issuedAt !== 'number' || typeof payload.expiresAt !== 'number') throw new Error('Internal context time bounds are invalid');
  assertId('requestId', payload.requestId as string);
  assertId('correlationId', payload.correlationId as string);
  assertClaim('userId', payload.userId as string);
  if (typeof payload.sessionId === 'string') assertClaim('sessionId', payload.sessionId);
  if (typeof payload.businessId === 'string') assertClaim('businessId', payload.businessId);
  return payload as SecurityContextPayload;
}

export function signSecurityContext(input: SignSecurityContextInput): SignedSecurityContext {
  assertSecret(input.secret);
  assertId('requestId', input.requestId);
  assertId('correlationId', input.correlationId);
  assertClaim('userId', input.userId);
  if (input.sessionId !== undefined) assertClaim('sessionId', input.sessionId);
  if (input.businessId !== undefined) assertClaim('businessId', input.businessId);
  const now = input.nowMs ?? Date.now();
  const lifetime = input.lifetimeMs ?? SECURITY_CONTEXT_MAX_AGE_MS;
  if (!Number.isInteger(lifetime) || lifetime <= 0 || lifetime > SECURITY_CONTEXT_MAX_AGE_MS) throw new Error('Internal context lifetime is invalid');
  const payload: SecurityContextPayload = {
    v: SECURITY_CONTEXT_VERSION,
    source: input.source ?? SECURITY_CONTEXT_SOURCE,
    aud: input.audience ?? SECURITY_CONTEXT_AUDIENCE,
    requestId: input.requestId,
    correlationId: input.correlationId,
    userId: input.userId,
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(input.businessId !== undefined ? { businessId: input.businessId } : {}),
    issuedAt: now,
    expiresAt: now + lifetime,
  };
  const encodedContext = encodePayload(payload);
  return { encodedContext, signature: signEncoded(input.secret, encodedContext), payload };
}

export function verifySecurityContext(input: VerifySecurityContextInput): SecurityContextPayload {
  assertSecret(input.secret);
  const payload = parsePayload(input.encodedContext);
  const expectedSource = input.expectedSource ?? SECURITY_CONTEXT_SOURCE;
  const expectedAudience = input.expectedAudience ?? SECURITY_CONTEXT_AUDIENCE;
  if (payload.source !== expectedSource) throw new Error('Unsupported internal context source');
  if (payload.aud !== expectedAudience) throw new Error('Unsupported internal context audience');
  if (input.requireBusinessId && !payload.businessId) throw new Error('Internal context businessId is required');
  const expectedSignature = signEncoded(input.secret, input.encodedContext);
  if (!secureEqual(input.signature, expectedSignature)) throw new Error('Internal context signature is invalid');
  const canonicalEncoded = encodePayload(payload);
  if (canonicalEncoded !== input.encodedContext) throw new Error('Internal context is not canonical');
  const now = input.nowMs ?? Date.now();
  const skew = input.maxFutureSkewMs ?? SECURITY_CONTEXT_MAX_FUTURE_SKEW_MS;
  if (payload.issuedAt > now + skew) throw new Error('Internal context issuedAt is in the future');
  if (payload.expiresAt <= now) throw new Error('Internal context expired');
  if (payload.expiresAt - payload.issuedAt > SECURITY_CONTEXT_MAX_AGE_MS) throw new Error('Internal context lifetime is too long');
  if (input.expectedRequestId !== undefined && payload.requestId !== input.expectedRequestId) throw new Error('Internal context request binding mismatch');
  if (input.expectedCorrelationId !== undefined && payload.correlationId !== input.expectedCorrelationId) throw new Error('Internal context correlation binding mismatch');
  return payload;
}
