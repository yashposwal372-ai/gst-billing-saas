export type PartyServiceEnvironment = Readonly<{
  NODE_ENV: 'development' | 'test' | 'production';
  PARTY_SERVICE_PORT: number;
  DATABASE_URL: string;
  PARTY_SERVICE_HMAC_SECRET: string;
}>;

const DEFAULT_PORT = 4200;
const DEFAULT_DATABASE_URL = 'postgresql://gst_dev:gst_dev_local@localhost:5432/gst_billing';
const LOCAL_SECRET = 'local-party-service-secret-change-me-32-bytes';
const MIN_SECRET_BYTES = 32;

function parsePort(value: unknown): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) throw new Error('PARTY_SERVICE_PORT must be a valid port');
  return parsed;
}

function parseDatabaseUrl(value: unknown, nodeEnv: PartyServiceEnvironment['NODE_ENV']): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_DATABASE_URL;
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error('DATABASE_URL must be a PostgreSQL URL');
  if (nodeEnv === 'production' && raw === DEFAULT_DATABASE_URL) throw new Error('DATABASE_URL must be configured in production');
  return raw;
}

function parseSecret(value: unknown, nodeEnv: PartyServiceEnvironment['NODE_ENV']): string {
  if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= MIN_SECRET_BYTES && !/placeholder|replace|change.me/i.test(value)) return value;
  if (nodeEnv === 'production') throw new Error('PARTY_SERVICE_HMAC_SECRET must be a real secret with at least 32 bytes in production');
  return LOCAL_SECRET;
}

export function validatePartyServiceEnvironment(config: Record<string, unknown>): PartyServiceEnvironment {
  const nodeEnv = config.NODE_ENV === 'production' || config.NODE_ENV === 'test' ? config.NODE_ENV : 'development';
  return {
    NODE_ENV: nodeEnv,
    PARTY_SERVICE_PORT: parsePort(config.PARTY_SERVICE_PORT),
    DATABASE_URL: parseDatabaseUrl(config.DATABASE_URL, nodeEnv),
    PARTY_SERVICE_HMAC_SECRET: parseSecret(config.PARTY_SERVICE_HMAC_SECRET, nodeEnv),
  };
}
