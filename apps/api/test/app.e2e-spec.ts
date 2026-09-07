import {
  Controller,
  Post,
  Body,
  Module,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { RedisService } from '../src/cache/redis.service.js';

class ProbeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
// Test-only route exercises the real global validation pipeline.
@Controller('validation-probe')
class ProbeController {
  @Post()
  check(@Body() body: ProbeDto) {
    return body;
  }
}
@Module({ imports: [AppModule], controllers: [ProbeController] })
class TestAppModule {}

describe('application foundation (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves prefixed health with security headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok', service: 'gst-billing-api' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(app.get(RedisService).client.status).toBe('wait');
  });
  it('preserves the starter response under the API prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
    await request(app.getHttpServer()).get('/health').expect(404);
  });
  it('allows configured origin without reflecting arbitrary origins', async () => {
    const origin = app.get(ConfigService).get<string>('FRONTEND_URL')!;
    const allowed = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    const denied = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example');
    expect(denied.headers['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
  });
  it('transforms DTO values and rejects unknown or invalid fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ quantity: '2' })
      .expect(201);
    expect(response.body.quantity).toBe(2);
    await request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ quantity: 2, extra: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/validation-probe')
      .send({ quantity: -1 })
      .expect(400);
  });
});
