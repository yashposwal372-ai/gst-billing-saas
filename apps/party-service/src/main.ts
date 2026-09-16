import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { validatePartyServiceEnvironment } from './config/party-service-environment.js';

async function bootstrap() {
  const env = validatePartyServiceEnvironment(process.env);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('');
  await app.listen(env.PARTY_SERVICE_PORT);
}

void bootstrap();
