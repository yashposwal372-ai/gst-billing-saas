import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateGatewayEnvironment } from './config/gateway-environment.js';
import { HealthModule } from './health/health.module.js';
import { ProxyModule } from './proxy/proxy.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateGatewayEnvironment }),
    HealthModule,
    ProxyModule,
  ],
})
export class AppModule {}
