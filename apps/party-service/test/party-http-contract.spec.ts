import { NotFoundException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_SIGNATURE_HEADER,
  PARTY_SERVICE_CONTEXT_AUDIENCE,
  PARTY_SERVICE_CONTEXT_SOURCE,
  signSecurityContext,
} from "@gst/security-context";
import { AppModule } from "../src/app.module.js";
import {
  CUSTOMER_REPOSITORY,
  SUPPLIER_REPOSITORY,
} from "../src/party/application/party-repository.port.js";
import type { PartyScope } from "../src/party/infrastructure/party.data.js";

const secret = "local-party-service-secret-change-me-32-bytes";
const authHeaders = (businessId = "business-a") => {
  const signed = signSecurityContext({
    secret,
    source: PARTY_SERVICE_CONTEXT_SOURCE,
    audience: PARTY_SERVICE_CONTEXT_AUDIENCE,
    requestId: "req-1",
    correlationId: "corr-1",
    userId: "user-1",
    sessionId: "session-1",
    businessId,
  });
  return {
    "x-request-id": "req-1",
    "x-correlation-id": "corr-1",
    [INTERNAL_CONTEXT_HEADER]: signed.encodedContext,
    [INTERNAL_SIGNATURE_HEADER]: signed.signature,
  };
};
const profile = (kind: "customer" | "supplier", businessId = "business-a") => ({
  id: `${kind}-1`,
  displayName: "Market Traders",
  businessName: null,
  contactPerson: null,
  gstRegistered: false,
  gstin: null,
  pan: null,
  phone: "9876543210",
  whatsappNumber: null,
  email: null,
  addressLine1: "12 Market Road",
  addressLine2: null,
  city: "Pune",
  state: "Maharashtra",
  stateCode: "27",
  pincode: "411001",
  openingBalance: "123.45",
  openingBalanceType: kind === "customer" ? "RECEIVABLE" : "PAYABLE",
  paymentTermsDays: 0,
  notes: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...(kind === "customer"
    ? {
        customerCode: "CUS-000001",
        customerType: "INDIVIDUAL",
        shippingSameAsBilling: true,
        shippingAddressLine1: null,
        shippingAddressLine2: null,
        shippingCity: null,
        shippingState: null,
        shippingStateCode: null,
        shippingPincode: null,
        creditLimit: "0.00",
      }
    : {
        supplierCode: "SUP-000001",
        bankName: null,
        accountHolderName: null,
        accountNumber: null,
        ifsc: null,
        upiId: null,
      }),
  businessId,
});
function repo(kind: "customer" | "supplier") {
  const calls: Array<{
    op: string;
    scope: PartyScope;
    dto?: unknown;
    query?: unknown;
    id?: string;
  }> = [];
  return {
    calls,
    create: vi.fn(async (scope: PartyScope, dto: unknown) => {
      calls.push({ op: "create", scope, dto });
      return profile(kind);
    }),
    list: vi.fn(async (scope: PartyScope, query: unknown) => {
      calls.push({ op: "list", scope, query });
      return {
        items: [profile(kind)],
        page: 2,
        pageSize: 5,
        total: 1,
        totalPages: 1,
      };
    }),
    detail: vi.fn(async (scope: PartyScope, id: string) => {
      calls.push({ op: "detail", scope, id });
      if (scope.businessId !== "business-a")
        throw new NotFoundException(`${kind} not found`);
      return {
        profile: profile(kind),
        summary:
          kind === "customer"
            ? {
                totalSales: "0.00",
                totalPaid: "0.00",
                outstanding: "0.00",
                invoiceCount: 0,
              }
            : {
                totalPurchases: "0.00",
                amountPaid: "0.00",
                amountPayable: "0.00",
                purchaseCount: 0,
              },
        dataStatus: "partial",
        ledgerEntries: [],
        activity: [],
      };
    }),
    update: vi.fn(async (scope: PartyScope, id: string, dto: unknown) => {
      calls.push({ op: "update", scope, id, dto });
      if (scope.businessId !== "business-a")
        throw new NotFoundException(`${kind} not found`);
      return { ...profile(kind), displayName: "Updated" };
    }),
    deactivate: vi.fn(async (scope: PartyScope, id: string) => {
      calls.push({ op: "deactivate", scope, id });
      if (scope.businessId !== "business-a")
        throw new NotFoundException(`${kind} not found`);
      return { ...profile(kind), isActive: false };
    }),
  };
}

describe("party-service internal Party HTTP contract", () => {
  let app: INestApplication;
  let customerRepo: ReturnType<typeof repo>;
  let supplierRepo: ReturnType<typeof repo>;
  beforeEach(async () => {
    customerRepo = repo("customer");
    supplierRepo = repo("supplier");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CUSTOMER_REPOSITORY)
      .useValue(customerRepo)
      .overrideProvider(SUPPLIER_REPOSITORY)
      .useValue(supplierRepo)
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
  });
  afterEach(async () => app.close());
  const client = () => request(app.getHttpServer());
  const cases = [
    {
      label: "customer",
      base: "/internal/v1/party/customers",
      repo: () => customerRepo,
      code: "customerCode",
      id: "11111111-1111-4111-8111-111111111111",
    },
    {
      label: "supplier",
      base: "/internal/v1/party/suppliers",
      repo: () => supplierRepo,
      code: "supplierCode",
      id: "22222222-2222-4222-8222-222222222222",
    },
  ] as const;
  for (const item of cases) {
    it(`${item.label} create/list/get/update/deactivate use signed tenant and response contract`, async () => {
      await client()
        .post(item.base)
        .set(authHeaders())
        .send({
          displayName: "Market",
          openingBalance: "123.45",
          businessId: "evil",
        })
        .expect(201)
        .expect((res) => expect(res.body.profile[item.code]).toBeDefined());
      await client()
        .get(
          `${item.base}?page=2&pageSize=5&search=Mar&status=active&gstRegistered=all&state=&sortBy=displayName&sortOrder=asc&businessId=evil`,
        )
        .set(authHeaders())
        .expect(200)
        .expect((res) => expect(res.body.items).toHaveLength(1));
      await client()
        .get(`${item.base}/${item.id}`)
        .set(authHeaders())
        .expect(200);
      await client()
        .patch(`${item.base}/${item.id}`)
        .set(authHeaders())
        .send({ displayName: "Updated", businessId: "evil" })
        .expect(200)
        .expect((res) => expect(res.body.profile.displayName).toBe("Updated"));
      await client()
        .delete(`${item.base}/${item.id}`)
        .set(authHeaders())
        .expect(200)
        .expect((res) => expect(res.body.profile.isActive).toBe(false));
      expect(item.repo().calls.map((call) => call.scope.businessId)).toEqual([
        "business-a",
        "business-a",
        "business-a",
        "business-a",
        "business-a",
      ]);
    });
    it(`${item.label} cross-business get/update/deactivate are scoped by signed tenant`, async () => {
      await client()
        .get(`${item.base}/${item.id}`)
        .set(authHeaders("business-b"))
        .expect(404);
      await client()
        .patch(`${item.base}/${item.id}`)
        .set(authHeaders("business-b"))
        .send({ displayName: "Other" })
        .expect(404);
      await client()
        .delete(`${item.base}/${item.id}`)
        .set(authHeaders("business-b"))
        .expect(404);
      expect(
        item
          .repo()
          .calls.every((call) => call.scope.businessId === "business-b"),
      ).toBe(true);
    });
  }
});
