# A08 Party compatibility layer

The monolith keeps public `/api/v1/customers` and `/api/v1/suppliers` controllers as compatibility adapters. Production execution delegates over HTTP to `apps/party-service` through `PartyClientPort`.

The previous local Prisma repositories are no longer wired into the monolith production module. They are retained only as historical source during review and are not exported by `PartyModule`.
