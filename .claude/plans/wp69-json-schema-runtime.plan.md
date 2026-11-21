---
name: WP69 — JSON Schema validation at run time, with external references
overview: A Spectral-compatible linter written in Nish validates document nodes against schemas that arrive at run time (ruleset options, the document's own schemas, the OpenAPI and AsyncAPI meta-schemas), which WP61 and WP62 cannot cover. Build nish/json-schema in std, dialects draft-04 to 2020-12 as ajv reads them, errors with ajv's fields, a valid/invalid/unusable result, external references loaded outside the validator by a file and an HTTP loader, and limits for attacker-written schemas.
spec: docs/wp69-json-schema-runtime.md
priority: 90
labels: [ready]
issue: 2018
stages:
  - id: s1-core
    title: WP69 S1 — nish/json-schema for draft 2020-12
    goal: std/json-schema.ts compiles a schema held in a JsonDocument and validates any value of any JsonDocument under 2020-12, with in-memory references, the first error or all with ajv's fields, formats when asked, a valid/invalid/unusable result and bounded work.
    verification: node tests/run.js std_json_schema && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    issue: 2023
    todos:
      - id: s1-walk
        content: Add std/json-schema.ts with the explicit-stack walk, every 2020-12 applicator and assertion keyword, in-memory references and the error record — see WP69 S1 — nish/json-schema for draft 2020-12
        status: pending
      - id: s1-suite
        content: Pack the 2020-12 JSON-Schema-Test-Suite files into tests/json-schema-suite and run them from tests/link/std_json_schema, skips listed with reasons — see WP69 S1 — nish/json-schema for draft 2020-12
        status: pending
      - id: s1-limits
        content: Add the depth cap, the compile-time ref-cycle check, the work budget and the compile caps, each with a case, as rows in docs/security/json.md — see WP69 S1 — nish/json-schema for draft 2020-12
        status: pending
      - id: s1-docs
        content: Write doc comments with every param and returns, the std/README.md row, the guide page with its route, and regenerate docs/reference — see WP69 S1 — nish/json-schema for draft 2020-12
        status: pending
  - id: s2-dialects
    title: WP69 S2 — draft-04, draft-06, draft-07 and 2019-09, and pattern translation
    goal: The dialect table chosen by the caller or by $schema (draft-07 when neither says), and the caller's (source) => string translation applied to every pattern and patternProperties key before regexCompile.
    verification: node tests/run.js std_json_schema && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    issue: 2026
    todos:
      - id: s2-table
        content: Add the dialect table and $schema detection to std/json-schema.ts — see WP69 S2 — draft-04, draft-06, draft-07 and 2019-09, and pattern translation
        status: pending
      - id: s2-suites
        content: Pack and pass JSON-Schema-Test-Suite for draft-04, draft-06, draft-07 and 2019-09, skips listed — see WP69 S2 — draft-04, draft-06, draft-07 and 2019-09, and pattern translation
        status: pending
      - id: s2-patterns
        content: Add the pattern hook, and make a refused pattern leave the schema unusable with its pointer and the regex error — see WP69 S2 — draft-04, draft-06, draft-07 and 2019-09, and pattern translation
        status: pending
  - id: s3-refs-file
    title: WP69 S3 — external references and the nish/json-schema-file loader
    goal: compile answers the absolute URIs it is missing, addResource takes each, compile again until none; std/json-schema-file.ts loads file and relative references as YAML or JSON under fs.read, with an optional realpath root.
    verification: node tests/run.js std_json_schema && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    issue: 2029
    todos:
      - id: s3-loop
        content: Add missing() and addResource() with $id base resolution to std/json-schema.ts — see WP69 S3 — external references and the nish/json-schema-file loader
        status: pending
      - id: s3-file
        content: Add std/json-schema-file.ts with the extension rules and the root fence, tested on a local file tree — see WP69 S3 — external references and the nish/json-schema-file loader
        status: pending
  - id: s4-http
    title: WP69 S4 — the nish/json-schema-http loader and its security record
    goal: std/json-schema-http.ts over nish/net/fetch, off unless enabled, allowedHosts, private, loopback and link-local addresses refused after resolution and on every redirect unless allowPrivateHosts, caps on bytes, time and fetches, one fetch per URI; it lands with its docs/security record and index row.
    verification: node tests/run.js std_json_schema && node scripts/security-scope.mjs && npm run check && npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    issue: 2032
    todos:
      - id: s4-loader
        content: Add std/json-schema-http.ts and its tests against a local HTTP server — see WP69 S4 — the nish/json-schema-http loader and its security record
        status: pending
      - id: s4-record
        content: Write docs/security/json-schema-http.md with each finding's before/after test, its index row and its route — see WP69 S4 — the nish/json-schema-http loader and its security record
        status: pending
  - id: s5-differential
    title: WP69 S5 — the ajv differential over the meta-schemas
    goal: Verdicts and, with all errors, keyword, instancePath and schemaPath equal to ajv 8 configured as Spectral configures it, over the vendored OpenAPI and AsyncAPI meta-schemas and a document corpus; the guide page and reference complete.
    verification: node tests/run.js std_json_schema && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    issue: 2033
    todos:
      - id: s5-corpus
        content: Vendor the OpenAPI 2.0, 3.0, 3.1 and AsyncAPI 2.x and 3.0 meta-schemas and a document corpus, with their licences in THIRD_PARTY_NOTICES.md — see WP69 S5 — the ajv differential over the meta-schemas
        status: pending
      - id: s5-ajv-diff
        content: Add the answer generator with its --check mode, commit its answers beside the corpus, and the differential that reads them — see WP69 S5 — the ajv differential over the meta-schemas
        status: pending
      - id: s5-docs
        content: Complete the guide page and the std/README.md rows for all three modules — see WP69 S5 — the ajv differential over the meta-schemas
        status: pending
---

# WP69 — JSON Schema validation at run time (plan)

## Context

Design only so far: [the design note](../../docs/wp69-json-schema-runtime.md) is the spec, and its [§7](../../docs/wp69-json-schema-runtime.md#7-stages) lists the stages. A linter written in Nish validates nodes of a document against JSON Schemas it only meets at run time: a ruleset's `functionOptions.schema`, the document's own schemas, and the OpenAPI and AsyncAPI meta-schemas. [WP61](https://github.com/amritk/nish/issues/1869) (typed decode with constraints) and [WP62](https://github.com/amritk/nish/issues/1860) (classes generated from a schema at compile time) both list a run-time schema interpreter as not planned, and [§1](../../docs/wp69-json-schema-runtime.md#1-the-problem) says why neither can be stretched to it. Nothing here changes or waits on either of them ([§4.10](../../docs/wp69-json-schema-runtime.md#410-wp61-and-wp62-are-unchanged)).

Order: S1 first; S2, S3 and S4 follow it in that order; S5 can start once S2 lands. Every stage is `std/` only, needs no new construct, and does not touch `src/` (so the rolling freeze does not apply).

## WP69 S1 — nish/json-schema for draft 2020-12

**Spec:** [design note §4.1 to §4.5, §4.8 and §4.9](../../docs/wp69-json-schema-runtime.md#4-the-decisions), with the surface sketched in [§5](../../docs/wp69-json-schema-runtime.md#5-the-surface-as-a-sketch). Depends on nothing.

A new module, `std/json-schema.ts` (`nish/json-schema`), that compiles a schema held in a `JsonDocument` (`std/json-value.ts`) and validates a value of any `JsonDocument` against it, under draft 2020-12 only.

- **The walk** runs over an explicit stack, as `jsonEqual` does: no native recursion. It covers every 2020-12 applicator and assertion keyword, and in-memory `$ref`, `$defs`, `$id`, `$anchor` and `$dynamicRef`, reusing the keyword helpers that exist: `std/json-equal.ts` (`const`, `enum`, `uniqueItems`), `std/json-number.ts` (`minimum`, `maximum`, `multipleOf`), `std/json-pointer.ts` (`$ref` fragments), `std/regex.ts` (`pattern`, `patternProperties`) and `std/text.ts` (`codePointLength`).
- **Errors:** the first error, or all of them in ajv's order when the caller asks. Each error carries `keyword`, `instancePath`, `schemaPath` (through each `$ref` followed), `params` and the failing value's handle; no other library's sentences, and a `describe(error)` helper with a short text of its own ([§4.5](../../docs/wp69-json-schema-runtime.md#45-errors-carry-ajvs-fields-not-its-english)).
- **Formats** are annotations unless the caller asks to assert them; asserted, each is `nish/json-format`'s check, and an unknown name is ignored ([§4.4](../../docs/wp69-json-schema-runtime.md#44-formats-when-asked)).
- **The result** has three states: valid, invalid with its errors, or unusable with its reason ([§4.8](../../docs/wp69-json-schema-runtime.md#48-unusable-is-not-invalid)). Compile answers a `Result`; no input panics.
- **Limits** ([§4.9](../../docs/wp69-json-schema-runtime.md#49-untrusted-schemas-and-values)): a capped and reported depth; a `$ref` cycle that consumes no instance (`{ "$ref": "#" }` at the root) found at compile time and unusable; a per-validation budget of keyword evaluations, past which the result is unusable; caps on schema size, resources and `$ref` hops. Each limit has a case that passes it, and a row in [`docs/security/json.md`](../../docs/security/json.md); `std/json-schema.ts` joins that record's scope and its row in [`docs/security/README.md`](../../docs/security/README.md).

Tests: pack the draft 2020-12 files of JSON-Schema-Test-Suite, `optional/format` included, the way [`tests/json-schema-suite/pack.js`](../../tests/json-schema-suite/pack.js) packs the twelve it has (pinned commit, sha256 per file), and run them from a new `tests/link/std_json_schema` program. A skipped file or group is listed with its reason in the suite's README.

Docs in this PR (CLAUDE.md): a doc comment with a `@param` per parameter and `@returns` on every public declaration, the `std/README.md` row, a guide page under [`docs/guide/using-nish/`](../../docs/guide/using-nish/) with its route in `scalar.config.json`, and `docs/reference/` regenerated with `node scripts/gen-reference.mjs`.

## WP69 S2 — draft-04, draft-06, draft-07 and 2019-09, and pattern translation

**Spec:** [design note §4.2](../../docs/wp69-json-schema-runtime.md#42-dialects-as-ajv-has-them) and [§4.6](../../docs/wp69-json-schema-runtime.md#46-patterns-through-a-callers-translation). Depends on S1.

**Dialects.** Each schema is validated under one dialect: draft-04, draft-06, draft-07, 2019-09 or 2020-12. The caller names it, or the root's `$schema` does, and it is draft-07 when neither says, as Spectral does. One interpreter holds every keyword; the dialect is a table of which keywords are live and what a few of them mean: `$ref` beside other keywords (ignored before 2019-09), array `items` and `additionalItems` (before 2020-12), boolean `exclusiveMinimum`/`exclusiveMaximum`, `id` against `$id` and `dependencies` (draft-04), and `$recursiveRef` (2019-09) against `$dynamicRef` (2020-12). A dialect the module does not know makes the schema unusable.

**Patterns.** An optional capture-free top-level function reference, `(source: string) => string`, is applied to each `pattern` and `patternProperties` key before `regexCompile`, so a caller can turn Spectral's Annex B patterns (compiled without the `u` flag, so `{}` is a literal brace there) into ones `nish/regex` reads. `nish/regex` does not change: a pattern it refuses (lookaround, backreferences) makes the schema unusable, reporting the pattern's pointer and the regex error.

Tests: JSON-Schema-Test-Suite for draft-04, draft-06, draft-07 and 2019-09 packed beside the 2020-12 files and green, skips listed; a case for each dialect difference above chosen both by the caller and by `$schema`; a translated pattern, and a refused one with its pointer. The guide page and `docs/reference/` gain the dialect option and the pattern hook.

## WP69 S3 — external references and the nish/json-schema-file loader

**Spec:** [design note §4.7](../../docs/wp69-json-schema-runtime.md#47-external-references-without-io-in-the-validator). Depends on S1.

**The loop, in `std/json-schema.ts`.** The validator does no I/O. Compiling answers the absolute URIs, resolved against each `$id`'s base, that the schema references and does not hold (`missing()`). The caller loads each one by any means and adds it with `addResource(uri, document, root)`; compiling again answers what the added resources reference in turn, until nothing is missing. A resource that cannot be loaded is not a validation error: it makes the schemas that reach it unusable.

**The loader, `std/json-schema-file.ts` (`nish/json-schema-file`, `fs.read` only).** It resolves a `file:` URI or a relative reference against the referring resource's base and reads it: `.yaml`/`.yml` as YAML (through `std/yaml-json.ts`), `.json` as JSON, anything else as JSON then YAML. An optional root refuses a resolved path outside it, checked after `realpathSync`. It is its own module so a program that only validates in-memory schemas reaches no capability.

Tests, on a local file tree: relative and absolute references, `$id` bases, a chain of resources each naming the next, the extension rules, the root fence refusing `../` and a symlink out of the root, and a missing file leaving the schema unusable. The root fence and what it refuses get rows in [`docs/security/json.md`](../../docs/security/json.md), with `std/json-schema-file.ts` added to its scope. The guide page and `docs/reference/` gain the loop and the loader.

## WP69 S4 — the nish/json-schema-http loader and its security record

**Spec:** [design note §4.7](../../docs/wp69-json-schema-runtime.md#47-external-references-without-io-in-the-validator) (the HTTP loader) and [§4.9](../../docs/wp69-json-schema-runtime.md#49-untrusted-schemas-and-values). Depends on S3.

`std/json-schema-http.ts` (`nish/json-schema-http`, the `net` capability) loads the URIs S3's `missing()` answers, through `std/net/fetch.ts`. A ruleset or a linted document chooses those URIs, so this is attacker-facing code that reads the network.

- Off unless the caller enables it. It takes the three options a linter's resolver takes: `remote`, `allowedHosts` (a non-empty list implies `remote`) and `allowPrivateHosts`.
- Without `allowPrivateHosts`, a host that resolves to a private, loopback or link-local address is refused, checked on the resolved address and again on every redirect, so a ruleset or a document cannot make the program call an internal service.
- Caps on the bytes read, the time taken and the number of fetches; each URI is fetched once.

**This stage lands with its security record and index row, in the same PR** (CLAUDE.md, "Attacker-facing code ships with its security record"): a new `docs/security/json-schema-http.md` whose Scope table names `std/json-schema-http.ts`, with each finding fixed by a before/after test or recorded open; its row in [`docs/security/README.md`](../../docs/security/README.md)'s Areas table; and its route in the "Security records" group of `scalar.config.json`. The file is outside `std/net/`, so `node scripts/security-scope.mjs` does not require it: the record's scope must name it anyway. Every "only", "cannot" and "never" in the record is checked against what the code really matches.

Tests, against a local HTTP server started by the test: the loader off by default, a host outside `allowedHosts` refused, a private, a loopback and a link-local address refused, a redirect to one refused, `allowPrivateHosts` letting each through, every cap passed, and one fetch per URI. Checks prove behaviour by the exit status of the helper the test builds ([`.claude/testing.md`](../../.claude/testing.md#checks-that-spawn-a-process)). The guide page and `docs/reference/` gain the loader.

## WP69 S5 — the ajv differential over the meta-schemas

**Spec:** [design note §6](../../docs/wp69-json-schema-runtime.md#6-how-it-is-tested) and [§3](../../docs/wp69-json-schema-runtime.md#3-the-reference-spectrals-schema-function) (how Spectral configures ajv). Depends on S2.

The reference is ajv 8 configured as Spectral configures it at `16aae2b6f444`: one instance per dialect (`ajv-draft-04`, the default instance for draft-06 and draft-07, `draft2019-09`, `draft2020-12`), `strict: false`, `unicodeRegExp: false`, `addFormats`, and `allErrors` both off and on. Over the published OpenAPI 2.0, 3.0, 3.1 and AsyncAPI 2.x and 3.0 meta-schemas and a document corpus, `nish/json-schema` gives the same verdict, and with all errors the same `keyword`, `instancePath` and `schemaPath` for each error, in the same order. Where ajv and the draft's text disagree, the draft decides and the case is listed as a known difference with the suite test that shows it.

Vendor the meta-schemas and the corpus under `tests/`, each with its upstream notice kept and a row in `THIRD_PARTY_NOTICES.md` ([`.claude/licensing.md`](../../.claude/licensing.md)). Complete the guide page (every option, the three loaders' capabilities, the unusable reasons) and the `std/README.md` rows for `nish/json-schema`, `nish/json-schema-file` and `nish/json-schema-http`.

### How the differential gets ajv's answers

Decided (the open question of [§7](../../docs/wp69-json-schema-runtime.md#7-stages)): **answers generated once and committed beside the corpus.** ajv does not become a dependency of this repository.

- A script beside the corpus (the shape of [`tests/json-schema-suite/pack.js`](../../tests/json-schema-suite/pack.js)) is run by hand with `ajv`, `ajv-draft-04` and `ajv-formats` installed in a scratch directory outside the repository. It configures them as Spectral does, writes each corpus file's expected verdict and, with all errors, each error's `keyword`, `instancePath` and `schemaPath` in order, and records the ajv package versions and the Spectral commit it followed.
- Its `--check` mode verifies the committed answers against the corpus files' sha256 without ajv, so a corpus file changed without regenerating its answers fails.
- The test reads only the committed answers; nothing installs or runs ajv in CI. Adding a corpus file means rerunning the script and committing its answers in the same PR.

## Out of scope

From [§8](../../docs/wp69-json-schema-runtime.md#8-not-planned): lookaround and backreferences in `pattern` (`nish/regex` stays linear); `better-ajv-errors`' wording and `ajv-errors`' `errorMessage` (the linter writes them from the error fields); generating classes from a schema (WP62); applying `default`s or coercing (WP61 coerces at decode); `$data`, custom keywords and `$async`.
