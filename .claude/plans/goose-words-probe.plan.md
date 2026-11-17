---
name: Goose words — profile the probe path and fix its larger cost
overview: bench/goose/README.md (added by amritk/nish#1697) leaves Nish at 0.64 against Goose on `words`, with two named suspects on the count phase — the FNV-1a hash loop and the per-byte overflow checks `same()` pays on `a + i` and `b + i`. Profile words at the large size, attribute the count phase between the two, and fix the costlier one in the general codegen or runtime path, so every program with the same loop shape gains. The port itself does not change. The README records the profile, the new figures and their noise band.
stages:
  - id: s1-probe-path
    title: "perf(codegen): profile Goose words and remove the costlier probe-path overhead"
    goal: A profile of bench/goose/words.ts at the large size attributes the count phase between hash() and same(); the costlier one is fixed in src/ or runtime/ for every program with that loop shape, pinned by a tests/cases golden and a panic negative, with words faster by more than its noise band, the instructions ratchet and runtime .text budgets passing, nish-cmp moves declared, and bench/goose/README.md updated.
    verification: npm run check && npm run lint && node tests/run.js overflow && node tests/run.js performance && node tests/run.js runtime-budget && node bench/run.mjs --compiler build/nish --instructions --check && node bench/goose/run.mjs --compiler build/nish --only words --validate
    todos:
      - id: baseline
        content: Build build/nish at the base, build Goose per bench/goose/README.md, and take the interleaved baseline for words at --size l (best of N, with the run-to-run noise band) — see S1
        status: pending
      - id: profile
        content: Profile words at the large size (valgrind --tool=callgrind on the built binary, or perf where available) and attribute the count phase's instructions and time between hash() and same(), reading the emitted IR for each — see S1
        status: pending
      - id: decide
        content: Pick the costlier of the two by the profile and record the numbers for both; the other one is a written follow-up, not part of this PR — see S1
        status: pending
      - id: fix
        content: Fix the costlier one in the general path (src/bounds.ts / src/ranges.ts / src/emit-ops.ts for an overflow check the prover could discharge or hoist, or the codegen of the hash loop), with no change keyed to words.ts, its names or its sizes — see S1
        status: pending
      - id: tests
        content: A positive tests/cases program with the general loop shape (golden .ll showing the check gone or hoisted, llvm-as pass, native round trip), and a negative whose arithmetic really overflows still panicking with the same message — see S1
        status: pending
      - id: ratchets
        content: Run the instructions ratchet, runtime-budget, wasi (WASI_SYSROOT=/usr) and performance sections; regenerate goldens; run nish-cmp and add narrow DECLARED entries for every program whose IR moves — see S1
        status: pending
      - id: readme
        content: Update bench/goose/README.md — the profile split, the fix, the new words row and geomeans with their noise band, and the remaining suspect as the next step — see S1
        status: pending
---

# Goose words — the probe path

## S1 — profile, then fix the costlier one

**Owns:** `src/**`, `runtime/**`, `tests/cases/**`, `tests/run.js`,
`tests/nish-cmp.js`, `tests/runtime-budgets.js`, `tests/self/goldens/**`,
`tests/differential/**`, `bench/instructions.json`, `bench/goose/README.md`,
`docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/wp7-runtime.md`,
`docs/security/runtime.md`.

**Not owned, never edited:** `bench/goose/words.ts` and the other ports.
The port is a copy of Goose's program and stays one; a win that needs the
port rewritten is not a compiler win.

One stage, because the fix is chosen by the profile: splitting "profile" from
"fix" would leave the second stage waiting on the first with nothing to do.

### Context

- `bench/goose/` is not on `main`: it arrives with amritk/nish#1697 (in-place
  array growth and the range-append rewrite). This stage starts from that PR's
  head and opens its own PR only once #1697 has merged — a merge-order edge on
  a PR this run does not own.
- `same(text, a, b, n)` compares `uncheckedGet(text, a + i)` with
  `uncheckedGet(text, b + i)` for `i` in `[0, n)`. `a` and `b` are parameters
  with no known range, so `judgeOverflow` (src/bounds.ts) cannot prove
  `a + i` fits, and `emitCheckedArith` (src/emit-ops.ts) emits
  `llvm.sadd.with.overflow` and a branch per byte, twice. A general fix is
  one the prover or emitter applies to any `x + i` with a loop-invariant `x`
  and an induction variable of known bounds (for example one check of
  `x + (n - 1)` before the loop, or a range fact the loop already carries).
- `hash(text, s, e)` is FNV-1a over `u64`: one `xor` and one `mul` per byte.
  If the profile puts the cost here, read the emitted IR for what Nish adds
  over the C Goose emits (an `i++` check, a widening, a reloaded header).
- The built-in `Map<string, …>` hashes with SipHash-1-3 (`emitStringHash`,
  src/emit-map.ts) and compares with `nish_str_eq` (runtime/runtime-text.c);
  words.ts uses neither, so a change there does not move words and is out
  of scope unless the profile says otherwise.

### Measuring

Interleaved, same machine, best of N with the spread reported as the noise
band (`.claude/testing.md` → "A `Measured:` trailer"). A gain inside the
band is reported as no change. Goose's figures are re-taken in the same
session, since only ratios taken in one session compare.
