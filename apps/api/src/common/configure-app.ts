import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { Environment } from '../config/environment.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: config.get('FRONTEND_URL', { infer: true }) });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
}
