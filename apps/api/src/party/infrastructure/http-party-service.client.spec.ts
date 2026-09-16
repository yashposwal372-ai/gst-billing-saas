import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, afterEach } from 'vitest';
import {
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_SIGNATURE_HEADER,
  PARTY_SERVICE_CONTEXT_AUDIENCE,
  PARTY_SERVICE_CONTEXT_SOURCE,
  verifySecurityContext,
} from '@gst/security-context';
import { HttpPartyServiceClient } from './http-party-service.client.js';
import type { AuthContext } from '../../users/user.select.js';

const secret = 'party-service-client-secret-32-bytes-long';
const auth: AuthContext = {
  user: {
    id: 'user-1',
    email: 'u@example.com',
    firstName: 'U',
    lastName: 'One',
    mobile: null,
    emailVerifiedAt: null,
    currentBusinessId: 'business-a',
  },
  sessionId: 'session-1',
};

type Hit = {
  method?: string;
  url?: string;
  headers: IncomingMessage['headers'];
  body: string;
};
const servers: Array<{ close: () => void }> = [];
async function fixture(
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    hit: Hit,
  ) => void | Promise<void>,
) {
  const hits: Hit[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk);
    });
    req.on('end', () => {
      const hit = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      };
      hits.push(hit);
      void handler(req, res, hit);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  const client = new HttpPartyServiceClient({
    get: (key: string) =>
      key === 'PARTY_SERVICE_BASE_URL'
        ? `http://127.0.0.1:${port}`
        : key === 'PARTY_SERVICE_TIMEOUT_MS'
          ? 200
          : key === 'PARTY_SERVICE_HMAC_SECRET'
            ? secret
            : undefined,
  } as never);
  return { client, hits };
}
afterEach(() => {
  while (servers.length) servers.pop()!.close();
});
function json(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}
function verifyHeaders(hit: Hit) {
  expect(hit.headers.cookie).toBeUndefined();
  const requestId = hit.headers['x-request-id'] as string;
  const correlationId = hit.headers['x-correlation-id'] as string;
  expect(requestId).toMatch(/^api-/);
  expect(correlationId).toBe(requestId);
  const payload = verifySecurityContext({
    secret,
    encodedContext: hit.headers[
      INTERNAL_CONTEXT_HEADER.toLowerCase()
    ] as string,
    signature: hit.headers[INTERNAL_SIGNATURE_HEADER.toLowerCase()] as string,
    expectedSource: PARTY_SERVICE_CONTEXT_SOURCE,
    expectedAudience: PARTY_SERVICE_CONTEXT_AUDIENCE,
    expectedRequestId: requestId,
    expectedCorrelationId: correlationId,
    requireBusinessId: true,
  });
  expect(payload).toMatchObject({
    userId: 'user-1',
    sessionId: 'session-1',
    businessId: 'business-a',
  });
}

describe('HttpPartyServiceClient', () => {
  it('preserves method, path, query, body, decimal strings and signed context for customer and supplier calls', async () => {
    const { client, hits } = await fixture((_req, res, hit) =>
      json(
        res,
        200,
        hit.url?.includes('suppliers')
          ? { profile: { supplierCode: 'SUP-1', openingBalance: '123.45' } }
          : hit.url?.includes('?')
            ? { items: [], page: 2, pageSize: 5, total: 0, totalPages: 0 }
            : { profile: { customerCode: 'CUS-1', openingBalance: '123.45' } },
      ),
    );
    await client.createCustomer(auth, {
      displayName: 'A',
      openingBalance: '123.45',
    });
    await client.listCustomers(auth, {
      page: 2,
      pageSize: 5,
      search: 'A',
      status: 'active',
      gstRegistered: 'all',
      state: '',
      sortBy: 'displayName',
      sortOrder: 'asc',
    });
    await client.updateSupplier(auth, 'supplier-1', {
      displayName: 'S',
      openingBalance: '123.45',
    });
    expect(hits.map((hit) => `${hit.method} ${hit.url}`)).toEqual([
      'POST /internal/v1/party/customers',
      'GET /internal/v1/party/customers?page=2&pageSize=5&search=A&status=active&gstRegistered=all&state=&sortBy=displayName&sortOrder=asc',
      'PATCH /internal/v1/party/suppliers/supplier-1',
    ]);
    expect(JSON.parse(hits[0]!.body).openingBalance).toBe('123.45');
    expect(JSON.parse(hits[2]!.body).openingBalance).toBe('123.45');
    hits.forEach(verifyHeaders);
  });

  it('maps internal domain errors without leaking internals', async () => {
    for (const [status, ErrorType] of [
      [400, BadRequestException],
      [404, NotFoundException],
      [409, ConflictException],
      [500, ServiceUnavailableException],
    ] as const) {
      const { client } = await fixture((_req, res) =>
        json(res, status, {
          message:
            status === 500
              ? 'stack ECONNREFUSED http://127.0.0.1 secret'
              : 'Domain error',
        }),
      );
      await expect(
        client.getCustomer(auth, 'customer-1'),
      ).rejects.toBeInstanceOf(ErrorType);
    }
  });

  it('maps malformed, unavailable and timeout failures to safe 503', async () => {
    const malformed = await fixture((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{');
    });
    await expect(
      malformed.client.getCustomer(auth, 'customer-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    const timeout = await fixture(() => undefined);
    await expect(
      timeout.client.getCustomer(auth, 'customer-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    const unavailable = new HttpPartyServiceClient({
      get: (key: string) =>
        key === 'PARTY_SERVICE_BASE_URL'
          ? 'http://127.0.0.1:9'
          : key === 'PARTY_SERVICE_TIMEOUT_MS'
            ? 100
            : key === 'PARTY_SERVICE_HMAC_SECRET'
              ? secret
              : undefined,
    } as never);
    await expect(
      unavailable.getCustomer(auth, 'customer-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not retry failed customer or supplier writes', async () => {
    const { client, hits } = await fixture((_req, res) =>
      json(res, 503, { message: 'down' }),
    );
    await expect(
      client.createCustomer(auth, { displayName: 'A' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      client.updateSupplier(auth, 'supplier-1', { displayName: 'S' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(hits.map((hit) => `${hit.method} ${hit.url}`)).toEqual([
      'POST /internal/v1/party/customers',
      'PATCH /internal/v1/party/suppliers/supplier-1',
    ]);
  });
});
