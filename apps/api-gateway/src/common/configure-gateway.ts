import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express, Request, Response } from 'express';
import type { GatewayEnvironment } from '../config/gateway-environment.js';
import { ProxyService } from '../proxy/proxy.service.js';

export function configureGateway(app: INestApplication): void {
  const proxy = app.get(ProxyService);
  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable('x-powered-by');
  express.use('/api/v1', (req: Request, res: Response) => void proxy.forward(req, res));
  const config = app.get(ConfigService<GatewayEnvironment, true>);
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    // Keep no-op branch explicit: A05 gateway does not expose Swagger UI; A04 docs remain on apps/api.
  }
}
