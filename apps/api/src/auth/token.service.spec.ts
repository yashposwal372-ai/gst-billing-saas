import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { TokenService } from './token.service.js';
import { setAuthCookies, clearAuthCookies } from './auth.cookies.js';
import type { Response } from 'express';

describe('token and cookie security', () => {
  const secret = 's'.repeat(48);
  const tokens = new TokenService(new ConfigService({ JWT_SECRET: secret }));
  it('rejects tampered JWTs', async () => {
    const token = await tokens.sign('user', 'session');
    const parts = token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ sub: 'attacker', sid: 'session' })).toString('base64url');
    await expect(tokens.verify(parts.join('.'))).rejects.toThrow();
  });
  it('rejects expired JWTs and incorrect audience', async () => {
    for (const audience of ['gst-billing-web', 'other']) {
      const token = await new SignJWT({ sid: 'session' }).setSubject('user').setProtectedHeader({ alg: 'HS256' })
        .setIssuer('gst-billing-api').setAudience(audience).setExpirationTime(audience === 'other' ? '15m' : 0)
        .sign(new TextEncoder().encode(secret));
      await expect(tokens.verify(token)).rejects.toThrow();
    }
  });
  it.each([true, false])('sets HttpOnly cookies, matching clear paths and secure=%s', (production) => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn(), setHeader: vi.fn() };
    setAuthCookies(res as unknown as Response, production, 'access', 'refresh', new Date(Date.now() + 100000));
    expect(res.cookie.mock.calls[0]![2]).toMatchObject({ httpOnly: true, secure: production, sameSite: 'lax', path: '/' });
    expect(res.cookie.mock.calls[1]![2]).toMatchObject({ httpOnly: true, secure: production, sameSite: 'lax', path: '/api/v1/auth' });
    clearAuthCookies(res as unknown as Response, production);
    expect(res.clearCookie.mock.calls[1]![0]).toBe(res.cookie.mock.calls[1]![0]);
    expect(res.clearCookie.mock.calls[1]![1].path).toBe('/api/v1/auth');
  });
});
