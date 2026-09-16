import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { accessCookieName, AccessTokenVerifier, readCookieValue, refreshCookieName } from './access-token-verifier.js';

const secret = 'jwt-secret-for-a06-tests-at-least-32-bytes';

async function token(overrides: { secret?: string; alg?: 'HS256' | 'HS384'; expiresIn?: string; sid?: string } = {}) {
  return new SignJWT({ sid: overrides.sid ?? 'session-1' })
    .setProtectedHeader({ alg: overrides.alg ?? 'HS256' })
    .setSubject('user-1')
    .setIssuer('gst-billing-api')
    .setAudience('gst-billing-web')
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '15m')
    .sign(new TextEncoder().encode(overrides.secret ?? secret));
}

describe('gateway access token verifier', () => {
  it('verifies current HS256 access JWT claims', async () => {
    await expect(new AccessTokenVerifier(secret).verify(await token())).resolves.toEqual({ userId: 'user-1', sessionId: 'session-1' });
  });

  it('rejects expired, malformed, wrong-key and unsupported-algorithm access tokens', async () => {
    const verifier = new AccessTokenVerifier(secret);
    await expect(verifier.verify(await token({ expiresIn: '-1s' }))).rejects.toThrow();
    await expect(verifier.verify('not-a-jwt')).rejects.toThrow();
    await expect(verifier.verify(await token({ secret: 'other-secret-for-a06-tests-at-least-32-bytes' }))).rejects.toThrow();
    await expect(verifier.verify(await token({ alg: 'HS384' }))).rejects.toThrow();
  });

  it('recognizes only the access cookie names for the active environment', () => {
    expect(accessCookieName(false)).toBe('gst_access');
    expect(accessCookieName(true)).toBe('__Host-gst_access');
    expect(refreshCookieName(false)).toBe('gst_refresh');
    expect(refreshCookieName(true)).toBe('__Secure-gst_refresh');
    expect(readCookieValue('gst_refresh=opaque; gst_access=token-value', 'gst_access')).toBe('token-value');
    expect(readCookieValue('__Secure-gst_refresh=opaque', '__Host-gst_access')).toBeUndefined();
  });
});
