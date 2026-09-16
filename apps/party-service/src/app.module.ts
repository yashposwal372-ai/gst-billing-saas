import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validatePartyServiceEnvironment } from './config/party-service-environment.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { PartyModule } from './party/party.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validatePartyServiceEnvironment }), DatabaseModule, HealthModule, PartyModule],
})
export class AppModule {}
