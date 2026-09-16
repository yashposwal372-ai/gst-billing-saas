# GST Billing & Business Management SaaS

Phase 8 adds bookkeeping payments, expenses and cash/bank account ledgers on top of the existing authentication, onboarding, dashboard, party, catalogue, GST invoice and sales/purchase document foundation. Statutory GST returns, e-invoice/e-way bill, POS, warehouses, staff, AI, subscriptions and administration remain future work. Live PostgreSQL/Redis verification is outstanding.

## Architecture

```text
Next.js :3000 (apps/web)
    -> NestJS REST :4000/api/v1 (apps/api)
        -> Prisma -> PostgreSQL (source of truth)
        -> Redis (cache infrastructure)
        -> BullMQ producers -> Redis (future workers)
packages/ -> shared UI, ESLint, TypeScript
```

NestJS owns database access and business logic. Next.js never connects to PostgreSQL or receives backend secrets. Future financial/inventory writes must use transactions where required; tenant records must enforce business isolation and justified indexes. The current runtime architecture remains a NestJS modular monolith; the target architecture is NestJS microservices reached through a Strangler Fig migration. The internal backend architecture foundation and migration rulebook are documented in [docs/architecture/backend-architecture.md](docs/architecture/backend-architecture.md).

## A04 public API contracts (2026-09-12)

The current backend remains the NestJS modular monolith in `apps/api`. No API
Gateway or physical microservices have been created. Product phases through POS
are recorded below; older phase-specific descriptions are historical.

Local/development/test documentation uses `@nestjs/swagger` 12.0.1:

- Swagger UI: `http://localhost:4000/api/docs`
- JSON: `http://localhost:4000/api/docs-json`
- Canonical public snapshot: [docs/openapi/api-v1.json](docs/openapi/api-v1.json)
- Exact inventory: [docs/openapi/routes.md](docs/openapi/routes.md) (185 operations)

Both documentation routes and Swagger assets are disabled when `NODE_ENV` is
`production`. The local UI is read-only; Try it out and credential persistence are
disabled. Existing `/api/v1/*` routes, cookies, exact Origin and
`X-CSRF-Protection: 1` checks are unchanged. The API-origin documentation UI does
not bypass the configured frontend-origin requirement.

From the root (use `npm.cmd` in PowerShell):

```sh
npm run openapi:generate
npm run openapi:check
npm run test --workspace api
npm run openapi:test --workspace api
```

Generation/check build the API and derive DTO and response metadata from source;
they do not construct Nest or listen, and require no PostgreSQL, Redis, or network.
Generation writes the snapshot and inventory. Check never overwrites them and
fails on drift, missing/duplicate operation IDs, unresolved references, missing
path parameters, empty request schemas or transport implementation leakage.
Runtime docs setup and `openapi:test` separately verify registered route/guard
coverage, local UI/JSON/assets and production absence using temporary loopback
HTTP listeners, then close them.

The build-time metadata file under `apps/api/src/openapi` is ignored and regenerated
by build/start/test hooks. Restart the development API after changing contract
source to refresh documentation metadata. Do not edit generated metadata or the
snapshot by hand. Intentional public changes require regeneration, diff review,
tests and an intentional snapshot update. See the
[contract policy](docs/architecture/backend-architecture.md#a04-public-contract-foundation).
The type-only `packages/contracts` foundation has no runtime/framework dependencies.
Generated Next.js/React Native clients and Gateway ownership remain future work.

Implementation follows the [Nest Swagger document API](https://docs.nestjs.com/openapi/introduction).


## A05 API Gateway foundation (2026-09-14)

`apps/api-gateway` is a parallel NestJS TypeScript public-edge foundation for the future Strangler migration. It does not replace the current backend yet, and the frontend has not been cut over. The current business API remains `apps/api` on `http://localhost:4000/api/v1`; the gateway defaults to `http://localhost:4100` and generically proxies only `/api/v1` and `/api/v1/*` to the trusted `MONOLITH_BASE_URL`.

Gateway defaults are safe local development values:

- `GATEWAY_PORT=4100`
- `MONOLITH_BASE_URL=http://127.0.0.1:4000`
- `PROXY_TIMEOUT_MS=30000`

The gateway preserves methods, paths, query strings, raw bodies, cookies, `Set-Cookie`, `Origin` and `X-CSRF-Protection`. It does not decode auth cookies, perform tenant authorization, retry side-effecting requests, cache responses, or duplicate business logic. It strips hop-by-hop headers, reconstructs forwarded headers at the trusted edge, strips reserved `x-gst-internal-*` and `x-internal-*` headers, and propagates bounded `X-Request-ID` and `X-Correlation-ID` values. Gateway-owned health endpoints are `GET /health/live` and `GET /health/ready`; the existing `/api/v1/health` continues to proxy to the monolith.

Run the gateway in parallel:

```sh
npm run start:dev --workspace api
npm run gateway:dev
```

Useful checks:

```sh
npm run gateway:check
npm run gateway:test
npm run gateway:build
```

A05 does not create physical business services, Kafka, outbox/inbox, Prisma schema changes or migrations. A06 will design identity and security propagation.
## A06 identity and security propagation (2026-09-16)

The gateway now performs stateless verification of the current access JWT only to create a short-lived trusted internal identity context for future downstream services. Current access tokens are `jose` JWTs signed with HS256, issuer `gst-billing-api`, audience `gst-billing-web`, subject `sub` as the user ID, and `sid` as the session ID. The current symmetric `JWT_SECRET` must be shared with the gateway for verification during this migration stage; the gateway does not mint, refresh, revoke or log access tokens. Future asymmetric verification is preferable before wider service extraction.

When a valid access cookie is present, the gateway signs a compact context using HMAC-SHA-256 and forwards it in `X-GST-Internal-Context` and `X-GST-Internal-Signature`. The context is base64url encoded, versioned, has source `api-gateway`, audience `gst-internal-services`, includes request/correlation IDs, user ID and session ID, and expires after at most 60 seconds. It never contains raw JWTs, refresh tokens, cookies, email, phone, GSTIN, PAN, bank data or business/customer data. Public `x-gst-internal-*` and `x-internal-*` headers remain stripped before new trusted headers are generated.

Compatibility is unchanged for public `/api/v1` traffic. Missing, expired, malformed or wrongly signed access cookies do not produce internal identity headers, but the request still proxies normally so the monolith remains the current authentication, CSRF, session validity, business membership, tenant authorization and resource authorization authority. Refresh cookies alone never establish gateway identity. No database or Redis lookup is performed by the gateway, and no frontend cutover, physical service extraction, Kafka, outbox/inbox, Prisma schema change or migration is introduced.
## Requirements and installation

Node >=24 (verified 24.19.0), npm 11.17.0, and Docker with Compose for local PostgreSQL/Redis. Run from the repository root:

```sh
npm install
npm run prisma:generate --workspace api
```

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Environment setup

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`. Optionally copy root `.env.example` to `.env` to customize Compose. These local files are ignored; examples are tracked.

Backend local defaults match Compose: port 4000, frontend origin http://localhost:3000, database gst_billing with development-only gst_dev/gst_dev_local credentials, and redis://localhost:6379. If you change Compose ports or credentials, update API URLs too. npm workspace commands run in apps/api, where ConfigModule and Prisma CLI load .env.

JWT_SECRET signs 15-minute access JWTs; when omitted locally, a random per-process key is used. JWT_REFRESH_SECRET remains unused with opaque refresh tokens, but existing production validation still requires both distinct non-placeholder secrets of at least 32 characters. Production requires explicit infrastructure/origin settings and an HTTPS frontend origin. Never use the local example credentials in production. Validation errors list variable names, never values.

Only NEXT_PUBLIC_API_URL belongs in the frontend environment. The Zod-validated getApiBaseUrl helper is in apps/web/lib/api.ts. Never expose DATABASE_URL, REDIS_URL, or JWT secrets there.

## Local services and development

```sh
docker compose up -d
docker compose ps
npm run infra:check --workspace api
npm run dev
```

Compose runs PostgreSQL 17 and Redis 7 with healthchecks and persistent volumes, bound to loopback. Redis uses append-only persistence and noeviction for BullMQ compatibility. Services run in Docker; Next.js and NestJS run on the host.

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1
- Liveness: http://localhost:4000/api/v1/health
- Preserved starter response: GET /api/v1

Health returns `{"status":"ok","service":"gst-billing-api"}`; it does not assert database/cache readiness. Connections are lazy so health, builds and tests work without services. `infra:check` explicitly executes SELECT 1 through Prisma and Redis PING, returning nonzero if unavailable. Redis producer requests have bounded retries; future workers require separate retrying connections. No queues or workers start until a queue is explicitly requested.

Stop apps with Ctrl+C. Stop containers with `docker compose stop`; keep volumes unless you deliberately intend to delete local data.

## Validation and schema commands

```sh
npm run lint
npm run typecheck
npm run build
npm run test --workspace api
npm run test:e2e --workspace api
npm run prisma:validate --workspace api
npm audit
npm audit --omit=dev
git diff --check
```

`check-types` remains supported. API build/dev/typecheck and start/test prehooks generate the Prisma client. After a build, `npm run start:prod --workspace api` starts compiled code. Prisma 7 uses prisma.config.ts and the PostgreSQL driver adapter; generated TypeScript is ignored and compiled into API dist. The initial Phase 2 migration is in `apps/api/prisma/migrations/20260907180000_phase2_auth_onboarding`. Once local PostgreSQL is available and the target database is configured, apply it with `npm run prisma:deploy --workspace api`. It has not been applied in this environment. Never use migration reset for validation.

Tailwind 4 uses @tailwindcss/postcss and CSS imports; existing App Router/CSS modules remain. Zod validates frontend API configuration. No frontend form/test framework was added.


## Phase 10 POS billing (2026-09-11)

Phase 10 adds a focused authenticated POS route at `/pos`, POS sales history at `/pos/sales`, and an 80mm receipt print route at `/pos/receipt/:invoiceId`. POS is a retail workflow over existing domains: completed sales are normal finalized Invoice records with `salesChannel = POS`; GST uses the existing invoice calculator; stock movements remain the existing invoice finalization movements; recorded payments use Phase 8 customer receipt/payment allocation and MoneyAccount ledger behavior. No separate POS financial record, payment gateway, UPI processing, camera scanning, warehouse, or offline sync is implemented.

Walk-in sales use explicit invoice snapshots with `customerId = null`, `Walk-in Customer` as the buyer snapshot, no GSTIN, and seller-state billing snapshot defaults. This avoids creating fake GSTINs or polluting CRM with anonymous customers. Existing customers can still be selected for normal customer snapshots. POS product lookup is bounded and active-only, covering name, product code, SKU and barcode; exact barcode lookup supports keyboard-style scanners and repeated scans merge into the cart when price/discount/mode match. Held carts are deferred; carts are browser state only and do not reserve stock.

POS checkout uses a safe two-step backend architecture: it first creates and finalizes the POS invoice through the existing invoice service, assigning the permanent invoice number and applying stock validation/deduction in the existing Serializable invoice transaction. If a recorded payment is selected, it then creates and posts a Phase 8 customer receipt against the finalized invoice. If payment recording fails, the finalized sale remains valid and outstanding; the UI reports that payment was not recorded. `posClientCheckoutId` provides durable duplicate-submit protection for checkout retries. Cash change due is display-only; only the retained invoice total is posted as the recorded payment.

## Phase 9 internal GST reports (2026-09-11)

Phase 9 provides internal book GST reports from finalized recorded transactions. These reports do not file GST returns, connect to GSTN, generate government upload files, validate GSTINs with the government, calculate ITC eligibility, certify compliance, create IRN/QR/e-way bills, or provide statutory tax advice.

Backend endpoints under `/api/v1/gst-reports` include summary, sales register, purchase register, output tax, purchase tax recorded, GST-rate summary, HSN/SAC summary, place-of-supply summary, operational returns summary, and CSV exports for sales register, purchase register and HSN/SAC. Sales reports use finalized invoices only. Purchase reports use finalized purchase bills only. Operational returns are shown separately and are not netted into GST summaries because statutory GST Credit Note / Debit Note treatment is not implemented.

Frontend routes under `/gst-reports` provide report summary cards, filters, printable report views, CSV export links and drill-down links to invoice or purchase bill detail pages. Use Purchase GST Recorded / Purchase Tax Recorded wording; do not present purchase totals as ITC eligibility or claimable tax.

No Phase 9 database migration was required. Existing Phase 6/7 snapshot columns and indexes support the implemented reporting views. Browser smoke support exists through `node apps/web/scripts/dashboard-smoke.mjs --gst-reports`, but local outside-sandbox Chrome execution was blocked by automatic approval review unless explicitly approved.
## Phase 8 payments, expenses and banking (2026-09-09)

Phase 8 is bookkeeping and settlement recording only. It does not move money, verify bank balances, synchronize bank feeds, process cards/UPI, clear cheques, integrate with RBI/NPCI, or perform automatic reconciliation. Account balances are internal ledger balances and may be negative because the app records business activity rather than authorizing external funds.

New finance APIs under `/api/v1` add money accounts, immutable account transactions, payments, payment allocations, expense categories, expenses, internal transfers, receivables and payables. Money accounts support CASH, BANK, UPI and OTHER types, server-generated ACC codes, opening balances and deactivation/reactivation. Nonzero opening balances create immutable ledger entries in the same transaction. Ordinary account updates cannot rewrite openingBalance, currentBalance or accountCode.

Payments support CUSTOMER_RECEIPT and SUPPLIER_PAYMENT drafts, explicit posting and reversal. Posting assigns RCPT/PAY financial-year numbers, validates active party/account records, requires allocation total to equal payment amount, prevents over-allocation against finalized invoices or finalized Purchase Bills, changes the selected account balance and writes an immutable ledger entry in one Serializable transaction. Reversal preserves the original payment number and allocations, records actor/time/reason, writes a reversing ledger entry and makes those allocations stop contributing to paid totals. Invoice status remains DRAFT/FINALIZED/CANCELLED; purchase bill document status remains the Phase 7 lifecycle. Paid, partial and unpaid states are derived from posted non-reversed allocations.

Expenses support business-scoped categories, draft expenses, posted expenses with EXP financial-year numbering, and cancellation by ledger reversal. Expenses record cash/bank outflows and do not implement fake ITC/GST-credit or GST return filing semantics. Internal account transfers assign TRF numbers and write paired transfer ledger entries; reversal writes paired reversal entries.

Frontend routes were added for `/accounts`, `/accounts/:id/transactions`, `/payments`, `/expense-categories`, `/expenses`, `/account-transfers`, `/receivables` and `/payables`. The workspace navigation enables Payments, Expenses and Banking destinations. Dashboard receivables, payables and monthly expenses are derived from posted finance records. Customer and supplier details now report paid/outstanding/payable totals from posted allocations.

Migration `20260909210000_phase8_payments_expenses_banking` was generated offline from the committed Phase 7 schema. It adds finance enums/tables/indexes/FKs, `Business.nextAccountNumber`, composite tenant-scoped references and SQL check constraints for valid payment parties, allocation targets, positive amounts and non-self transfers. Migration application was not run in this environment.

## Phase 2 usage and validation (2026-09-08)

Open `/signup` or `/login`, then complete `/onboarding`: business/address details, GST information, and invoice defaults with optional bank/UPI details. Completed onboarding now leads to `/dashboard`; `/welcome` remains available for compatibility. `/forgot-password`, `/reset-password`, and `/verify-email` provide recovery/verification forms. GST/PAN/bank checks are format checks only; logo uploads and email delivery are not connected.

All routes use `/api/v1`. Auth exposes POST `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/request-verification`, and GET `/auth/me`. Business routes are POST `/businesses`, GET `/businesses/current`, and PATCH `/businesses/current` (complete profile DTO). Business creation and OWNER membership are transactional; reads/updates require the authenticated user's OWNER membership.

Passwords use Argon2id. Access and rotating opaque refresh tokens use HttpOnly, SameSite=Lax cookies; production adds Secure and cookie prefixes. Deploy the frontend and API on the same site over HTTPS. Writes require the exact configured Origin and `X-CSRF-Protection: 1`; fetch includes credentials. Refresh tokens are stored as SHA-256 hashes, have a fixed 30-day session lifetime, and reuse revokes the session. Every authenticated request checks session revocation and user status/version. Password reset expires after 30 minutes, verification after 24 hours; both are single-use. Auth writes share an in-memory limit of 30 requests per IP per 15 minutes. Multi-instance rate limiting and deployment proxy configuration remain future deployment work.

No reset or verification emails are sent. The local-only `npm run auth:local-token --workspace api -- verify <email>` utility now issues and consumes a verification token internally without printing it. The `reset <email>` variant reads a 12Ã¢â‚¬â€œ128 character password from redirected stdin, never a command-line argument. It rejects production and remote database hosts; its live database behavior is untested here. User-facing recovery requires a future email delivery integration.

Install, lint, typecheck, build, Prisma format/validate/generate passed. Fresh offline migration generation matches the existing SQL. Unit tests: 56 passed. HTTP/e2e: 15 passed, including the four foundation tests; one real PostgreSQL integration test skipped. To run that test later, migrate a dedicated database whose name ends in `_test`, set `TEST_DATABASE_URL` for the API test process, and run `npm run test:e2e --workspace api`. It cleans up only its own records.

Production-server smoke checks returned HTTP 200 for `/`, all seven Phase 2 frontend routes, the API root and health. Servers were stopped. Responsive styles, labels, error states and keyboard controls were reviewed in source; interactive browser flows, live persistence, transaction concurrency and the local utility were not runtime verified.

## Phase 3 dashboard and navigation (2026-09-08)

`/dashboard` uses the reusable `(app)` layout with a desktop sidebar, tablet/mobile drawer, current-business context, account/logout menu, search placeholder and notification placeholder. Future navigation items and quick actions are disabled and marked Soon. KPI cards, five chart areas and recent activity use explicit unavailable/empty states; no financial data is invented. Lucide supplies icons; no chart library or Redis cache was added.

`GET /api/v1/dashboard/summary` requires the existing cookie session and OWNER membership for the authenticated user's current business. Unknown query fields (including businessId) are rejected. The response selects only business ID/name/completion/role, null metrics, empty chart/activity arrays and the acknowledged filter. A missing current business returns business: null so the UI can route to onboarding. `period` supports today, yesterday, last7, last30, thisMonth (default), lastMonth, financialYear and custom. Custom requires ordered real dates in `start` and `end` as YYYY-MM-DD. Filters acknowledge the empty dataset in Asia/Kolkata; financial aggregation is not implemented. No schema change or migration was needed.

Validation: lint, typecheck, production build and Prisma validation/generation passed. API unit tests: 56 passed. HTTP/e2e: 28 passed, including 13 new dashboard cases; one live PostgreSQL test remains skipped. Existing cookie, refresh, CSRF and session behavior is preserved.

For optional browser smoke checks, first build the app and free port 3000, then run `node apps/web/scripts/dashboard-smoke.mjs`. It uses Node 24 and installed Chrome on Windows; pass another Chrome/Edge executable as the first argument if needed. It starts/stops its own frontend/browser and uses isolated test-only API interception, with no database or real authentication. Checks cover 1440/1024/768/375px overflow, long business names, navigation groups, drawer Tab wrapping/Escape/focus restoration, notifications, date filtering, loading, errors/retry, auth/onboarding routing and logout. Phase 8 mode additionally covers finance routes plus full customer receipt create/post/reverse, supplier payment create/post/reverse, expense create/edit/post/cancel, transfer create/post/reverse, account deactivate/reactivate and lifecycle dialog Escape/Tab behavior. Screenshots and browser profile are written to a unique OS temporary directory. These checks passed with test-only API fixtures; they do not establish live persistence. Sandbox renderer restrictions required an approved browser run outside the sandbox here.

## Phase 4 customers and suppliers (2026-09-08)

Open `/customers` or `/suppliers`; each has `/new`, `/:id` and `/:id/edit` routes. Both use the existing authenticated shell. Lists support submitted search, URL filters, sorting and server pagination. Deactivation requires confirmation and retains the record; use the Inactive filter to find and reactivate it. Supplier account numbers are masked on detail pages and available in full only while editing. Cancel and browser reload/close warn about unsaved form changes; other in-app links are not intercepted.

Under `/api/v1`, both `/customers` and `/suppliers` expose POST (create), GET (list), GET `/:id` (detail), PATCH `/:id` (partial update), and DELETE `/:id` (deactivate). PATCH `{"isActive":true}` reactivates. All use the current authorized OWNER business; do not submit businessId or party codes. Unknown body/list query fields are rejected. Optional strings can be cleared with an empty string; omitted PATCH fields are preserved.

List parameters: `page` (default 1), `pageSize` (20, max 100), `search`, `status=active|inactive|all` (active default), `gstRegistered=all|true|false`, `state`, `sortBy=displayName|code|createdAt|updatedAt`, and `sortOrder=asc|desc`. Results include items/page/pageSize/total/totalPages. Lists omit bank details and notes. Details return profile, null future transaction totals/counts and empty ledger/activity arrays.

Opening balances and customer credit limits use PostgreSQL Decimal(15,2): send nonnegative decimal **strings**, e.g. `"123.45"`, with at most two fractional digits. Responses have two decimal places. Opening balance has a RECEIVABLE or PAYABLE direction and is independent of live dues; no ledger entry is fabricated. Customer `addressLine1` through `pincode` are billing fields, with separate optional shipping fields. GST/PAN/state and bank checks are format/consistency checks only.

Codes are business-scoped CUS-/SUP- sequences allocated by atomic business counters in the creation transaction. GSTIN uniqueness is scoped to each business and party type. No hard-delete API exists. Dashboard counts show current active customer/supplier records, independent of the date filter; financial metrics remain unavailable. Add customer is enabled.

Migration `20260908123000_phase4_customers_suppliers` was generated offline against the Phase 3 schema and inspected; Prisma format/validate/generate passed. **Migration application and live database verification have not run.** Once PostgreSQL is available, apply migrations using the existing `npm run prisma:deploy --workspace api` workflow before using these features.

Validation: lint, typecheck and build passed; 88 unit and 104 HTTP/e2e tests passed. Two live PostgreSQL suites are skipped without a migrated dedicated `*_test` database configured through `TEST_DATABASE_URL`. The new opt-in suite tests concurrent code allocation and rollback/isolation. No dependency was added.

Run `node apps/web/scripts/dashboard-smoke.mjs --parties` after building, with port 3000 free, for fixture-based browser checks of lists/forms/details/dialogs at 1440/1024/768/375px plus validation/create/edit/status/filter/error flows. It uses the existing Chrome/Edge approach and stops its own processes. These checks passed but do not verify live persistence.

## Phase 5 products and inventory (2026-09-08)

Frontend routes: `/products`, `/products/new`, `/products/:id`, `/products/:id/edit`, `/categories`, and `/inventory`. Products, Categories and Stock navigation and Add product are enabled. Lists have search, filters, sorting and pagination; detail pages show SKU/barcode, pricing, stock and paginated movement history. Category dialogs support create/edit/deactivate/reactivate. Product detail supports confirmed status changes and explained stock adjustments.

All API paths below are relative to `/api/v1` and require the authenticated user's current OWNER business. Writes retain Origin/CSRF checks. Unknown DTO/query properties, including client business IDs and product codes, are rejected.

| Methods | Path | Behavior |
| --- | --- | --- |
| GET, POST | `/categories` | Paginated list / create |
| GET, PATCH, DELETE | `/categories/:id` | Detail / partial edit / deactivate |
| GET, POST | `/products` | Paginated catalogue / create PRODUCT or SERVICE |
| GET, PATCH, DELETE | `/products/:id` | Detail / partial edit / deactivate |
| GET | `/products/by-barcode/:barcode` | Exact business-scoped barcode lookup |
| GET | `/inventory/summary` | Active product, tracked, low-stock and out-of-stock counts |
| POST | `/products/:id/stock-adjustments` | Transactional stock increase/decrease |
| GET | `/products/:id/stock-movements` | Immutable paginated history |

PATCH `{"isActive":true}` reactivates categories/items; DELETE never physically deletes them. Product lists accept `page`, `pageSize` (default 20, max 100), `search`, `status=active|inactive|all`, `type=PRODUCT|SERVICE`, `categoryId`, `gstRate`, `stockStatus=all|tracked|low|out`, `sortBy=name|productCode|createdAt|salePrice|currentStock` and `sortOrder=asc|desc`. Category lists accept pagination, status and search. Movement lists accept pagination and optional `type=OPENING|ADJUSTMENT_IN|ADJUSTMENT_OUT`.

Category names are case-insensitively unique within a business. Optional trimmed SKU and barcode are case-sensitive and business-unique; empty strings clear optional values. Codes use `PRD-000001` onward, allocated by an atomic business counter in the same transaction as item creation and opening stock. A failed transaction rolls back the counter and records together; live concurrency remains unverified.

PRODUCT items may track inventory; SERVICE items cannot carry stock or accept adjustments. Type, unit and tracking mode are fixed after creation. Units: PCS, NOS, KG, G, LTR, ML, MTR, BOX, PACK, SET, HOUR, DAY, SERVICE; no unit conversion. HSN accepts 4/6/8 digits, SAC accepts 6 digits starting with 99. GST rate accepts 0Ã¢â‚¬â€œ100 with up to two decimals. These are format checks, not official classification/rate verification or tax calculation.

Send prices as nonnegative decimal strings with up to two decimals (Decimal(15,2)); quantities use up to three decimals (Decimal(18,3)). Responses serialize prices/rates with two places and quantities with three. Stock source of truth is Product.currentStock plus append-only StockMovement records. Nonzero opening stock creates an OPENING movement in the creation transaction; zero stock creates none. Normal PATCH rejects opening/current stock fields. Adjustments use `{"direction":"INCREASE","quantity":"0.001","reason":"Physical count correction"}` or DECREASE, with exact Decimal arithmetic, Serializable transactions, bounded conflict retries and conditional stock updates. Quantity must be positive; negative resulting stock and overflow are rejected. Each movement records quantity, before/after stock, reason, actor and time. There are no movement update/delete endpoints.

Low stock means `currentStock > 0 && currentStock <= minimumStock`; out of stock means `currentStock <= 0`. Both exclude inactive items, services and untracked products. Dashboard product/low-stock counts are authorized current counts, independent of date selection; financial metrics remain null and charts empty. Out-of-stock count appears in inventory summary only.

Migration `20260908180000_phase5_products_inventory` adds Category, Product, StockMovement, enums, scoped constraints/indexes and Business.nextProductNumber. Prisma format/validate/generate passed, and a fresh offline Phase 4-to-5 diff exactly matches the migration. **Migration application: NOT RUN.** Use the existing deploy command only against a configured PostgreSQL database when available; no reset is needed.

Backend verification: 141 unit tests passed; 178 HTTP/e2e tests passed; 4 real PostgreSQL tests skipped without `TEST_DATABASE_URL`. The opt-in catalogue suite targets a migrated dedicated `*_test` database and covers code allocation, rollback, decimals, tenant isolation and concurrent decrements. Mock tests do not verify persistence or actual concurrency.

Run `node apps/web/scripts/dashboard-smoke.mjs --catalogue` after building with port 3000 free. Fixture-backed browser checks passed at 1440/1024/768/375px for pages/dialogs, long names/SKU/barcode, overflow, keyboard containment/Escape/restoration, category/status flows, product/service create/edit, exact stock adjustments, negative-stock errors, history, search/filters/pagination and loading/error/retry/empty/conflict states. The prior edit stall was an incorrect fixture PATCH response (empty optional money instead of null), corrected to match the API. Existing dashboard and party browser regression checks passed. Screenshots were inspected; these checks do not verify real authentication or database persistence.

Known UI limits: category selectors load the first 100 categories; unsaved-change protection covers reload/close and Cancel, not all in-app links. No barcode scanning/printing UI, stock valuation, unit conversion or financial transactions are implemented.

## Phase 6 GST billing and invoices (2026-09-08)

Frontend routes: `/invoices`, `/invoices/new`, `/invoices/:id`, `/invoices/:id/edit`, and `/invoices/:id/print`. Sales > Invoices and the Create invoice dashboard action are enabled. The print route is browser print-to-PDF using print CSS; no server-generated PDF, IRN, government QR, e-invoice registration, e-way bill, GST portal integration or GST return filing exists.

All invoice API paths are under `/api/v1`, require the authenticated user's current OWNER business, and keep the existing Origin/CSRF protections on writes. Unknown DTO/query fields are rejected, including client-submitted totals.

| Methods | Path | Behavior |
| --- | --- | --- |
| GET, POST | `/invoices` | Paginated list / create draft |
| POST | `/invoices/preview` | Server-calculated draft preview without persistence |
| GET, PATCH, DELETE | `/invoices/:id` | Detail / edit draft / discard draft |
| POST | `/invoices/:id/finalize` | Assign permanent invoice number and deduct stock |
| POST | `/invoices/:id/cancel` | Cancel finalized invoice and restore stock |

Draft invoices have no permanent invoice number and do not affect stock. Finalization assigns a server-generated number such as `INV/2026-27/000001`, using the existing business invoice prefix, an `InvoiceSequence` row scoped by business and Indian-style April-March financial year, and a Serializable transaction. Finalized invoice financial fields and snapshots are immutable through the public API. Cancellation preserves the invoice number and totals, records reason/date/actor and restores stock exactly once.

Invoice, InvoiceLine and InvoiceSequence store seller/customer/product snapshots, line values and computed totals. Seller data comes from the authorized Business; selected Customer and Product records are loaded by the backend and snapshotted. Historical finalized/cancelled invoice rendering uses invoice snapshots, not today's mutable customer/product/business records.

The authoritative calculator lives in `apps/api/src/invoices/invoice-calculator.ts`. It uses Prisma Decimal arithmetic, currency rounding to two places and Phase 5 quantity precision to three places. Supported price modes are EXCLUSIVE and INCLUSIVE. Supported discounts are line-level NONE, PERCENT and AMOUNT. Product GST rate is snapshotted; client-submitted tax amounts and totals are not trusted. Place of supply is validated, and tax treatment is determined by seller state code versus place-of-supply state code: same state produces CGST/SGST, different state produces IGST, and zero GST produces zero components. These are deterministic calculation and format checks only, not official GST classification, portal validation or tax compliance certification.

Finalization aggregates duplicate product lines before stock deduction so repeated lines cannot oversell independently. Inventory products are deducted transactionally with `INVOICE_FINALIZED` stock movements; cancellation restores them with `INVOICE_CANCELLED` movements. Services and untracked products do not create stock movements. Negative resulting stock is rejected. Real PostgreSQL concurrency and rollback remain unverified locally.

Dashboard sales metrics now use finalized, non-cancelled invoices where the implemented query can aggregate them truthfully; cancelled and draft invoices are excluded. Customer detail exposes finalized invoice count and total sales only. Payments, paid amounts, receivables, overdue invoices, purchases, GST reports and ledgers remain unavailable.

Migration `20260908210000_phase6_gst_billing_invoices` was generated offline against the Phase 5 schema and inspected. It adds invoice enums, InvoiceSequence, Invoice, InvoiceLine, invoice-linked stock movements, composite tenant FKs/indexes and the new stock movement types. **Migration application: NOT RUN.** Use the existing deploy command only against a configured PostgreSQL database when available; no reset is needed.

Validation: lint, typecheck and build passed. API unit tests: 153 passed. HTTP/e2e tests: 188 passed; 6 real PostgreSQL opt-in tests skipped without `TEST_DATABASE_URL`. Tests cover calculator GST/rounding/financial-year behavior, invoice HTTP preview/create/update/discard/finalize/cancel flows with database doubles, and opt-in PostgreSQL invoice transaction coverage for concurrent finalize/cancel stock behavior. Fixture-backed invoice browser smoke checks passed for list, form, detail, edit and print routes at 1440/1024/768/375px, including stale preview response protection, finalize/cancel dialogs and cancelled print watermark/status. Browser checks use intercepted test API fixtures, so they do not prove live auth or persistence.

## Phase 7 sales and purchases (2026-09-09)

Frontend routes now include `/quotations`, `/sales-orders`, `/delivery-challans`, `/sales-returns`, `/purchase-orders`, `/purchase-bills`, and `/purchase-returns`, each with list, new, detail, edit and print pages. Sales and Purchases navigation is enabled for these documents, and Record purchase links to `/purchase-bills/new`. Existing invoices remain the Phase 6 invoice implementation.

Phase 7 documents use a generalized `BusinessDocument` / `BusinessDocumentLine` schema with `BusinessDocumentType`, `BusinessDocumentStatus` and `BusinessDocumentSequence`. This stores quotations, sales orders, delivery challans, sales returns, purchase orders, purchase bills and purchase returns as business-scoped document records rather than seven separate tables. Document numbers are assigned only on issue/confirm/finalize actions using prefixes `QT`, `SO`, `DC`, `SR`, `PO`, `PB`, and `PR` with the April-March financial year, for example `PB/2026-27/000001`. Drafts remain unnumbered.

All document APIs are under `/api/v1` and require the authenticated user's current OWNER business plus existing Origin/CSRF protections. Each resource exposes GET/POST collection, POST `/preview`, GET/PATCH/DELETE `/:id`, POST lifecycle actions and POST `/:id/convert/:target`. Implemented conversions are quotation to sales order, sales order to delivery challan, purchase order to purchase bill, quotation to invoice draft, sales order to invoice draft, and delivery challan to invoice draft. Invoice draft conversions create a new unnumbered Phase 6 invoice draft through the invoice service; the source document remains unchanged and stock is not affected until invoice finalization.

Server-side GST calculation reuses the Phase 6 Decimal calculator with two-place currency rounding and three-place quantities. EXCLUSIVE and INCLUSIVE pricing, line discounts, CGST/SGST/IGST split and place-of-supply handling are server-authoritative. Client totals are rejected by DTO whitelisting. These remain deterministic commercial calculations, not official GST registration verification, ITC eligibility, credit/debit notes, GSTR reporting, IRN, QR or e-way bill support.

Quotations, sales orders, delivery challans and purchase orders do not affect stock. Purchase bill finalization increases tracked product stock; purchase bill cancellation reverses that increase only if stock will not go negative. Sales return finalization restores tracked product stock against finalized invoices and cancellation reverses it. Purchase return finalization deducts tracked product stock against finalized purchase bills and cancellation restores it. Duplicate return lines are aggregated against the source line so over-return cannot slip through split lines. Service returns are rejected in Phase 7; service lines in commercial documents never create stock movements.

Seller, customer, supplier and product details are snapshotted into document rows and lines, so issued/finalized/cancelled print/detail views use stored historical values. Purchase bill totals feed the dashboard purchase metric where available. Supplier detail now reports finalized purchase bill count and total purchases; paid/payable settlement remains unavailable until payments/accounting phases.

Migration `20260909120000_phase7_sales_purchases` was generated offline and inspected. It adds business document enums, sequence/table/line records, scoped indexes/foreign keys, supplier composite tenant key, and document-linked stock movement types. **Migration application: NOT RUN.** Use the existing deploy command only against a configured PostgreSQL database when available; never reset for validation.

Validation in this environment: API Phase 7 HTTP double coverage was added for preview/create/lifecycle/conversion/stock/return safety. Root lint, typecheck, build, API unit, API HTTP/e2e, Prisma format/validate/generate and git diff checks passed. Fixture-backed Phase 7 browser smoke passed outside the sandbox at 1440/1024/768/375 for document routes, conversions, lifecycle dialogs, responsive layout and print DOM checks. npm audit remained blocked by automatic approval review after a read-only registry attempt; manual user approval is required. Local PostgreSQL and Redis remain unavailable, so live persistence/concurrency/cache verification is not claimed.
## Infrastructure and dependency limitations

Phase 1 previously verified root dev serving on ports 3000 and 4000; watch restart was not verified. Phase 2 runtime checks used compiled servers.

Docker/psql/redis-server are not available on PATH and no local database/cache listeners were observed. Compose YAML syntax was parsed using the installed Prettier YAML parser; Docker Compose runtime/schema validation and PostgreSQL/Redis/BullMQ runtime connectivity were NOT RUN. App Dockerfiles are deferred to the deployment phase.

npm audit reports 9 packages: 2 low, 1 moderate, 6 high. Production-only audit reports 4 high through Prisma, @prisma/config, deepmerge-ts and mysql2. Although Prisma CLI is declared a devDependency, @prisma/client's optional peer causes npm to include it in the production audit. Do not describe production audit as clean. The other 5 findings are in the existing @nestjs/mau development tree. Prisma pins affected transitive versions; no forced downgrade, prerelease upgrade, or override was applied.

npm also warns of unapproved dependency lifecycle scripts for Prisma, its engines, and optional msgpackr-extract. Generation/build/tests work in this environment; no blanket script approval was added. Vitest reports the existing vite-tsconfig-paths native-support warning.

Phase 6 implementation and feasible validation are complete with the runtime limitations above. Phase 7 (Sales + Purchases) has not started and requires separate authorization.
