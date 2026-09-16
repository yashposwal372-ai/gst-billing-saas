import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'api-gateway' };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  ready() {
    return this.health.ready();
  }
}
