import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { ApiErrorFilter } from './api-error.filter.js';
import type { Environment } from '../config/environment.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get('FRONTEND_URL', { infer: true }), credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Protection'], methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
  app.use('/api/v1/auth', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    skip: (req) => req.method === 'GET' || req.method === 'OPTIONS',
    message: { statusCode: 429, message: 'Too many attempts. Please try again later.' },
  }));
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
}
