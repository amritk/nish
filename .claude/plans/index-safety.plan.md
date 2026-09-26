---
name: Index safety — at(), proven-only indexing, and no --unchecked-indexing
overview: Make an index that can go out of range impossible to write. xs[i] compiles only where the compiler proves i in range, so it never needs a runtime check and never panics; Array.prototype.at is the explicit, always-safe read for everything else; --unchecked-indexing is removed because nothing unproven is left to uncheck. Lands as an opt-in first, migrates std, self and the tests, then flips the default in one breaking 0.x release. Runs after awfy-perf-2 closes.
stages:
  - id: design
    title: Design note
    goal: Settle the semantics before code — at(), the exact provable forms that become part of the language, pop(), and the migration path
    verification: docs/wp33-index-safety.md merged and the owner has signed off on its open decisions
    todos:
      - id: design-note
        content: Write docs/wp33-index-safety.md — at() typing and lowering, the provable-forms contract, pop(), the migration and the breaking release — see Design note
        status: pending
      - id: design-signoff
        content: Put the open decisions to the owner and record the answers in the note — see Open decisions
        status: pending
  - id: at
    title: Array.prototype.at
    goal: xs.at(i) answers T | undefined with exact JavaScript semantics, lowered to compares and a select with no panic path, and a present result proves the index
    verification: npm run check and an undegraded npm test green; at goldens and negatives pass; npm run test:diff agrees with Node on every at case
    todos:
      - id: at-checker
        content: Type xs.at(i) as the existing maybe type (T | undefined) in self/members.ts and self/types.ts, reusing Map.get rules for where a maybe may appear — see Array.prototype.at
        status: pending
      - id: at-lowering
        content: Lower at() in self/emit_arrays.ts — negative index adds length, one unsigned compare, element load on the present edge, select for ?? with a literal default — see Array.prototype.at
        status: pending
      - id: at-proof
        content: Teach self/bounds.ts that inside a present region of at(i) with i known non-negative, xs[i] is proven — see Array.prototype.at
        status: pending
      - id: at-tests
        content: Add arr_at goldens and reject_arr_at_* negatives, the LANGUAGE.md rule and a cookbook entry — see Tests
        status: pending
  - id: strict
    title: Proven-only indexing, opt-in
    goal: Under --strict-indexing every access the prover cannot prove is a compile error naming a rewrite that compiles, and the rule set is written down as the language contract
    verification: npm test green; strict goldens pass; every refusal names a rewrite that is itself a passing case; the flag off leaves every golden byte-identical
    todos:
      - id: strict-contract
        content: Write the provable forms into docs/LANGUAGE.md as a numbered, append-only list, each pinned by a golden — see Provable forms
        status: pending
      - id: strict-flag
        content: Add --strict-indexing to self/options.ts and self/compile.ts and raise NL9007, NL9008, NL9009 and unproven pop() to errors under it — see Proven-only indexing
        status: pending
      - id: strict-count
        content: Add a --report-unproven mode (or reuse --json diagnostics) that counts the rewrites a program needs, and run it over std, self and tests to size the migration — see Migration
        status: pending
      - id: strict-tests
        content: Add strict_* goldens and reject_strict_* negatives, one per refused shape — see Tests
        status: pending
  - id: migrate
    title: Migrate std, self and the tests
    goal: Everything in the repository compiles under --strict-indexing with no behaviour change
    verification: std, self (stage 2) and every tests/cases and tests/link program compile under --strict-indexing; npm test and test:diff green; instruction counts equal or lower
    todos:
      - id: migrate-std
        content: Rewrite the std accesses strict refuses with guards or at() — see Migration
        status: pending
      - id: migrate-self
        content: Rewrite the roughly 52 unproven accesses in self (48 NL9007, 4 NL9009 per tests/perf-baseline.json) without using at() until the seed has it (rolling freeze) — see Migration
        status: pending
      - id: migrate-tests
        content: Rewrite or re-classify every test program strict refuses; negatives that exist to panic become reject_* or at() cases — see Migration
        status: pending
  - id: flip
    title: Make it the default and remove --unchecked-indexing
    goal: One breaking 0.x release in which xs[i] compiles only when proven, --unchecked-indexing no longer exists, and the docs say so
    verification: feat! commit; the flag is refused with a message pointing at at(); every golden that used it is gone or rewritten; the AWFY unchecked column is retired from bench/run.mjs and docs
    todos:
      - id: flip-default
        content: Make proven-only indexing the default in self/compile.ts and drop --strict-indexing to a no-op alias for one release — see Breaking release
        status: pending
      - id: flip-remove-unchecked
        content: Remove --unchecked-indexing and its code paths (self/bounds.ts, self/emit_arrays.ts, self/emit_strings.ts, self/checker.ts), its tests (arr_unchecked, arr_sum args) and doc mentions — see Breaking release
        status: pending
      - id: flip-docs
        content: Update docs/LANGUAGE.md, docs/AI.md, the cookbook and the changelog body to describe indexing as proven-or-at() — see Breaking release
        status: pending
---

# Index safety — proven-only indexing

## Context

- Indexing is memory-safe by default today: every `xs[i]` the prover in [self/bounds.ts](../../self/bounds.ts) and [self/ranges.ts](../../self/ranges.ts) cannot prove gets a length compare, and an out-of-range index panics (`index out of range: i >= len`).
- The only unsafe path is `--unchecked-indexing` ([docs/LANGUAGE.md](../../docs/LANGUAGE.md), "the opposite trade"), which removes every check and makes out-of-range undefined behaviour.
- Unproven accesses are already reported as performance warnings — `NL9007` "is not provably within", `NL9008` "is not proven to be in range for", `NL9009` "is at or beyond the" ([self/codes.ts](../../self/codes.ts), raised from [self/checker.ts](../../self/checker.ts)) — and `--no-warn-performance` silences them.
- There is no way to read an element that might be out of range without either a panic or a hand-written guard.
- The checker already has a general "maybe" type, `T | undefined` (`isMaybe` in [self/types.ts](../../self/types.ts), rules in [self/expressions.ts](../../self/expressions.ts)), built for `Map.get`: a maybe may only initialise a `const`, be the left of `??`, or be compared with `undefined`, and narrows like `T | null`. Scalars have no `null` (`reject_nullable_scalar`), which is why `T | null` cannot carry this.

## Approach

**The rule.** `xs[i]` compiles only where the compiler proves `0 <= i < xs.length`; there it needs no runtime check, so checked and unchecked are the same speed by construction. Everywhere else the program says what it wants: `xs.at(i)` (a `T | undefined` it must handle) or a guard the prover understands. Indexing can then neither corrupt memory nor panic, and `--unchecked-indexing` has nothing left to do.

| Decision | Choice | Why |
|---|---|---|
| Name of the non-panicking read | `xs.at(i)` | It is the JavaScript/TypeScript method with Rust `get`'s meaning (`T \| undefined`), so a Nish program still type-checks under `tsc` and runs the same under Node. A Nish-only `get` would need an ambient type in `runtime/nish.d.ts` *and* a prototype shim, and would still diverge from TS. Owner-approved. |
| Negative index | JavaScript's: `at(-1)` is the last element | Nish is a TypeScript subset; `test:diff` runs every program under Node and must agree. |
| Return type | the existing maybe, `T \| undefined` | Reuses Map.get's typing, narrowing, `??` and all their negatives — no new type-system surface, works for scalars. |
| Rollout | opt-in `--strict-indexing` first, then the default | The default flips only once std, self and every test already pass, so the breaking release is a flag flip, not a migration. |
| `--unchecked-indexing` | removed in the same breaking release | With proven-only indexing every compiled access is already check-free; the flag could only remove checks from code that no longer compiles. |
| Provable forms | a numbered, append-only list in `docs/LANGUAGE.md` | What compiles now depends on the prover, so its rules are language, not optimisation: a form once provable stays provable. |

## Design note

`docs/wp33-index-safety.md` (next free WP number — confirm against `docs/MASTER_PLAN.md`) settles, with examples:

- `at()`: exact semantics (`i < 0` → `i + length`; then `0 <= k < length` or `undefined`), the maybe rules it inherits, and the lowering (below). What `at()` on a `string` does, or that it is refused for now.
- Proven-only indexing: the exact set of refused shapes (NL9007, NL9008, NL9009, `pop()` on an array not proven non-empty), whether `shift`/`slice` bounds are in scope, whether integer division's divisor check is in or out (recommend out: a separate `--strict-division` later), and the fix-it wording for each.
- The provable-forms contract (below), `pop()`, the migration count, and the breaking release's wording.
- The open decisions below, answered.

## Array.prototype.at

Typing ([self/members.ts](../../self/members.ts), [self/types.ts](../../self/types.ts)): `xs.at(i)` on `T[]` with `i` an integer answers the maybe of `T`. Everything Map.get's maybe forbids stays forbidden, with the same NL codes and messages naming `at` instead of `get`.

Lowering ([self/emit_arrays.ts](../../self/emit_arrays.ts)), for `const v = xs.at(i)`:

```llvm
%len  = load i64 header.len              ; the tagged header load (#220)
%neg  = icmp slt i64 %i, 0
%adj  = add  i64 %i, %len
%k    = select i1 %neg, i64 %adj, i64 %i
%ok   = icmp ult i64 %k, %len            ; one unsigned compare covers both ends
; present edge: element load at %k (element tag, #208); absent edge: nothing
```

- `xs.at(i) ?? d` with a literal or name default lowers to a `select` over the loaded element — no branch, no panic block. Where LLVM cannot speculate the load, a `br` to the load.
- When the prover already knows `i >= 0`, the negative-index select folds away.

Proof carry-over ([self/bounds.ts](../../self/bounds.ts)): inside the region where `v !== undefined` holds, and where `i` is known non-negative, record `i < xs.length` so later `xs[i]` in that region needs no check. A negative `i` gets no fact, because `xs[i]` with a negative `i` panics where `at(i)` would not.

## Proven-only indexing

- **Flag.** New in [self/options.ts](../../self/options.ts) and [self/compile.ts](../../self/compile.ts). Passing it together with `--unchecked-indexing` is an error: strict proves the checks away, unchecked deletes them unproven.
- **Refusals.** Under the flag, NL9007, NL9008 and NL9009 are errors, not warnings. They keep their codes, with the severity raised; confirm in the design note whether the diagnostics registry wants separate error codes. Each message ends with a rewrite that compiles. For example:
  - `` guard it: `if (i < xs.length) { … xs[i] … }` ``;
  - `` or read it with `xs.at(i) ?? d` ``.

  The unsigned-bound defect noted in [self/checker.ts](../../self/checker.ts) (`TODO(wp15)`) must be fixed or worked around so no suggested rewrite fails to compile.
- **`pop()`.** On an array not proven non-empty it panics today (`index out of range: 0 >= 0`). Under strict it is refused unless the prover knows `length >= 1`.
- **Unchanged meaning.** A strict build's IR is identical to a default build's IR for any program strict accepts: strict refuses, it never changes codegen.

## Provable forms

The contract `docs/LANGUAGE.md` states, each pinned by a golden, and only ever extended:

1. A loop index bounded by the array's length: `for (let i = 0; i < xs.length; i++)`, and the count-down form.
2. A dominating guard: `if (i >= 0 && i < xs.length)`, including early-exit forms (`if (i >= xs.length) return`).
3. A constant index into an array of known minimum length (a literal, `new Array<T>(K)`, an inline fixed field).
4. A fact carried across a call by the call-site ranges pass (#222), including the closed-world rule.
5. The present region of `xs.at(i)` with `i` known non-negative.
6. `pop()` / `xs[xs.length - 1]` where the length is proven at least 1.

The design note lists anything else the prover proves today and decides which of it becomes contract.

## Migration

`--report-unproven` (or the existing `--json` diagnostics) counts, per file, the accesses strict refuses; the count for std, self and the test corpus sizes this stage before it starts. Rewrites use a guard where the index is really in range and `at()` where it is data-dependent; a rewrite never changes output (`test:diff`, goldens). `self/` may not use `at()` until the seed has it, so its rewrites are guards. Test programs whose purpose is to panic on an index become `reject_*` cases or `at()` cases.

## Breaking release

A `feat!` commit whose body explains the rule and the rewrite, moving the minor version (0.x). `--strict-indexing` stays as a no-op alias for one release; `--unchecked-indexing` is refused with `` `--unchecked-indexing` is gone: an index either is proven, and has no check to remove, or is written `xs.at(i)` ``. The AWFY "unchecked" column leaves `bench/run.mjs` and the docs, since it now equals the default.

## std under strict

- Compile each [std/](../../std/) module with `--strict-indexing`, and rewrite each refused access with a guard or `at()` without changing behaviour. `test:diff` and the std tests stay green.
- A named `std-strict` check in [tests/run.js](../../tests/run.js) compiles every std module under the flag, so a new unproven access in std fails `npm test`.
- `self/` is out of scope. It keeps tightening under `tests/perf-baseline.json`.

## Open decisions

For the owner, recorded in the design note:

1. `at()` (TypeScript's name, negative indices from the end, owner-approved) — confirm `at()` on strings is out for now.
2. Scope: indices and `pop` only, or also integer division's divisor check? **Recommend indices and `pop`; division separately.**
3. A migration escape hatch for users in the breaking release (e.g. a one-release `--allow-unproven-indexing` that keeps runtime checks), or none? **Recommend none beyond the no-op alias: `at()` is the migration.**
4. Which provable forms the design note finds today but does not want to promise forever.

## Out of scope

- A runtime-checked `xs[i]` after the breaking release.
- Optional chaining, `?.[]`, or any new union types beyond the existing maybe.
- `at()` on strings, unless the design note decides otherwise.

## Tests

Every case gets a golden `.ll`, an `llvm-as` pass, a native round trip with `.out` and a `test:diff` run under Node. Mirror `map_get_narrow`, `map_get_nullish`, `map_get_pointer_value` and `reject_map_get_*`.

| Case | Pins |
|---|---|
| `arr_at` | in-range, out-of-range, `at(-1)`, and `at(-len-1)` → `undefined`; scalar and pointer elements |
| `arr_at_nullish` | `xs.at(i) ?? d` lowers to a select with no panic block |
| `arr_at_narrow` | `if (v !== undefined)` narrows; `xs[i]` inside is unchecked when `i >= 0` is known, and checked when it is not |
| `reject_arr_at_*` | a maybe used as a value, in arithmetic, stored, or returned — each with Map.get's message naming `at` |
| `strict_*` | each accepted shape: a guarded loop, `at() ??`, a proven `pop` |
| `reject_strict_*` | one per refused shape (NL9007, NL9008, NL9009, `pop`), each whose suggested rewrite is itself a `strict_*` case |
| `std-strict` (named check) | every std module compiles under `--strict-indexing` |
| `repo-strict` (named check, after migration) | self and every test program compile under `--strict-indexing` |
| `reject_unchecked_flag` (after the flip) | `--unchecked-indexing` is refused with the message above |

## Verification

- `npm run check`
- An undegraded `npm test`: read the skip count; no `DEGRADED:` line.
- `npm run test:diff`: every `at` case agrees with Node.
- `node tests/run.js arr_at strict std-strict repo-strict`
- `node bench/run.mjs --instructions --check`: counts equal or lower at every stage.
- `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js`: 0 undeclared differences.
- `npm run lint` and `node docs/check-links.mjs`.
- The rolling freeze: `self/` may not *use* `at()` until the next release's seed.
