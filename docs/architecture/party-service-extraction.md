# A08 party-service extraction notes

A07 establishes Party as an internal Clean Architecture boundary only. A08 may physically extract this boundary after an explicit approval.

The future party-service ownership candidate is:

- Customer records and customer code allocation
- Supplier records and supplier code allocation
- Party list/search/detail/update/deactivate semantics
- Tenant-scoped GSTIN uniqueness and format-only GSTIN/PAN validation
- Opening balance fields as entered master-data values, not ledger transactions

Current cross-domain references remain in the monolith during A07:

- invoices store `customerId` and customer snapshots
- sales documents and returns store customer references and snapshots
- purchase documents, expenses and payments store supplier references and snapshots
- finance, GST reports, POS and dashboard query customer/supplier IDs or historical snapshots directly

A08 must define service contracts, reference validation, read-model or snapshot strategy, and migration sequencing before any process/database extraction. A07 does not add internal HTTP calls, Gateway signed context consumption inside the monolith, Kafka, outbox/inbox, a service database or a service-owned Prisma schema.