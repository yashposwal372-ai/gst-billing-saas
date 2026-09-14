import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { BrowserWriteGuard } from '../auth/guards/browser-write.guard.js';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import type {
  OperationObject,
  ParameterObject,
  SchemaObject,
} from '@nestjs/swagger';
import metadataJson from './generated-metadata.json' with { type: 'json' };
import {
  responseOverride,
  responseSchemas,
  type Schema,
  object,
  str,
  money,
  date,
  ref,
} from './response-contracts.js';

export interface RouteContract {
  path: string;
  verb: string;
  handler: string;
  source: string;
  protected: boolean;
  csrf: boolean;
  status: number;
  parameters: ParameterObject[];
  body?: { $ref: string };
  response: Schema;
  csv: boolean;
}
export const metadata = metadataJson as unknown as {
  routes: RouteContract[];
  schemas: Record<string, SchemaObject>;
};
export function canonical(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(value), null, 2) + '\n';
}
const camel = (s: string) =>
  s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
// Public route semantics define identity, never controller class or handler names.
export function operationId(path: string, verb: string): string {
  const parts = path
    .replace(/^\/api\/v1\/?/, '')
    .split('/')
    .filter(Boolean);
  const group = camel(parts.shift() ?? 'root');
  const suffix = parts.filter((p) => !p.startsWith('{')).map(camel);
  const deletion = [
    'customers',
    'suppliers',
    'categories',
    'products',
    'accounts',
    'expenseCategories',
  ].includes(group)
    ? 'deactivate'
    : group === 'invoices'
      ? 'discard'
      : 'delete';
  const action = suffix.length
    ? suffix.join('.')
    : verb === 'get'
      ? parts.length
        ? 'get'
        : group === 'health'
          ? 'check'
          : group === 'root'
            ? 'get'
            : 'list'
      : ({ post: 'create', patch: 'update', delete: deletion }[verb] ?? verb);
  // Methods sharing a named route remain distinct (e.g. businesses/current).
  return `${group}.${action}${suffix.length && !['get', 'post'].includes(verb) ? '.' + verb : ''}`;
}
function tag(group: string): string {
  if (['categories', 'products'].includes(group)) return 'Catalogue';
  if (/^(quotations|sales-orders|delivery-challans|sales-returns)$/.test(group))
    return 'Sales';
  if (group.startsWith('purchase-')) return 'Purchases';
  if (
    [
      'accounts',
      'payments',
      'expense-categories',
      'expenses',
      'account-transfers',
      'receivables',
      'payables',
    ].includes(group)
  )
    return 'Finance';
  return (
    (
      {
        health: 'Health',
        auth: 'Auth',
        businesses: 'Businesses',
        dashboard: 'Dashboard',
        customers: 'Customers',
        suppliers: 'Suppliers',
        inventory: 'Inventory',
        invoices: 'Invoices',
        pos: 'POS',
        'gst-reports': 'GST Reports',
      } as Record<string, string>
    )[group] ?? 'Health'
  );
}
function cookie(name: string, description: string) {
  return { type: 'apiKey' as const, in: 'cookie' as const, name, description };
}
export function baseDocument(): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('GST Billing SaaS API')
    .setVersion('v1')
    .setDescription(
      'Internal/business SaaS API for the current NestJS modular monolith. Public routes remain /api/v1. No API Gateway or physical services exist. GST reports describe finalized recorded transactions; no GSTN integration, government certification, filing, IRN, e-way bill or ITC eligibility. Payments and POS tenders are bookkeeping records, not external payment processing. Unknown DTO body/query fields are rejected. Trusted current OWNER business scopes domain access; clients do not choose businessId. Cookie authentication and exact configured frontend Origin plus X-CSRF-Protection: 1 protect browser writes. Documentation does not add mobile bearer or internal service authentication.',
    )
    .build();
  return {
    ...config,
    openapi: '3.0.0',
    paths: {},
    components: {
      schemas: {
        ...structuredClone(metadata.schemas),
        ...structuredClone(responseSchemas),
      },
      securitySchemes: {
        accessCookie: cookie(
          'gst_access',
          'Local/test access cookie; HttpOnly, SameSite=Lax, path /. Production uses __Host-gst_access with Secure instead. Session revocation and user auth version are checked.',
        ),
        productionAccessCookie: cookie(
          '__Host-gst_access',
          'Production counterpart of gst_access, Secure and host-only. Environment-specific alternatives, not two credentials required together.',
        ),
        refreshCookie: cookie(
          'gst_refresh',
          'Opaque rotating refresh cookie; HttpOnly, SameSite=Lax, path /api/v1/auth. Production uses __Secure-gst_refresh with Secure. Fixed session expiry; reuse revokes the session.',
        ),
        productionRefreshCookie: cookie(
          '__Secure-gst_refresh',
          'Production counterpart of gst_refresh, Secure and host-only.',
        ),
      },
    },
  };
}
function describe(route: RouteContract): string {
  const group = route.path.split('/')[3] ?? '';
  let result =
    'Current public operation. Runtime validation, tenant authorization and lifecycle rules remain authoritative.';
  if (route.protected && group !== 'auth')
    result += ' Requires the authenticated user’s current OWNER business.';
  if (route.body)
    result +=
      ' Unknown body fields are rejected. Cross-field and current-record checks can reject otherwise well-formed requests.';
  if (group === 'customers' || group === 'suppliers')
    result +=
      ' Create requires displayName, phone, addressLine1, city, state, stateCode and pincode. PATCH merges omitted values. Empty optional text clears values. GSTIN is required when gstRegistered is true; state/GSTIN/PAN must be consistent. Separate shipping/bank groups must be complete when used. DELETE deactivates.';
  if (group === 'products')
    result +=
      ' Create requires name; type defaults PRODUCT, unit PCS (SERVICE for services), prices/GST/opening stock default zero, inventory tracking defaults false. Type, unit and tracking cannot change. Services cannot track stock. HSN is 4/6/8 digits; SAC is six digits starting 99. Stock adjustments require active tracked products and positive quantity. DELETE deactivates.';
  if (group === 'invoices')
    result +=
      ' Standard invoice create/preview requires an active customerId. Server computes tax and totals. Drafts are unnumbered; finalize assigns number and stock movements; cancel preserves history. Dates in serialized invoice records (including lifecycle fields) currently use YYYY-MM-DD.';
  if (route.source.startsWith('business-documents/'))
    result +=
      ' The shared controller exposes all lifecycle routes for every document group; service rules reject unsupported transitions/conversions. Quotation issue/accept, sales/purchase order confirm, delivery challan issue, purchase bill and operational return finalize are supported. Return source/line IDs and quantities must match finalized source records. Conversions: quotation to sales-order, sales-order to delivery-challan, purchase-order to purchase-bill; quotation/sales-order/delivery-challan to invoice draft. Operational returns are not statutory GST credit/debit notes.';
  if (route.source.startsWith('finance/'))
    result +=
      ' Recorded bookkeeping only. Account balances may be negative; no funds are moved externally. Payment amount must be positive and allocations must sum exactly; each allocation targets one invoice or purchase bill. CUSTOMER_RECEIPT requires customerId only; SUPPLIER_PAYMENT requires supplierId only. Posting checks outstanding balances. Lifecycle fields currently serialize as date-only strings. Transfers require distinct accounts.';
  if (group === 'gst-reports')
    result +=
      ' Internal recorded-transaction GST reporting only. Finalized invoices and PURCHASE_BILL records; drafts/cancelled excluded. Operational returns remain separate. Purchase Tax Recorded does not establish ITC eligibility. Register-only filters not applicable to the opposite party type are accepted but ignored; date bounds/FY are validated. CSV text cells use formula-injection protection.';
  if (group === 'pos')
    result +=
      ' POS creates a normal finalized Invoice with salesChannel POS through existing invoice/GST/stock logic. clientCheckoutId provides durable idempotency. Invoice finalization precedes optional existing finance payment recording; payment failure can leave the finalized sale outstanding. No external tender processing. CUSTOMER mode requires customerId; RECORDED_PAYMENT requires tender. Cash change is display-only. Preview uses invoice fields and does not post tender. Sales paymentStatus filtering currently applies after database pagination; filtered counts describe the current page.';
  if (route.path.endsWith('/auth/refresh'))
    result +=
      ' Requires the environment’s refresh cookie; rotates cookies. Does not require an access cookie.';
  if (route.path.endsWith('/auth/logout'))
    result +=
      ' Accepts available access/refresh cookies for revocation and clears both. Missing cookies do not require an authenticated session.';
  if (route.path === '/api/v1/health')
    result += ' Liveness only; does not assert PostgreSQL/Redis readiness.';
  if (route.path === '/api/v1/inventory/summary')
    result += ' No query parameters accepted.';
  if (route.path === '/api/v1/account-transfers' && route.verb === 'get')
    result +=
      ' Reuses PaymentQuery: page/pageSize/status/accountId/search affect results; payment type/method/party/date/sort fields are accepted but ignored. Status POSTED/REVERSED is meaningful; DRAFT returns no transfers.';
  if (route.path === '/api/v1/expense-categories' && route.verb === 'get')
    result += ' AccountQuery.type is accepted but ignored.';
  return result;
}
function applyWireFormats(schema: Schema, field = ''): Schema {
  if ('$ref' in schema) return schema;
  // Only augment already-known strings; never turn floats or erased types into money guesses.
  const result = structuredClone(schema);
  if (result.type === 'string') {
    if (
      /^(openingBalance|creditLimit|purchasePrice|salePrice|mrp|gstRate|grandTotal|totalSales|totalPaid|totalPurchases|totalExpenses|todaySales|monthlySales|receivables|payables|outstanding|payable|paidAmount|credit|debit|balanceAfter)$/.test(
        field,
      )
    )
      Object.assign(result, money);
    if (
      /^(invoiceDate|documentDate|paymentDate|expenseDate|transferDate|billDate|dateFrom|dateTo|dueDate|date)$/.test(
        field,
      )
    )
      Object.assign(result, date);
  }
  if (result.properties)
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([k, v]) => [
        k,
        applyWireFormats(v, k),
      ]),
    );
  if (result.items && typeof result.items === 'object')
    result.items = applyWireFormats(result.items as Schema);
  for (const key of ['oneOf', 'anyOf', 'allOf'] as const)
    if (result[key])
      result[key] = result[key]!.map((s) => applyWireFormats(s, field));
  return result;
}
export function contractDocument(): OpenAPIObject {
  const doc = baseDocument();
  const schemas = doc.components!.schemas! as Record<string, SchemaObject>;
  // Service-level requirements on shared partial DTOs. PATCH remains partial.
  for (const [source, required] of Object.entries({
    CustomerDto: [
      'displayName',
      'phone',
      'addressLine1',
      'city',
      'state',
      'stateCode',
      'pincode',
    ],
    SupplierDto: [
      'displayName',
      'phone',
      'addressLine1',
      'city',
      'state',
      'stateCode',
      'pincode',
    ],
    CategoryDto: ['name'],
    CreateProductDto: ['name'],
  }))
    schemas[`Create${source}`] = {
      ...structuredClone(schemas[source]!),
      required,
    };
  schemas.StandardInvoiceDraft = {
    ...structuredClone(schemas.InvoiceDraftDto!),
    required: [...(schemas.InvoiceDraftDto!.required ?? []), 'customerId'],
  };
  for (const route of metadata.routes) {
    let response = route.csv
      ? str
      : (responseOverride(route.path, route.verb, route.handler) ??
        route.response);
    // Reuse the already fully inferred create schemas for generic retry helpers whose return type is erased.
    if (
      ['categories', 'products'].some((g) =>
        route.path.startsWith(`/api/v1/${g}`),
      ) &&
      ['update', 'deactivate'].includes(route.handler)
    )
      response = metadata.routes.find(
        (r) => r.path === route.path.split('/{')[0] && r.handler === 'create',
      )!.response;
    if (
      route.handler === 'adjust' &&
      route.path.startsWith('/api/v1/products/')
    )
      response = object({
        profile: (
          metadata.routes.find(
            (r) => r.path === '/api/v1/products' && r.handler === 'create',
          )!.response as SchemaObject
        ).properties!.profile!,
        movement: (
          (
            metadata.routes.find((r) => r.handler === 'history')!
              .response as SchemaObject
          ).properties!.items as SchemaObject
        ).items as Schema,
      });
    response = applyWireFormats(response);
    const responseName = operationId(route.path, route.verb) + '.Response';
    schemas[responseName] = response as SchemaObject;
    const parameters = structuredClone(route.parameters);
    if (route.csrf)
      parameters.push(
        {
          name: 'X-CSRF-Protection',
          in: 'header',
          required: true,
          schema: { type: 'string', enum: ['1'] },
          description:
            'Mandatory on browser writes, including public auth writes.',
        },
        {
          name: 'Origin',
          in: 'header',
          required: true,
          schema: str,
          description:
            'Must exactly equal the configured FRONTEND_URL. Browser-managed header; Swagger UI on a different origin cannot bypass this check.',
        },
      );
    let body = route.body;
    if (body) {
      const name = body.$ref.split('/').at(-1)!;
      if (
        route.verb === 'post' &&
        [
          'CustomerDto',
          'SupplierDto',
          'CategoryDto',
          'CreateProductDto',
        ].includes(name)
      )
        body = { $ref: `#/components/schemas/Create${name}` };
      if (name === 'InvoiceDraftDto')
        body = { $ref: '#/components/schemas/StandardInvoiceDraft' };
    }
    const security: NonNullable<OperationObject['security']> = route.protected
      ? [{ accessCookie: [] }, { productionAccessCookie: [] }]
      : route.path.endsWith('/auth/refresh')
        ? [{ refreshCookie: [] }, { productionRefreshCookie: [] }]
        : [];
    const operation: OperationObject = {
      operationId: operationId(route.path, route.verb),
      tags: [tag(route.path.split('/')[3] ?? '')],
      description: describe(route),
      parameters,
      security,
      ...(body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: body } },
            },
          }
        : {}),
      responses: {
        [route.status]: {
          description: 'Successful current operation.',
          content: {
            [route.csv
              ? 'text/csv'
              : route.path === '/api/v1'
                ? 'text/plain'
                : 'application/json']: {
              schema: route.csv ? str : ref(responseName),
            },
          },
        },
      },
    };
    for (const status of [
      400,
      ...(route.protected || route.path.startsWith('/api/v1/auth/')
        ? [401]
        : []),
      ...(route.csrf || route.protected ? [403] : []),
      404,
      409,
      ...(route.path.startsWith('/api/v1/auth') ? [429] : []),
      500,
      503,
    ])
      operation.responses[String(status)] = {
        description: (
          {
            400: 'Validation or business-rule failure; message may be a safe validation-message array.',
            401: 'Missing, expired or revoked authentication.',
            403: 'Origin/CSRF or tenant/owner access rejected.',
            404: 'Resource not found in authorized scope.',
            409: 'Conflict; retry where appropriate.',
            429: 'Authentication attempt limit exceeded.',
            500: 'Unable to complete request.',
            503: 'Service temporarily unavailable.',
          } as Record<number, string>
        )[status]!,
        content: { 'application/json': { schema: ref('LegacyError') } },
      };
    doc.paths[route.path] ??= {};
    (doc.paths[route.path] as Record<string, OperationObject>)[route.verb] =
      operation;
  }
  return doc;
}
export function assertRouteCoverage(
  actual: OpenAPIObject,
  expected: OpenAPIObject,
): void {
  const keys = (doc: OpenAPIObject) =>
    Object.entries(doc.paths)
      .flatMap(([path, item]) =>
        Object.keys(item ?? {})
          .filter((v) =>
            [
              'get',
              'post',
              'put',
              'patch',
              'delete',
              'head',
              'options',
            ].includes(v),
          )
          .map((v) => `${v.toUpperCase()} ${path}`),
      )
      .sort();
  if (JSON.stringify(keys(actual)) !== JSON.stringify(keys(expected)))
    throw new Error(
      'OpenAPI route inventory differs from registered Nest routes. Review controller discovery and contracts.',
    );
}
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const discovered = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Route discovery').setVersion('v1').build(),
    { autoTagControllers: false },
  );
  const document = contractDocument();
  assertRouteCoverage(discovered, document);
  // Verify documentation security against the actual registered guard metadata.
  for (const module of app.get(ModulesContainer).values())
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype;
      if (!controller) continue;
      const prototype = controller.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const method: unknown = Object.getOwnPropertyDescriptor(
          prototype,
          name,
        )?.value;
        if (typeof method !== 'function') continue;
        const verb = Reflect.getMetadata(METHOD_METADATA, method) as
          RequestMethod | undefined;
        if (verb === undefined) continue;
        const path = [
          '/api/v1',
          Reflect.getMetadata(PATH_METADATA, controller) as string,
          Reflect.getMetadata(PATH_METADATA, method) as string,
        ]
          .filter(Boolean)
          .join('/')
          .replace(/\/+/g, '/')
          .replace(/\/$/, '')
          .replace(/:([\w]+)/g, '{$1}');
        const guards = [
          ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
          ...(Reflect.getMetadata(GUARDS_METADATA, method) ?? []),
        ] as unknown[];
        const operation = (
          document.paths[path] as Record<string, OperationObject> | undefined
        )?.[RequestMethod[verb]!.toLowerCase()];
        if (!operation)
          throw new Error(`Registered operation missing: ${path}`);
        if (
          guards.includes(AuthGuard) !==
          !!operation.security?.some((s) => 'accessCookie' in s)
        )
          throw new Error(`Authentication documentation mismatch: ${path}`);
        const csrf =
          guards.includes(BrowserWriteGuard) &&
          ![
            RequestMethod.GET,
            RequestMethod.HEAD,
            RequestMethod.OPTIONS,
          ].includes(verb);
        if (
          csrf !==
          !!operation.parameters?.some(
            (p) =>
              !('$ref' in p) && p.name === 'X-CSRF-Protection' && p.required,
          )
        )
          throw new Error(`CSRF documentation mismatch: ${path}`);
      }
    }
  return document;
}
