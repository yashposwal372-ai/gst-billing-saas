import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_CONTEXT_HEADER, INTERNAL_SIGNATURE_HEADER, signSecurityContext } from '@gst/security-context';
import type { GatewayEnvironment } from '../config/gateway-environment.js';
import { AccessTokenVerifier, accessCookieName, readCookieValue } from './access-token-verifier.js';

export type IdentityPropagationResult = 'anonymous' | 'verified' | 'invalid';

export type IdentityPropagationInput = Readonly<{
  headers: Record<string, unknown>;
  requestId: string;
  correlationId: string;
}>;

export type IdentityPropagationOutput = Readonly<{
  status: IdentityPropagationResult;
  headers: Record<string, string>;
}>;

@Injectable()
export class IdentityPropagationService {
  private readonly verifier?: AccessTokenVerifier;

  constructor(private readonly config: ConfigService<GatewayEnvironment, true>) {
    const jwtSecret = this.config.get('JWT_SECRET', { infer: true });
    this.verifier = jwtSecret ? new AccessTokenVerifier(jwtSecret) : undefined;
  }

  async buildTrustedHeaders(input: IdentityPropagationInput): Promise<IdentityPropagationOutput> {
    const production = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const accessCookie = readCookieValue(input.headers.cookie, accessCookieName(production));
    if (!accessCookie) return { status: 'anonymous', headers: {} };
    if (!this.verifier) return { status: 'invalid', headers: {} };
    try {
      const claims = await this.verifier.verify(accessCookie);
      const signed = signSecurityContext({
        secret: this.config.get('INTERNAL_IDENTITY_HMAC_SECRET', { infer: true }),
        requestId: input.requestId,
        correlationId: input.correlationId,
        userId: claims.userId,
        sessionId: claims.sessionId,
        lifetimeMs: this.config.get('INTERNAL_IDENTITY_MAX_AGE_MS', { infer: true }),
      });
      return { status: 'verified', headers: { [INTERNAL_CONTEXT_HEADER]: signed.encodedContext, [INTERNAL_SIGNATURE_HEADER]: signed.signature } };
    } catch {
      return { status: 'invalid', headers: {} };
    }
  }
}
