import { describe, expect, it } from 'vitest';
import { validateGatewayEnvironment } from './gateway-environment.js';

describe('gateway environment', () => {
  it('uses safe local defaults', () => {
    expect(validateGatewayEnvironment({})).toMatchObject({ GATEWAY_PORT: 4100, MONOLITH_BASE_URL: 'http://127.0.0.1:4000', PROXY_TIMEOUT_MS: 30000, INTERNAL_IDENTITY_MAX_AGE_MS: 60000 });
  });

  it('rejects invalid upstreams, timeout values and production identity secrets', () => {
    expect(() => validateGatewayEnvironment({ MONOLITH_BASE_URL: 'file:///tmp/api' })).toThrow(/http or https/);
    expect(() => validateGatewayEnvironment({ PROXY_TIMEOUT_MS: '0' })).toThrow(/positive integer/);
    expect(() => validateGatewayEnvironment({ INTERNAL_IDENTITY_MAX_AGE_MS: '60001' })).toThrow(/at most/);
    expect(() => validateGatewayEnvironment({ NODE_ENV: 'production' })).toThrow(/INTERNAL_IDENTITY_HMAC_SECRET/);
  });

  it('accepts explicit production identity and JWT verification secrets', () => {
    expect(validateGatewayEnvironment({ NODE_ENV: 'production', JWT_SECRET: 'jwt-secret', INTERNAL_IDENTITY_HMAC_SECRET: 's'.repeat(32) })).toMatchObject({ NODE_ENV: 'production', JWT_SECRET: 'jwt-secret', INTERNAL_IDENTITY_HMAC_SECRET: 's'.repeat(32) });
  });
});
