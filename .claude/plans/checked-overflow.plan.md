---
name: Checked signed integer overflow by default
overview: Signed i32/i64 add, sub, mul, negate, increment, decrement and compound assignment stop carrying an unproven nsw and become a Rust-style checked panic (exit 1) by default; plain add nsw survives only where bounds.ts, ranges.ts or an integer range proves the result fits, and --wrapping keeps its meaning.
stages:
  - id: checked-arith
    title: "feat!(codegen): make signed integer overflow a checked panic by default"
    goal: Every signed add/sub/mul/negate/++/--/op= is either proven to fit (plain add nsw, proof written beside it) or lowered through llvm.s*.with.overflow to a cold noreturn panic, with the compiler, std and the corpus clean under the new default and the cost measured.
    verification: npm run check && npm test (undegraded, skip count read) && scripts/bootstrap.sh --verify && npm run lint
    todos:
      - id: runtime-panic
        content: Add the overflow panic entry to runtime/runtime.c, runtime/nish.h, runtime/runtime-wasm.c and the src/runtime.ts table, mirroring nish_panic_div — see Runtime
        status: pending
      - id: checked-lowering
        content: Lower signed add/sub/mul through llvm.s{add,sub,mul}.with.overflow in src/emit-ops.ts and route every caller (emit-control, emit-arrays, emit-classes, unary negate) through it — see Lowering
        status: pending
      - id: proven-no-check
        content: Record a per-node overflow proof from src/bounds.ts / src/ranges.ts / integer ranges in src/program.ts and emit plain add nsw only where it holds, proof written beside each case — see Proofs
        status: pending
      - id: attributes-fixpoint
        content: Teach src/attributes.ts that a checked op may call the overflow panic (as collectDivisionFacts does) and that a proven one does not — see Attributes
        status: pending
      - id: flags
        content: Keep --wrapping as plain wrapping ops with no check, and stop --nsw from reintroducing unchecked nsw in src/compile.ts and src/options.ts — see Flags
        status: pending
      - id: no-wrap-reliance
        content: Find and fix every place src/, std/, tests corpus, examples, bench and docs/cookbook rely on signed wrap, then prove stage2 == stage3 with the new default — see Self and std
        status: pending
      - id: tests
        content: Add the repro, one panic case per operator and width, one golden per proven no-check case, a --wrapping twin, and update opt_nsw and opt_wrapping — see Tests
        status: pending
      - id: measure
        content: Measure every docs/BENCHMARKS.md program before and after, extend proofs where the cost is large, and update bench/run.mjs's --nsw column — see Measurement
        status: pending
      - id: docs
        content: Rewrite docs/LANGUAGE.md Semantics decisions and the operator tables, docs/AI.md, docs/IR_COOKBOOK.md and CHANGELOG.md for checked overflow — see Docs
        status: pending
      - id: goldens-and-pr
        content: Regenerate .ll goldens and tests/self/goldens with the tools, read the diff, then open and drive the PR — see Shipping
        status: pending
---

# Checked signed integer overflow by default

## Context

Today every user-level signed `add`/`sub`/`mul` carries `nsw` by default ([src/emit-ops.ts](../../src/emit-ops.ts) `intOpcode`, [src/options.ts](../../src/options.ts) `nsw: true`; [docs/LANGUAGE.md](../../docs/LANGUAGE.md) "Semantics decisions", "Signed integer overflow is undefined behaviour"). That is an attribute with no proof, which breaks rule 3 of [.claude/orientation.md](../orientation.md). The repro in the task (`x + 1 > x` folded to `true` while `x + 1` prints `-2147483648`) is the visible consequence; a bounds panic reporting index 2147483648 is another. 383 of 587 `.ll` goldens carry `nsw` today.

Division already has the shape we want: `emitIntBinary` branches to a `div.fail` block that calls `nish_panic_div` (`nounwind noreturn cold`, `EFFECT_WRITE`, `WRITES_PANIC`) then `unreachable`, and [runtime/runtime.c](../../runtime/runtime.c) prints `attempt to divide with overflow` and exits 1. Ranged integers (WP31 §6) already have `emitPanicTail` / `emitRangedStore` and a proof table `nodeProvenRange`.

## Approach

- **Checked is the semantics, not a mode.** Overflow on a signed type is a defined panic. `--wrapping` is the one visible opt-in to defined wrapping. There is no way back to UB.
- **The proof is per node.** The checker records, the emitter reads (orientation rule 1): a new `nodeProvenNoOverflow` (name the worker's call) side table written by the bounds/ranges passes, read by `emitIntBinary`. Where it is true, emit `add nsw` (the `nsw` is then *justified*, and keeps loop/IV optimisation); elsewhere emit the intrinsic + branch.
- **The bounds proofs stay valid.** [src/bounds.ts](../../src/bounds.ts) uses `nsw` to argue that `i + 1` never wraps past `INT_MAX`. Under checked arithmetic it cannot wrap either — it panics — so every fact bounds.ts derives "under nsw" holds under the checked default; only `--wrapping` loses them, as today. Re-read every `nsw`-conditioned branch in bounds.ts and ranges.ts and keep the condition as "not `--wrapping`".
- **One cold panic call per op kind**, not per site, is acceptable but not required; mirror the division path first, then measure.

## Runtime

One entry, e.g. `void nish_panic_overflow(int32_t op)` with op ∈ {add, sub, mul, neg}, printing `attempt to add with overflow` / `attempt to subtract with overflow` / `attempt to multiply with overflow` / `attempt to negate with overflow` and exiting 1 through `nish_die`. Declare it in [src/runtime.ts](../../src/runtime.ts) exactly as `nish_panic_div` is (`nounwind noreturn cold`, `EFFECT_WRITE`, `addWrites(WRITES_PANIC, …)`, `noreturn = true`), in [runtime/nish.h](../../runtime/nish.h), and in [runtime/runtime-wasm.c](../../runtime/runtime-wasm.c) as `__builtin_trap()`. Layout rule 4 holds: `tests/run.js` must agree.

## Lowering

In [src/emit-ops.ts](../../src/emit-ops.ts): for a signed type with checking on and no proof, `%r = call {iN, i1} @llvm.s{add,sub,mul}.with.overflow.iN(lhs, rhs)`, `extractvalue` the flag, `br i1 %ovf, label %ovf.fail, label %ovf.ok`, fail block calls the panic and `unreachable`. Unary `-` (line ~415, `sub 0, x`) uses `ssub.with.overflow(0, x)` with the negate message. Callers to cover: `emit-ops.ts` binary (~371) and negate (~415), `emit-control.ts` compound (~396) and `++`/`--` (~409), `emit-arrays.ts` (~1170) and `emit-classes.ts` (~335) compound on elements and fields, and anything else `grep -n intOpcode src/` finds (the parallel emitter, `Math.abs`, ranged stores). Constant folds are unchanged: an overflowing fold is already refused (`reject_const_overflow_arith`). Unsigned types are untouched: they wrap, never flagged.

## Proofs

Plain `add nsw` with no check only where a fact proves the result is in range, with the reason written beside each case as [src/attributes.ts](../../src/attributes.ts) does. At minimum:

| case | proof |
| --- | --- |
| `i + 1`, `i++`, `i += 1` where `i < xs.length` (or `i < n`, any i32 `n`) is known | `i < n <= INT_MAX` so `i + 1 <= INT_MAX`; floor from bounds.ts keeps `>= INT_MIN` |
| `i - 1`, `i--` where `i >= 0` (or `i > lo` for any lo) is known | `i - 1 >= -1 > INT_MIN` |
| operands of `integer<Lo, Hi>` / u8/u16-widened values whose sum/difference/product bounds fit the width | interval arithmetic on the declared ranges |
| `a + b` where both are array indices / lengths known in `[0, len]` (i32 lengths ≤ INT_MAX… only if the sum bound fits) | only where the interval fits; otherwise check |

The proof table is filled by the pass that already knows the facts (bounds.ts walk, ranges.ts call-site pass), not re-derived in the emitter. Every proven case gets a golden.

## Attributes

[src/attributes.ts](../../src/attributes.ts) `collectDivisionFacts` adds `nish_panic_div` to a function's callees. Add the equivalent for an unproven checked op, so the fixpoint stays honest about `willreturn`/memory effects; a proven op adds nothing. Watch the cost: a function that loses an attribute because of a check is a measurement item, and the remedy is a proof, not a missing callee.

## Flags

- `--wrapping`: `opts.nsw = false` path, plain `add`/`sub`/`mul`, no check, defined wrap — unchanged meaning, and the bounds facts that need no-wrap are still lost under it as today.
- `--nsw`: today an accepted no-op that "says what the compiler does anyway" ([docs/LANGUAGE.md](../../docs/LANGUAGE.md) ~5240, [src/compile.ts](../../src/compile.ts) ~456). After this change it must not mean unchecked `nsw`. **Decided at sign-off:** a usage error, exit 2, saying signed overflow is now checked and `--wrapping` is the opt-in to wrap, with a CLI test pinning it. No new flag restores UB.
- The `nsw` option field may be renamed (e.g. `checkedOverflow`) if that reads better; `src/` may not *use* any new construct (rolling freeze), but renaming a field is not a construct.

## Self and std

Build stage1 from the seed, then stage2 with stage1 under the new default, then `scripts/bootstrap.sh --verify`. Any panic while stage2 compiles `src/` is a place the compiler relied on signed wrap: fix it in `src/` with `u32`/`u64` or an explicit range, never with `--wrapping` for the bootstrap. Same for `std/` (crypto, text, json, net — hashing and bit-mixing are the usual suspects; `src/map.ts` FNV is already `u32`), `examples/`, `bench/`, `docs/cookbook/`, `tests/differential/corpus/` and the fuzz generator (`tests/differential/fuzz.js --stage1` must not generate programs whose oracle wraps; adjust its generator or its JS rewrite so both sides agree on checked semantics). Note open PRs #399, #404, #406, #407 add `std/` code; they are not this PR's to fix, but the PR body names the rule they must meet once this merges.

## Tests

Mirror `div_checked`, `div_overflow_panic` and `perf_overflow*` in [tests/cases/](../../tests/cases/):

- the task's repro, expecting stderr `attempt to add with overflow`, exit 1, built at `--profile speed`;
- one native panic case per operator (`+ - *`, unary `-`, `++`, `--`, `+= -= *=`) for both `i32` and `i64`, on locals, array elements and fields;
- a `--wrapping` twin that prints the wrapped value and exits 0;
- unsigned arithmetic still unchecked and wrapping (`u_arith_wrap` unchanged);
- one golden `.ll` per proven no-check case in the Proofs table, pinning `add nsw` and the absence of the intrinsic;
- `opt_nsw` and `opt_wrapping` updated for the new default; a negative/`reject_` or CLI test for the `--nsw` decision;
- `tests/wordings/` / `tests/diagnostic-coverage.js` if any diagnostic code is added (next free code in its band in [src/codes.ts](../../src/codes.ts)).

Show the exact LLVM IR for every TypeScript snippet the PR adds, per CLAUDE.md.

## Measurement

Build every program in [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) (fib, nbody, spectral, sieve, strbuild, vec3, result, par-*, map*) with the base compiler and with this branch at `--profile speed`; record min/median wall time from `node bench/run.mjs` or an equivalent loop with changing input and a printed checksum. **Agreed bar: any program whose min wall time regresses by more than 5% against base blocks the merge** — extend the proofs (never the rule) until it is under 5%, or open the PR as a draft naming the program and why the remaining cost is unprovable. Replace the `Nish --nsw` column in [bench/run.mjs](../../bench/run.mjs) / [bench/README.md](../../bench/README.md) with `Nish --wrapping` (the cost of the checks). Regenerate `docs/BENCHMARKS.md` only if the full harness (C, Rust, Go) runs in the container; otherwise leave it and say so. The figures go in the commit's `Measured:` trailer, stated in full.

## Docs

- [docs/LANGUAGE.md](../../docs/LANGUAGE.md): the `i32`/`i64` rows (~157, ~160), the arithmetic table (~459, ~471, ~3023), "Semantics decisions" (replace "Signed integer overflow is undefined behaviour" with the checked rule and the proven exceptions), the const-fold paragraph (~1056), the bounds paragraph that says `--wrapping` costs the bounds-check elimination (~3235), and the flags list (~5236).
- [docs/AI.md](../../docs/AI.md): one rule — signed overflow panics; use `--wrapping` or `u32`/`u64` for hashing and bit-mixing.
- [docs/IR_COOKBOOK.md](../../docs/IR_COOKBOOK.md): the checked lowering and a proven `add nsw`.
- [CHANGELOG.md](../../CHANGELOG.md): one line, if the repo's convention still wants it beside the commit body.

## Shipping

`node tests/self/goldens.js --update` (with `--seed build/seed/bin/nish` if `build/nish` is absent) and `npm run test:update`; read the diff — 380-odd `.ll` files will move and every moved one should show `nsw` becoming either a checked sequence or a proven `nsw`. Commit `feat!(codegen): make signed integer overflow a checked panic by default` with a prose body, `Measured:`, `Refs: docs/LANGUAGE.md#semantics-decisions`, `Tests:` trailers. Open the PR, read its body back and remove any session footer (`pr-body.yml`).

## Out of scope

- Unsigned arithmetic (stays wrapping, unflagged).
- Float arithmetic.
- Fixing `std/` code in other open PRs.
- Any new syntax, pragma or decorator; any flag that restores UB.
- Cutting a release; the rolling freeze means `src/` cannot *use* any new construct, and this change adds none.

## Verification

```bash
npm run check
npm test                      # read "N passed, M failed, K skipped" — K must not grow; no DEGRADED banner
scripts/bootstrap.sh --verify # stage1 == stage2, stage3 == stage2, under the checked default
npm run lint
node scripts/gen-diagnostic-codes.mjs --check
```
