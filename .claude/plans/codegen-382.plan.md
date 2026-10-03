---
name: Close the open codegen findings CG-2, CG-3, CG-4, CG-8 and CG-10 (#382)
overview: Fix the five codegen findings still open in docs/security/codegen.md and tracked by #382, one commit per finding, each with a regression test shown failing on the base commit and passing after, and the security record moved to fixed. One PR, squash-merged.
stages:
  - id: cg-fixes
    title: "fix(codegen): close CG-2, CG-3, CG-4, CG-8 and CG-10 (#382)"
    goal: Every one of the five findings fixed in src/ (and runtime/ where needed), pinned by a failing-first regression test, and recorded as fixed in the security record and README
    verification: npm run check && npm test (undegraded, skip count read) && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js
    todos:
      - id: cg8-willreturn-decls
        content: Drop willreturn from nish_read_file, nish_write_file, nish_append_file, nish_str_concat and nish_alloc_array in src/runtime.ts and correct their comments — see CG-8
        status: pending
      - id: cg4-recursion-willreturn
        content: Clear willReturn for every function on a call-graph cycle in src/attributes.ts before propagate — see CG-4
        status: pending
      - id: cg2-negative-new-array
        content: Panic on a negative i32 n in new Array<T>(n) before the allocator rounds it, in src/emit-arrays.ts (emitNewArrayLength) — see CG-2
        status: pending
      - id: cg3-join-limit
        content: Refuse a join whose result passes 2^31 − 1 bytes, before allocating, in src/emit-arrays.ts — see CG-3
        status: pending
      - id: cg10-compound-element-order
        content: Evaluate the right side of a compound element assignment before taking the slot address in src/emit-arrays.ts (emitElementAssignment) — see CG-10
        status: pending
      - id: security-record
        content: Move each finding to Fixed in docs/security/codegen.md, the README Areas counts, Open findings table and Corrections table, in the same commit as its fix — see Security record
        status: pending
---

## Context

[`docs/security/README.md`](../../docs/security/README.md) lists five codegen findings still open, all tracked by [#382](https://github.com/amritk/nish/issues/382). The codegen stage left them open because each fix moves goldens that stage could not regenerate. Every finding's row in [`docs/security/codegen.md`](../../docs/security/codegen.md) holds the reproducer and the fix it recommended.

## Approach

**Owns:** `src/**`, `runtime/**`, `tests/cases/**`, `tests/link/**`, `tests/self/goldens/**`, `tests/runtime-test.c`, `tests/perf-baseline.json`, `tests/nish-cmp.js`, `docs/security/codegen.md`, `docs/security/README.md`, `docs/LANGUAGE.md`, `docs/ARCHITECTURE.md`, `docs/IR_COOKBOOK.md`, `docs/AI.md`, `CHANGELOG.md`. Single stage, so nothing runs concurrently with it.


- **One stage, one PR, five commits, squash merge** (the owner's choice). All five fixes touch `docs/security/codegen.md`, the README table and `tests/self/goldens/checked-self.txt`, so they cannot be split into parallel slices without conflicting.
- **Commit order** is CG-8 → CG-4 → CG-2 → CG-3 → CG-10. CG-8 changes runtime attributes that CG-4's inference reads, so it goes first. Each commit regenerates the goldens it moves with `node tests/self/goldens.js --update` and `UPDATE_GOLDENS=1 node tests/run.js <case>`, and the diff is read before committing. Goldens are never hand-edited.
- **Failing-first.** For each finding, add the regression test and run it on the base commit (`e2826b9`) to show it fails, then apply the fix and show it passes. Paste both outcomes into the PR body under that finding.
- **No new language surface.** These are fixes, so there is no new syntax, builtin or diagnostic. A panic reuses an existing message and path. If a fix needs a new diagnostic code, it takes the next free one in its band in `src/codes.ts`.
- **Rolling freeze.** `src/` is built by the seed, so the compiler's own source may not *use* anything this PR adds (for example a new runtime symbol called from `src/`'s own program code). Emitting a call to a runtime function from generated IR is fine only if the runtime `src/` links against has it. CI's `bootstrap` job is the check.

## CG-8

[`src/runtime.ts`](../../src/runtime.ts) declares `nish_read_file` (:337), `nish_write_file` (:350), `nish_append_file` (:353), `nish_str_concat` (:244) and `nish_alloc_array` as `willreturn`, but each can `_exit(1)`: a missing or unwritable file, `open()` blocking on a FIFO with no writer, and the RT-2 and RT-7 out-of-memory refusals. Give them attributes without `willreturn` (keep `nounwind` and the memory effects), and rewrite their comments to say why. Also close the matching row in the README's "Corrections still to make" table.

- **Test:** a `tests/cases/` golden whose `.ll` shows the declarations without `willreturn`, plus a check that a caller of `readFileSync` is no longer inferred `willreturn`.
- **Commit:** `fix(runtime): stop declaring the exiting runtime calls willreturn`.

## CG-4

`willReturn` starts true (`src/attributes.ts:440`) and only a non-returning callee clears it (`propagateCallee`, :2232), so a function on a call-graph cycle keeps `willreturn`. A `readnone` self-recursive `spin(x)` was then deleted by `opt -O2`, and a program that should hang printed `returned`. Before `propagate` (:2166), walk each function's user callees and clear `willReturn` whenever the walk reaches the function itself. This covers self-recursion and mutual recursion, and matches LLVM FunctionAttrs, which never infers `willreturn` through recursion. Also correct the wrong claim in `docs/ARCHITECTURE.md` that LangRef allows unbounded recursion.

- **Tests:** two native round trips, self-recursion and mutual recursion. Each should hang, or recurse until a bounded guard ends it, rather than print `returned`. Use a reproducer whose correct output is deterministic, for example a recursion that terminates only after a large count, so that deleting the call changes stdout. Add a `tests/cases/` golden pinning that the recursive function's attribute group has no `willreturn`.
- **Goldens:** at least ten existing `.ll` goldens move (`cf_fib`, `fn_arrow`, `gen_recursive_ground`, `mem_scope_tail_call`, …). Regenerate them, and check the perf/instruction-count baselines (`tests/perf-baseline.json`) still pass undegraded.
- **Commit:** `fix(codegen): never infer willreturn for a recursive function`.

## CG-2

`newArrayLengthChecked` never checks an `i32` `n`, so a negative `i32` reaches `nish_alloc_struct` as a byte count past 2^63. The inline allocator ([`src/runtime.ts:808`](../../src/runtime.ts)) adds 7 without an overflow check, the bump "fits", and the `memset` writes until the process faults. Check `n < 0` for a signed `i32` `n` in `emitNewArrayLength` (`src/emit-arrays.ts`) and panic with the existing `array length out of range` message (`emitLengthCheck`) before anything is rounded. A literal `n` that is provably non-negative stays unchecked. Keep `collectArrayFacts` reporting the panic's callees so `willreturn` stays exact (CG-1 did the same).

- **Tests:** `tests/link/cg_sec_new_array_negative` (`new Array<u8>(parseInt(field))` with `-1` from argv or a file, in both number modes), expecting the panic message and a non-zero exit. On the base commit it faults or hangs. Add an IR golden in `tests/cases/` for the guard.
- **Commit:** `fix(codegen): panic on a negative new Array length before allocating`.

## CG-3

`join` (`src/emit-arrays.ts`, ~:1305) sums the part and separator lengths into `join.total` (i64) and allocates inline. Nothing bounds the total, so under `--number-mode i32` the result's `length` reads back negative and `src/bounds.ts` trusts it. After the sum and before the allocation, refuse a total past 2^31 − 1 bytes in both number modes, as RT-2 does for concatenation. Fail the same way RT-2 does (`nish: out of memory`, exit 1, through the runtime's `nish_oom` path) so every length source fails identically. A result of exactly 2^31 − 1 bytes is still made. With `join` closed, every source is bounded, so the bounds prover's trust in `.length` becomes sound. Say so in the CG-3 row and in K1-6's "still open" note.

- **Tests:** a `tests/link/cg_sec_join_limit` native round trip under `--number-mode i32` that joins parts summing past 2^31 − 1 bytes, for example two copies of a ~1.1 GB string read from a sparse file (RT-1 lets that through). It expects the out-of-memory failure. Before the fix it either answers a negative `length` or faults. Keep the test's memory use as low as the reproducer allows, and gate it the same way the existing large-file `rt_sec_read_cap` test is gated. Add an IR golden for the guard.
- **Commit:** `fix(codegen): refuse a join longer than 2^31 - 1 bytes`.

## CG-10

`emitElementAssignment` (`src/emit-arrays.ts`, ~:1059) computes the slot's address and then evaluates the right side. `xs[0] += grow(xs)`, where `grow` pushes until `xs` moves, therefore stores into the old block: it prints 1 where JavaScript prints 6. `zs[2] += shrink(zs)` stores past the new length. Keep the order JavaScript and [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) ("Evaluation order", ~:5043) define: evaluate the array reference and the index, read the old value, evaluate the right side, then **re-take the address** (re-load the data pointer and re-check bounds against the current length) and store. Leave the plain `xs[i] = e` path alone unless it has the same bug. If it does, fix it too and say so in the record.

- **Tests:** a native round trip for `xs[0] += grow(xs)` printing 6, and one for `zs[2] += shrink(zs)` panicking on the bounds check (or matching Node's output). Compare both against Node with `tests/nish-cmp.js` where the harness supports it. Every compound element assignment's golden moves, and those are regenerated.
- **Commit:** `fix(codegen): evaluate a compound element assignment's right side before its address`.

## Security record

In each finding's own commit:

- `docs/security/codegen.md`: the row becomes **Fixed**, naming the fix and its tests, in the style of CG-1. Update the "Status after the runtime stage" notes and any summary lines that list these as open.
- `docs/security/README.md`: move the codegen row's counts from Open to Fixed, update the Total row and footnote 1 (K1-6 / `join`), remove the finding from "Open findings", and for CG-8 remove the "Corrections still to make" row.

## Out of scope

- CG-6's emitter half (`emitOrReturn` joining a scope), which #382 also tracks. Leave the refusal in place.
- Any other open finding: CT-13, CLI-*, ECC-2, X509-*, RT-10..13, SC-16.
- New language surface, CLI flags or diagnostics.
- Closing #382. The PR says `Refs #382` and leaves CG-6 open there.

## Verification

```
npm run check
npm test                      # read the summary: no DEGRADED banner, only the 3 allowed environmental skips
npm run lint && npm run lint:dead
node docs/check-links.mjs
node tests/self/goldens.js          # check mode; --update only to regenerate, and read the diff
node scripts/changelog-gen.mjs --check-subject "<PR title>"
```
