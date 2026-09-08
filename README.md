# GST Billing & Business Management SaaS

Phase 3 adds the authenticated application shell and dashboard foundation to the existing authentication and business onboarding. Financial and operational modules remain future work. Live PostgreSQL/Redis verification is outstanding.

## Architecture

```text
Next.js :3000 (apps/web)
    -> NestJS REST :4000/api/v1 (apps/api)
        -> Prisma -> PostgreSQL (source of truth)
        -> Redis (cache infrastructure)
        -> BullMQ producers -> Redis (future workers)
packages/ -> shared UI, ESLint, TypeScript
```

NestJS owns database access and business logic. Next.js never connects to PostgreSQL or receives backend secrets. Future financial/inventory writes must use transactions where required; tenant records must enforce business isolation and justified indexes.

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

## Phase 2 usage and validation (2026-09-08)

Open `/signup` or `/login`, then complete `/onboarding`: business/address details, GST information, and invoice defaults with optional bank/UPI details. Completed onboarding now leads to `/dashboard`; `/welcome` remains available for compatibility. `/forgot-password`, `/reset-password`, and `/verify-email` provide recovery/verification forms. GST/PAN/bank checks are format checks only; logo uploads and email delivery are not connected.

All routes use `/api/v1`. Auth exposes POST `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/request-verification`, and GET `/auth/me`. Business routes are POST `/businesses`, GET `/businesses/current`, and PATCH `/businesses/current` (complete profile DTO). Business creation and OWNER membership are transactional; reads/updates require the authenticated user's OWNER membership.

Passwords use Argon2id. Access and rotating opaque refresh tokens use HttpOnly, SameSite=Lax cookies; production adds Secure and cookie prefixes. Deploy the frontend and API on the same site over HTTPS. Writes require the exact configured Origin and `X-CSRF-Protection: 1`; fetch includes credentials. Refresh tokens are stored as SHA-256 hashes, have a fixed 30-day session lifetime, and reuse revokes the session. Every authenticated request checks session revocation and user status/version. Password reset expires after 30 minutes, verification after 24 hours; both are single-use. Auth writes share an in-memory limit of 30 requests per IP per 15 minutes. Multi-instance rate limiting and deployment proxy configuration remain future deployment work.

No reset or verification emails are sent. The local-only `npm run auth:local-token --workspace api -- verify <email>` utility now issues and consumes a verification token internally without printing it. The `reset <email>` variant reads a 12–128 character password from redirected stdin, never a command-line argument. It rejects production and remote database hosts; its live database behavior is untested here. User-facing recovery requires a future email delivery integration.

Install, lint, typecheck, build, Prisma format/validate/generate passed. Fresh offline migration generation matches the existing SQL. Unit tests: 56 passed. HTTP/e2e: 15 passed, including the four foundation tests; one real PostgreSQL integration test skipped. To run that test later, migrate a dedicated database whose name ends in `_test`, set `TEST_DATABASE_URL` for the API test process, and run `npm run test:e2e --workspace api`. It cleans up only its own records.

Production-server smoke checks returned HTTP 200 for `/`, all seven Phase 2 frontend routes, the API root and health. Servers were stopped. Responsive styles, labels, error states and keyboard controls were reviewed in source; interactive browser flows, live persistence, transaction concurrency and the local utility were not runtime verified.

## Phase 3 dashboard and navigation (2026-09-08)

`/dashboard` uses the reusable `(app)` layout with a desktop sidebar, tablet/mobile drawer, current-business context, account/logout menu, search placeholder and notification placeholder. Future navigation items and quick actions are disabled and marked Soon. KPI cards, five chart areas and recent activity use explicit unavailable/empty states; no financial data is invented. Lucide supplies icons; no chart library or Redis cache was added.

`GET /api/v1/dashboard/summary` requires the existing cookie session and OWNER membership for the authenticated user's current business. Unknown query fields (including businessId) are rejected. The response selects only business ID/name/completion/role, null metrics, empty chart/activity arrays and the acknowledged filter. A missing current business returns business: null so the UI can route to onboarding. `period` supports today, yesterday, last7, last30, thisMonth (default), lastMonth, financialYear and custom. Custom requires ordered real dates in `start` and `end` as YYYY-MM-DD. Filters acknowledge the empty dataset in Asia/Kolkata; financial aggregation is not implemented. No schema change or migration was needed.

Validation: lint, typecheck, production build and Prisma validation/generation passed. API unit tests: 56 passed. HTTP/e2e: 28 passed, including 13 new dashboard cases; one live PostgreSQL test remains skipped. Existing cookie, refresh, CSRF and session behavior is preserved.

For optional browser smoke checks, first build the app and free port 3000, then run `node apps/web/scripts/dashboard-smoke.mjs`. It uses Node 24 and installed Chrome on Windows; pass another Chrome/Edge executable as the first argument if needed. It starts/stops its own frontend/browser and uses isolated test-only API interception, with no database or real authentication. Checks cover 1440/1024/768/375px overflow, long business names, navigation groups, drawer Tab wrapping/Escape/focus restoration, notifications, date filtering, loading, errors/retry, auth/onboarding routing and logout. Screenshots and browser profile are written to a unique OS temporary directory. These checks passed; they do not establish live persistence. Sandbox renderer restrictions required an approved browser run outside the sandbox here.

## Infrastructure and dependency limitations

Phase 1 previously verified root dev serving on ports 3000 and 4000; watch restart was not verified. Phase 2 runtime checks used compiled servers.

Docker/psql/redis-server are not available on PATH and no local database/cache listeners were observed. Compose YAML syntax was parsed using the installed Prettier YAML parser; Docker Compose runtime/schema validation and PostgreSQL/Redis/BullMQ runtime connectivity were NOT RUN. App Dockerfiles are deferred to the deployment phase.

npm audit reports 9 packages: 2 low, 1 moderate, 6 high. Production-only audit reports 4 high through Prisma, @prisma/config, deepmerge-ts and mysql2. Although Prisma CLI is declared a devDependency, @prisma/client's optional peer causes npm to include it in the production audit. Do not describe production audit as clean. The other 5 findings are in the existing @nestjs/mau development tree. Prisma pins affected transitive versions; no forced downgrade, prerelease upgrade, or override was applied.

npm also warns of unapproved dependency lifecycle scripts for Prisma, its engines, and optional msgpackr-extract. Generation/build/tests work in this environment; no blanket script approval was added. Vitest reports the existing vite-tsconfig-paths native-support warning.

Phase 3 implementation is complete with the runtime limitations above. Phase 4 (Customers + Suppliers) has not started and requires separate authorization.
