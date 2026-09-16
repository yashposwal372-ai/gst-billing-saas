import type { IncomingHttpHeaders } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { GatewayEnvironment } from '../config/gateway-environment.js';
import { IdentityPropagationService } from '../security/identity-propagation.service.js';

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const RESERVED_INTERNAL_HEADER_PREFIXES = ['x-gst-internal-', 'x-internal-'] as const;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const FORWARDED_HEADERS = new Set(['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']);
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function isSafeGatewayId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

export function effectiveGatewayId(value: unknown): string {
  return isSafeGatewayId(value) ? value : crypto.randomUUID();
}

export function isProxiedPublicApiPath(path: string): boolean {
  return path === '/api/v1' || path.startsWith('/api/v1/');
}

export function shouldStripRequestHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    HOP_BY_HOP_HEADERS.has(lower) ||
    FORWARDED_HEADERS.has(lower) ||
    RESERVED_INTERNAL_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))
  );
}

export function buildForwardHeaders(source: IncomingHttpHeaders, requestId: string, correlationId: string, host?: string, remoteAddress?: string, trustedIdentityHeaders: IncomingHttpHeaders = {}): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = {};
  for (const [name, value] of Object.entries(source)) {
    if (shouldStripRequestHeader(name)) continue;
    headers[name] = value;
  }
  headers[REQUEST_ID_HEADER] = requestId;
  headers[CORRELATION_ID_HEADER] = correlationId;
  for (const [name, value] of Object.entries(trustedIdentityHeaders)) {
    headers[name] = value;
  }
  if (host) headers['x-forwarded-host'] = host;
  if (remoteAddress) headers['x-forwarded-for'] = remoteAddress;
  headers['x-forwarded-proto'] = 'http';
  return headers;
}

function copyResponseHeaders(upstreamHeaders: IncomingHttpHeaders, res: Response, requestId: string, correlationId: string): void {
  for (const [name, value] of Object.entries(upstreamHeaders)) {
    if (!value || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    res.setHeader(name, value);
  }
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', correlationId);
}

function sendGatewayError(res: Response, status: number, code: string, message: string, requestId: string, correlationId: string): void {
  if (res.headersSent) return;
  res.status(status).setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', correlationId);
  res.json({ code, message, requestId });
}

@Injectable()
export class ProxyService {
  constructor(private readonly config: ConfigService<GatewayEnvironment, true>, private readonly identity: IdentityPropagationService) {}

  async forward(req: Request, res: Response): Promise<void> {
    const requestId = effectiveGatewayId(req.headers[REQUEST_ID_HEADER]);
    const correlationId = effectiveGatewayId(req.headers[CORRELATION_ID_HEADER] ?? requestId);
    if (!isProxiedPublicApiPath(req.originalUrl.split('?')[0] ?? req.originalUrl)) {
      sendGatewayError(res, 404, 'NOT_FOUND', 'Route not found', requestId, correlationId);
      return;
    }

    const upstreamBase = this.config.get('MONOLITH_BASE_URL', { infer: true });
    const timeoutMs = this.config.get('PROXY_TIMEOUT_MS', { infer: true });
    const upstreamUrl = new URL(req.originalUrl, upstreamBase);
    const transport = upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const identity = await this.identity.buildTrustedHeaders({ headers: req.headers as Record<string, unknown>, requestId, correlationId });
    const headers = buildForwardHeaders(req.headers, requestId, correlationId, req.headers.host, req.socket.remoteAddress, identity.headers);

    await new Promise<void>((resolve) => {
      let settled = false;
      const complete = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const upstream = transport(
        upstreamUrl,
        { method: req.method, headers, timeout: timeoutMs },
        (upstreamRes) => {
          copyResponseHeaders(upstreamRes.headers, res, requestId, correlationId);
          res.status(upstreamRes.statusCode ?? 502);
          upstreamRes.pipe(res);
          upstreamRes.on('end', complete);
          upstreamRes.on('error', () => {
            if (!res.headersSent) sendGatewayError(res, 502, 'UPSTREAM_UNAVAILABLE', 'Upstream API is unavailable', requestId, correlationId);
            complete();
          });
        },
      );
      upstream.on('timeout', () => {
        upstream.destroy();
        sendGatewayError(res, 504, 'UPSTREAM_TIMEOUT', 'Upstream API timed out', requestId, correlationId);
        complete();
      });
      upstream.on('error', () => {
        sendGatewayError(res, 502, 'UPSTREAM_UNAVAILABLE', 'Upstream API is unavailable', requestId, correlationId);
        complete();
      });
      req.pipe(upstream);
    });
  }
}
