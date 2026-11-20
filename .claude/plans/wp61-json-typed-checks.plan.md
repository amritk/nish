---
name: WP61 — typed JSON, constraints and coercion in one pass
overview: Proposed only. Decode checks a schema's constraints and optionally coerces in the single typed-JSON pass, with zero cost when unused. Six owner decisions are open, and the union-state cost of tagged unions is queued for a decision.
roadmap: docs/roadmap/wp61-json-typed-checks.md
spec: docs/wp61-json-typed-checks.md
priority: 60
issue: 1869
stages:
  - id: s1-constraints
    title: WP61 S1 — constraints in decode
    goal: A constraints option in static readonly json checks bounds, lengths, pattern, format, enum, item counts and uniqueItems straight after each field read and fails with JSON_DECODE_CONSTRAINT (-27), with unconstrained IR byte-identical.
    verification: node tests/run.js json && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1880
    todos:
      - id: s1-option
        content: Add jsonReadConstraints and its diagnostics in the checker and the emitted checks for every keyword in std/json-typed.ts and src/ — see WP61 S1 — constraints in decode
        status: pending
      - id: s1-tests
        content: Add golden .ll per keyword family, the zero-cost golden, round trips, negatives, the linear-time pattern test and the NaN bounds golden — see WP61 S1 — constraints in decode
        status: pending
      - id: s1-docs
        content: Update the LANGUAGE.md Typed JSON rule, the guide, docs/security/json.md and regex.md, and the options sentence in std/json-typed.ts — see WP61 S1 — constraints in decode
        status: pending
  - id: s2-coercion
    title: WP61 S2 — coercion
    goal: With coerce true, jsonDecode always answers OK with a correct instance, using lossless conversions or the class's own default, with reason and errorAt readable after the OK.
    verification: node tests/run.js json && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1896
    todos:
      - id: s2-conversions
        content: Add the coerce option, the conversion table, defaults and stop rules in std/json-typed.ts and src/ — see WP61 S2 — coercion
        status: pending
      - id: s2-repair
        content: Add the repair log, jsonPointerAt and the coerce epilogue, with the measurement that decides whether the log is always on — see WP61 S2 — coercion
        status: pending
      - id: s2-docs
        content: Add negatives, the LANGUAGE.md rule, the guide and the security record update — see WP61 S2 — coercion
        status: pending
  - id: s3-guide-bench
    title: WP61 S3 — the Typed JSON guide page, error-code table and benchmarks
    goal: A Typed JSON guide page with a scalar route and the JSON_DECODE_* table exists, bench/json-compare has Bun and Node rows for constrained and coercion workloads, and an Ir/doc gate pins the zero-cost claim.
    verification: npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    status: pending
    todos:
      - id: s3-guide
        content: Write docs/guide/using-nish/typed-json.md lifted from standard-library.md, with its scalar.config.json route and error-code table — see WP61 S3 — the Typed JSON guide page, error-code table and benchmarks
        status: pending
      - id: s3-bench
        content: Add constrained and coercion workloads and Bun and Node rows to bench/json-compare and an Ir/doc gate — see WP61 S3 — the Typed JSON guide page, error-code table and benchmarks
        status: pending
  - id: json-union-state-cost
    title: WP61 — decide the cost of tagged-union state in JsonDecoder and the re-pinned typed-JSON wordings
    goal: The owner has accepted the 8-byte JsonDecoder growth and the longer wordings, or a follow-up keeps union state outside JsonDecoder.
    verification: node tests/run.js json && node tests/run.js wordings && npm run lint
    status: pending
    issue: 1406
    labels: [needs-decision]
    todos:
      - id: union-state-decide
        content: Record the decision on JsonDecoder's unionStart and unionReread fields, and if rejected move them out of the struct in std/json-typed.ts — see WP61 — decide the cost of tagged-union state in JsonDecoder and the re-pinned typed-JSON wordings
        status: pending
---

# WP61 — typed JSON, constraints and coercion in one pass

## Context
Only the proposal has landed (nothing is built); see [the roadmap page](../../docs/roadmap/wp61-json-typed-checks.md). Spec: [design note §11](../../docs/wp61-json-typed-checks.md#11-stages). Each stage adds a construct and follows the checklist in `docs/ARCHITECTURE.md` ("How to add a construct"). WP62 (generated classes) depends on S1 and S2.

## WP61 S1 — constraints in decode
Spec: [§4](../../docs/wp61-json-typed-checks.md#4-constraints). Each constraint is checked right after its field's read and fails with `JSON_DECODE_CONSTRAINT` (-27) at the value; unconstrained IR stays byte-identical (a zero-cost golden). `f64` bounds are emitted as the negated ordered pass test so `NaN` fails. Includes the `docs/security/json.md` and `regex.md` updates.
Likely files: `std/json-typed.ts`, `src/` typed-JSON checker and emitter, `docs/LANGUAGE.md`.

### Decision needed
The owner's decisions in [§9](../../docs/wp61-json-typed-checks.md#9-decisions-for-the-owner) shape S1: (1) one `constraints` map (recommended) or per-keyword keys; (2) record `failedKeyword` (recommended, one `i32`) or only code and offset; (3) whether a `-g` build checks constraints on encode.

## WP61 S2 — coercion
With `coerce: true`, `jsonDecode` always answers `OK`; lossless conversions follow an exact table, otherwise the class's own default. Malformed JSON and limits stop the reading without failing the decode; `reason` and `errorAt` stay readable. A union field must be `| null` and takes `null` on a bad tag. A capped repair log (offset, code, keyword, action) is always on or opt-in as measurement decides. Prior art: mjst (§5.7). Depends on S1.

### Decision needed
(4) Refuse a coerce class that reaches a strict class (recommended) or write a second coercing part; (5) boolean spellings: only `true`, `false`, `1`, `0` (recommended) or mjst's wider set; (6) unions only as `U | null` (recommended) or refuse unions in coerce classes for now.

## WP61 S3 — the Typed JSON guide page, error-code table and benchmarks
The guide page `docs/guide/using-nish/typed-json.md` with its route, the `JSON_DECODE_*` table (today only in the header of `std/json-typed.ts`), a note that `jsonEncodeI32Array` and kin are generated-encoder helpers, Bun and Node rows and constrained and coercion workloads in `bench/json-compare`, and an `Ir/doc` gate.

## WP61 — decide the cost of tagged-union state in JsonDecoder and the re-pinned typed-JSON wordings
#1406 (from the merge of #1400, typed JSON tagged unions) found acceptance criterion 8 PARTIAL: existing tests' expectations were edited. The `nl2485`, `nl2488` and `nl2494` wording pins gained text (old text is a prefix of the new), and `tests/link/std_json_typed/{main,renamed,tag}.ll` changed because `JsonDecoder` grew from 32 to 40 bytes (`unionStart`, `unionReread`). Not checked: NL2719, NL2722 to NL2724 by hand, and the `maxDepth`/`unionReread` bounds beyond `tests/link/json_tagged_union`. This issue is about the existing typed-JSON union feature rather than WP61's constraints and coercion; it is placed here as the nearest JSON work.

### Decision needed
Accept the wordings and 8 bytes per decoder (even for programs without unions) and close the issue, or keep union state outside `JsonDecoder` in a follow-up. The issue gives no recommendation.
