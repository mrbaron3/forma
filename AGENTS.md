# Working agreement

This repository owns the standalone Forma product. It must remain usable without any
particular consumer repository.

## Non-negotiable boundaries

- Public contracts are language-neutral JSON Schema. Do not expose another product's internal
  database records, lifecycle enums, filesystem paths, or runtime types.
- The engine owns design requests, design revisions, design-system deltas, preview artifacts, and
  human design decisions. Integrators retain ownership of their issues, pull requests, and delivery
  workflow.
- Human approval is bound to an immutable design-revision digest. Any material change creates a new
  revision and invalidates the old approval.
- A page begins with purpose, effort budget, and attention hierarchy. Every visible region and
  element must trace to a user task, requirement, safety constraint, or explicit product rationale.
- UX authors describe backend capabilities required by an interaction. They do not invent concrete
  endpoints, tables, or provider-specific infrastructure.
- A live integration must have one authoritative writer. Never introduce database sharing or
  dual-write as a shortcut for integration.
- Consumer adapters, consumer issue lifecycles, and consumer-specific dogfood tasks belong to the
  consumer repository. Forma tasks must not depend on a consumer issue or implementation.

## Documentation and validation

- Product and planning prose is written in Japanese; schema identifiers and protocol fields remain
  in English.
- Record durable architectural decisions in `docs/decisions/`; do not silently rewrite their
  rationale.
- Keep `docs/HANDOFF.md` current whenever a milestone, decision, blocker, or next action changes.
- Run `npm test` after changing schemas, examples, or cross-artifact integrity rules.
