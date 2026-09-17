import 'reflect-metadata';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@gst/prisma-client/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_SIGNATURE_HEADER,
  PARTY_SERVICE_CONTEXT_AUDIENCE,
  PARTY_SERVICE_CONTEXT_SOURCE,
  SECURITY_CONTEXT_AUDIENCE,
  SECURITY_CONTEXT_SOURCE,
  signSecurityContext,
} from '@gst/security-context';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const shouldRun = process.env.RUN_PARTY_POSTGRES_TESTS === '1' && Boolean(databaseUrl);
const describePostgres = shouldRun ? describe : describe.skip;
const secret = 'synthetic-party-service-ci-secret-32-bytes';
const runId = `a09-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function config(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] } as never;
}

function baseParty(index: number) {
  return {
    displayName: `A09 Party ${index} ${runId}`,
    gstRegistered: false,
    phone: `98${String(index).padStart(8, '0')}`,
    addressLine1: `${index} Test Street`,
    city: 'Pune',
    state: 'Maharashtra',
    stateCode: '27',
    pincode: '411001',
    openingBalance: '0.10',
    paymentTermsDays: 7,
  };
}

function signedHeaders(businessId: string, overrides: Partial<Parameters<typeof signSecurityContext>[0]> = {}, headerOverrides: Record<string, string> = {}) {
  const requestId = headerOverrides['x-request-id'] ?? `req-${crypto.randomUUID()}`;
  const correlationId = headerOverrides['x-correlation-id'] ?? requestId;
  const signed = signSecurityContext({
    secret,
    source: PARTY_SERVICE_CONTEXT_SOURCE,
    audience: PARTY_SERVICE_CONTEXT_AUDIENCE,
    requestId,
    correlationId,
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    businessId,
    ...overrides,
  });
  return {
    'x-request-id': requestId,
    'x-correlation-id': correlationId,
    [INTERNAL_CONTEXT_HEADER]: signed.encodedContext,
    [INTERNAL_SIGNATURE_HEADER]: signed.signature,
    ...headerOverrides,
  };
}

async function createBusiness(db: PrismaClient, suffix: string) {
  return db.business.create({
    data: {
      name: `A09 ${suffix} ${runId}`,
      ownerName: 'A09 Owner',
      businessType: 'PROPRIETORSHIP',
      gstRegistered: false,
      mobile: `97${suffix.padStart(8, '0').slice(0, 8)}`,
      email: `${runId}-${suffix}@example.test`,
      addressLine1: '1 CI Road',
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

describePostgres('party-service real PostgreSQL integration', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let baseUrl: string;
  let businessA: Awaited<ReturnType<typeof createBusiness>>;
  let businessB: Awaited<ReturnType<typeof createBusiness>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = databaseUrl!;
    process.env.PARTY_SERVICE_HMAC_SECRET = secret;
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    businessA = await createBusiness(db, '10000001');
    businessB = await createBusiness(db, '10000002');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (db) {
      await db.customer.deleteMany({ where: { businessId: { in: [businessA?.id, businessB?.id].filter(Boolean) } } });
      await db.supplier.deleteMany({ where: { businessId: { in: [businessA?.id, businessB?.id].filter(Boolean) } } });
      await db.business.deleteMany({ where: { id: { in: [businessA?.id, businessB?.id].filter(Boolean) } } });
      await db.$disconnect();
    }
  });

  it('persists Customer records, exact decimals, search, update, deactivate and reactivate through real HTTP and Prisma', async () => {
    const create = await request(baseUrl)
      .post('/internal/v1/party/customers')
      .set(signedHeaders(businessA.id))
      .send({ ...baseParty(1), gstRegistered: true, gstin: '27ABCDE1234F1Z5', pan: 'ABCDE1234F', customerType: 'BUSINESS', creditLimit: '123.40' })
      .expect(201);
    expect(create.body.profile.customerCode).toBe('CUS-000001');
    expect(create.body.profile.openingBalance).toBe('0.10');
    expect(create.body.profile.creditLimit).toBe('123.40');

    await request(baseUrl)
      .get('/internal/v1/party/customers?page=1&pageSize=10&search=A09%20Party&status=active&gstRegistered=true&state=Maharashtra&sortBy=code&sortOrder=asc')
      .set(signedHeaders(businessA.id))
      .expect(200)
      .expect((res) => expect(res.body.items.some((item: { id: string }) => item.id === create.body.profile.id)).toBe(true));

    await request(baseUrl)
      .get(`/internal/v1/party/customers/${create.body.profile.id}`)
      .set(signedHeaders(businessA.id))
      .expect(200)
      .expect((res) => expect(res.body.profile.openingBalance).toBe('0.10'));

    await request(baseUrl)
      .patch(`/internal/v1/party/customers/${create.body.profile.id}`)
      .set(signedHeaders(businessA.id))
      .send({ displayName: 'A09 Customer Updated', isActive: true })
      .expect(200)
      .expect((res) => expect(res.body.profile.displayName).toBe('A09 Customer Updated'));

    await request(baseUrl).delete(`/internal/v1/party/customers/${create.body.profile.id}`).set(signedHeaders(businessA.id)).expect(200).expect((res) => expect(res.body.profile.isActive).toBe(false));
    await request(baseUrl).patch(`/internal/v1/party/customers/${create.body.profile.id}`).set(signedHeaders(businessA.id)).send({ isActive: true }).expect(200).expect((res) => expect(res.body.profile.isActive).toBe(true));
    expect(await db.customer.count({ where: { id: create.body.profile.id } })).toBe(1);
  });

  it('persists Supplier records, exact decimals, search, update, deactivate and reactivate through real HTTP and Prisma', async () => {
    const create = await request(baseUrl)
      .post('/internal/v1/party/suppliers')
      .set(signedHeaders(businessA.id))
      .send({ ...baseParty(2), openingBalance: '0.30', gstRegistered: true, gstin: '27ABCDE1234F2Z5', pan: 'ABCDE1234F', bankName: 'CI Bank', accountHolderName: 'A09 Supplier', accountNumber: '123456789012', ifsc: 'HDFC0001234' })
      .expect(201);
    expect(create.body.profile.supplierCode).toBe('SUP-000001');
    expect(create.body.profile.openingBalance).toBe('0.30');

    await request(baseUrl)
      .get('/internal/v1/party/suppliers?page=1&pageSize=10&search=A09%20Party&status=active&gstRegistered=true&state=Maharashtra&sortBy=code&sortOrder=asc')
      .set(signedHeaders(businessA.id))
      .expect(200)
      .expect((res) => expect(res.body.items.some((item: { id: string }) => item.id === create.body.profile.id)).toBe(true));

    await request(baseUrl).get(`/internal/v1/party/suppliers/${create.body.profile.id}`).set(signedHeaders(businessA.id)).expect(200);
    await request(baseUrl).patch(`/internal/v1/party/suppliers/${create.body.profile.id}`).set(signedHeaders(businessA.id)).send({ displayName: 'A09 Supplier Updated' }).expect(200).expect((res) => expect(res.body.profile.displayName).toBe('A09 Supplier Updated'));
    await request(baseUrl).delete(`/internal/v1/party/suppliers/${create.body.profile.id}`).set(signedHeaders(businessA.id)).expect(200).expect((res) => expect(res.body.profile.isActive).toBe(false));
    await request(baseUrl).patch(`/internal/v1/party/suppliers/${create.body.profile.id}`).set(signedHeaders(businessA.id)).send({ isActive: true }).expect(200).expect((res) => expect(res.body.profile.isActive).toBe(true));
    expect(await db.supplier.count({ where: { id: create.body.profile.id } })).toBe(1);
  });

  it('enforces signed-context tenant isolation for Customer and Supplier list/detail/update/deactivate', async () => {
    const customerB = await request(baseUrl).post('/internal/v1/party/customers').set(signedHeaders(businessB.id)).send(baseParty(3)).expect(201);
    const supplierB = await request(baseUrl).post('/internal/v1/party/suppliers').set(signedHeaders(businessB.id)).send(baseParty(4)).expect(201);

    await request(baseUrl).get('/internal/v1/party/customers?page=1&pageSize=100&search=&status=all&gstRegistered=all&state=&sortBy=displayName&sortOrder=asc').set(signedHeaders(businessA.id)).expect(200).expect((res) => expect(res.body.items.some((item: { id: string }) => item.id === customerB.body.profile.id)).toBe(false));
    await request(baseUrl).get(`/internal/v1/party/customers/${customerB.body.profile.id}`).set(signedHeaders(businessA.id)).expect(404);
    await request(baseUrl).patch(`/internal/v1/party/customers/${customerB.body.profile.id}`).set(signedHeaders(businessA.id)).send({ displayName: 'Cross tenant' }).expect(404);
    await request(baseUrl).delete(`/internal/v1/party/customers/${customerB.body.profile.id}`).set(signedHeaders(businessA.id)).expect(404);

    await request(baseUrl).get('/internal/v1/party/suppliers?page=1&pageSize=100&search=&status=all&gstRegistered=all&state=&sortBy=displayName&sortOrder=asc').set(signedHeaders(businessA.id)).expect(200).expect((res) => expect(res.body.items.some((item: { id: string }) => item.id === supplierB.body.profile.id)).toBe(false));
    await request(baseUrl).get(`/internal/v1/party/suppliers/${supplierB.body.profile.id}`).set(signedHeaders(businessA.id)).expect(404);
    await request(baseUrl).patch(`/internal/v1/party/suppliers/${supplierB.body.profile.id}`).set(signedHeaders(businessA.id)).send({ displayName: 'Cross tenant' }).expect(404);
    await request(baseUrl).delete(`/internal/v1/party/suppliers/${supplierB.body.profile.id}`).set(signedHeaders(businessA.id)).expect(404);
  });

  it('maps real PostgreSQL tenant-scoped GSTIN uniqueness to conflict errors', async () => {
    await request(baseUrl).post('/internal/v1/party/customers').set(signedHeaders(businessA.id)).send({ ...baseParty(5), gstRegistered: true, gstin: '27ABCDE1234F3Z5', pan: 'ABCDE1234F' }).expect(201);
    await request(baseUrl).post('/internal/v1/party/customers').set(signedHeaders(businessA.id)).send({ ...baseParty(6), gstRegistered: true, gstin: '27ABCDE1234F3Z5', pan: 'ABCDE1234F' }).expect(409).expect((res) => expect(res.body.message).toContain('already exists'));
    await request(baseUrl).post('/internal/v1/party/customers').set(signedHeaders(businessB.id)).send({ ...baseParty(7), gstRegistered: true, gstin: '27ABCDE1234F3Z5', pan: 'ABCDE1234F' }).expect(201);

    await request(baseUrl).post('/internal/v1/party/suppliers').set(signedHeaders(businessA.id)).send({ ...baseParty(8), gstRegistered: true, gstin: '27ABCDE1234F4Z5', pan: 'ABCDE1234F' }).expect(201);
    await request(baseUrl).post('/internal/v1/party/suppliers').set(signedHeaders(businessA.id)).send({ ...baseParty(9), gstRegistered: true, gstin: '27ABCDE1234F4Z5', pan: 'ABCDE1234F' }).expect(409).expect((res) => expect(res.body.message).toContain('already exists'));
    await request(baseUrl).post('/internal/v1/party/suppliers').set(signedHeaders(businessB.id)).send({ ...baseParty(10), gstRegistered: true, gstin: '27ABCDE1234F4Z5', pan: 'ABCDE1234F' }).expect(201);
  });

  it('rejects missing, wrong-secret, wrong-audience and tampered-tenant contexts before repository execution', async () => {
    const before = await db.customer.count({ where: { businessId: businessA.id } });
    await request(baseUrl).post('/internal/v1/party/customers').send(baseParty(11)).expect(401);
    await request(baseUrl).post('/internal/v1/party/customers').set(signedHeaders(businessA.id, { secret: 'wrong-party-service-secret-32-bytes' })).send(baseParty(12)).expect(401);
    await request(baseUrl).post('/internal/v1/party/customers').set(signedHeaders(businessA.id, { audience: SECURITY_CONTEXT_AUDIENCE, source: SECURITY_CONTEXT_SOURCE, businessId: undefined })).send(baseParty(13)).expect(401);
    const signed = signSecurityContext({ secret, source: PARTY_SERVICE_CONTEXT_SOURCE, audience: PARTY_SERVICE_CONTEXT_AUDIENCE, requestId: 'req-tamper', correlationId: 'req-tamper', userId: 'user-1', businessId: businessA.id });
    const payload = JSON.parse(Buffer.from(signed.encodedContext, 'base64url').toString('utf8')) as Record<string, unknown>;
    payload.businessId = businessB.id;
    const tampered = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    await request(baseUrl).post('/internal/v1/party/customers').set({ 'x-request-id': 'req-tamper', 'x-correlation-id': 'req-tamper', [INTERNAL_CONTEXT_HEADER]: tampered, [INTERNAL_SIGNATURE_HEADER]: signed.signature }).send(baseParty(14)).expect(401);
    expect(await db.customer.count({ where: { businessId: businessA.id } })).toBe(before);
  });


  it('reports liveness without database and readiness according to database health without exposing secrets', async () => {
    await request(baseUrl).get('/health/live').expect(200).expect((res) => expect(res.body).toEqual({ status: 'ok', service: 'party-service' }));
    await request(baseUrl).get('/health/ready').expect(200).expect((res) => expect(res.body).toEqual({ status: 'ready', service: 'party-service' }));

    const oldUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://bad:bad@127.0.0.1:9/missing';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const badApp = module.createNestApplication();
    badApp.useLogger(false);
    await badApp.init();
    await request(badApp.getHttpServer()).get('/health/live').expect(200);
    await request(badApp.getHttpServer()).get('/health/ready').expect(503).expect((res) => {
      expect(JSON.stringify(res.body)).not.toContain('postgresql://');
      expect(JSON.stringify(res.body)).not.toContain('bad:bad');
    });
    await badApp.close();
    process.env.DATABASE_URL = oldUrl;
  });

  it('owns and closes the party-service Prisma lifecycle through Nest shutdown', async () => {
    const database = app.get(DatabaseService);
    await expect(database.$queryRaw`SELECT 1`).resolves.toBeDefined();
    await app.close();
    await expect(database.$disconnect()).resolves.toBeUndefined();

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
});