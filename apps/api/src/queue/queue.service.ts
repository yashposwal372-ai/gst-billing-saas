import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../cache/redis.service.js';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  private readonly logger = new Logger(QueueService.name);
  constructor(private readonly redis: RedisService) {}

  // Producers are created on demand. Future workers need dedicated connections
  // with maxRetriesPerRequest: null; never reuse this bounded producer connection.
  getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.redis.client });
      queue.on('error', () =>
        this.logger.warn('Queue connection unavailable.'),
      );
      this.queues.set(name, queue);
    }
    return queue;
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
