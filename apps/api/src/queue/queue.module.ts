import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module.js';
import { QueueService } from './queue.service.js';

@Module({
  imports: [CacheModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
