import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { INTERNAL_CONTEXT_HEADER, INTERNAL_SIGNATURE_HEADER, verifySecurityContext } from '@gst/security-context';
import { IdentityPropagationService } from './identity-propagation.service.js';

const jwtSecret = 'jwt-secret-for-a06-tests-at-least-32-bytes';
const internalSecret = 'internal-secret-for-a06-tests-at-least-32-bytes';

function service(env: Record<string, unknown> = {}) {
  return new IdentityPropagationService(new ConfigService({ NODE_ENV: 'test', JWT_SECRET: jwtSecret, INTERNAL_IDENTITY_HMAC_SECRET: internalSecret, INTERNAL_IDENTITY_MAX_AGE_MS: 60000, ...env }));
}

async function token(overrides: { secret?: string; expiresIn?: string } = {}) {
  return new SignJWT({ sid: 'session-1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer('gst-billing-api')
    .setAudience('gst-billing-web')
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '15m')
    .sign(new TextEncoder().encode(overrides.secret ?? jwtSecret));
}

describe('identity propagation service', () => {
  it('creates a signed internal context from a valid local access cookie', async () => {
    const result = await service().buildTrustedHeaders({ headers: { cookie: `gst_access=${await token()}` }, requestId: 'req-1', correlationId: 'corr-1' });
    expect(result.status).toBe('verified');
    const payload = verifySecurityContext({ secret: internalSecret, encodedContext: result.headers[INTERNAL_CONTEXT_HEADER]!, signature: result.headers[INTERNAL_SIGNATURE_HEADER]!, expectedRequestId: 'req-1', expectedCorrelationId: 'corr-1' });
    expect(payload).toMatchObject({ userId: 'user-1', sessionId: 'session-1' });
    expect(JSON.stringify(payload)).not.toContain('gst_access');
  });

  it('creates a signed internal context from a valid production access cookie', async () => {
    const result = await service({ NODE_ENV: 'production' }).buildTrustedHeaders({ headers: { cookie: `__Host-gst_access=${await token()}` }, requestId: 'req-2', correlationId: 'corr-2' });
    expect(result.status).toBe('verified');
  });

  it('does not create trusted headers for no access, refresh-only, expired, malformed or wrong-key tokens', async () => {
    const cases = [
      undefined,
      'gst_refresh=opaque-refresh-token',
      `gst_access=${await token({ expiresIn: '-1s' })}`,
      'gst_access=malformed',
      `gst_access=${await token({ secret: 'wrong-secret-for-a06-tests-at-least-32-bytes' })}`,
    ];
    for (const cookie of cases) {
      const result = await service().buildTrustedHeaders({ headers: cookie ? { cookie } : {}, requestId: 'req-1', correlationId: 'corr-1' });
      expect(result.headers[INTERNAL_CONTEXT_HEADER]).toBeUndefined();
      expect(result.headers[INTERNAL_SIGNATURE_HEADER]).toBeUndefined();
    }
  });
});
