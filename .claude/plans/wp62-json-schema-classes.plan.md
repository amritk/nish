---
name: WP62 — Nish classes from a JSON Schema (proposal, docs only)
overview: A JSON Schema says a shape, prose, defaults and rules; a hand-written typed JSON class keeps only the shape. Propose `nish schema`, a generator that writes Nish classes from a draft 2020-12 schema or OpenAPI 3.1 components, with every keyword typed, checked through WP61's constraints literal, kept as JSDoc, or refused with its JSON Pointer. This PR writes the design note and roadmap page and changes no compiler code.
stages:
  - id: s1-proposal
    title: S1 — the WP62 proposal (docs only)
    goal: docs/wp62-json-schema-classes.md and docs/roadmap/wp62-json-schema-classes.md exist, every claim about the compiler and std checked at 798636cb, registered in the indexes, aligned with WP61 (proposed).
    verification: npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    todos:
      - id: research-typed-json
        content: What a typed JSON class can say today (field kinds, the options literal, strict decode, encoding every field, refusals) with anchors — see S1 — the WP62 proposal
        status: completed
      - id: research-wp61
        content: Read WP61's proposal (constraints, coerce, its generator sketch) and follow its spelling — see S1 — the WP62 proposal
        status: completed
      - id: design-note
        content: Write docs/wp62-json-schema-classes.md, the keyword-by-keyword table for draft 2020-12 and OpenAPI 3.1, defaults, names, round trip, how it runs, stages — see S1 — the WP62 proposal
        status: completed
      - id: roadmap-page
        content: Write docs/roadmap/wp62-json-schema-classes.md, four unticked stages, S4 ending in *(owner's decisions)*; its index rows, scalar route, MASTER_PLAN and README rows — see S1 — the WP62 proposal
        status: completed
---

# WP62 — Nish classes from a JSON Schema (proposal)

## S1 — the WP62 proposal

Owns: `docs/wp62-json-schema-classes.md`,
`docs/roadmap/wp62-json-schema-classes.md`, `docs/roadmap/index.md`,
`scalar.config.json`, `docs/MASTER_PLAN.md`, `docs/README.md`,
`.claude/plans/wp62-json-schema-classes.plan.md`.

One PR, docs only. No file under `src/`, `std/`, `runtime/`, `tests/` or
`bench/` changes.

Stages proposed (unticked on the roadmap page):

- S1: `nish schema` for plain objects, annotations and defaults
- S2: `$ref`, maps, nullables and tagged unions
- S3: validation keywords onto WP61's `constraints`
- S4: the corpus, the guide page and the round trip *(owner's decisions)*
