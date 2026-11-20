---
name: WP33 — the round trip to TypeScript
overview: --emit-ts, the portability pass and the fix tiers are built; what is left is compatibility mode (WP28, R6), a deferred Bun adapter, and two --emit-ts gaps that over-refuse or emit wrong TypeScript. Each makes the way back out to TypeScript safe enough to widen the way in.
roadmap: docs/roadmap/wp33-round-trip.md
spec: docs/wp33-round-trip.md
priority: 40
issue: 1877
stages:
  - id: r6-compat
    title: WP33 R6 — compatibility mode (WP28) lands
    goal: WP28's staging is finished, which is what R6 means, and the round-trip note's R6 row is ticked.
    verification: node tests/run.js compat && npm run lint
    status: pending
    issue: 1887
    todos:
      - id: r6-track-wp28
        content: Track WP28's remaining stages (C-lib to C7) on docs/roadmap/wp28-compatibility-mode.md and tick R6 when the last lands — see WP33 R6 — compatibility mode (WP28) lands
        status: pending
      - id: r6-note
        content: Update the R6 row and staging text in docs/wp33-round-trip.md once WP28 is done — see WP33 R6 — compatibility mode (WP28) lands
        status: pending
  - id: bun-adapter
    title: WP33 R7 — a Bun runtime adapter (deferred)
    goal: runtime/core/ has a Bun host adapter beside the Node and browser ones, and the emit-ts differential runs under it.
    verification: node tests/run.js emit-ts && npm run lint
    status: pending
    labels: [deferred]
    issue: 1888
    todos:
      - id: bun-adapter-file
        content: Add a Bun adapter beside the Node and browser adapters under runtime/ — see WP33 R7 — a Bun runtime adapter (deferred)
        status: pending
  - id: emit-ts-u32-const-fold
    title: WP33 — emit-ts folds a u32 constant-table element from an i64 constant in the element type
    goal: tests/cases/const_table_u16_u32.ts agrees under --emit-ts and type-checks under tsc --strict, with no new row in tests/differential/emit-ts-known.txt.
    verification: node tests/run.js emit-ts && npm run lint
    status: pending
    issue: 1827
    todos:
      - id: u32-fold-emit
        content: Emit a constant-table element folded from an i64 constant as a number in the table's element type in src/emit-ts-*.ts — see WP33 — emit-ts folds a u32 constant-table element
        status: pending
      - id: u32-fold-test
        content: Confirm tests/cases/const_table_u16_u32.ts passes the live differential and tsc --strict — see WP33 — emit-ts folds a u32 constant-table element
        status: pending
  - id: emit-ts-nl4014
    title: WP33 — NL4014 stops refusing uncalled generics whose zero or copy every instance writes alike
    goal: An uncalled generic whose body makes no instance-dependent choice is emitted, and the refused fixtures that still depend on T stay refused.
    verification: node tests/run.js emit-ts && npm run lint
    status: pending
    issue: 930
    todos:
      - id: nl4014-narrow
        content: Narrow changedText in src/emit-ts-edits.ts and the record check in src/emit-ts-records.ts to the element types that can reach the body — see WP33 — NL4014 stops refusing uncalled generics
        status: pending
      - id: nl4014-fixtures
        content: Revisit tests/emit-ts/refused/uncalled-zero.ts, uncalled-copy.ts, uncalled-ctor-zero.ts, uncalled-field-zero.ts and uncalled-wide-zero.ts — see WP33 — NL4014 stops refusing uncalled generics
        status: pending
---

# WP33 — the round trip to TypeScript

## Context
R0 to R5 have landed: the note and ledger, the `portability` class behind `--warn-portability`, typed-array names without `push`/`pop`, the runtime split by host, `--emit-ts <dir>` with its live differential, and both `fix` tiers (see [the roadmap page](../../docs/roadmap/wp33-round-trip.md)). Open are R6 (compatibility mode, which is WP28 on its own staging), a deferred Bun adapter, and two `--emit-ts` issues. Spec: [design note §9](../../docs/wp33-round-trip.md#9-staging).

## WP33 R6 — compatibility mode (WP28) lands
R6 is done when [WP28](../../docs/roadmap/wp28-compatibility-mode.md) is. C0 and C1 are built; the next stage is C-lib (`Date`, `JSON`, `RegExp`, `Buffer` under compat), then C2b to C7. This stage is a tracking stage with no code of its own: tick R6 on the roadmap page and update the note when WP28's last stage ships.
Likely files: `docs/wp33-round-trip.md`, `docs/roadmap/wp33-round-trip.md`.

## WP33 R7 — a Bun runtime adapter (deferred)
The roadmap lists "A Bun runtime adapter" as deferred. R3 split the runtime into `runtime/core/` with Node and browser adapters; Bun would be a third host. Not planned until a user needs it.
Likely files: `runtime/`.

## WP33 — emit-ts folds a u32 constant-table element from an i64 constant in the element type
#1827: `const MASKS: readonly u32[] = [..., TOP, TOP + 294967295, ...]` with `const TOP: i64 = 4000000000` folds natively to 4294967295, but `--emit-ts` keeps `TOP` a `bigint` and writes the sum into a `number[]`: TS2322, TS2365, and a run-time `TypeError` (exit 1 against native 0). Found by CI on #1826. Expected: fold in the element type, or convert with `Number(...)` for a u32 or u16 table. `tests/cases/const_table_u16_u32.ts` exists on main and is not in `tests/differential/emit-ts-known.txt`; check whether it still fails before changing anything.
Likely files: `src/emit-ts-*.ts`, `tests/differential/emit-ts-known.txt`.

## WP33 — NL4014 stops refusing uncalled generics whose zero or copy every instance writes alike
#930: NL4014 refuses an uncalled generic whose body zero-fills `new Array<T>(n)` or copies an element into a slot in a program keeping records inline, because the untyped walk knows nothing about `T`. It over-refuses where every type `T` could take gives the same TypeScript. Fixes the issue names: type uncalled generic bodies in the checker (which also removes the NL8012 stubs), or narrow the choice to the element types that can reach the body. Remember the rule that an untyped emit-ts walk knows nothing: use `walk.typeAt` and `walk.missType()`.
Likely files: `src/emit-ts-edits.ts` (`changedText`), `src/emit-ts-records.ts`, `tests/emit-ts/refused/`.
