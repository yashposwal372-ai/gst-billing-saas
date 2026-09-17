import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@gst/prisma-client/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpPartyServiceClient } from './http-party-service.client.js';
import type { AuthContext } from '../../users/user.select.js';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const shouldRun = process.env.RUN_PARTY_POSTGRES_TESTS === '1' && Boolean(databaseUrl);
const describePostgres = shouldRun ? describe : describe.skip;
const secret = 'synthetic-party-service-ci-secret-32-bytes';
const runId = `a09-api-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const port = 4300 + Math.floor(Math.random() * 1000);

function config(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] } as never;
}

function party(index: number) {
  return {
    displayName: `A09 API Party ${index} ${runId}`,
    gstRegistered: false,
    phone: `96${String(index).padStart(8, '0')}`,
    addressLine1: `${index} Client Street`,
    city: 'Pune',
    state: 'Maharashtra',
    stateCode: '27',
    pincode: '411001',
    openingBalance: '0.20',
    paymentTermsDays: 0,
  };
}

async function waitForReady(baseUrl: string) {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      if (response.ok) return;
      lastError = new Error(`ready returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError instanceof Error ? lastError : new Error('party-service did not become ready');
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describePostgres('HttpPartyServiceClient live party-service integration', () => {
  let db: PrismaClient;
  let partyProcess: ChildProcessWithoutNullStreams;
  let business: Awaited<ReturnType<typeof createBusiness>>;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function createBusiness() {
    return db.business.create({
      data: {
        name: `A09 API ${runId}`,
        ownerName: 'A09 Owner',
        businessType: 'PROPRIETORSHIP',
        gstRegistered: false,
        mobile: '9699999999',
        email: `${runId}@example.test`,
        addressLine1: '1 Client Road',
        state: 'Maharashtra',
        stateCode: '27',
        city: 'Pune',
        pincode: '411001',
        invoicePrefix: 'INV',
        financialYear: '2026-27',
        gstMode: 'EXCLUSIVE',
        onboardingCompletedAt: new Date(),
      },
    });
  }

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    business = await createBusiness();
    partyProcess = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start', '--workspace', 'party-service'], {
      cwd: process.cwd().replace(/\\apps\\api$/, '').replace(/\/apps\/api$/, ''),
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl!, PARTY_SERVICE_HMAC_SECRET: secret, PARTY_SERVICE_PORT: String(port) },
      stdio: 'pipe',
    });
    let logs = '';
    partyProcess.stdout.on('data', (chunk) => { logs += String(chunk); });
    partyProcess.stderr.on('data', (chunk) => { logs += String(chunk); });
    partyProcess.once('exit', (code) => {
      if (code !== null && code !== 0) console.error(logs);
    });
    await waitForReady(baseUrl);
  }, 45_000);

  afterAll(async () => {
    if (partyProcess && !partyProcess.killed) partyProcess.kill();
    if (db) {
      await db.customer.deleteMany({ where: { businessId: business?.id } });
      await db.business.deleteMany({ where: { id: business?.id } });
      await db.$disconnect();
    }
  });

  it('uses the production monolith client against actual party-service HTTP and PostgreSQL', async () => {
    const client = new HttpPartyServiceClient(config({ PARTY_SERVICE_BASE_URL: baseUrl, PARTY_SERVICE_TIMEOUT_MS: 1000, PARTY_SERVICE_HMAC_SECRET: secret }));
    const auth = { user: { id: '11111111-1111-4111-8111-111111111111', currentBusinessId: business.id }, sessionId: 'session-live' } as AuthContext;
    const created = await client.createCustomer(auth, party(1));
    expect(created.customerCode).toBe('CUS-000001');
    expect(created.openingBalance).toBe('0.20');
    expect(await db.customer.count({ where: { id: created.id, businessId: business.id } })).toBe(1);
  });

  it('does not retry failed writes and maps unavailable/timeout failures safely', async () => {
    const auth = { user: { id: '11111111-1111-4111-8111-111111111111', currentBusinessId: business.id }, sessionId: 'session-live' } as AuthContext;
    let attempts = 0;
    const failing = createServer((_req, res) => { attempts += 1; res.statusCode = 503; res.end('{"message":"down"}'); });
    await new Promise<void>((resolve) => failing.listen(0, '127.0.0.1', resolve));
    const failingAddress = failing.address() as AddressInfo;
    const failingClient = new HttpPartyServiceClient(config({ PARTY_SERVICE_BASE_URL: `http://127.0.0.1:${failingAddress.port}`, PARTY_SERVICE_TIMEOUT_MS: 1000, PARTY_SERVICE_HMAC_SECRET: secret }));
    await expect(failingClient.createCustomer(auth, party(2))).rejects.toThrow('Party service is unavailable');
    expect(attempts).toBe(1);
    await closeServer(failing);

    const unavailable = new HttpPartyServiceClient(config({ PARTY_SERVICE_BASE_URL: 'http://127.0.0.1:9', PARTY_SERVICE_TIMEOUT_MS: 100, PARTY_SERVICE_HMAC_SECRET: secret }));
    await expect(unavailable.createCustomer(auth, party(3))).rejects.toThrow('Party service is unavailable');

    const stalled = createServer((_req, _res) => undefined);
    await new Promise<void>((resolve) => stalled.listen(0, '127.0.0.1', resolve));
    const stalledAddress = stalled.address() as AddressInfo;
    const timeout = new HttpPartyServiceClient(config({ PARTY_SERVICE_BASE_URL: `http://127.0.0.1:${stalledAddress.port}`, PARTY_SERVICE_TIMEOUT_MS: 50, PARTY_SERVICE_HMAC_SECRET: secret }));
    await expect(timeout.createCustomer(auth, party(4))).rejects.toThrow('Party service is unavailable');
    await closeServer(stalled);
  });
});