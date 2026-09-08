# GST Billing & Business Management SaaS App

## Locked product and architecture

Build a production-oriented SaaS for Indian businesses, phase by phase. Authentication and business onboarding are implemented through Phase 2. Eventual scope includes GST billing, business documents, parties, inventory, payments, accounting, reports, portals, staff, AI, subscriptions, and administration. These later product features are not implemented.

- Frontend: Next.js + React + TypeScript + Tailwind CSS in apps/web, with Zod validation.
- Backend: modular NestJS + TypeScript REST API in apps/api. NestJS owns core business logic and database access. Do not move business logic into Next.js API routes or Server Actions.
- PostgreSQL is the source of truth, accessed through Prisma only in NestJS. Next.js must never connect directly to PostgreSQL.
- Redis supports cache infrastructure; BullMQ uses Redis for future background work. Avoid unnecessary distributed microservices.
- Docker Compose supplies local services. Turborepo and npm workspaces (apps/*, packages/*) orchestrate the monorepo.
- Local URLs: frontend http://localhost:3000; backend http://localhost:4000/api/v1; health http://localhost:4000/api/v1/health.

## Verified Phase 2 implementation: 2026-09-08

- Continued the existing Phase 2 working tree; no authentication rewrite, reset, commit, push or Phase 3 work. The Phase 1 section below is historical; this section supersedes its auth/schema/test status.
- Argon2id via @node-rs/argon2: memoryCost 19456 KiB, timeCost 2, parallelism 1. jose signs HS256 access JWTs with issuer/audience checks and 15-minute expiry. Missing local JWT_SECRET generates a per-process key. JWT_REFRESH_SECRET is unused but retained in existing production configuration validation.
- Refresh tokens use 32 cryptographically random bytes and SHA-256 hash storage. AuthSession has a fixed 30-day expiry; rotation consumes a token atomically in a Serializable transaction with bounded P2034 retries. Replay commits session revocation. Guards check active user, session expiry/revocation and authVersion on every authenticated request. Logout revokes the session; password reset increments authVersion and revokes all sessions.
- Access and refresh cookies are HttpOnly, SameSite=Lax, host-only; production uses Secure and __Host-/__Secure- names. Access path is /; refresh path is /api/v1/auth. Cookie clearing matches paths/options. Production requires a same-site HTTPS frontend/API deployment. CORS permits only the configured frontend origin with credentials; all auth/business writes require exact Origin plus X-CSRF-Protection: 1.
- express-rate-limit limits auth writes to 30/IP/15 minutes, excluding GET/OPTIONS; in-memory store only. Distributed limiting and proxy configuration are not implemented. Safe user selection omits hashes/status/version. Error logging omits payloads/secrets.
- Prisma models: User, AuthSession, RefreshToken, PasswordResetToken, EmailVerificationToken, Business, BusinessMember. Unique normalized email, GSTIN, token hashes and user/business membership; expiry and relation indexes. User deletion cascades auth/membership records; business deletion cascades memberships and sets currentBusinessId null. No later-phase models.
- Business creation, OWNER membership and conditional currentBusinessId assignment share a transaction. Current-business read/update enforce trusted user ID, current business and OWNER membership; client tenant assignment is rejected. Onboarding stores address/GST/default invoice/bank details with backend DTO and cross-field validation; no government/bank verification or billing logic.
- Auth API under /api/v1: POST /auth/signup, /auth/login, /auth/refresh, /auth/logout, /auth/forgot-password, /auth/reset-password, /auth/verify-email, /auth/request-verification; GET /auth/me. Business API: POST /businesses, GET /businesses/current, PATCH /businesses/current (full DTO).
- Frontend routes: /signup, /login, /forgot-password, /reset-password, /verify-email, /onboarding, /welcome. React auth context supports loading/authenticated/unauthenticated/error states; credentials included, one refresh promise per tab and Web Locks where available, retry and logout. Tokens are not stored in browser JS storage. Three-step onboarding and minimal completion page only; root starter preserved. Source-reviewed responsive layout, labels and keyboard controls; no interactive browser verification.
- Reset tokens expire after 30 minutes, verification after 24 hours; single-use and previous requests invalidated. Email delivery is NOT configured. Local-only auth:local-token utility now consumes tokens internally without printing them; reset password comes from redirected stdin. It refuses production/remote DB hosts. Live utility execution is unverified.
- npm.cmd install succeeded; npm ls found no missing declared dependencies. Lockfile adds Phase 2 dependencies only. Prisma format/validate/generate passed; fresh offline migration SQL exactly matches 20260907180000_phase2_auth_onboarding. Migration application NOT RUN.
- Root lint/typecheck/build passed. API unit: 56 passed. HTTP/e2e: 15 passed including four foundation tests; one PostgreSQL integration test skipped without TEST_DATABASE_URL (requires a migrated dedicated *_test database). Mock tests are not evidence of live transaction/concurrency behavior.
- Compiled frontend / and all seven Phase 2 pages, API /api/v1 and /api/v1/health returned HTTP 200; smoke servers stopped. Docker/psql/redis-server unavailable on PATH; no local PostgreSQL/Redis listeners observed. PostgreSQL persistence, migration runtime, Redis/BullMQ connectivity remain unverified.
- Fresh audits: production 4 high; full 9 (2 low, 1 moderate, 6 high), in existing Prisma and @nestjs/mau chains. Initial sandbox network failure resolved with approved audit retry. No forced fixes/upgrades. Existing pending lifecycle-script and vite-tsconfig-paths warnings remain.
- Implementation and feasible validation complete with the above runtime/delivery limitations. Phase 3 requires explicit new authorization.

## Historical Phase 1 implementation: 2026-09-07

- Runtime: Node 24.19.0, npm 11.17.0. Root requires Node >=24 and declares npm 11.17.0 in devEngines. PowerShell blocks npm.ps1 here; use npm.cmd.
- Frontend: Next.js 16.3.4, React 19.2.8, TypeScript 7.0.2. Existing App Router/CSS module starter preserved. Tailwind 4.3.3 uses PostCSS, shared UI source scanning, global typography/box-sizing/focus styles. Zod 4.5.4 validates the public API URL in apps/web/lib/api.ts.
- Backend: NestJS 12.0.1, installed TypeScript 6.0.3, strict NodeNext/ESM (strictPropertyInitialization remains disabled). ConfigModule is global; Environment validates configuration and safe development defaults. ConfigService controls port and CORS origin. Shared configureApp applies api/v1, Helmet, and global ValidationPipe with transformation, whitelist, forbidNonWhitelisted, and forbidUnknownValues.
- HealthModule returns status ok/service gst-billing-api. This is liveness only, not database/cache readiness. Starter GET response is preserved at /api/v1.
- Prisma/client/adapter-pg 7.10.0 configured with prisma.config.ts, PostgreSQL datasource and generated ESM TypeScript client under ignored apps/api/src/generated/prisma. DatabaseService uses the PostgreSQL driver adapter, lazy connection and disconnect lifecycle. Schema has no business models or migrations.
- Redis uses ioredis 6.0.0 with lazy connection, bounded producer retries, sanitized error logs and shutdown cleanup. QueueService uses BullMQ 6.3.4, creating named producers only on demand. No jobs/workers/queues start at bootstrap. Future workers need separate connections with maxRetriesPerRequest null. Queue providers close before shared Redis disconnects.
- compose.yaml defines loopback-bound PostgreSQL 17 and Redis 7, healthchecks and persistent volumes. Redis uses append-only persistence and noeviction. App Dockerfiles remain deferred to deployment.
- Root dev starts both apps; lint, typecheck, build and legacy check-types tasks are aligned. API generation runs in build/dev/typecheck and prehooks for start/start:dev/start:debug/test:e2e. Turbo caches dist/** and Next.js outputs and accounts for NEXT_PUBLIC_API_URL; dev is persistent/non-cached with explicit environment passthrough.
- Root README is the development guide. App READMEs link to it. Environment example files exist at root and in both apps; local .env files were not created. Ignore rules protect .env* while allowing .env.example, generated Prisma source, and tsbuildinfo.
- No authentication, onboarding, business models, GST calculation, or other Phase 2+ functionality was implemented.

## Environment and commands

Copy apps/api/.env.example to apps/api/.env and apps/web/.env.example to apps/web/.env.local. Optional root .env configures Compose. Backend defaults match local-only Compose credentials. Production requires explicit service/origin settings, HTTPS frontend origin, and distinct non-placeholder JWT secrets of at least 32 characters. JWT_SECRET signs access tokens; JWT_REFRESH_SECRET remains unused with opaque refresh tokens but is still required by production validation. Never commit real secrets or expose them as NEXT_PUBLIC_*.

From root: npm install; npm run prisma:generate --workspace api; docker compose up -d (when Docker available); npm run infra:check --workspace api; npm run dev.

Validation commands: npm run lint; npm run typecheck; npm run build; npm run test --workspace api; npm run test:e2e --workspace api; npm run prisma:validate --workspace api; npm audit; npm audit --omit=dev; git diff --check. Use npm.cmd where PowerShell requires it.

infra:check explicitly runs SELECT 1 through Prisma and Redis PING with nonzero exit on failure. Health/builds/tests do not require running infrastructure. Future migrations use npm run prisma:migrate --workspace api -- --name <name> only after authorized schema changes.

## Historical Phase 1 validation and limitations

- Root npm install, lint, typecheck, production build, Prisma generation/schema validation passed. API unit tests: 14 passed; e2e: 4 passed (health/prefix, CORS, Helmet, DTO transformation/rejection, lazy Redis).
- Root dev served HTTP 200 on web :3000 and API :4000/api/v1/health. Windows sandbox blocked Nest watch process termination during shutdown; second Ctrl+C stopped Turbo, and subsequent process/port inspection found no app processes/listeners remaining. Do not claim watch restart was verified.
- Docker, psql, redis-server not found on PATH; no local PostgreSQL/Redis listeners observed. Compose YAML parsed with installed Prettier YAML parser. Docker Compose schema/runtime validation and PostgreSQL/Redis/BullMQ connectivity were NOT RUN. Phase 1 configuration is implemented; runtime infrastructure verification remains outstanding.
- Full npm audit: 9 vulnerable packages (2 low, 1 moderate, 6 high). Production-only audit: 4 high through prisma/@prisma/config/deepmerge-ts/mysql2. Prisma CLI is declared dev-only but @prisma/client's optional peer includes it in the production audit. Other 5 findings remain in @nestjs/mau development tooling. Upstream pins affected transitives; no forced fixes, overrides or prerelease upgrades were applied.
- npm warns about unapproved lifecycle scripts for prisma, @prisma/engines and optional msgpackr-extract; generation/build/tests succeeded without blanket approval. Vitest retains the existing vite-tsconfig-paths warning.
- Pre-existing Git state: apps/docs absent with 20 tracked deletions; package-lock.json modified; apps/api/ and AGENTS.md untracked. Preserve these user changes. Phase 1 modified the existing untracked API/context and added infrastructure/frontend/docs changes. No commits made.

## Development phases

1. Foundation and architecture (implemented, limitations above; stop here).
2. Authentication + Business onboarding (implemented; runtime limitations above; stop here).
3. Dashboard + Navigation.
4. Customers + Suppliers.
5. Products + Inventory.
6. GST Billing + Invoice Generation.
7. Sales + Purchases.
8. Payments + Expenses + Banking.
9. GST Reports.
10. POS Billing.
11. Warehouses + Branches.
12. Employees + Permissions.
13. Reports + Analytics.
14. Notifications + Invoice Sharing.
15. AI Business Assistant.
16. Subscription SaaS System.
17. Super Admin.
18. Security + Performance + Testing.
19. Docker + Production Deployment.

Stop after the explicitly requested task/phase. Phase 3 requires new user authorization.

## Implementation rules

- Inspect before editing; preserve user changes and working behavior. Make the smallest correct change; avoid unnecessary rewrites, deleting apparently unused files, resets, or commits without instruction.
- Preserve TypeScript strictness, responsive design, reusable components, and UI/business-logic separation.
- Use NestJS DTO validation. Validate sensitive values and recalculate financial/invoice/GST totals server-side; never trust frontend totals.
- Preserve tenant/business isolation. Use transactions for financial/inventory operations where required, justified indexes, pagination, and avoid N+1 queries. Do not invent tenant schema before its phase.
- Never expose backend secrets through Next.js public environment variables.
- Never fake government integrations, IRNs, government E-Way Bill numbers, or official GST return filing. Such claims require a real authorized integration. Clearly label mock/demo data.
- Run appropriate validation before declaring success; report missing commands, failures, warnings and untested services honestly.
- Never run npm audit fix --force or destructive dependency upgrades. Do not run writing format scripts during read-only audits.
