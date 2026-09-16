import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@gst/prisma-client/client';
import type { PartyServiceEnvironment } from '../config/party-service-environment.js';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<PartyServiceEnvironment, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }), connectionTimeoutMillis: 3000 }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
