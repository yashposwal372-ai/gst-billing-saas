import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureGateway } from './common/configure-gateway.js';
import type { GatewayEnvironment } from './config/gateway-environment.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureGateway(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<GatewayEnvironment, true>);
  await app.listen(config.get('GATEWAY_PORT', { infer: true }));
}

await bootstrap();
