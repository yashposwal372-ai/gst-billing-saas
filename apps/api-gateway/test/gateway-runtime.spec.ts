import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

async function startFixture(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function startGateway(upstream: string, timeout = '500') {
  const old = { NODE_ENV: process.env.NODE_ENV, MONOLITH_BASE_URL: process.env.MONOLITH_BASE_URL, PROXY_TIMEOUT_MS: process.env.PROXY_TIMEOUT_MS, GATEWAY_PORT: process.env.GATEWAY_PORT };
  process.env.NODE_ENV = 'test';
  process.env.MONOLITH_BASE_URL = upstream;
  process.env.PROXY_TIMEOUT_MS = timeout;
  vi.resetModules();
  const [{ AppModule }, { configureGateway }] = await Promise.all([import('../src/app.module.js'), import('../src/common/configure-gateway.js')]);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureGateway(app);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, baseUrl: `http://127.0.0.1:${port}`, restore: () => {
    for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : (process.env[key] = value);
  } };
}

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

describe('api gateway fixture runtime', () => {
  it('proxies method, path, query, body, cookies, CSRF and multiple Set-Cookie headers', async () => {
    const seen: Record<string, unknown>[] = [];
    const fixture = await startFixture(async (req, res) => {
      const payload = await body(req);
      seen.push({ url: req.url, method: req.method, headers: req.headers, payload });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Set-Cookie', ['gst_access=next; Path=/; HttpOnly', 'gst_refresh=next; Path=/api/v1/auth; HttpOnly']);
      res.statusCode = 201;
      res.end(JSON.stringify({ ok: true, payload }));
    });
    const gateway = await startGateway(fixture.baseUrl);
    try {
      const response = await fetch(`${gateway.baseUrl}/api/v1/products/by-barcode/A%2FB?tag=a&tag=b`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'gst_access=old; gst_refresh=old', Origin: 'http://localhost:3000', 'X-CSRF-Protection': '1', 'X-Request-ID': 'client-req-1', 'X-Correlation-ID': 'client-corr-1', 'X-GST-Internal-User-ID': 'spoof', Connection: 'close' },
        body: JSON.stringify({ amount: '12.34' }),
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ ok: true, payload: '{"amount":"12.34"}' });
      expect(response.headers.get('x-request-id')).toBe('client-req-1');
      expect(response.headers.get('x-correlation-id')).toBe('client-corr-1');
      expect(response.headers.getSetCookie?.().length ?? response.headers.get('set-cookie')?.split(/,\s*(?=gst_)/).length).toBe(2);
      expect(seen[0]).toMatchObject({ method: 'POST', url: '/api/v1/products/by-barcode/A%2FB?tag=a&tag=b', payload: '{"amount":"12.34"}' });
      const headers = seen[0]!.headers as Record<string, string>;
      expect(headers.cookie).toBe('gst_access=old; gst_refresh=old');
      expect(headers.origin).toBe('http://localhost:3000');
      expect(headers['x-csrf-protection']).toBe('1');
      expect(headers['x-gst-internal-user-id']).toBeUndefined();
      expect(headers['x-request-id']).toBe('client-req-1');
      expect(headers['x-correlation-id']).toBe('client-corr-1');
    } finally {
      await gateway.app.close();
      gateway.restore();
      fixture.server.close();
    }
  });

  it('supports raw body pass-through, upstream status pass-through and namespace 404', async () => {
    const fixture = await startFixture(async (req, res) => { res.statusCode = req.url === '/api/v1/conflict' ? 409 : 204; res.end(await body(req)); });
    const gateway = await startGateway(fixture.baseUrl);
    try {
      const raw = await fetch(`${gateway.baseUrl}/api/v1/raw`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'raw=12.30' });
      expect(raw.status).toBe(204);
      const conflict = await fetch(`${gateway.baseUrl}/api/v1/conflict`);
      expect(conflict.status).toBe(409);
      const unknown = await fetch(`${gateway.baseUrl}/api/docs`);
      expect(unknown.status).toBe(404);
    } finally {
      await gateway.app.close();
      gateway.restore();
      fixture.server.close();
    }
  });

  it('generates IDs, handles invalid IDs, exposes health and does not retry failures', async () => {
    let hits = 0;
    const fixture = await startFixture((req, res) => {
      hits += 1;
      if (req.url === '/api/v1/health') { res.setHeader('Content-Type','application/json'); res.end('{"status":"ok","service":"gst-billing-api"}'); return; }
      res.statusCode = 500;
      res.end('safe upstream error');
    });
    const gateway = await startGateway(fixture.baseUrl);
    try {
      expect((await fetch(`${gateway.baseUrl}/health/live`)).status).toBe(200);
      expect((await fetch(`${gateway.baseUrl}/health/ready`)).status).toBe(200);
      const fail = await fetch(`${gateway.baseUrl}/api/v1/fail`, { method: 'POST', headers: { 'X-Request-ID': 'bad id' }, body: 'once' });
      expect(fail.status).toBe(500);
      expect(fail.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(await fail.text()).toBe('safe upstream error');
      expect(hits).toBe(2);
    } finally {
      await gateway.app.close();
      gateway.restore();
      fixture.server.close();
    }
  });

  it('returns safe gateway errors for unavailable and timed-out upstreams', async () => {
    const hanging = await startFixture(() => undefined);
    const gateway = await startGateway(hanging.baseUrl, '50');
    try {
      const timedOut = await fetch(`${gateway.baseUrl}/api/v1/slow`);
      expect(timedOut.status).toBe(504);
      expect(await timedOut.json()).toMatchObject({ code: 'UPSTREAM_TIMEOUT', message: 'Upstream API timed out' });
    } finally {
      await gateway.app.close();
      gateway.restore();
      hanging.server.close();
    }

    const unavailable = await startGateway('http://127.0.0.1:9', '100');
    try {
      const response = await fetch(`${unavailable.baseUrl}/api/v1/health`);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', message: 'Upstream API is unavailable' });
    } finally {
      await unavailable.app.close();
      unavailable.restore();
    }
  });
});
