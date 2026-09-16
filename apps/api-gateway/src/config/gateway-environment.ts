export type GatewayEnvironment = Readonly<{
  NODE_ENV: 'development' | 'test' | 'production';
  GATEWAY_PORT: number;
  MONOLITH_BASE_URL: string;
  PROXY_TIMEOUT_MS: number;
}>;

const DEFAULT_PORT = 4100;
const DEFAULT_UPSTREAM = 'http://127.0.0.1:4000';
const DEFAULT_TIMEOUT_MS = 30_000;

function parsePositiveInt(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 600_000) throw new Error(`${name} must be a positive integer`);
  return parsed;
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
  };
}
