# Backend Architecture Foundation

A03 establishes the internal backend architecture foundation for the existing GST Billing SaaS project. It does not extract services, add an API gateway, add Kafka, change Prisma models, or change product behavior.

## Current state

The runtime backend is still one NestJS modular monolith in `apps/api`. The public API remains `/api/v1/*`. Prisma still uses one shared PostgreSQL schema. No physical microservices exist. No `apps/api-gateway` exists. Kafka, outbox/inbox, service-owned schemas, OpenSearch, S3, Razorpay, WebSocket, PostGIS, Terraform and AWS infrastructure are not implemented in A03.

The frontend remains `apps/web` and continues to call the existing API base URL. A03 does not change frontend behavior.

## Target state

The migration target is a production-oriented NestJS microservice architecture in this monorepo, reached through a Strangler Fig migration. Future services should use Clean Architecture and SOLID inside each service:

```text
src/
  domain/
  application/
  infrastructure/
  presentation/
```

Dependency direction is:

```text
presentation -> application -> domain
infrastructure -> application/domain ports
domain -> no framework or infrastructure dependencies
```

## Clean Architecture rules

Domain must not import NestJS, Prisma, Redis, BullMQ, Kafka, HTTP clients, controllers, transport DTO classes, database clients, presentation code or infrastructure implementations.

Application must not import presentation code, HTTP decorators, controllers or infrastructure implementations. It may depend on domain objects and application/domain ports.

Infrastructure implements application and domain ports. Presentation invokes application use cases and maps HTTP or event transport concerns.

Existing folders remain legacy modular-monolith implementation until migrated. New Clean Architecture folders must follow the A03 dependency rules. The architecture guard currently checks the new platform foundation and future opted-in Clean Architecture areas, while excluding legacy modules to avoid false positives during staged migration.

## Architecture rulebook

1. One service writes only its owned data.
2. No shared domain entities across services.
3. No service imports another service's domain or infrastructure code.
4. Contracts may be shared; domain models may not.
5. PostgreSQL remains the durable source of truth.
6. Redis is never the financial, stock or payment source of truth.
7. Kafka is introduced only after outbox/inbox reliability exists.
8. No duplicate GST engine.
9. No duplicate invoice engine.
10. No duplicate stock engine.
11. No duplicate finance ledger.
12. Gateway performs coarse auth; domain services still perform tenant and resource authorization.
13. Every business query uses trusted `businessId`.
14. Physical extraction requires contract tests and rollback routing.
15. One bounded context migrates at a time.

## Target service map

Initial target services:

- `api-gateway`
- `auth-service`
- `business-service`
- `party-service`
- `catalogue-service`
- `inventory-service`
- `billing-service`
- `sales-service`
- `purchase-service`
- `finance-service`
- `gst-report-service`
- `pos-service`

Later supporting services:

- `notification-service`
- `file-service`
- `search-service`
- `realtime-service`
- `analytics-service`
- `ai-service`

These are target services only. They do not currently exist physically.

## Service ownership

| Future owner | Current/future data |
| --- | --- |
| Auth | `User`, `AuthSession`, `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken` |
| Business | `Business`, `BusinessMember` |
| Party | `Customer`, `Supplier` |
| Catalogue | `Category`, `Product` master data |
| Inventory | `StockMovement`, future `InventoryBalance` |
| Billing | `Invoice`, `InvoiceLine`, `InvoiceSequence`, GST calculator, invoice snapshots and lifecycle |
| Sales/Purchase | `BusinessDocument*` during staged split; later sales and purchase ownership by document type |
| Finance | `MoneyAccount`, `MoneyAccountEntry`, `FinanceSequence`, `Payment`, `PaymentAllocation`, `ExpenseCategory`, `Expense`, `AccountTransfer` |
| GST reports | Future report read models |
| POS | Checkout orchestration and future held-cart/session/idempotency data |

Prisma ownership is documented only in A03. No Prisma model ownership is physically changed.

## Database stages

Stage A: one PostgreSQL database with the current shared schema. This is the current state.

Stage B: one PostgreSQL instance/database with service-owned PostgreSQL schemas and separate ownership boundaries.

Stage C: independent service databases only after boundaries stabilize, cross-service foreign keys are replaced, no unresolved cross-service transaction remains, outbox/inbox is live, contract tests pass and rollback routing exists.

## Strangler Fig migration

Initial route:

```text
apps/web and future mobile
-> future apps/api-gateway
-> current apps/api monolith
```

Later, route groups move behind the gateway one at a time:

```text
/auth/* -> auth-service
/businesses/* -> business-service
/customers/* and /suppliers/* -> party-service
/categories/* and /products/* -> catalogue-service
/inventory/* -> inventory-service
/invoices/* -> billing-service
sales/purchase document routes -> sales-service and purchase-service
finance routes -> finance-service
/gst-reports/* -> gst-report-service
/pos/* -> pos-service
```

Every cutover must preserve public `/api/v1` compatibility and have a rollback route to the monolith.

## First physical extraction

The first physical extraction remains `party-service`, after prerequisite architecture steps. A03 does not extract it.

Current party implementation:

```text
apps/api/src/customers/
apps/api/src/suppliers/
apps/api/src/parties/
```

Future internal boundary, planned for A07:

```text
party/
  domain/
  application/
  infrastructure/
  presentation/
```

Later physical service:

```text
services/party-service
```

## API gateway preparation

A future `apps/api-gateway` should preserve `/api/v1/*` public routes. Initially it routes to the current monolith. Later it strangles route groups to extracted services. The gateway owns public routing, CORS, coarse auth, request IDs, correlation IDs, global rate limits, edge validation, request-size limits and OpenAPI aggregation.

The gateway must not own GST calculation, stock rules, invoice lifecycle, payment rules, tenant domain authorization or business logic.

## Contract foundation preparation

A04 should introduce contract and OpenAPI foundations. Candidate future packages are:

- `packages/contracts`
- `packages/event-contracts`
- `packages/observability`
- `packages/security`
- `packages/testing`

A03 does not create these packages.

## Event foundation preparation

Kafka and outbox/inbox are not implemented in A03. The future reliability rule is:

```text
domain state transaction
+ OutboxEvent write
-> publisher
-> Kafka
-> consumer
-> Inbox/ProcessedEvent
```

Critical events must never be fire-and-forget.

Candidate producer-domain topics:

- `identity.events`
- `business.events`
- `party.events`
- `catalogue.events`
- `inventory.events`
- `billing.events`
- `sales.events`
- `purchase.events`
- `finance.events`
- `pos.events`

Implementation belongs to A11.

## Health contract decision

The existing `/api/v1/health` route remains unchanged. A03 does not add `/health/live` or `/health/ready` aliases because route churn is not needed for this foundation step. Future services should expose separate liveness and readiness routes when the API gateway and physical services are introduced.

## A04 next

A04 should implement Contract Foundation + OpenAPI. It should not start until A03 is reviewed and approved.
