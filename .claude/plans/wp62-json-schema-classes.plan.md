---
name: WP62 — Nish classes from a JSON Schema
overview: Proposed only. nish schema would write typed-JSON classes from a draft 2020-12 schema or OpenAPI 3.1 components, keeping every keyword as a type, a WP61 constraint, JSDoc, or a refusal naming its JSON Pointer. Nothing is built and several owner decisions are open.
roadmap: docs/roadmap/wp62-json-schema-classes.md
spec: docs/wp62-json-schema-classes.md
priority: 60
issue: 1860
stages:
  - id: s1-typed-json-prereqs
    title: WP62 S1 — typed JSON prerequisites for generated classes
    goal: A typed JSON class can have an optional field whose default the constructor assigns, a per-class unknown ignore or error option, and new JsonNumber() in a coerce class, with NL2498 reworded and the security record updated.
    verification: node tests/run.js json && node tests/run.js wordings && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1915
    todos:
      - id: s1-default-ctor
        content: Admit an optional field whose default the constructor assigns ([], new Map(), new C(), new JsonNumber()) and reword NL2498 in src/ and std/json-typed.ts — see WP62 S1 — typed JSON prerequisites for generated classes
        status: pending
      - id: s1-unknown
        content: Add the per-class unknown ignore or error option to the typed-JSON options literal — see WP62 S1 — typed JSON prerequisites for generated classes
        status: pending
      - id: s1-docs
        content: Update docs/security/json.md with a finding per case where an unknown key or missing field could now reach the decoded value, plus LANGUAGE.md and the guide — see WP62 S1 — typed JSON prerequisites for generated classes
        status: pending
  - id: s2-plain-objects
    title: WP62 S2 — nish schema for plain objects
    goal: nish schema writes a deterministic class file, with header, Flags line and --check, for scalars, strings, arrays, required and optional fields and additionalProperties as unknown, refusing every other keyword with its JSON Pointer.
    verification: node tests/run.js schema && npm run check && npm run lint
    status: pending
    issue: 1933
    todos:
      - id: s2-generator
        content: Add the nish schema command reading a schema with JsonLimits and writing classes, JSDoc from annotations, names and rename — see WP62 S2 — nish schema for plain objects
        status: pending
      - id: s2-check-refusals
        content: Add the file header, the Flags line, --check and the refusal of every other keyword with its JSON Pointer, with tests/link negatives — see WP62 S2 — nish schema for plain objects
        status: pending
  - id: s3-refs-unions
    title: WP62 S3 — $defs and $ref, maps, nullables, tagged unions and allOf
    goal: The generator handles $defs and $ref, maps, nullables, tagged unions from const and OpenAPI's discriminator, the flat allOf merge, and recursion through arrays, maps and | null.
    verification: node tests/run.js schema && npm run check && npm run lint
    status: pending
    issue: 1951
    todos:
      - id: s3-refs
        content: Resolve $defs and $ref with a visiting set and a class-count limit in the generator — see WP62 S3 — $defs and $ref, maps, nullables, tagged unions and allOf
        status: pending
      - id: s3-unions
        content: Generate tagged unions from const and discriminator, the flat allOf merge and recursion — see WP62 S3 — $defs and $ref, maps, nullables, tagged unions and allOf
        status: pending
  - id: s4-validation
    title: WP62 S4 — validation keywords onto WP61 constraints, and the transitive coerce switch
    goal: Validation keywords become WP61's constraints literal with format checked by default, and the generator's coerce switch is transitive.
    verification: node tests/run.js schema && node tests/run.js json && npm run lint
    status: pending
    labels: [needs-decision]
    issue: 1962
    todos:
      - id: s4-constraints
        content: Map validation keywords to the constraints literal after WP61 S1 and record --formats-as-tags in Flags — see WP62 S4 — validation keywords onto WP61 constraints, and the transitive coerce switch
        status: pending
      - id: s4-coerce
        content: Add the transitive coerce switch after WP61 S2 — see WP62 S4 — validation keywords onto WP61 constraints, and the transitive coerce switch
        status: pending
  - id: s5-corpus-guide
    title: WP62 S5 — the schema corpus, the guide page and the reverse generator
    goal: A vendored schema corpus with per-schema counts, the guide page and, if the owner takes it, nish schema --emit-schema exist.
    verification: node tests/run.js schema && npm run lint && node docs/check-links.mjs
    status: pending
    labels: [needs-decision]
    issue: 1971
    todos:
      - id: s5-corpus
        content: Vendor the schema corpus with per-schema counts and its licence notices in THIRD_PARTY_NOTICES.md — see WP62 S5 — the schema corpus, the guide page and the reverse generator
        status: pending
      - id: s5-guide
        content: Write the guide page and its scalar.config.json route, and the reverse generator if taken — see WP62 S5 — the schema corpus, the guide page and the reverse generator
        status: pending
---

# WP62 — Nish classes from a JSON Schema

## Context
Only the proposal has landed (the design note and roadmap page, no compiler code); see [the roadmap page](../../docs/roadmap/wp62-json-schema-classes.md). Spec: [design note §12](../../docs/wp62-json-schema-classes.md#12-stages); the keyword table is [§4](../../docs/wp62-json-schema-classes.md#4-the-keyword-table). S4 depends on WP61's S1 (constraints in decode) and S2 (coercion), whose plan is `wp61-json-typed-checks.plan.md`.

## WP62 S1 — typed JSON prerequisites for generated classes
An optional field whose default the constructor assigns (`[]`, `new Map()`, `new C()`, `new JsonNumber()`) with NL2498 reworded, a per-class `unknown: "ignore" | "error"` option, `new JsonNumber()` in a coerce class, and the `docs/security/json.md` update. Whichever of this stage and WP61's coercion lands first builds the in-place reset they share.
Likely files: `std/json-typed.ts`, `src/` typed-JSON checker, `docs/security/json.md`.

### Decision needed
Where do the two typed JSON changes land ([§10](../../docs/wp62-json-schema-classes.md#10-decisions-for-the-owner), item 1)? Options: as WP62's S1 before any generator code (recommended, WP62 is their first user); as a WP61 stage; or generator first, refusing the fields they cover.

## WP62 S2 — nish schema for plain objects
Scalars, strings, arrays, `required`/`optional`, the default rule with its warning, `additionalProperties` as `unknown`, annotations as JSDoc, names and `rename`; a deterministic file with a header, a `Flags:` line and `--check`; every other keyword refused with its JSON Pointer. The note recommends `nish schema` as the home (§10 item 9). The schema is read with `JsonLimits`; no separate security record is expected (§11).

## WP62 S3 — $defs and $ref, maps, nullables, tagged unions and allOf
`$defs` and `$ref` (a visiting set so a cycle is a refusal, a class-count limit), maps, nullables, tagged unions from `const` and OpenAPI's `discriminator`, the flat `allOf` merge, and recursion through arrays, maps and `| null`.

## WP62 S4 — validation keywords onto WP61 constraints, and the transitive coerce switch
Validation keywords onto WP61's `constraints` literal with `format` checked by default, after WP61 "S1 — constraints in decode"; the transitive coerce switch after "S2 — coercion".

### Decision needed
Is `format` checked by default (§10 item 10)? Options: checked by default with `--formats-as-tags` as a weakening recorded in `Flags:` (recommended, the generator never keeps less than the schema says unless the header shows it), or draft 2020-12's annotation reading, which would make checking the opt-in.

## WP62 S5 — the schema corpus, the guide page and the reverse generator
A vendored schema corpus with per-schema counts, the guide page, and the reverse generator if taken.

### Decision needed
Build `nish schema --emit-schema` (recommended, it is what proves §8.1) or test the round trip on instances only. Also open in §10: `readOnly`/`writeOnly` (tags only is recommended), unknown and `x-*` keywords (refuse unless allowed by name), nullable `boolean` and type-discriminated unions (refuse), `--presence` (off), field-name style (keep as written), and where the generator lives.
