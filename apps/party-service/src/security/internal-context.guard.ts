import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_CONTEXT_HEADER, INTERNAL_SIGNATURE_HEADER, PARTY_SERVICE_CONTEXT_AUDIENCE, PARTY_SERVICE_CONTEXT_SOURCE, verifySecurityContext, type SecurityContextPayload } from '@gst/security-context';
import type { PartyServiceEnvironment } from '../config/party-service-environment.js';

export type PartyInternalContext = SecurityContextPayload & { businessId: string };

function readHeader(headers: Record<string, unknown>, name: string): string | undefined {
  const value = headers[name.toLowerCase()] ?? headers[name];
  return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : undefined;
}

@Injectable()
export class InternalContextGuard implements CanActivate {
  constructor(private readonly config: ConfigService<PartyServiceEnvironment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown>; internalContext?: PartyInternalContext }>();
    const encodedContext = readHeader(request.headers, INTERNAL_CONTEXT_HEADER);
    const signature = readHeader(request.headers, INTERNAL_SIGNATURE_HEADER);
    const requestId = readHeader(request.headers, 'x-request-id');
    const correlationId = readHeader(request.headers, 'x-correlation-id');
    if (!encodedContext || !signature || !requestId || !correlationId) throw new UnauthorizedException({ code: 'INTERNAL_CONTEXT_INVALID', message: 'Internal service context is required' });
    try {
      const payload = verifySecurityContext({
        secret: this.config.get('PARTY_SERVICE_HMAC_SECRET', { infer: true }),
        encodedContext,
        signature,
        expectedSource: PARTY_SERVICE_CONTEXT_SOURCE,
        expectedAudience: PARTY_SERVICE_CONTEXT_AUDIENCE,
        requireBusinessId: true,
        expectedRequestId: requestId,
        expectedCorrelationId: correlationId,
      });
      request.internalContext = payload as PartyInternalContext;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INTERNAL_CONTEXT_INVALID', message: 'Internal service context is invalid' });
    }
  }
}
