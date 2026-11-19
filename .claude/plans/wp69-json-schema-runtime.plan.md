---
name: WP69 — JSON Schema validation at run time, with external references
overview: A Spectral-compatible linter written in Nish validates document nodes against schemas that arrive at run time (ruleset options, the document's own schemas, the OpenAPI and AsyncAPI meta-schemas), which WP61 and WP62 cannot cover. Build nish/json-schema in std, dialects draft-04 to 2020-12 as ajv reads them, errors with ajv's fields, a valid/invalid/unusable result, external references loaded outside the validator by a file and an HTTP loader, and limits for attacker-written schemas.
stages:
  - id: s0-proposal
    title: S0 — the WP69 proposal (docs only)
    goal: docs/wp69-json-schema-runtime.md and docs/roadmap/wp69-json-schema-runtime.md exist, every claim anchored at d0f446d1 or a pinned upstream commit, registered in the indexes, WP61's and WP62's "not planned" lines pointing here.
    verification: npm run lint && node docs/check-links.mjs
    todos:
      - id: research-spectral
        content: Read Spectral's schema function (packages/functions/src/schema/ajv.ts, index.ts at 16aae2b6f444) for dialects, allErrors, formats, strict, unicodeRegExp, ajv-errors and better-ajv-errors — see S0
        status: completed
      - id: design-note
        content: Write the design note, §1 to §8 — see S0
        status: completed
      - id: roadmap-page
        content: Roadmap page with five unticked stages, the index rows, the scalar route, MASTER_PLAN and docs/README rows, WP61/WP62 pointers — see S0
        status: completed
  - id: s1-core
    title: S1 — nish/json-schema for 2020-12
    goal: std/json-schema.ts compiles a schema held in a JsonDocument and validates any value of any JsonDocument; in-memory $ref, $defs, $id, $anchor, $dynamicRef; first error or all, with keyword, instancePath, schemaPath, params and the value handle; formats when asked via nish/json-format; valid, invalid or unusable.
    verification: node tests/run.js json-schema && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s1-walk
        content: The walk over an explicit stack (no native recursion), every applicator and assertion keyword of 2020-12, JSON-Schema-Test-Suite 2020-12 green with skips listed — see docs/wp69-json-schema-runtime.md §4.2 to §4.5
        status: pending
      - id: s1-limits
        content: Depth cap, $ref cycle that consumes no instance detected at compile, per-validation work budget, compile caps; each with a case; rows in docs/security/json.md — see §4.9
        status: pending
      - id: s1-docs
        content: Doc comments with @param and @returns, std/README.md row, guide page, docs/reference/ regenerated — see §7
        status: pending
  - id: s2-dialects
    title: S2 — draft-04, draft-06, draft-07 and 2019-09, and pattern translation
    goal: The dialect table of §4.2, chosen by the caller or by $schema, draft-07 when neither says; the caller's (source) => string translation applied to every pattern and patternProperties key before regexCompile.
    verification: node tests/run.js json-schema && npm run lint
    todos:
      - id: s2-suites
        content: JSON-Schema-Test-Suite for draft-04, draft-06, draft-07 and 2019-09 green, skips listed — see §4.2 and §6
        status: pending
      - id: s2-patterns
        content: The pattern hook, and a refused pattern making the schema unusable with its pointer — see §4.6 and §4.8
        status: pending
  - id: s3-refs-file
    title: S3 — external references and the file loader
    goal: compile answers the absolute URIs it is missing, addResource takes each, compile again until none; std/json-schema-file.ts loads file: and relative references as YAML or JSON with an optional realpath root.
    verification: node tests/run.js json-schema && npm run lint
    todos:
      - id: s3-loop
        content: The missing/addResource loop with $id base resolution — see §4.7
        status: pending
      - id: s3-file
        content: The file loader under fs.read only, the root fence, the extension rules — see §4.7 and §6
        status: pending
  - id: s4-http
    title: S4 — the HTTP loader and its security record
    goal: std/json-schema-http.ts over nish/net/fetch, off unless enabled, allowedHosts, private/loopback/link-local refused after resolution and on every redirect unless allowPrivateHosts, caps on bytes, time and fetches, one fetch per URI; a docs/security/ record and index row.
    verification: node tests/run.js json-schema && node scripts/security-scope.mjs && npm run lint
    todos:
      - id: s4-loader
        content: The loader and its tests against a local HTTP server — see §4.7 and §6
        status: pending
      - id: s4-record
        content: The security record with each finding's before/after test, its index row in docs/security/README.md — see §4.9
        status: pending
  - id: s5-differential
    title: S5 — the ajv differential and the docs
    goal: Verdicts and, with all errors, keyword, instancePath and schemaPath equal to ajv 8 configured as Spectral configures it, over the OpenAPI and AsyncAPI meta-schemas and a document corpus; guide page and reference complete.
    verification: node tests/run.js json-schema && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s5-decision
        content: Owner decides whether ajv is a dev dependency or its answers are committed once (open question) — see §7
        status: pending
      - id: s5-corpus
        content: Vendored meta-schemas with their licences in THIRD_PARTY_NOTICES.md, the differential, the guide page — see §6
        status: pending
---

# WP69 — JSON Schema validation at run time (plan)

## S0 — the WP69 proposal

Owns: `docs/wp69-json-schema-runtime.md`,
`docs/roadmap/wp69-json-schema-runtime.md`, `docs/roadmap/index.md`,
`scalar.config.json`, `docs/MASTER_PLAN.md`, `docs/README.md`, the "not
planned" lines of WP61 and WP62, and this plan.

One PR, docs only, shared with WP70's proposal. No file under `src/`, `std/`,
`runtime/`, `tests/` or `bench/` changes.

## S1 to S5

Each stage is specified in the design note's §7 and lands in its own PR that
ticks its box on the roadmap page. S2, S3 and S4 follow S1 in order; S5 can
start once S2 lands.
