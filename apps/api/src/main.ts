import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './common/configure-app.js';
import type { Environment } from './config/environment.js';
import { configureOpenApi } from './openapi/openapi.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  configureOpenApi(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Environment, true>);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
