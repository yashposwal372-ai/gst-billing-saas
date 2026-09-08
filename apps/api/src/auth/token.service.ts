import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_SECONDS = 15 * 60;
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;
  constructor(config: ConfigService) {
    // A per-process development key keeps build/health usable without secrets.
    // Production validation requires a configured key. Restart invalidates local access JWTs.
    this.key = new TextEncoder().encode(config.get<string>('JWT_SECRET') || newToken());
  }
  sign(userId: string, sessionId: string) {
    return new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId).setIssuer('gst-billing-api').setAudience('gst-billing-web')
      .setIssuedAt().setExpirationTime(ACCESS_SECONDS + 's').sign(this.key);
  }
  async verify(token: string) {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: ['HS256'], issuer: 'gst-billing-api', audience: 'gst-billing-web',
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error('Invalid access token');
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
