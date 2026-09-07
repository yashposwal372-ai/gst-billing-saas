# GST Billing & Business Management SaaS

Phase 1 foundation for Indian business billing and management. No authentication or business features are implemented.

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

JWT_SECRET and JWT_REFRESH_SECRET are unused Phase 2 placeholders and may be empty locally. Production requires explicit infrastructure/origin settings and distinct non-placeholder secrets of at least 32 characters. Production frontend origin must use HTTPS. Never use the local example credentials in production. Validation errors list variable names, never values.

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

`check-types` remains supported. API build/dev/typecheck and start/e2e prehooks generate the Prisma client. After a build, `npm run start:prod --workspace api` starts compiled code. Prisma 7 uses prisma.config.ts and the PostgreSQL driver adapter; generated TypeScript is ignored and compiled into API dist. The schema intentionally has no business models or migrations. In Phase 2, use `npm run prisma:migrate --workspace api -- --name <name>` after designing authorized models and starting PostgreSQL.

Tailwind 4 uses @tailwindcss/postcss and CSS imports; existing App Router/CSS modules remain. Zod validates frontend API configuration. No frontend form/test framework was added.

## Verified status and limitations (2026-09-07)

Builds, lint, typechecks, 14 unit tests and 4 e2e tests passed during implementation. Root dev served HTTP 200 on ports 3000 and 4000. A Windows sandbox denied Nest watch process termination during shutdown; a second interrupt stopped the task tree, and subsequent inspection found no remaining app listeners/processes.

Docker/psql/redis-server are not available on PATH and no local database/cache listeners were observed. Compose YAML syntax was parsed using the installed Prettier YAML parser; Docker Compose runtime/schema validation and PostgreSQL/Redis/BullMQ runtime connectivity were NOT RUN. App Dockerfiles are deferred to the deployment phase.

npm audit reports 9 packages: 2 low, 1 moderate, 6 high. Production-only audit reports 4 high through Prisma, @prisma/config, deepmerge-ts and mysql2. Although Prisma CLI is declared a devDependency, @prisma/client's optional peer causes npm to include it in the production audit. Do not describe production audit as clean. The other 5 findings are in the existing @nestjs/mau development tree. Prisma pins affected transitive versions; no forced downgrade, prerelease upgrade, or override was applied.

npm also warns of unapproved dependency lifecycle scripts for Prisma, its engines, and optional msgpackr-extract. Generation/build/tests work in this environment; no blanket script approval was added. Vitest reports the existing vite-tsconfig-paths native-support warning.

Phase 2 (Authentication + Business Onboarding) requires separate authorization.
