import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DatabaseService } from './database/database.service.js';
import { RedisService } from './cache/redis.service.js';

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const results = await Promise.allSettled([
    app.get(DatabaseService).$queryRaw`SELECT 1`,
    app.get(RedisService).client.ping(),
  ]);
  results.forEach((result, index) => {
    const service = index === 0 ? 'PostgreSQL via Prisma' : 'Redis';
    console.log(
      service +
        ': ' +
        (result.status === 'fulfilled'
          ? 'PASS'
          : 'FAIL (check service and configuration)'),
    );
  });
  if (results.some((result) => result.status === 'rejected'))
    process.exitCode = 1;
} finally {
  await app.close();
}
