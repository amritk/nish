---
name: Close four gaps in the panic prover
overview: The panic prover (src/bounds.ts, src/ranges.ts) refuses four kinds of correct code under --deny-panics — a named constant or converted literal not read as its value, the range of x & mask (and x >>> k), the range of charCodeAt, and a down-counting loop that loses its upper bound. Teach the prover to read each one soundly, update the "what the prover reads" rules and guide, and measure the drop in std refusals on a real program.
stages:
  - id: s1-prover-gaps
    title: "feat(checker): read named constants, masks, charCodeAt and down-counting loops in the panic prover"
    goal: The four gap snippets compile under --deny-panics with their runtime check gone from the IR, every listed negative is still refused with the same code and wording, the panics oracle and bootstrap --verify pass, and the PR body records vector's std refusals before and after.
    verification: npm run check && npm run lint && rm -rf build/test && node tests/run.js <filter> for each new case and for the tests/run.js sections that hold the existing bounds and overflow tests (named in the PR body) && node tests/panics-oracle.js && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && node tests/self/goldens.js && node scripts/gen-reference.mjs --check && bash scripts/bootstrap.sh --verify, each summary read for its case and skip counts
    todos:
      - id: gap1-constants
        content: "Gap 1 — read a const binding (module or function level, never let, never a field) whose initializer is an integer literal or a constant the checker folds, and toI32/toU32/toI64/toU64/toU8… of a literal that fits, as its value, through the same path a literal takes into an interval. Negatives stay refused: let, a const from a non-conversion call, a conversion of a literal that does not fit, a negative constant length — see S1 — Gap 1"
        status: pending
      - id: gap2-mask
        content: "Gap 2 — give x & C (C a non-negative constant) the range [0, C] for any operand sign, and x >>> k the range [0, 2^(bits-k) - 1] if the same table carries it; check that toI32 of a u32 in a known range keeps the range — see S1 — Gap 2"
        status: pending
      - id: gap3-charcodeat
        content: "Gap 3 — confirm charCodeAt's result in runtime/nish.d.ts and docs/LANGUAGE.md, then give it [0, 255] from where the builtin is typed, not as a prover special case; list any other builtin with a documented range in the PR body and add only those the docs promise — see S1 — Gap 3"
        status: pending
      - id: gap4-downcount
        content: "Gap 4 — keep a loop variable's upper bound at the loop head when the body only decrements it (end starts at t.length, end -= 1), staying sound against other writes to the variable and reassignment of the string; confirm the mirror up-counting loop proves — see S1 — Gap 4"
        status: pending
      - id: tests
        content: "Per gap: a positive case under --deny-panics with its IR shown (no nish_panic_index / llvm.*.with.overflow / divide test for the site, nsw where an add is now proven), a native round trip on the edge value (last byte, mask top value, byte 255), and the negatives refused with the same code and wording — placed where .claude/testing.md says prover tests go, new tests/cases registered with node tests/differential/goldens.js --update — see S1 — Tests"
        status: pending
      - id: docs
        content: "Grow the \"what the prover reads\" rules in docs/LANGUAGE.md (Panic sites, the overflow rule) and the docs/guide page that tells users which guards prove; leave diagnostic hint wording alone unless one is now wrong; regenerate docs/reference — see S1 — Docs"
        status: pending
      - id: ir-moves
        content: "Run nish-cmp and add narrow DECLARED entries with the PR's release-note words; node tests/self/goldens.js --update and read every hunk (each should be a removed check); bootstrap --verify stage2 = stage3; wasi and performance runs with NL9007 counts only going down, lowering the ratchet if the run says to — see S1 — IR moves"
        status: pending
      - id: measure
        content: "Before and after: vector's NL2458 refusals into std grouped by std/<file>.ts:LINE:COL (baseline 0.42.0: 460 call refusals into std, 2,459 errors), the examples refused under --deny-panics, and a Measured: trailer for any runtime figure; the remaining std list goes in the PR body — see S1 — Measure"
        status: pending
---

# Close four gaps in the panic prover

Source: the requirements handed to `/feature` (reproduced in the tracking
issue). Read `CLAUDE.md`, `.claude/orientation.md`, `.claude/selfhost.md`
and `.claude/testing.md` first. This is a `src/` change: the rolling
freeze, the `wasi` and `performance` runs and the goldens all apply.

Soundness is the whole point: a fact the prover adds removes a runtime
check from the IR, so a wrong fact is a silent out-of-bounds read or a
wrap. When a case is ambiguous, refuse it and say so in the PR body.

## S1 — the four gaps, one PR

**Owns:** `src/**`, `runtime/nish.d.ts`, `tests/**`, `docs/LANGUAGE.md`,
`docs/guide/**`, `docs/reference/**`, `docs/IR_COOKBOOK.md`,
`docs/cookbook/**`, `scalar.config.json`.

Not `std/**`: changing std source to dodge a gap is out of scope, and so
are contract panics (`split` with an empty separator, `slice` out of
range, `Map.valueAt` out of range).

One stage rather than four because every gap lands in `src/bounds.ts`
(and most in `src/ranges.ts`), every gap moves the same self goldens and
nish-cmp corpus, and the requirements ask for one PR with one
before/after measurement. The type is `feat(checker)`: the "what the
prover reads" list grows.

### Gap 1 — a named constant or a converted literal is read as its value

```ts
const N: i32 = 8
export const p = (): u32[] => new Array<u32>(N)    // refused today: array-length
export const q = (): u32[] => new Array<u32>(8)    // proven

export const f = (a: u64, b: u64): u64 =>
  b === toU64(0) ? a : a % b                       // refused today: divide
export const g = (a: u64, b: u64): u64 => {
  const zero: u64 = 0
  return b === zero ? a : a % b                    // refused today: divide
}
export const n = (a: u64, b: u64): u64 =>
  b !== 0 ? a % b : a                              // proven
```

A conditional expression is already read (`n` proves); the gap is the
operand. In the prover, a `const` binding (module- or function-level,
never `let`, never a field) whose initializer is an integer literal, or a
constant the checker already folds, is that value. So is `toI32` /
`toU32` / `toI64` / `toU64` / `toU8`... of a literal that fits the target.
Find where the prover turns a literal into an interval and route these
through it. `std/collections.ts` `INITIAL_SLOTS` (`new Array<u32>(INITIAL_SLOTS)`)
is case `p`; vector's `src/spec/sample/prng.ts:77,82` is case `f`.

Negatives that stay refused: a `let` binding, even one never assigned
again (or decide this and document it); a `const` whose initializer is a
call that isn't a conversion; a conversion of a literal that doesn't fit
(`toU8(300)`, if that compiles at all); a negative constant length
(`const M: i32 = -1; new Array<u32>(M)`).

### Gap 2 — the range of `x & mask`

```ts
export const r = (w: u32): i32 => toI32(w & 16777215) - 1   // refused today: overflow
```

`w & C` with a non-negative constant `C` lies in `[0, C]`, whatever sign
`x` has. `x >>> k` is a cousin (`[0, 2^(bits-k) - 1]`); add it if the
same table covers it. `std/collections.ts`'s probe in `Map.has` / `get` /
`set` and `Cli.parse` is this case (in vector's run it alone was 147 of
the call refusals into std). Also check that `toI32` of a `u32` in a
known range keeps the range.

### Gap 3 — the range of `charCodeAt`

```ts
export const s = (t: string, i: i32): i32 => {
  if (i < 0 || i >= toI32(t.length)) { return 0 }
  return toI32(t.charCodeAt(i)) + 1                // refused today: overflow
}
```

Confirm what `charCodeAt` returns (`runtime/nish.d.ts`, `docs/LANGUAGE.md`):
strings are bytes, and `fromCharCode` is documented as the inverse of
`charCodeAt`. Give the result that range from the place the builtin is
typed; do not special-case it in the prover. List in the PR body any
other builtin with a documented range the same table could carry
(`length` is already `>= 0`), and add only the ones the docs promise.
`std/text.ts` `asciiLower` / `asciiUpper` (`code + delta`) is this case.

### Gap 4 — a down-counting loop keeps its upper bound

```ts
export const u = (t: string): i32 => {
  let end: i32 = toI32(t.length)
  while (end > 0 && t.charCodeAt(end - 1) === 32) { end -= 1 }  // refused today: index
  return end
}
```

`end` starts at `t.length` and only decreases, so `end - 1 < t.length`
whenever `end > 0`. The prover keeps the guard's lower bound but drops
`end <= length` at the loop head because of the `-= 1`. Find how it widens
a loop variable and keep an upper bound a decrement cannot break. Be
careful with other writes to `end` in the body and with `t` being
reassigned. `std/text.ts` `trimEnd` / `trim` / `some` is this case. Check
the mirror loop (`let i = 0; while (i < n) i += 1`) too.

### Tests

For each gap, where `.claude/testing.md` says prover tests go
(`tests/cases` with a golden `.ll` registered by
`node tests/differential/goldens.js --update`, or a `tests/run.js`
section next to the existing bounds tests — read the guide, do not
guess):

- a positive case that compiles under `--deny-panics`, with its IR shown
  in the PR: no `nish_panic_index` / `llvm.*.with.overflow` / divide test
  for the site, and an `nsw` where an add is now proven;
- a native round trip with expected stdout on the edge value: the last
  byte for gap 4, the mask's top value for gap 2, byte 255 for gap 3;
- the negatives above, refused with the same code and wording.

Soundness: `node tests/panics-oracle.js` (read its header for what it
compares), and the bounds and overflow sections of `tests/run.js`.

### Docs

`docs/LANGUAGE.md` → "Panic sites" and the overflow rule are the rules for
what the prover reads; they change with the code. The `docs/guide/` page
that tells users which guards prove (grep "proves it", "a test the checker
reads") moves with them. Do not change diagnostic hint wording (e.g.
NL2457's) unless a hint is now wrong. Regenerate `docs/reference/` with
`node scripts/gen-reference.mjs`.

### IR moves

- `std/` and `src/` get compiled with the new prover, so their IR moves
  where a check is dropped: run `node tests/nish-cmp.js` and add narrow
  `DECLARED` entries with the PR's release-note words, which the squash
  subject repeats verbatim.
- `node tests/self/goldens.js --update`, and read the diff: every hunk
  should be a removed check.
- `scripts/bootstrap.sh --verify`: stage2 = stage3.
- `WASI_SYSROOT=/usr node tests/run.js wasi` (read the skip line) and
  `node tests/run.js performance`. NL9007 counts only go down; lower the
  ratchet if the run says to.
- No `std/` line moves (this is a `src/` change).

### Measure

Before and after:

- `amritk/vector` (public; clone read-only, or `add_repo` read): build with
  `nish src/main.ts --link /tmp/v --deny-panics --json` and group the
  NL2458 diagnostics by the `std/<file>.ts:LINE:COL` their message names.
  Baseline from 0.42.0: 460 call refusals into std, 2,459 errors in total.
  Write the remaining list in the PR body; the std follow-up starts from it.
- The examples refused under `--deny-panics` (`examples/*.ts`, built with
  their `// smoke:` flags).
- A `Measured:` trailer for any runtime figure claimed, with its noise band.
