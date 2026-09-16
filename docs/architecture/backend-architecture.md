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

| Future owner   | Current/future data                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | `User`, `AuthSession`, `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`                                                   |
| Business       | `Business`, `BusinessMember`                                                                                                            |
| Party          | `Customer`, `Supplier`                                                                                                                  |
| Catalogue      | `Category`, `Product` master data                                                                                                       |
| Inventory      | `StockMovement`, future `InventoryBalance`                                                                                              |
| Billing        | `Invoice`, `InvoiceLine`, `InvoiceSequence`, GST calculator, invoice snapshots and lifecycle                                            |
| Sales/Purchase | `BusinessDocument*` during staged split; later sales and purchase ownership by document type                                            |
| Finance        | `MoneyAccount`, `MoneyAccountEntry`, `FinanceSequence`, `Payment`, `PaymentAllocation`, `ExpenseCategory`, `Expense`, `AccountTransfer` |
| GST reports    | Future report read models                                                                                                               |
| POS            | Checkout orchestration and future held-cart/session/idempotency data                                                                    |

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

## Contract foundation

A04 introduced the current public OpenAPI and transport-contract foundation.
Future packages may include:

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

## A04 public contract foundation

A04 adds documentation to the current modular monolith. It does not change public
routes or runtime DTO validation, serializers, guards, error handling, financial
engines, frontend behavior or Prisma ownership. Swagger 12.0.1 is the only new
direct application dependency; its required dependencies match NestJS 12.

Public contract ownership currently belongs to `apps/api`:

- `scripts/openapi-metadata.mjs` inspects TypeScript controller decorators, DTO
  validators/defaults and structural serialized return types. It discovers the
  seven document-controller factory instantiations instead of copying their route
  lists. Unsupported erased response types must receive an explicit wire schema.
- `src/openapi/response-contracts.ts` explicitly documents legacy response shapes
  where generic serializers erase type information. It contains transport schemas,
  not ORM or domain classes. Existing typed return shapes are projected into JSON
  primitives; generated public schemas contain no Prisma implementation references.
- `src/openapi/openapi-document.ts` defines security, tags, service-level request
  requirements and operation descriptions. Runtime docs setup checks paths against
  Swagger's registered Nest route discovery and authentication/CSRF against actual
  guards.
- `src/openapi/openapi.config.ts` mounts read-only `/api/docs` and `/api/docs-json`
  outside production. Main only invokes this small setup function. Production
  mounts neither UI, raw spec nor assets. No complicated environment flags were added.
- `src/openapi/cli.ts` generates/checks the contract from build-time source metadata
  without constructing Nest, listening or querying infrastructure. Build-time
  metadata is an ignored artifact, included in the compiled application. Runtime
  route and guard coverage is verified separately by the documentation setup test.

`npm run openapi:generate` writes `docs/openapi/api-v1.json` and the exact
`docs/openapi/routes.md` inventory. There are 185 current public operations including
the preserved `/api/v1` starter and all decorated document lifecycle routes. A route
being present does not mean every document type permits that transition; existing
service rules still reject unsupported actions. The docs routes are outside the
public v1 inventory. `npm run openapi:check` regenerates in memory and compares both
canonical files without overwriting either. Object keys are sorted recursively;
arrays retain semantic order. No timestamps, local URLs, secrets or absolute paths
are generated. Reference/ID/request quality failures stop the check.

### Wire compatibility

The authentication contract is cookie-based: `gst_access` and `gst_refresh` locally;
`__Host-gst_access` and `__Secure-gst_refresh` in production. Cookies are HttpOnly,
SameSite=Lax and host-only, with Secure in production. Access path is `/`; refresh
path is `/api/v1/auth`. Public auth writes still require the exact configured Origin
and `X-CSRF-Protection: 1`. Refresh requires the refresh cookie, while logout can
accept absent cookies. No bearer, mobile, OAuth, API-key or internal service scheme
is advertised. Request/correlation IDs and tracing propagation remain future A05/A06
work; the A03 RequestContext scaffold is not runtime propagation.

Money is documented as exact decimal strings; quantities use three fractional
digits where serialized that way. Business dates use YYYY-MM-DD. Existing invoice,
document and finance generic serializers also truncate lifecycle timestamps to
date-only strings; party/catalogue/business timestamps retain ISO date-time.
POS duplicate checkout can return a raw recorded payment with native decimal JSON
strings and ISO timestamps, unlike newly recorded finance payments. These
differences are documented, not normalized by A04.

The current global error filter emits `{ statusCode, message, error? }`, with message
sometimes an array for validation. `LegacyError` documents it. `StandardError`
documents the A03 `{ code, message, requestId?, details? }` foundation separately;
it is not falsely advertised as the current global response. No error pipeline was
rewritten. Examples contain no credentials or real taxpayer/bank/customer data.

Response schemas preserve meaningful envelope differences: party details include
summary data, stock history omits totalPages, report summaries are not paginated,
and current POS payment-status filtering counts the filtered current page. Explicit
record schemas describe stable useful fields and permit additional existing snapshot
fields; they do not claim an exhaustive closed schema for every legacy nested
relation. Cross-field validation, lifecycle restrictions and accepted-but-ignored
legacy query fields are explained in operation descriptions. Runtime remains the
authority; do not treat OpenAPI as a replacement business-rule validator.

### Shared transport package and contract policy

`packages/contracts` is type-only and framework-neutral: version/prefix types,
existing pagination envelope, current/future error envelopes, browser write header
types and decimal/date semantic aliases. It has no runtime dependencies. It must
not import external frameworks, domain entities, repositories, controllers,
services, generated Prisma types or database infrastructure. The architecture guard
checks these imports and rejects runtime/peer dependencies. Existing DTOs were not
moved into the package. Event contracts remain deferred to A11; no active event
package, Kafka, outbox or inbox exists.

Operation IDs are stable public identifiers derived from route/resource semantics,
not controller class names or implementation handler names. Examples include
`auth.login`, `customers.deactivate`, `invoices.finalize` and `pos.checkout`.
Method suffixes distinguish named paths where required. Renaming an operation ID
requires explicit contract review even if its HTTP route does not change.

Public API version remains `/api/v1`. Compatible additive changes may stay v1.
Removals, renames and changes to wire types or semantics require a deliberate
compatibility window/migration plan or v2 as appropriate. Every public change must:

1. Update runtime code and relevant explicit contract schemas/descriptions.
2. Run `npm run openapi:generate`.
3. Review the OpenAPI and route-inventory diffs.
4. Run contract and functional tests, plus architecture/lint/typecheck/build checks.
5. Intentionally include the updated snapshot with the code change.

Unexpected drift is a failure. The generator supports the current decorator
conventions; new controller factories or novel validator shapes need deliberate
extractor support and tests. Type inference cannot prove that arbitrary future
serializer changes preserve semantics; review explicit schemas whenever those
serializers change. Restart development after contract-source edits to refresh
build-time metadata.

### Future Gateway and clients

A05 will introduce the Gateway, initially routing `/api/v1/*` to this monolith.
Later the Gateway will own/aggregate public OpenAPI as route groups migrate.
The intended client direction is Gateway OpenAPI → generated typed clients →
Next.js / React Native. No client generator or frontend API migration is introduced
in A04. Internal `/internal/v1/*` contracts will be separate and are not published
in this public snapshot. Party remains the first later physical extraction after
A04–A07 prerequisites.

## A05 API Gateway foundation

A05 introduces `apps/api-gateway` as a parallel public-edge NestJS TypeScript application. The current runtime topology is:

```text
apps/web -> apps/api-gateway :4100 -> apps/api :4000/api/v1 -> Prisma/PostgreSQL
```

The frontend is not cut over in A05; it still uses the configured API base URL. The gateway defaults to port `4100` and forwards only `/api/v1` and `/api/v1/*` to the trusted `MONOLITH_BASE_URL`. Gateway native operational endpoints are `GET /health/live` and `GET /health/ready`. Unknown routes outside those namespaces return 404 and are not proxied, so the gateway is not an open proxy.

A05 gateway responsibilities are transport-only: receive HTTP, forward the public v1 API namespace, preserve request and response semantics, provide bounded upstream timeout handling, return safe gateway-originated transport errors, add transport request/correlation IDs, strip untrusted internal identity headers, and expose operational health. The monolith remains authoritative for authentication, CSRF enforcement, validation, tenant authorization, GST calculation, stock, billing, finance, reports, POS and persistence.

The gateway must not retry proxied requests. This protects side-effecting operations such as invoice finalization, payment posting, POS checkout, stock adjustments, expenses and transfers. Domain endpoints keep their own idempotency where already implemented. A05 also adds no response cache, Redis rate limiter, WebSocket proxy, API Gateway OpenAPI ownership, physical business service, Kafka, outbox/inbox, service-owned database schema, Prisma model change or migration.

Header policy at the public edge:

- `X-Request-ID` and `X-Correlation-ID` are preserved only when bounded to safe printable characters; invalid or oversized values are replaced with generated UUIDs.
- Effective IDs are sent upstream and returned on gateway responses and gateway-originated errors.
- Client-supplied `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto` are not trusted; the gateway reconstructs forwarded headers.
- Hop-by-hop headers are stripped.
- Reserved future internal identity namespaces `x-gst-internal-*` and `x-internal-*` are stripped before upstream forwarding. A05 does not create or trust internal identity.

`npm run gateway:check` validates that the 185-operation A04 OpenAPI contract is covered by the `/api/v1` proxy rule, checks config and header policies, and rejects gateway imports from `apps/api` implementation source. Gateway fixture tests cover GET/POST, raw bodies, encoded paths, repeated query keys, cookies, multiple `Set-Cookie`, CSRF/Origin forwarding, ID handling, internal header stripping, upstream 5xx pass-through, unavailable/timeout errors, no retries and health.

A06 � Identity + Security Propagation is next. It requires explicit authorization and has not started.

## A06 next

A06 � Identity + Security Propagation requires explicit authorization. It has not started.

## A06 Identity and security propagation

A06 adds a compatibility-preserving identity propagation foundation between public clients, `apps/api-gateway`, the current monolith and future internal services. The public trust boundary remains at the gateway, but the current `apps/api` monolith remains authoritative for authentication responses, refresh/session validity, CSRF, tenant authorization, business membership and resource authorization.

The gateway verifies the existing access credential statelessly when possible. The current token format is a `jose` JWT signed with HS256 using `JWT_SECRET`, issuer `gst-billing-api`, audience `gst-billing-web`, `sub` for user ID and `sid` for session ID. Because the current token is symmetric, sharing the verification secret with the gateway is a migration constraint. The gateway never mints access tokens, refreshes tokens, revokes sessions or uses refresh tokens for identity propagation.

A valid access cookie lets the gateway create a signed internal context. Missing, expired, malformed, wrong-key or unsupported access tokens do not create trusted context and do not produce gateway 401/403 responses; the original request still proxies to the monolith unchanged so existing public behavior is preserved. Refresh-only requests similarly proxy without trusted context.

The internal context is produced by the framework-neutral `packages/security-context` package. It is version `1`, source `api-gateway`, audience `gst-internal-services`, base64url encoded, HMAC-SHA-256 signed with `INTERNAL_IDENTITY_HMAC_SECRET`, and bounded to a maximum lifetime of 60 seconds. It includes request ID and correlation ID so downstream verification can reject accidental context swapping. The claim allowlist is user ID and session ID only; business ID and roles are omitted because the current access token does not carry authoritative business or role claims. No raw JWT, refresh token, cookie value, email, phone, GSTIN, PAN, bank data or customer data is included.

Trusted transport uses exactly `X-GST-Internal-Context` and `X-GST-Internal-Signature`. A05's reserved header stripping remains in force for public client input: `x-gst-internal-*` and `x-internal-*` are removed before any new trusted gateway-generated headers are attached. Future extracted services can use `packages/security-context` to verify signature, version, source, audience, expiry, future skew, payload size and request/correlation binding without importing NestJS, Prisma, Redis or business modules.

A06 does not cut the frontend over to the gateway, does not make the gateway an authorization authority, does not query PostgreSQL or Redis, does not add Kafka/outbox/inbox and does not extract a physical business service. A07 � Internal Party Clean Architecture Boundary is next and requires explicit authorization.

## A07 internal Party Clean Architecture boundary (working state)

A07 keeps Customer and Supplier behavior inside the existing `apps/api` NestJS modular monolith while introducing an explicit internal Party boundary under `apps/api/src/party`.

The new boundary is organized as domain, application, infrastructure and presentation. Domain and application code use framework-neutral Party actor, command, query and result types. Infrastructure implements Customer and Supplier repository ports with the existing Prisma Customer and Supplier tables. The existing `/customers` and `/suppliers` controllers remain route-compatible presentation adapters through thin legacy service delegators, so public routes, DTO validation, response shapes, frontend URLs and business semantics stay unchanged.

No Prisma schema change or migration is part of A07. Customer and Supplier code generation, tenant scoping, active/deactivate flags, GSTIN/PAN format-only validation, opening balance Decimal handling, list/search/filter/sort/pagination, uniqueness handling and summary behavior are preserved. The monolith's existing auth/session/CSRF/current-business owner checks remain authoritative; A06 Gateway signed context is not consumed inside the monolith for A07.

The architecture guard now includes the migrated `party` scope while still excluding unrelated legacy folders until they migrate. `docs/architecture/party-service-extraction.md` records A08 extraction considerations for references from invoices, sales/purchase documents, finance, POS, dashboard and GST reports. A07 does not create `apps/party-service`, service-owned Prisma schema, internal HTTP calls, Kafka, outbox/inbox, Redis cache, frontend gateway cutover or any physical microservice.

A08 - party-service extraction remains future work and requires explicit authorization.

## A08 first physical business microservice: party-service

A08 physically separates Customer and Supplier runtime execution into `apps/party-service` while preserving the public monolith API as the compatibility surface. The current topology is browser/client -> public `apps/api` controllers -> signed internal HTTP -> `apps/party-service` -> existing PostgreSQL Customer/Supplier tables.

Trust boundary: `apps/api` continues to authenticate the public session and resolve the current OWNER business. Only after that resolution does it sign a service-specific context with `PARTY_SERVICE_HMAC_SECRET`. Party-service requires `source=api-monolith`, `audience=party-service`, `userId`, `businessId`, `requestId`, `correlationId`, `issuedAt` and `expiresAt`, bound to `X-Request-ID` and `X-Correlation-ID`. Gateway A06 contexts remain `source=api-gateway`, `audience=gst-internal-services` and are not accepted by party-service.

Write ownership: production Customer/Supplier writes flow through party-service internal routes under `/internal/v1/party/*`. The monolith `PartyModule` wires the remote `HttpPartyServiceClient` and does not wire local Prisma Party repositories in production. The client uses zero automatic retries; timeouts or transport failures map to safe public service-unavailable responses without exposing internal URLs, stack traces or secret headers.

Database stage: A08 deliberately remains a shared PostgreSQL transition. `@gst/prisma-client` hosts the generated Prisma client from the canonical `apps/api/prisma/schema.prisma` so both runtimes can compile against one schema without duplicating schema ownership. No Prisma migration or DB-per-service split is introduced.

Remaining transitional read coupling: invoices, business documents, finance/payments, POS, GST reports and dashboards may still read Customer/Supplier rows through the shared database for projections, snapshots and metrics. These reads are documented as transitional shared-DB coupling. A08 does not add distributed transactions, Kafka, outbox/inbox or direct gateway routing to party-service.
