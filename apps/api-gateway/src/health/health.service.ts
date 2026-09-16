import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GatewayEnvironment } from '../config/gateway-environment.js';

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService<GatewayEnvironment, true>) {}

  async ready() {
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(5_000, this.config.get('PROXY_TIMEOUT_MS', { infer: true })));
    try {
      const upstream = new URL('/api/v1/health', this.config.get('MONOLITH_BASE_URL', { infer: true }));
      const response = await fetch(upstream, { signal: controller.signal, headers: { 'X-Request-ID': requestId } });
      if (!response.ok) throw new Error('upstream not ready');
      return { status: 'ok', service: 'api-gateway', upstream: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ code: 'UPSTREAM_UNAVAILABLE', message: 'Upstream API is not ready', requestId });
    } finally {
      clearTimeout(timeout);
    }
  }
}
