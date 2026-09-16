import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'party-service' };
  }

  @Get('ready')
  @HttpCode(200)
  async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ready', service: 'party-service' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', service: 'party-service' });
    }
  }
}
