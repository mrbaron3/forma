# Working agreement

This repository owns the standalone Forma product. It must remain usable without any
particular consumer repository.

## Non-negotiable boundaries

- Design Seed package/stage contracts and reusable JSON bodies are language-neutral JSON Schema;
  target product and Forma service HTTP transports are separate OpenAPI documents that reference
  their schemas. Do not expose another product's internal database records, lifecycle enums, host
  filesystem paths, or runtime types.
- The primary output is an executable Design Seed file tree, not an abstract JSON bundle or a
  separately regenerated preview. Browser review and ZIP export must use the same payload file
  bytes; export may add only a detached approval receipt that references the payload manifest.
- The engine owns requirement snapshots, stage revisions, draft workspaces, authoring provenance,
  preview evidence, package manifests, exports, and human design decisions. Integrators retain
  ownership of their repositories, issues, pull requests, implementation, and delivery workflow.
- Human approval is bound to an immutable stage-revision or package-manifest digest. A material
  upstream-stage change creates a new revision and invalidates dependent downstream approval.
- A page begins with purpose, effort budget, and attention hierarchy. Every visible region and
  element must trace to a user task, requirement, safety constraint, or explicit product rationale.
- Design foundation precedes components; component contracts and UI-facing API precede integrated
  screens. Do not introduce screen-local literal tokens, component forks, direct HTTP calls, or
  schema-external mock fixtures as shortcuts.
- Experience Authors describe backend capabilities required by an interaction and do not invent
  concrete endpoints. Forma's API Contract Designer maps those capabilities to the target product's
  UI-facing OpenAPI. It must not invent tables, service topology, providers, or internal-only APIs.
- Design Requests never select an agent provider. Versioned operational profiles route
  application-owned authoring ports; implicit fallback and multiple writers for one generated file
  are forbidden. Exported visual assets require source, license status, purpose, trace, and exactly
  one author invocation.
- Forma Service API, Design Seed target-product OpenAPI, and integrator Control API are distinct contract
  families. Never copy them into a shared dual-written specification.
- A live integration must have one authoritative writer. Never introduce database sharing or
  dual-write as a shortcut for integration. After repository handoff, the target repository is the
  sole writer for its Design Seed files and target OpenAPI.
- Consumer adapters, consumer issue lifecycles, and consumer-specific dogfood tasks belong to the
  consumer repository. Forma tasks must not depend on a consumer issue or implementation.

## Documentation and validation

- Product and planning prose is written in Japanese; schema identifiers and protocol fields remain
  in English.
- Record durable architectural decisions in `docs/decisions/`; do not silently rewrite their
  rationale. Move superseded or obsolete ADRs to `docs/decisions/archive/` with an updated status
  line and intact rationale.
- Keep `docs/DESIGN_SEED_PACKAGE.md` authoritative for output layout, stage gates, manifest, review,
  export, and handoff semantics.
- Commit settled decisions only. Progress snapshots, current-position summaries, next-action lists,
  and issue backlogs do not belong in the repository; the issue tracker and git history own them.
- Run `npm test` after changing schemas, examples, or cross-artifact integrity rules.
