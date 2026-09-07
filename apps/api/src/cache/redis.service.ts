import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Environment } from '../config/environment.js';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService<Environment, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.client.on('error', () =>
      this.logger.warn('Redis unavailable; check local service configuration.'),
    );
  }

  // Queue providers finish closing in onModuleDestroy before shared Redis closes.
  onApplicationShutdown() {
    this.client.disconnect();
  }
}
