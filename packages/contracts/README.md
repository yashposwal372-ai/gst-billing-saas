# HTTP transport foundation

Types only: no framework, database, domain, service or infrastructure dependency.
Do not move business logic, ORM models, controllers or existing DTOs here wholesale.
The current OpenAPI source belongs to apps/api; docs/openapi/api-v1.json is its
reviewed generated public baseline. These small types align with existing envelopes
and do not change runtime handling. Do not use Page for nonpaginated summaries.

Request/correlation IDs and trace propagation remain future A05/A06 work; no active
header constants claim that propagation exists. Events are deferred to A11.
