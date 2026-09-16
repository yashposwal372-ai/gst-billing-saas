import { describe, expect, it } from 'vitest';
import { validateGatewayEnvironment } from './gateway-environment.js';

describe('gateway environment', () => {
  it('uses safe local defaults', () => {
    expect(validateGatewayEnvironment({})).toMatchObject({ GATEWAY_PORT: 4100, MONOLITH_BASE_URL: 'http://127.0.0.1:4000', PROXY_TIMEOUT_MS: 30000 });
  });

  it('rejects invalid upstreams and timeout values', () => {
    expect(() => validateGatewayEnvironment({ MONOLITH_BASE_URL: 'file:///tmp/api' })).toThrow(/http or https/);
    expect(() => validateGatewayEnvironment({ PROXY_TIMEOUT_MS: '0' })).toThrow(/positive integer/);
  });
});
