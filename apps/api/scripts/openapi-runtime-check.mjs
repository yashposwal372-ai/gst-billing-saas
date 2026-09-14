// Focused compiled-app documentation check. Only this test listens, on ephemeral loopback.
// The generator never listens and never initializes infrastructure.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
process.env.NODE_ENV = 'test';
const offline = execFileSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
  import { Socket, Server } from 'node:net';
  Socket.prototype.connect = function () { throw new Error('OpenAPI attempted a network connection'); };
  Server.prototype.listen = function () { throw new Error('OpenAPI attempted to listen'); };
  process.argv.push('--check');
  await import('./dist/openapi/cli.js');
`,
  ],
  { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 30000 },
);
assert.match(offline, /OpenAPI check passed/);
console.log(
  'Offline generation/check passed with network connections and server listening forbidden.',
);
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/common/configure-app.js');
const { configureOpenApi } = await import('../dist/openapi/openapi.config.js');
for (const mode of ['test', 'production']) {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    // Verify documentation's actual NODE_ENV decision without production credentials.
    app.get(ConfigService).set('NODE_ENV', mode);
    configureApp(app);
    configureOpenApi(app);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const health = await fetch(base + '/api/v1/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      status: 'ok',
      service: 'gst-billing-api',
    });
    for (const path of [
      '/api/docs',
      '/api/docs-json',
      '/api/docs/swagger-ui-bundle.js',
    ]) {
      const response = await fetch(base + path, {
        signal: AbortSignal.timeout(10000),
      });
      const body = await response.text();
      assert.equal(
        response.status,
        mode === 'production' ? 404 : 200,
        `${mode} ${path}`,
      );
      if (path.endsWith('-json') && mode !== 'production') {
        const document = JSON.parse(body);
        assert.equal(document.info.title, 'GST Billing SaaS API');
        assert.equal(
          document.paths['/api/v1/pos/checkout'].post.operationId,
          'pos.checkout',
        );
      }
    }
    const protectedResponse = await fetch(base + '/api/v1/customers');
    await protectedResponse.text();
    assert.equal(protectedResponse.status, 401);
    console.log(
      `Documentation HTTP checks passed in ${mode}; health and protected route compatibility preserved.`,
    );
  } finally {
    app.getHttpServer().closeAllConnections();
    await app.close();
  }
}
