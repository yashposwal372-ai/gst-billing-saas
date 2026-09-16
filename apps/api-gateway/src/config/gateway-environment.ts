export type GatewayEnvironment = Readonly<{
  NODE_ENV: 'development' | 'test' | 'production';
  GATEWAY_PORT: number;
  MONOLITH_BASE_URL: string;
  PROXY_TIMEOUT_MS: number;
  JWT_SECRET?: string;
  INTERNAL_IDENTITY_HMAC_SECRET: string;
  INTERNAL_IDENTITY_MAX_AGE_MS: number;
}>;

const DEFAULT_PORT = 4100;
const DEFAULT_UPSTREAM = 'http://127.0.0.1:4000';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INTERNAL_IDENTITY_MAX_AGE_MS = 60_000;
const MIN_SECRET_BYTES = 32;

function parsePositiveInt(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 600_000) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function parseInternalIdentityMaxAge(value: unknown): number {
  const parsed = parsePositiveInt(value, DEFAULT_INTERNAL_IDENTITY_MAX_AGE_MS, 'INTERNAL_IDENTITY_MAX_AGE_MS');
  if (parsed > DEFAULT_INTERNAL_IDENTITY_MAX_AGE_MS) throw new Error('INTERNAL_IDENTITY_MAX_AGE_MS must be at most 60000');
  return parsed;
}

function parseSecret(value: unknown, nodeEnv: GatewayEnvironment['NODE_ENV']): string {
  if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= MIN_SECRET_BYTES) return value;
  if (nodeEnv === 'production') throw new Error('INTERNAL_IDENTITY_HMAC_SECRET must be at least 32 bytes in production');
  return 'local-internal-identity-secret-change-me';
}

function parseJwtSecret(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseUpstream(value: unknown): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_UPSTREAM;
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('MONOLITH_BASE_URL must use http or https');
  url.username = '';
  url.password = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function validateGatewayEnvironment(config: Record<string, unknown>): GatewayEnvironment {
  const nodeEnv = config.NODE_ENV === 'production' || config.NODE_ENV === 'test' ? config.NODE_ENV : 'development';
  return {
    NODE_ENV: nodeEnv,
    GATEWAY_PORT: parsePositiveInt(config.GATEWAY_PORT, DEFAULT_PORT, 'GATEWAY_PORT'),
    MONOLITH_BASE_URL: parseUpstream(config.MONOLITH_BASE_URL),
    PROXY_TIMEOUT_MS: parsePositiveInt(config.PROXY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 'PROXY_TIMEOUT_MS'),
    JWT_SECRET: parseJwtSecret(config.JWT_SECRET),
    INTERNAL_IDENTITY_HMAC_SECRET: parseSecret(config.INTERNAL_IDENTITY_HMAC_SECRET, nodeEnv),
    INTERNAL_IDENTITY_MAX_AGE_MS: parseInternalIdentityMaxAge(config.INTERNAL_IDENTITY_MAX_AGE_MS),
  };
}
