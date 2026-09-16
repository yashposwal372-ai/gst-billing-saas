import { jwtVerify } from 'jose';

export type VerifiedAccessClaims = Readonly<{
  userId: string;
  sessionId: string;
}>;

const ISSUER = 'gst-billing-api';
const AUDIENCE = 'gst-billing-web';
const ALGORITHM = 'HS256';

export function accessCookieName(production: boolean): string {
  return production ? '__Host-gst_access' : 'gst_access';
}

export function refreshCookieName(production: boolean): string {
  return production ? '__Secure-gst_refresh' : 'gst_refresh';
}

export function readCookieValue(cookieHeader: unknown, name: string): string | undefined {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    const value = part.slice(index + 1).trim();
    return value ? decodeURIComponent(value) : undefined;
  }
  return undefined;
}

export class AccessTokenVerifier {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async verify(token: string): Promise<VerifiedAccessClaims> {
    const { payload } = await jwtVerify(token, this.key, { algorithms: [ALGORITHM], issuer: ISSUER, audience: AUDIENCE });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error('Invalid access token');
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
