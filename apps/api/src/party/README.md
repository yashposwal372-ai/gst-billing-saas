# A07 Party boundary

A07 keeps customers and suppliers inside the existing `apps/api` NestJS modular monolith while making Party the internal Clean Architecture boundary for future extraction.

- `domain` contains framework-neutral Party records and result contracts for Customer and Supplier.
- `application` contains use-case services and repository ports. Tenant scope is explicit through the authenticated user context passed to each use case, and repository methods require the scoped operation shape rather than an unscoped `findById(id)` style API.
- `infrastructure` implements the repository ports with the existing Prisma Customer and Supplier tables. It preserves current Decimal, uniqueness, active flag, owner scoping, summary and error behavior.
- `presentation` is intentionally empty in A07 because the existing `/customers` and `/suppliers` controllers remain as compatibility presentation adapters. They call thin legacy services, and those services delegate to the Party application layer.

A07 does not add a physical service, HTTP calls between modules, Kafka, outbox/inbox, Redis cache, Prisma schema changes, migrations, frontend routing changes or Gateway internal-context authorization. A08 can extract this boundary later after defining service contracts and reference/read-model strategy for invoices, finance, documents, POS and reports.