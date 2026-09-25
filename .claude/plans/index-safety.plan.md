---
name: Index safety — at(), strict indexing, and an honest --unchecked-indexing
overview: Give programs a non-panicking element read (Array.prototype.at, the TypeScript spelling of Rust's get), an opt-in --strict-indexing that makes every unproven index a compile error, and make --unchecked-indexing say out loud which accesses it leaves unguarded. Runs after awfy-perf-2 closes; checks stay on by default and no existing program changes meaning.
stages:
  - id: design
    title: Design note
    goal: Settle every open semantic question in one reviewed doc before any code — at() semantics and name, what strict mode refuses, the unchecked warning
    verification: docs/wp33-index-safety.md merged, owner has signed off on the open decisions it lists
    todos:
      - id: design-note
        content: Write docs/wp33-index-safety.md covering at() typing and lowering, the strict-mode rule set, the unchecked warning, and the open decisions — see Design note
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
        content: Type xs.at(i) as the existing maybe type (T | undefined) in self/members.ts and self/types.ts, reusing Map.get's rules for where a maybe may appear — see Array.prototype.at
        status: pending
      - id: at-lowering
        content: Lower at() in self/emit_arrays.ts — negative index adds length, one unsigned compare, element load on the present edge, select for ?? with a literal default — see Array.prototype.at
        status: pending
      - id: at-proof
        content: Teach self/bounds.ts that inside a present region of at(i) with i known non-negative, xs[i] is proven — see Array.prototype.at
        status: pending
      - id: at-tests
        content: Add arr_at goldens (positive, negative index, ?? default, narrowing proof, pointer and scalar element types) and reject_arr_at_* negatives, plus LANGUAGE.md rule and cookbook entry — see Tests
        status: pending
  - id: strict
    title: --strict-indexing
    goal: An opt-in flag under which every access the prover cannot prove in range is a compile error naming the fix, so a program that builds cannot panic on an index
    verification: npm test green; strict_* goldens pass; every refusal message names a rewrite that compiles; flag off leaves every golden byte-identical
    todos:
      - id: strict-flag
        content: Add --strict-indexing to self/options.ts and self/compile.ts, carried to the checker, rejected together with --unchecked-indexing — see --strict-indexing
        status: pending
      - id: strict-errors
        content: Raise NL9007, NL9008 and NL9009 to errors under the flag with a fix-it naming the guard or at() rewrite, and cover pop() on an array not proven non-empty — see --strict-indexing
        status: pending
      - id: strict-tests
        content: Add strict_* goldens and reject_strict_* negatives, one per refused shape, each whose suggested rewrite is itself a passing case — see Tests
        status: pending
  - id: unchecked-warn
    title: --unchecked-indexing reports what it leaves unguarded
    goal: Every access that --unchecked-indexing turns into undefined behaviour without a proof is reported under a new warning that --no-warn-performance does not silence
    verification: npm test green; unchecked_* wordings goldens pass; a fully proven program builds under --unchecked-indexing with no new output
    todos:
      - id: unchecked-code
        content: Add a new NL code in self/codes.ts via scripts/gen-diagnostic-codes.mjs for an unproven access under --unchecked-indexing, plus a one-line count summary — see --unchecked-indexing
        status: pending
      - id: unchecked-emit
        content: Report it from the same site as NL9007/NL9008 whenever uncheckedIndexing is set, independent of warnPerformance — see --unchecked-indexing
        status: pending
      - id: unchecked-docs
        content: Update the --unchecked-indexing section of docs/LANGUAGE.md to point at --strict-indexing as the safe way to drop every check — see --unchecked-indexing
        status: pending
  - id: std-strict
    title: std/ under --strict-indexing
    goal: Every std/ module compiles clean under --strict-indexing, and a test keeps it that way
    verification: node tests/run.js std-strict passes; std/ IR unchanged or strictly fewer checks
    todos:
      - id: std-fix
        content: Rewrite the std/ accesses strict mode refuses with guards or at(), no behaviour change — see std under strict
        status: pending
      - id: std-pin
        content: Add a named std-strict check to tests/run.js compiling every std/ module with --strict-indexing — see std under strict
        status: pending
---

# Index safety

## Context

- Indexing is memory-safe by default today: every `xs[i]` the prover in [self/bounds.ts](../../self/bounds.ts) and [self/ranges.ts](../../self/ranges.ts) cannot prove gets a length compare, and an out-of-range index panics (`index out of range: i >= len`).
- The only unsafe path is `--unchecked-indexing` ([docs/LANGUAGE.md](../../docs/LANGUAGE.md), "the opposite trade"), which removes every check and makes out-of-range undefined behaviour.
- Unproven accesses are already reported as performance warnings — `NL9007` "is not provably within", `NL9008` "is not proven to be in range for", `NL9009` "is at or beyond the" ([self/codes.ts](../../self/codes.ts), raised from [self/checker.ts](../../self/checker.ts)) — and `--no-warn-performance` silences them.
- There is no way to read an element that might be out of range without either a panic or a hand-written guard.
- The checker already has a general "maybe" type, `T | undefined` (`isMaybe` in [self/types.ts](../../self/types.ts), rules in [self/expressions.ts](../../self/expressions.ts)), built for `Map.get`: a maybe may only initialise a `const`, be the left of `??`, or be compared with `undefined`, and narrows like `T | null`. Scalars have no `null` (`reject_nullable_scalar`), which is why `T | null` cannot carry this.

## Approach

| Decision | Choice | Why |
|---|---|---|
| Name of the non-panicking read | `xs.at(i)` | It is the JavaScript/TypeScript method with Rust `get`'s meaning (`T \| undefined`), so a Nish program still type-checks under `tsc` and runs the same under Node. A Nish-only `get` would need an ambient type in `runtime/nish.d.ts` *and* a prototype shim, and would still diverge from TS. **Open decision** for the owner. |
| Negative index | JavaScript's: `at(-1)` is the last element | Nish is a TypeScript subset; `test:diff` runs every program under Node and must agree. |
| Return type | the existing maybe, `T \| undefined` | Reuses Map.get's typing, narrowing, `??` and all their negatives — no new type-system surface, works for scalars. |
| Strict mode | opt-in flag | Default builds must not change (the owner's rule). `self/` still has unproven accesses; it tightens file by file under the existing `tests/perf-baseline.json` ratchet. |
| Unchecked | warn, never refuse | Refusing would change an existing flag's meaning (a break under the stability rule at the head of `docs/LANGUAGE.md`). |

## Design note

`docs/wp33-index-safety.md` (next free WP number — confirm against `docs/MASTER_PLAN.md`) settles, with examples:

- `at()`: exact semantics (`i < 0` → `i + length`; then `0 <= k < length` or `undefined`), the maybe rules it inherits, and the lowering (below). What `at()` on a `string` does, or that it is refused for now.
- Strict mode: the exact set of refused shapes (NL9007, NL9008, NL9009, `pop()` on an array not proven non-empty), whether `shift`/`slice` bounds are in scope, whether integer division's divisor check is in or out (recommend out: a separate `--strict-division` later), and the fix-it wording for each.
- The unchecked warning: code, wording, the summary line, and that it fires only when `--unchecked-indexing` is set.
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

## --strict-indexing

- **Flag.** New in [self/options.ts](../../self/options.ts) and [self/compile.ts](../../self/compile.ts). Passing it together with `--unchecked-indexing` is an error: strict proves the checks away, unchecked deletes them unproven.
- **Refusals.** Under the flag, NL9007, NL9008 and NL9009 are errors, not warnings. They keep their codes, with the severity raised; confirm in the design note whether the diagnostics registry wants separate error codes. Each message ends with a rewrite that compiles. For example:
  - `` guard it: `if (i < xs.length) { … xs[i] … }` ``;
  - `` or read it with `xs.at(i) ?? d` ``.

  The unsigned-bound defect noted in [self/checker.ts](../../self/checker.ts) (`TODO(wp15)`) must be fixed or worked around so no suggested rewrite fails to compile.
- **`pop()`.** On an array not proven non-empty it panics today (`index out of range: 0 >= 0`). Under strict it is refused unless the prover knows `length >= 1`.
- **Unchanged meaning.** A strict build's IR is identical to a default build's IR for any program strict accepts: strict refuses, it never changes codegen.

## --unchecked-indexing

- **New code.** Add an NL code through [scripts/gen-diagnostic-codes.mjs](../../scripts/gen-diagnostic-codes.mjs) and [self/codes.ts](../../self/codes.ts): "`xs[i]` is not proven in range, and `--unchecked-indexing` removed its check: an out-of-range index here is undefined behaviour".
- **When it fires.** It is raised at the NL9007/NL9008 sites whenever `uncheckedIndexing` is set, and **not** gated by `warnPerformance`. It ends with one summary line: `N accesses are unchecked and unproven`.
- **Proven programs stay quiet.** A program every access of which is proven prints nothing new.
- **Docs.** The `--unchecked-indexing` section of [docs/LANGUAGE.md](../../docs/LANGUAGE.md) says to use `--strict-indexing` to drop every check safely: once strict passes, unchecked has nothing left to remove.

## std under strict

- Compile each [std/](../../std/) module with `--strict-indexing`, and rewrite each refused access with a guard or `at()` without changing behaviour. `test:diff` and the std tests stay green.
- A named `std-strict` check in [tests/run.js](../../tests/run.js) compiles every std module under the flag, so a new unproven access in std fails `npm test`.
- `self/` is out of scope. It keeps tightening under `tests/perf-baseline.json`.

## Open decisions

For the owner, recorded in the design note:

1. `at()` (TypeScript's name, negative indices from the end) vs a Nish-only `get(i)` (Rust's name, no negative indices, needs a shim under Node). **Recommend `at()`.**
2. Strict mode's scope. Indices and `pop` only, or also divisor checks? **Recommend indices and `pop` only; division separately.**
3. Should `std/` adopt strict now (stage `std-strict`), or wait? **Recommend now: it is small, and it proves the fix-its are usable.**

## Out of scope

- Changing the default: checks stay on, and strict stays opt-in.
- Making `--unchecked-indexing` refuse to build.
- Strict mode for `self/`.
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
| `unchecked_*` (wordings) | the new warning and the summary line; a fully proven program prints nothing |
| `std-strict` (named check) | every std module compiles under `--strict-indexing` |

## Verification

- `npm run check`
- An undegraded `npm test`: read the skip count; no `DEGRADED:` line.
- `npm run test:diff`: every `at` case agrees with Node.
- `node tests/run.js arr_at strict unchecked std-strict`
- `node bench/run.mjs --instructions --check`: no count moves, since no existing program uses the new surface.
- `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js`: 0 undeclared differences.
- `npm run lint` and `node docs/check-links.mjs`.
- The rolling freeze: `self/` may not *use* `at()` until the next release's seed.
