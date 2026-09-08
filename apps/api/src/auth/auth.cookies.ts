import type { Request, Response, CookieOptions } from 'express';
import { ACCESS_SECONDS, SESSION_MS } from './token.service.js';

export function cookieNames(production: boolean) {
  return { access: production ? '__Host-gst_access' : 'gst_access',
    refresh: production ? '__Secure-gst_refresh' : 'gst_refresh' };
}
export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : undefined;
}
export function setAuthCookies(res: Response, production: boolean, access: string, refresh: string, expiresAt: Date) {
  const names = cookieNames(production);
  const base: CookieOptions = { httpOnly: true, secure: production, sameSite: 'lax' };
  res.cookie(names.access, access, { ...base, path: '/', maxAge: ACCESS_SECONDS * 1000 });
  res.cookie(names.refresh, refresh, { ...base, path: '/api/v1/auth', maxAge: Math.max(0, Math.min(SESSION_MS, expiresAt.getTime() - Date.now())) });
  res.setHeader('Cache-Control', 'no-store');
}
export function clearAuthCookies(res: Response, production: boolean) {
  const names = cookieNames(production);
  const base: CookieOptions = { httpOnly: true, secure: production, sameSite: 'lax' };
  res.clearCookie(names.access, { ...base, path: '/' });
  res.clearCookie(names.refresh, { ...base, path: '/api/v1/auth' });
  res.setHeader('Cache-Control', 'no-store');
}
