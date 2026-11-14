---
name: Widen the self-recursive checked-sum loop and pin its overflow against the recursion
overview: The checked-sum loop of #1597 (src/accumulate.ts records, src/emit-accumulate.ts writes) reaches only free i32 functions. Pin every panicking acc_* case against --no-elision byte for byte, commit the tree-sum benchmark, then widen eligibility to methods, other checked integer widths and functions whose arena scope is released per step, each with its proof beside the emitter. Issue #1605.
stages:
  - id: overflow-diff
    title: "test(codegen) — pin every panicking acc_* case against --no-elision byte for byte"
    goal: Every panicking run of an acc_* case is compared, stdout, stderr and exit status byte for byte, between the loop build and the --no-elision build
    verification: node tests/run.js acc
    todos:
      - id: panics-sidecar
        content: Add tests/cases/acc_overflow.panics, acc_effects.panics and acc_soundness.panics listing today's panicking runs — see Overflow differential
      - id: diff-check
        content: Add the tests/run.js check that builds each acc_* case with a .panics sidecar twice (default, --no-elision) and compares each listed run byte for byte — see Overflow differential
      - id: diff-guards
        content: Make the check fail when a listed run exits 0, when the default build of the program has no rec.head loop, or when a .panics file names no run — see Overflow differential
      - id: diff-negative
        content: Prove the check can fail — a deliberately different reference must make it report, by a helper's exit status, not message text — see Overflow differential
  - id: tree-bench
    title: "test(bench) — commit the tree-sum benchmark with a free-function and a method kernel"
    goal: The tree-sum figure in docs/wp9-optimisation.md is reproducible from bench/, and a class-method tree walk has a committed benchmark
    verification: node bench/run.mjs --only treesum --runs 3 --validate
    todos:
      - id: bench-nish
        content: Add bench/treesum.ts with kernels fn and method over one depth-20 tree summed 60 times — see Tree-sum benchmark
      - id: bench-twins
        content: Add bench/treesum.c, bench/treesum.go and bench/treesum.rs twins with matching checksums per kernel — see Tree-sum benchmark
      - id: bench-register
        content: Register treesum in bench/run.mjs BENCHMARKS with both kernels and add its row to bench/README.md — see Tree-sum benchmark
  - id: acc-methods
    title: "perf(codegen) — emit self-recursive checked-sum methods as a loop"
    goal: A statically bound method whose recursive returns are steps over a receiver of its own class (the treesum method kernel) is emitted as one loop, with its proof beside the emitter
    verification: node tests/run.js acc && node tests/run.js wasi && node tests/run.js performance && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: methods-record
        content: Extend signatureQualifies and isSelfCall in src/accumulate.ts to methods whose self call is statically bound, with the receiver as the loop's first parameter — see Methods
      - id: methods-emit
        content: Carry the receiver as a header phi in src/emit-accumulate.ts and write the methods proof beside the emitter — see Methods
      - id: proof-pointer
        content: Point the emitter proof's Y sentence at the recorder's argument in src/accumulate.ts — see Proof pointer
      - id: methods-cases
        content: Add tests/cases/acc_method*.ts (eligible walk, overflow cases with a .panics sidecar, overridden and interface-dispatched methods that stay recursion) with goldens — see Methods
      - id: methods-measure
        content: Measure fib and treesum fn and method before and after, interleaved, with a noise band, and record it in docs/wp9-optimisation.md and the Measured trailer — see Measurement
      - id: methods-nishcmp
        content: Run nish-cmp and add narrow DECLARED entries in tests/nish-cmp.js for every moved program — see Measurement
  - id: acc-widths
    title: "perf(codegen) — emit self-recursive checked sums of every checked integer width as a loop"
    goal: Every integer type whose + is checked, signed and unsigned, qualifies, each width's cold test and proof written beside the emitter
    verification: node tests/run.js acc && node tests/run.js wasi && node tests/run.js performance && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: widths-record
        content: Accept every checked integer return type in src/accumulate.ts in place of T_I32 — see Widths
      - id: widths-emit
        content: Emit each width's header and cold test in src/emit-accumulate.ts and write the signed and unsigned proofs — see Widths
      - id: widths-cases
        content: Add tests/cases/acc_width*.ts per width with overflow .panics sidecars at each width's MAX (and 0 for unsigned) plus goldens — see Widths
      - id: widths-measure
        content: Re-measure fib and treesum for regression, run nish-cmp and add DECLARED entries — see Measurement
  - id: acc-arena
    title: "perf(codegen) — emit self-recursive checked sums with a per-step arena scope as a loop"
    goal: A function whose only blocker is its inferred arena scope qualifies when nothing a step allocates reaches the next step, the scope released per step, with its proof beside the emitter
    verification: node tests/run.js acc && node tests/run.js wasi && node tests/run.js performance && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: arena-record
        content: Record when a step's arena allocations cannot reach its arguments or the next step, in src/accumulate.ts — see Arena scope
      - id: arena-emit
        content: Release the frame's arena scope per step and on rec.call and base exits in src/emit-accumulate.ts, with the proof — see Arena scope
      - id: arena-cases
        content: Add tests/cases/acc_arena*.ts (a template per frame, an overflow .panics sidecar, a step whose argument is arena-allocated and stays recursion) with goldens — see Arena scope
      - id: arena-measure
        content: Re-measure fib and treesum, run nish-cmp and add DECLARED entries — see Measurement
---

# Widen the self-recursive checked-sum loop (issue #1605)

## Context

#1597 emits a self-recursive checked sum (`X + self(args)`, `self(args) + Y`) as one loop with an overflow check that panics where the recursion would. [`src/accumulate.ts`](../../src/accumulate.ts) records eligible functions; [`src/emit-accumulate.ts`](../../src/emit-accumulate.ts) writes the loop and carries the proof. fib is 0.89–0.93x of Rust on `main` at 7699d971. Today eligibility is: free functions only, `i32` only, no arena scope (`emitsAsLoop` refuses `facts.arenaScope`). nish-cmp moved no `src/`, `std/` or bench program but fib. The overflow cases are pinned by hand (exit 1 and a stderr substring), and the CI `nish-cmp elision` job compares `--no-elision` only on runs with no arguments.

## Approach

- **One width, receiver or scope per stage, serial.** The three widenings all edit `signatureQualifies`, `emitsAsLoop` and the proof, so they run one after another: methods first (the class-method tree walk is the named target), then widths, then arena scopes. Each lands its own proof beside the emitter.
- **Panicking runs are discovered from a sidecar, not a list in `tests/run.js`.** `tests/cases/<case>.panics` holds one run per line (whitespace-separated argv). The overflow-diff check reads every `tests/cases/acc_*.panics`, so the later stages add cases without editing `tests/run.js`.
- **The benchmark lands before the method change measures against it.** `tree-bench` merges before `acc-methods`; `acc-methods` may measure from the `tree-bench` branch while it is open.

## Overflow differential

Owns: `tests/run.js`, `tests/cases/acc_overflow.panics`, `tests/cases/acc_effects.panics`, `tests/cases/acc_soundness.panics`

- Sidecar format: one line per run, the argv the program gets (`0`, `3 1000000000`, ...). Blank lines and `#` comments allowed. Today's runs: `acc_overflow` cases 0–3, `acc_effects`'s `noisy(3, 1000000000)` run, `acc_soundness` cases 0 and 1. Check the name passes `scripts/check-filenames.mjs` and that no other harness reads `.panics` as something else.
- The check, in the existing `acc_` section of [`tests/run.js`](../../tests/run.js) (around :16270): for each `tests/cases/acc_*.panics`, compile its `.ts` twice with the build compiler, once as is and once with `--no-elision`, link both, run each listed argv under both, and compare stdout, stderr and exit status byte for byte. One `check(...)` per run, naming the program and argv.
- Guards that keep the comparison meaningful: the default build's IR has a `rec.head` (the loop is really under test); each listed run exits non-zero; a `.panics` with no run fails.
- Keep the existing hand-pinned checks: they pin the message text the differential cannot.
- A negative: the check must be shown to fail on a mismatch, e.g. a helper the check runs against a deliberately divergent pair, judged by exit status. Follow [`.claude/testing.md`](../../.claude/testing.md#checks-that-spawn-a-process): CI runs ubuntu with uutils, so no assertion on a tool's message text or on the process's descriptor count.

## Tree-sum benchmark

Owns: `bench/treesum.*`, `bench/run.mjs`, `bench/README.md`

One program, two kernels (the `kernels` mechanism of [`bench/run.mjs`](../../bench/run.mjs), rows `treesum/fn` and `treesum/method`), over one complete depth-20 tree of class nodes, summed 60 times, the shape [`docs/wp9-optimisation.md`](../../docs/wp9-optimisation.md) measured (median 318 → 191 ms):

```ts
class TreeNode {
  value: i32
  left: TreeNode | null
  right: TreeNode | null
  // constructor(value, left, right)
  sum(): i32 {
    const left = this.left
    const right = this.right
    const l = left === null ? 0 : left.sum()
    if (right === null) {
      return this.value + l
    }
    return this.value + l + right.sum()
  }
}

const sum = (t: TreeNode | null): i32 => {
  if (t === null) {
    return 0
  }
  return t.value + sum(t.left) + sum(t.right)
}
```

The `fn` kernel is the wp9 program exactly. The `method` kernel is the shape `acc-methods` must make eligible; do not reshape it to suit the compiler. Values must keep every sum inside `i32`. C, Go and Rust twins implement both kernels with the same structure (a heap node with two nullable children, recursive sum), carry the `bench:n` marker, and print the same checksum per kernel. Add the README programs row. Do not hand-edit `docs/BENCHMARKS.md` (generated). Original code: no licence notice needed.

## Methods

Owns: `src/accumulate.ts`, `src/emit-accumulate.ts`, any `src/*.ts` the receiver plumbing strictly needs (name each in the PR body), `tests/cases/acc_method*`, `tests/differential/corpus/acc_*`, `tests/nish-cmp.js`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/wp9-optimisation.md`

- Eligible: an instance method (not static unless it is a plain free function in disguise, not a constructor, accessor, generic, async, generator) whose step's self call is **statically bound** to this very method — the class's method is not overridden by any subclass in the program, and the call is not through an interface or a union that dispatches. The receiver is `this` or a value of the method's own class (non-null after narrowing, not `?.`).
- The loop treats the receiver as parameter 0: a header `phi` of the receiver, rebound per step to the step call's receiver expression, evaluated in source order with the arguments.
- Proof beside the emitter: why a statically bound self call through another receiver is the same function with a different first argument, so the existing argument holds; why reading fields of `this` in `X` and in a `Y` is what the recursion reads (no frame of the recursion can assign them in an eligible body — or state the restriction that makes it so, e.g. no field assignment and no call that may write a field in the body).
- Cases: the treesum method shape (both a loop and the right answer), overflow cases mirroring `acc_overflow` 0–3 with a `.panics` sidecar, and negatives that stay recursion: an overridden method, a call through an interface, a method that assigns a field of `this` before its step.

## Proof pointer

In [`src/emit-accumulate.ts`](../../src/emit-accumulate.ts), "Each step's `X` and arguments run where the recursion runs them" does not hold for `Y` in `self(args) + Y`. Say so, and point at the recorder's argument in [`src/accumulate.ts`](../../src/accumulate.ts) (`recordAccumulation`'s header: reading `Y` after the recursion and before are one value, because the recursion cannot assign this frame's parameters). Carried by `acc-methods` because it rewrites the same proof; `tree-bench` owns no `src/` file.

## Widths

Owns: as Methods, with `tests/cases/acc_width*` in place of `tests/cases/acc_method*`

- Every integer type whose `+` goes through `emitCheckedArith` qualifies; a type whose `+` wraps by definition stays out. Name the set in the recorder's header.
- Signed widths: the existing proof with `MAX` and `MIN` of the width; the cold test is the sign test at that width.
- Unsigned widths: every `X` is at least 0 by type, so the sum is monotone and overflow is a carry; the cold test is the carry of the header's add. Write it as its own paragraph of the proof, not as "the same".
- Cases per width: in-range sums, an innermost and an outermost-only overflow at the width's `MAX` with `.panics` sidecars, and for each the golden `.ll`.

## Arena scope

Owns: as Methods, with `tests/cases/acc_arena*` in place of `tests/cases/acc_method*`, plus `src/attributes.ts` only where the escape facts must be read (name the lines in the PR body)

- Eligible when `facts.arenaScope` is the only blocker and nothing a step allocates in the frame's scope can reach the step's arguments, its `X` value (an integer, so only through effects), or a later step. A step whose argument is arena-allocated in the step stays recursion.
- The loop releases the frame's scope before looping back, and on the `rec.call` and base exits as the function's own epilogue would. State in the proof why memory a step freed is never read again, and that peak memory may fall (as stack depth already does), which nothing observes.
- Cases: a recursion that builds a template per frame and sums its length, its overflow `.panics`, and the negative above.

## Measurement

Every `src/` stage, before its PR goes up:

- `node bench/run.mjs --only fib --no-go --runs 15 --warmup 2` and the treesum rows, interleaved base build / branch build, two runs of each binary to read the noise band ([`.claude/testing.md`](../../.claude/testing.md) → "A `Measured:` trailer"). Record the figures in the `Measured:` trailer and, for `acc-methods`, in the wp9 section beside the tree-sum figure, pointing at `bench/treesum.ts`.
- `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js`; every moved program gets a narrow `DECLARED` entry (program + file, the PR's release-note words).
- A widening that measures inside its noise band still ships when its proof and tests hold; say so in the PR.

## Out of scope

- `self(args) + Y` with an effect-free `Y` that may panic (#1605 lists it; not asked for here).
- Operators other than `+`, loops or `switch` in the body, recursive-descent parsers.
- Changing `--no-elision`'s meaning or the `nish-cmp elision` CI job.

## Tests

Mirror `tests/cases/acc_overflow.ts`, `acc_tree.ts` and `acc_ineligible.ts`. Each new positive case is registered with `node tests/differential/goldens.js --update` in the same commit; `tests/self/goldens/checked/` is regenerated with `node tests/self/goldens.js --update`.

## Verification

`npm run check`, `npm run lint`, `npm run lint:dead`, `node scripts/gen-reference.mjs --check`, `node docs/check-links.mjs`, and each stage's `verification` line. `src/` stages also run `WASI_SYSROOT=/usr node tests/run.js wasi` and `node tests/run.js performance` and read the wasi skip line. CI's eight `test` shards are the full-suite gate.
