import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import {
  SwaggerModule,
  type OperationObject,
  type SchemaObject,
} from '@nestjs/swagger';
import {
  canonical,
  contractDocument,
  assertRouteCoverage,
  metadata,
  operationId,
} from './openapi-document.js';
import { assertSnapshotMatches, validateOpenApi } from './openapi-check.js';
import { configureOpenApi } from './openapi.config.js';
import { createErrorResponse } from '../platform/presentation/http/error-response.js';
import type { ErrorResponse } from '../../../../packages/contracts/index.js';
// @ts-ignore Project-local dependency guard is exercised as a plain Node module.
import { checkArchitectureImports } from '../../scripts/architecture-check.mjs';

const doc = contractDocument();
const schema = (name: string) => doc.components!.schemas![name] as SchemaObject;
const op = (path: string, verb = 'get') =>
  (doc.paths['/api/v1' + path] as Record<string, OperationObject>)[verb]!;
describe('A04 OpenAPI transport contract', () => {
  it('generates a canonical deterministic document without IO or runtime services', () => {
    expect(canonical(contractDocument())).toBe(canonical(contractDocument()));
    expect(canonical({ z: 1, a: { y: 2, b: 3 } })).toBe(
      canonical({ a: { b: 3, y: 2 }, z: 1 }),
    );
    expect(canonical([2, 1])).not.toBe(canonical([1, 2]));
  });
  it('has unique IDs on every discovered operation', () => {
    const ids = metadata.routes.map((r) => operationId(r.path, r.verb));
    expect(ids).toHaveLength(185);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
  });
  it('uses route semantics independent of controller/handler renames', () => {
    expect(operationId('/api/v1/customers/{id}', 'delete')).toBe(
      'customers.deactivate',
    );
    expect(operationId('/api/v1/pos/checkout', 'post')).toBe('pos.checkout');
    expect(operationId('/api/v1/auth/login', 'post')).toBe('auth.login');
  });
  it('covers every current group including factory-generated document controllers', () => {
    const groups = new Set(
      Object.keys(doc.paths)
        .map((p) => p.split('/')[3])
        .filter(Boolean),
    );
    expect([...groups].sort()).toEqual(
      [
        'health',
        'auth',
        'businesses',
        'dashboard',
        'customers',
        'suppliers',
        'categories',
        'products',
        'inventory',
        'invoices',
        'quotations',
        'sales-orders',
        'delivery-challans',
        'sales-returns',
        'purchase-orders',
        'purchase-bills',
        'purchase-returns',
        'accounts',
        'payments',
        'expense-categories',
        'expenses',
        'account-transfers',
        'receivables',
        'payables',
        'gst-reports',
        'pos',
      ].sort(),
    );
    expect(doc.paths['/api/v1']).toBeDefined();
    expect(op('/purchase-returns/{id}/convert/{target}', 'post')).toBeDefined();
  });
  it('rejects a disappeared route', () => {
    const broken = structuredClone(doc);
    delete broken.paths['/api/v1/pos/checkout'];
    expect(() => assertRouteCoverage(broken, doc)).toThrow('route inventory');
  });
  it('passes request, references, error and leakage checks', () =>
    expect(() => validateOpenApi(doc)).not.toThrow());
  it('rejects duplicate and missing operation IDs', () => {
    const broken = structuredClone(doc);
    broken.paths['/api/v1/health']!.get!.operationId =
      op('/auth/me').operationId;
    expect(() => validateOpenApi(broken)).toThrow('operation ID');
    delete broken.paths['/api/v1/health']!.get!.operationId;
    expect(() => validateOpenApi(broken)).toThrow('operation ID');
  });
  it('rejects unresolved refs', () => {
    const broken = structuredClone(doc);
    broken.components!.schemas!.Broken = {
      $ref: '#/components/schemas/Missing',
    };
    expect(() => validateOpenApi(broken)).toThrow('Unresolved');
  });
  it('rejects missing required path parameters', () => {
    const broken = structuredClone(doc);
    broken.paths['/api/v1/customers/{id}']!.get!.parameters = [];
    expect(() => validateOpenApi(broken)).toThrow('path parameter');
  });
  it('rejects empty required request schemas', () => {
    const broken = structuredClone(doc);
    broken.components!.schemas!.LoginDto = { type: 'object' };
    expect(() => validateOpenApi(broken)).toThrow('Empty request');
  });
  it('documents DTO required fields, inheritance and service create requirements', () => {
    expect(schema('SignupDto').required).toEqual(
      expect.arrayContaining(['email', 'password', 'firstName', 'lastName']),
    );
    expect(schema('CreateCustomerDto').required).toContain('displayName');
    expect(schema('CustomerDto').required ?? []).not.toContain('displayName');
    expect(schema('StandardInvoiceDraft').required).toContain('customerId');
    expect(schema('InvoiceLineDto').properties!.quantity).toMatchObject({
      type: 'string',
      pattern: expect.any(String),
    });
  });
  it('documents actual pagination bounds, including POS search maximum 25', () => {
    expect(
      op('/pos/products').parameters!.find(
        (p) => !('$ref' in p) && p.name === 'pageSize',
      ),
    ).toMatchObject({
      required: false,
      schema: { type: 'integer', default: 10, maximum: 25, minimum: 1 },
    });
    expect(
      op('/customers').parameters!.find(
        (p) => !('$ref' in p) && p.name === 'pageSize',
      ),
    ).toMatchObject({ schema: { default: 20, maximum: 100 } });
    expect(
      schema('products.stockMovements.Response').properties,
    ).not.toHaveProperty('totalPages');
  });
  it('uses actual enum values and UUID validation', () => {
    expect(schema('PosTenderDto').properties!.method).toMatchObject({
      enum: ['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER'],
    });
    expect(op('/invoices/{id}').parameters![0]).toMatchObject({
      required: true,
      schema: { format: 'uuid' },
    });
    expect(
      op('/pos/products/by-barcode/{barcode}').parameters![0],
    ).toMatchObject({ schema: { type: 'string' } });
  });
  it('does not expose server authority in invoice/payment/POS request schemas', () => {
    for (const name of ['InvoiceDraftDto', 'PaymentDto', 'PosCheckoutDto'])
      for (const field of [
        'businessId',
        'invoiceNumber',
        'paymentNumber',
        'taxTotal',
        'currentStock',
        'currentBalance',
        'status',
        'createdById',
        'postedById',
      ])
        expect(schema(name).properties).not.toHaveProperty(field);
  });
  it('represents money and quantity as exact strings', () => {
    expect(schema('Invoice').properties!.grandTotal).toMatchObject({
      type: 'string',
      pattern: '^-?\\d+\\.\\d{2}$',
    });
    expect(schema('Payment').properties!.amount).toMatchObject({
      type: 'string',
    });
    expect(schema('MoneyAccount').properties!.currentBalance).toMatchObject({
      type: 'string',
    });
    expect(schema('CommercialLine').properties!.quantity).toMatchObject({
      type: 'string',
      pattern: '^-?\\d+\\.\\d{3}$',
    });
  });
  it('distinguishes business dates and actual serializer timestamp behavior', () => {
    expect(schema('InvoiceDraftDto').properties!.invoiceDate).toMatchObject({
      format: 'date',
    });
    expect(schema('Invoice').properties!.createdAt).toMatchObject({
      format: 'date',
    });
    expect(schema('Payment').properties!.postedAt).toMatchObject({
      format: 'date',
    });
    expect(schema('CustomerListItem').properties!.createdAt).toMatchObject({
      format: 'date-time',
    });
    expect(schema('SafeUser').properties!.emailVerifiedAt).toMatchObject({
      format: 'date-time',
    });
  });
  it('documents cookie authentication, refresh and public routes separately', () => {
    expect(op('/customers').security).toEqual([
      { accessCookie: [] },
      { productionAccessCookie: [] },
    ]);
    expect(op('/auth/login', 'post').security).toEqual([]);
    expect(op('/auth/refresh', 'post').security).toEqual([
      { refreshCookie: [] },
      { productionRefreshCookie: [] },
    ]);
    expect(op('/auth/logout', 'post').security).toEqual([]);
    expect(op('/health').security).toEqual([]);
    expect(Object.keys(doc.components!.securitySchemes!)).not.toContain(
      'bearer',
    );
  });
  it('represents Origin and CSRF even for public browser writes', () => {
    for (const path of ['/auth/login', '/invoices', '/pos/checkout'])
      expect(op(path, 'post').parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'X-CSRF-Protection',
            required: true,
            schema: { type: 'string', enum: ['1'] },
          }),
          expect.objectContaining({ name: 'Origin', required: true }),
        ]),
      );
    expect(
      op('/customers').parameters!.some(
        (p) => !('$ref' in p) && p.name === 'X-CSRF-Protection',
      ),
    ).toBe(false);
  });
  it('aligns the future envelope with A03 while documenting legacy runtime errors', () => {
    const result: ErrorResponse = createErrorResponse(
      new Error('private detail'),
    );
    expect(result).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unable to complete request',
    });
    expect(schema('StandardError').required).toEqual(['code', 'message']);
    expect(op('/customers').responses['400']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/LegacyError' },
        },
      },
    });
  });
  it('excludes ORM implementation, secrets and machine-specific data', () => {
    const json = canonical(doc);
    expect(json).not.toMatch(
      /Prisma\.Decimal|passwordHash|tokenHash|C:\\\\Users|localhost|127\.0\.0\.1|file:\/\//,
    );
    const broken = structuredClone(doc);
    broken.components!.schemas!.Leak = {
      type: 'object',
      properties: { toFixed: { type: 'string' } },
    };
    expect(() => validateOpenApi(broken)).toThrow('leaked');
  });
  it('protects the framework-neutral contract package boundary', () => {
    expect(
      checkArchitectureImports([
        {
          path: 'packages/contracts/index.ts',
          source: "import { X } from '@prisma/client';",
        },
      ]),
    ).toHaveLength(1);
    expect(
      checkArchitectureImports([
        {
          path: 'packages/contracts/index.ts',
          source: "export type { Page } from './pagination.js';",
        },
      ]),
    ).toEqual([]);
  });
  it('detects snapshot drift without changing the baseline', () => {
    const file = new URL(
      '../../../../docs/openapi/api-v1.json',
      import.meta.url,
    );
    const before = readFileSync(file, 'utf8');
    expect(before).toBe(canonical(doc));
    const changed = structuredClone(doc);
    changed.info.version = 'intentional-test-change';
    expect(() => assertSnapshotMatches(canonical(changed), before)).toThrow(
      'contract drift',
    );
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
  it('disables all documentation setup in production', () => {
    const setup = vi
      .spyOn(SwaggerModule, 'setup')
      .mockImplementation(() => undefined);
    try {
      configureOpenApi({
        get: () => ({ get: () => 'production' }),
      } as unknown as INestApplication);
      expect(setup).not.toHaveBeenCalled();
    } finally {
      setup.mockRestore();
    }
  });
  it('enables read-only local UI and JSON without changing API prefixes', () => {
    const setup = vi
      .spyOn(SwaggerModule, 'setup')
      .mockImplementation(() => undefined);
    try {
      const app = {
        get: () => ({ get: () => 'development' }),
      } as unknown as INestApplication;
      configureOpenApi(app);
      expect(setup).toHaveBeenCalledWith(
        'api/docs',
        app,
        expect.any(Function),
        expect.objectContaining({
          jsonDocumentUrl: 'api/docs-json',
          raw: ['json'],
          swaggerOptions: {
            supportedSubmitMethods: [],
            persistAuthorization: false,
          },
        }),
      );
    } finally {
      setup.mockRestore();
    }
  });
});
