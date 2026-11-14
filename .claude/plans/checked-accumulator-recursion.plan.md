---
name: Checked sums in self-recursion become a loop
overview: fib is 1.50x Rust at 0.39.0, and the cause is not call overhead. Nish's fib is instruction-for-instruction the same as C with the same overflow check. The checked `+` (llvm.sadd.with.overflow) stops LLVM's accumulator tail-recursion elimination, which turns C's and Rust's plain-add fib into a loop over its second call and halves the calls. Emit that loop ourselves for checked integer `+`, with the overflow check deferred to the base case and proved equal to the right fold the program asked for, so fib, tree sums and every `f(...) + g(...) + f(rest)` recursion keep their checks and lose the extra frames.
stages:
  - id: s1-checked-accumulator
    title: S1 — self-recursive checked sums emitted as a loop
    goal: A function whose recursive returns are `X + self(args)` over a checked integer `+` is emitted as a loop with a deferred, exact overflow check. Its output and its panics are byte-identical to today's, and fib is within 1.10x of Rust.
    verification: node bench/run.mjs --only fib --no-go --runs 15 --warmup 2 shows Nish / Rust ≤ 1.10x on interleaved re-runs; node tests/run.js performance, node tests/run.js wasi (WASI_SYSROOT=/usr), node tests/run.js for the new cases, node tests/nish-cmp.js, npm run check and npm run lint all pass.
    todos:
      - id: recorder
        content: Add a recorder module (fusion.ts's shape, the checker records and the emitter reads) that marks a function eligible and names its step and base returns — see S1 the rules
        status: pending
      - id: emit-loop
        content: Emit an eligible function as a header loop with params as loop-carried values, a wide prefix sum and its running min and max, and the one deferred check at each base return — see S1 the emission
        status: pending
      - id: proof-comment
        content: Write the equivalence proof beside the emitter (the order of calls, the order of side effects, which panic, and the bound on the wide accumulator) — see S1 the proof
        status: pending
      - id: tests
        content: Golden .ll and llvm-as pass for fib, tree sum and a two-step-return function, native round trips with expected stdout, the overflow cases from S1 the proof, and negative tests that keep today's IR for ineligible shapes — see S1 the tests
        status: pending
      - id: real-world
        content: Measure one non-bench recursive program (a class-node binary tree sum, tests/cases or examples) before and after, interleaved, with its noise band — see S1 the measurement
        status: pending
      - id: corpus
        content: Run nish-cmp, add a narrow DECLARED entry for each corpus program whose IR moves, regenerate tests/self/goldens/checked and the differential goldens — see CLAUDE.md definition of done
        status: pending
      - id: docs
        content: Record the cause and the result in docs/wp9-optimisation.md, add the IR_COOKBOOK entry with exact IR, and correct bench/fib.rs's comment that Nish wraps on overflow — see S1 the docs
        status: pending
---

# Checked sums in self-recursion become a loop

## Context

Re-measured on 2026-11-14 at `main` d38a94b0 (nish 0.39.0), 4-core cloud VM,
`node bench/run.mjs --only fib --no-go --runs 15 --warmup 2`:

| | Nish | C `-O3` | Rust `-O3` | Rust native | Nish / Rust |
| --- | ---: | ---: | ---: | ---: | ---: |
| fib(40), min / median ms | 465 / 480 | 309 / 322 | 310 / 320 | 307 / 327 | 1.50x |

The gap is the overflow check, not call overhead:

- Nish's optimised `fib` and C's `fib` with `__builtin_add_overflow`
  plus a cold noreturn panic compile to the same x86 instruction for
  instruction: the same `push rbp; push rbx; push rax` prologue, the same
  two calls, `add` + `jo`. That C program runs in 434–458 ms.
- Nish's own `.ll` with the `sadd.with.overflow` replaced by `add nsw`,
  linked with `--profile speed`, runs in 312–340 ms, which is C's and Rust's
  time.
- `opt -O3` on C's fib shows why. TailCallElim's accumulator recursion
  elimination turns `fib(n-1) + fib(n-2)` into a loop over the second call,
  so the program makes half the calls. The pass handles only associative,
  commutative instructions, and `sadd.with.overflow` plus a branch is not one.
  Rust release builds wrap, so they get the same loop. `bench/fib.rs` says
  "Release builds wrap on overflow (like Nish)", which has been false since
  #426.
- None of the attributes would change this. fib is already `internal fastcc`,
  `noundef`, `nounwind`, and the frame needs no stack probe.
- It is not fib-only. A C binary-tree sum over 4M nodes, 40 passes, takes
  ~905 ms with plain `+` and ~1210 ms with checked `+` (1.33x). Any
  `count(l) + count(r) + 1` or `sum(l) + v + sum(r)` walk pays the same.

`docs/wp9-optimisation.md` already records that fib is at parity under
`--wrapping`. This plan keeps the checks and emits the loop LLVM cannot.

## S1 the rules

A function is eligible when all of these hold. Everything else compiles
exactly as today. The checker records eligibility and the emitter reads it
(orientation rule 1).

- It is a plain function or `const` arrow, not a method, generator, `async`
  function or closure that captures a parameter. Its return type is an
  integer type whose `+` is checked (i32 under the default number mode; other
  checked integer widths if the emitter's checked-add path covers them). Not
  under `--wrapping`, where the add is already plain and LLVM does this, and
  not `f64`, where `fadd` is not associative.
- Every `return` is one of two kinds:
  - **step**: `X + self(args)`, where the `+` is a checked integer add and
    `self(args)` is its right operand, so it is evaluated last. `X` may contain
    anything, other calls to `self` included (fib). `self(args) + X` is also
    a step when `X` is a literal, a local or a parameter: nothing observable
    happens between the two evaluations, so commuting them is invisible. A
    chain such as `sum(l) + v + sum(r)` parses as `(sum(l) + v) + sum(r)` and
    is a step with `X = sum(l) + v`.
  - **base**: any expression with no call to `self` in tail position.
- At least one return is a step and at least one is a base.
- Nothing runs at the function's exit that a loop would skip or repeat: no
  `try`/`finally`, no arena mark the function releases on return, no region or
  scope ended by the return, no stack slot whose address outlives an
  iteration, no `defer`-like cleanup. Read these from the facts the checker
  already records, such as the per-call memory facts from #1558. Never
  re-derive them in the emitter. If a fact is missing, the function is
  ineligible.

## S1 the emission

- The entry block jumps to a header with parameters as loop-carried values
  (phis or allocas that mem2reg promotes), and with the prefix sum `P` and its
  running `minP` and `maxP`, all starting at 0, in a type wide enough for the
  bound in the proof.
- At a step return: evaluate `X`, then evaluate `args` into temporaries, all
  in source order. Set `minP = min(minP, P)` and `maxP = max(maxP, P)`, then
  `P += sext(X)`. Assign the parameters from the temporaries, then branch to
  the header.
- At a base return: evaluate `E`, then `T = P + sext(E)`. If
  `minP < T - MAX` or `maxP > T - MIN`, call the same `nish_panic_overflow(op)`
  with the same `op` the `+` would have passed. Otherwise return `trunc(T)`.
- For fib, the target is the shape `clang -O3` gives C's fib, plus a
  compare/select pair and the deferred check.

## S1 the proof

Write this beside the emitter in full. It is the reason the transform is
allowed (orientation rule 3's spirit: no transform without a proof).

- The program asks for the right fold
  `R = a_0 + (a_1 + (... + (a_{k-1} + base)))`, checked at every `+`:
  `S_j = a_j + S_{j+1}` with `S_k = base`, and it panics if any `S_j` leaves
  the type's range.
- The order of evaluation is unchanged. In the original, every `a_j`
  (each `X`) and every argument list are evaluated, in order, before any of
  the `+` runs. The loop evaluates them in that same order. Their own panics
  and output therefore happen exactly where they did.
- The checks. Let `P_j = a_0 + ... + a_{j-1}`, so `P_0 = 0`, and let
  `T = P_k + base = S_0`, computed exactly. Then `S_j = T - P_j`, so
  "every `S_j` for `j < k` is in `[MIN, MAX]`" holds exactly when
  `min(P_0..P_{k-1}) ≥ T - MAX` and `max(P_0..P_{k-1}) ≤ T - MIN`. The
  deferred check fails exactly when the original would have panicked at one
  of its adds.
- Which panic. Every `+` in the fold passes the same `op` to
  `nish_panic_overflow`, which prints by `op` alone (runtime/runtime.c). So
  the original's innermost failing add and the loop's single check print the
  same message and exit with the same status. If a function's step returns
  could pass different `op` values, it is ineligible.
- The bound. `|P_j| ≤ j · 2^(w-1)` for a `w`-bit type. The accumulator must
  be wide enough that no reachable `k` overflows it, and the comment must say
  why. i128 for an i32 sum needs `k ≥ 2^96` to overflow, which no run can
  reach. i64 needs `k ≥ 2^32`, which an unlimited stack could reach in
  principle. Do not use i64 on a stack-depth argument. Choose by
  measurement, and write the argument.
- What changes: the loop needs no stack frame per step. A recursion deep
  enough to overflow the stack today now completes. LLVM's own
  TailCallElim does the same to C and Rust, and it is the point of the
  change.

## S1 the tests

- Golden `.ll` and an `llvm-as` pass for fib, a class-node tree sum
  (`sum(t.left) + t.value + sum(t.right)`, null base), and a function with
  two step returns and two base returns.
- Native round trips with expected stdout for each.
- Overflow, each against the expected stdout and exit status the same
  program has today. Build them at the base SHA to get those values.
  - (a) The right fold overflows at the innermost add: same panic message
    and exit status.
  - (b) The right fold overflows only at the outermost add.
  - (c) A left-to-right prefix sum would overflow but the right fold does
    not, e.g. steps adding `MAX`, `MAX` and `-MAX` around a negative base. It
    must complete with the same output. This is the case a naive "accumulate
    and check as you go" gets wrong.
  - (d) A side effect (`console.log`) in `X` keeps its order relative to a
    later overflow panic.
- Negative tests whose IR stays exactly today's: f64 mode, `-` instead of `+`,
  `self(args) + X` with a call in `X`, a method, a `try`/`finally`, a function
  with an arena scope, and `--wrapping`.
- Show the exact IR for every TypeScript snippet the PR adds (CLAUDE.md).

## S1 the measurement

- fib: `node bench/run.mjs --only fib --no-go --runs 15 --warmup 2`, at
  least three interleaved runs, before and after on the same container.
  Restore `docs/BENCHMARKS.md` afterwards (`git checkout docs/BENCHMARKS.md`).
  A run on a cloud VM is not a quiet-machine regeneration of the whole table.
- The tree-sum program, before and after, interleaved, min / median, with a
  noise band (`.claude/testing.md` → "A `Measured:` trailer").
- `node tests/run.js performance`: it must pass, and any NL9007 must be read.
- The nish-cmp list of corpus programs whose IR moved says how far the
  change reaches. Put it in the PR body.

## S1 the docs

- `docs/wp9-optimisation.md`: replace the "fib is 1.68x by default … at
  parity under `--wrapping`" account with the cause above, the transform and
  the measured result.
- `docs/IR_COOKBOOK.md`: an entry with the TypeScript, the emitted IR and
  the proof's one-paragraph summary.
- `bench/fib.rs`: correct the comment. Nish checks overflow by default, and
  Rust release wraps.
- No guide page or LANGUAGE.md rule should change, because nothing a user
  writes or sees changes except speed and stack depth. If a guide page
  states that deep self-recursion overflows the stack, or quotes fib's
  ratio, update it.

## Out of scope

- `*` and `-`. `*` with a checked accumulator needs a different exact check,
  and `-` is not associative.
- Mutual recursion, and methods.
- Refreshing the whole `docs/BENCHMARKS.md` table.

## Verification

`node bench/run.mjs --only fib --no-go --runs 15 --warmup 2` ≤ 1.10x Rust on
interleaved re-runs; `node tests/run.js performance`; `node tests/run.js wasi`
with `WASI_SYSROOT=/usr`; `node tests/run.js` on the new cases;
`node tests/nish-cmp.js` with DECLARED entries; `npm run check`;
`npm run lint`; `node scripts/gen-reference.mjs --check`;
`node docs/check-links.mjs`; then CI's eight test shards green on the head.
