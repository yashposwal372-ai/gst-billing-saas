import { describe, expect, it } from 'vitest';
import { buildForwardHeaders, effectiveGatewayId, isProxiedPublicApiPath, isSafeGatewayId, shouldStripRequestHeader } from './proxy.service.js';

describe('gateway proxy policy', () => {
  it('covers only the public v1 API namespace', () => {
    expect(isProxiedPublicApiPath('/api/v1')).toBe(true);
    expect(isProxiedPublicApiPath('/api/v1/customers')).toBe(true);
    expect(isProxiedPublicApiPath('/api/docs')).toBe(false);
    expect(isProxiedPublicApiPath('/https://example.com/api/v1')).toBe(false);
  });

  it('validates bounded request and correlation identifiers', () => {
    expect(isSafeGatewayId('req-123_ABC.ok:1')).toBe(true);
    expect(isSafeGatewayId('bad id')).toBe(false);
    expect(isSafeGatewayId('x'.repeat(129))).toBe(false);
    expect(effectiveGatewayId('safe-id')).toBe('safe-id');
    expect(effectiveGatewayId('bad id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('strips hop-by-hop, forwarded and reserved internal headers', () => {
    expect(shouldStripRequestHeader('connection')).toBe(true);
    expect(shouldStripRequestHeader('X-Forwarded-For')).toBe(true);
    expect(shouldStripRequestHeader('x-gst-internal-user-id')).toBe(true);
    expect(shouldStripRequestHeader('x-internal-role')).toBe(true);
    expect(shouldStripRequestHeader('x-csrf-protection')).toBe(false);
  });

  it('preserves browser auth and CSRF headers while setting effective IDs', () => {
    const headers = buildForwardHeaders({ cookie: 'gst_access=a', origin: 'http://localhost:3000', 'x-csrf-protection': '1', connection: 'close', 'x-gst-internal-user-id': 'spoof' }, 'req-1', 'corr-1', 'localhost:4100', '127.0.0.1');
    expect(headers.cookie).toBe('gst_access=a');
    expect(headers.origin).toBe('http://localhost:3000');
    expect(headers['x-csrf-protection']).toBe('1');
    expect(headers.connection).toBeUndefined();
    expect(headers['x-gst-internal-user-id']).toBeUndefined();
    expect(headers['x-request-id']).toBe('req-1');
    expect(headers['x-correlation-id']).toBe('corr-1');
  });
});
