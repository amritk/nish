---
name: WP32 — Map and Set
overview: Map and Set landed; one open follow-up accepts a key/value walk, for (const [k, v] of m.entries()), now that destructuring has landed, without a pair allocation or a second lookup.
spec: docs/wp32-map.md
priority: 80
issue: 1862
stages:
  - id: s8-map-entries-walk
    title: WP32 S8 — accept for (const [k, v] of m.entries()) and for (const [k, v] of m)
    goal: The exact [k, v] pattern over a Map walks the table once with the value read in place, with no allocation, no pair and no second lookup, and every other entries() use stays refused.
    verification: node tests/run.js map && node tests/run.js performance && node tests/nish-cmp.js && npm run check && npm run lint
    status: pending
    issue: 1575
    todos:
      - id: s8-lower
        content: Lower the [k, v] for...of head over a Map as the keys() table walk with the value slot read in place in src/ — see WP32 S8
        status: pending
      - id: s8-negatives
        content: Add negatives for entries() stored, returned or spread, defaults, rest, nesting and assignment patterns, and drop the needs-destructuring wording from NL2375 — see WP32 S8
        status: pending
      - id: s8-ir-measure
        content: Pin a golden .ll with no allocation, no pair alloca and one table walk, and measure against the keys() plus get loop with a noise band — see WP32 S8
        status: pending
      - id: s8-docs
        content: Update the LANGUAGE.md rule, cookbook entry, Map guide page and AI.md Map note, and register the case with the differential goldens — see WP32 S8
        status: pending
---

# WP32 — Map and Set

## Context
S1 to S7 (global `Map` and `Set`, iteration, fusion, `nish/map`, `StringMap`, measured against Node) and `Map` reads inside a parallel body have landed (#227 to #244). See [the design note](../../docs/wp32-map.md). Spec: [design note](../../docs/wp32-map.md). No open roadmap boxes; stage id S8 is this plan's numbering.

## WP32 S8 — accept for (const [k, v] of m.entries()) and for (const [k, v] of m)
Issue #1575. Both forms are refused today (`reject_map_entries`, `reject_map_iter_entries_call`, NL2375 `reject_map_iter_entries`); the workaround is `keys()` plus `get`, a second lookup per key. Destructuring declarations have landed (`tests/cases/destructure_array`), so the blocker named in the issue is gone. Only the exact `[k, v]` pattern (or a hole, `[, v]`) in a `const`/`let` head is accepted; `Set` stays as is.
Hard conditions from the issue: every program that compiles today keeps its IR (nish-cmp moves are defects, not `DECLARED` entries); the new loop allocates nothing and does one table walk; it is measured against the workaround on `Map<string, i32>` and `Map<i32, i32>` with a self-baseline noise band; peak RSS and allocation count do not rise; no new NL9xxx warning.
Likely files: `src/` Map for...of lowering, `docs/LANGUAGE.md` (around the NL2375 note), `docs/AI.md`.
