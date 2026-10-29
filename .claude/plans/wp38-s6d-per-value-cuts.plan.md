---
name: WP38 S6d — cut the per-value work that blocks S6c, then re-gate S6c
overview: S6c's callgrind gate (docs/wp38-simd.md §7, *S6c, the callgrind gate (2026-10-24)*) found the structural index NOT REACHABLE, with instruction ceilings of 1.37x on twitter and 1.22x on citm against a 1.5x bar. Its "What would have to move" asks for 758,283 instructions out of twitter's kept work (10.7%) and 3,882,223 out of citm's (23.7%), none of it index work. S6d measures where that work could come from (numberF64, the grammar switch and the rest of next/value/key's per-token work, stringInto's copy), picks the cuts whose combined saving, plus S6c as priced, reaches 1.5x on both files, builds them only if such a combination exists, and then re-runs S6c's gate on the new main. S6c itself is not built in this run.
stages:
  - id: measure
    title: "docs(wp38): S6d, the per-value cuts that would let S6c reach its bar"
    goal: docs/wp38-simd.md §7 gains an S6d row and a section under it recording a finer callgrind split of main's tokenize loop (numberF64 by citm's integers against its doubles, stringInto by short against long strings, the grammar switch and the rest of next/value/key per token kind), each candidate cut priced in instructions per file, the chosen combination, and the arithmetic showing whether that combination plus S6c as priced reaches 1.5x on twitter and on citm, ending in a REACHABLE or NOT REACHABLE verdict
    verification: npm run lint && node docs/check-links.mjs
    status: completed
    todos:
      - id: split
        content: "Callgrind main's tokenize loop by S6c's gate method (bench/json-compare built --profile speed, 0 and 20 iterations, a -g build for the per-line split, the same `at` digits) and split numberF64 (citm's integers against its doubles, the Eisel–Lemire path against the rest), stringInto and its memcpy (strings by length band, e.g. under 16 bytes against longer), and next/value/key's grammar switch and per-token rest, per file — see Stage 1, the split"
        status: completed
      - id: price
        content: "Price each candidate cut in instructions per iteration per file, by a throwaway prototype counted under callgrind where the saving is not obvious from the split; a figure that is only an estimate is marked as one and the verdict may rest only on measured or lower-bound figures — see Stage 1, pricing a cut"
        status: completed
      - id: choose
        content: "Choose the smallest set of cuts whose combined saving reaches 1.5x on both files with the formula S6c's gate used (gate Total ÷ (kept − saving + walker + kernel), with the gate's Total, walker and kernel figures unchanged), and record the choice, each cut's saving and the arithmetic as a new S6d row in §7 plus its section; if no combination reaches 1.5x on both files, record that with the best combination's ceilings and stop — see Stage 1, the verdict"
        status: completed
  - id: cuts
    title: "perf(runtime): S6d, the per-value cuts in JsonTokenizer"
    goal: The cuts stage 1 chose are built in std/json-tokenizer.ts (and only what they need beside it), each one holding its own bar against main — tokenize on twitter and citm faster outside its band, nothing else on bench/json-compare or bench/json-tokenizer slower outside its band — with every numberF64 answer still bit-for-bit parseFloat's on S6b's corpus and every JSONTestSuite verdict, error code and errorAt offset unchanged, and the A/B recorded in docs/BENCHMARKS.md and docs/wp38-simd.md
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js json && node tests/run.js bytes && node tests/run.js simd && node docs/check-links.mjs, an undegraded set of CI test shards, and the per-cut bench/json-compare and bench/json-tokenizer A/B against main recorded
    status: pending
    todos:
      - id: build
        content: "Build each cut stage 1's S6d row chose, as its own commit, in std/json-tokenizer.ts and only the files it needs beside it; a cut touching runtime/*.c or src/ follows that area's rules (security record, rolling freeze, wasi and performance sections) — see Stage 2, building"
        status: pending
      - id: exact
        content: "Keep numberF64 bit-for-bit parseFloat's on S6b's corpus (canada.json's numbers, every JSONTestSuite number, at least 10^8 random doubles printed shortest and at 17 digits, natively and under Node), and keep every JSONTestSuite verdict, error code and errorAt offset and the conformance corpus unchanged; add native edge checks for every new fast path's boundaries — see Stage 2, exactness"
        status: pending
      - id: ab
        content: "Interleaved A/B of each cut against main (and the whole stage against main) on every bench/json-compare workload and bench/json-tokenizer, each with a byte-identical copy for its noise band; a cut that does not make tokenize on twitter or citm faster outside its band, or makes any other row slower outside its band, is dropped and recorded, not shipped — see Stage 2, the bar"
        status: pending
      - id: record
        content: "Record the A/B in docs/BENCHMARKS.md (a note after the JSON section, or a fresh json-compare --record) and in docs/wp38-simd.md's S6d row and section, saying for each chosen cut whether it was built and met its bar, with figures; regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff"
        status: pending
  - id: regate
    title: "docs(wp38): re-run S6c's callgrind gate after S6d"
    goal: S6c's callgrind gate is re-run on main after S6d merged, by the same method and with the same prototype kernel, and the S6c row in §7, the gate section and §8 Q5 carry the new ceilings for twitter and citm and a REACHABLE or NOT REACHABLE verdict; nothing of S6c is built
    verification: npm run lint && node docs/check-links.mjs
    status: pending
    todos:
      - id: rerun
        content: "Re-run S6c's gate on the new main: the same build, 0 and 20 iterations, the same -g split into removable and kept, the same walker price (8 a mark, marks unchanged because the documents are) and the same kernel cost (1,299,916 and 3,277,635 a pass, the prototype's count, re-counted if the prototype is rebuilt) — see Stage 3, the re-gate"
        status: pending
      - id: verdict
        content: "Update the S6c row in §7, add a dated re-gate paragraph to the gate section with the new split, ceilings and the same sensitivity rows, and update §8 Q5; if REACHABLE, say so and stop — S6c is not built in this run"
        status: pending
---

# WP38 S6d — cut the per-value work that blocks S6c, then re-gate S6c

Three stages, in a chain: each starts only after the previous one merges.
They are split because each one is worth merging on its own: stage 1 is a
decision record that ends the run if it says NOT REACHABLE; stage 2 is a
speedup that holds its own bar whatever S6c does; stage 3 has to run on main
as stage 2 leaves it.

**The bar's base.** S6c's bar is a ratio against the record S6b leaves, not
against whatever main is when it is measured. The gate's "What would have to
move" computes its 758,283 and 3,882,223 that way: the gate's Total
(12,290,415 on twitter, 25,632,165 on citm, an iteration at `2f10882`) stays
the numerator, and the cuts come out of the kept work in the denominator.
Stages 1 and 3 keep that formula, and stage 3 also states the ratio against
the new main beside it, so a reader can see both.

## measure

**Owns:** `docs/wp38-simd.md`, `.claude/plans/wp38-s6d-per-value-cuts.plan.md`.

Nothing outside these two files is committed. Prototypes and callgrind
outputs stay in a scratch directory.

### Stage 1, the split

Use S6c's gate method exactly as recorded (*S6c, the callgrind gate*): the
build commands, the 0 and 20 iteration runs, the `-g` build for per-line
cost, the line-0 apportioning. Then split further than the gate did:

- **`numberF64`** (16.2% of citm's tokenize, 3.2% of twitter's): integers
  against numbers with a fraction or exponent; within each, the digit scan,
  the Eisel–Lemire product (`jsonTokMulHigh`'s four products), the table
  reads, and the rest. Count how many of citm's numbers are integers that fit
  a fast path with no product at all.
- **`stringInto` and its `memcpy`** (19.4% on twitter, 8.0% on citm): by
  string length band (for example under 16 bytes, 16 to 63, 64 and over), and
  the fixed per-call cost against the per-byte cost.
- **`next`, `value` and `key`**: the grammar switch (6.1% / 6.8%) and the
  rest (5.8% / 13.7%), by token kind, so the per-token dispatch and the
  `number` scan, `open`, `emit` and the inlined `top`/`close` each have a
  figure.

### Stage 1, pricing a cut

A candidate cut is a concrete change to `std/json-tokenizer.ts` (an integer
fast path in `numberF64`, a cheaper copy for short strings, folding the
grammar switch into the first-byte dispatch, and so on). Price each by a
throwaway prototype counted the same way where the saving is not plain from
the split. The verdict may rest only on measured savings or on lower bounds
argued from the split; an upper-bound estimate may be recorded but must not
carry the verdict.

### Stage 1, the verdict

For every combination worth considering, compute per file
`Total ÷ (kept − saving + walker + kernel)` with the gate's Total, walker
(596,680 / 1,300,720) and kernel (1,299,916 / 3,277,635). The chosen set is
the smallest whose ceilings reach 1.5x on both files. Record a new **S6d**
row in §7 (what it is, the bar from the requirements, the verdict) and a
section after the S6c gate section with the split tables, each cut's price
and the arithmetic. **REACHABLE** names the cuts stage 2 builds.
**NOT REACHABLE** records the best combination's ceilings, and the run stops
with nothing built.

## cuts

**Owns:** `std/json-tokenizer.ts`, `std/json-typed.ts`, `std/json-value.ts`,
`std/bytes.ts`, `runtime/runtime-bytes.c`, `tests/simd/**`,
`src/kernels.ts`, `src/std-modules.ts` (only if a cut needs a `nish/bytes`
change), `scripts/gen-json-pow5.mjs`, `tests/link/std_json*/**`,
`tests/link/std_bytes*/**`, `tests/json-suite/**`,
`tests/json-conformance/**`, `tests/run.js`, `bench/json-compare/**`,
`bench/json-tokenizer/**`, `docs/BENCHMARKS.md`, `docs/wp38-simd.md`,
`docs/security/**` (only if a runtime file changes), `docs/LANGUAGE.md`,
`docs/IR_COOKBOOK.md` and `docs/guide/**` (only if a user-visible surface
moves), `tests/self/goldens/checked/**` and `tests/differential/**`
(regenerated only), `.claude/plans/wp38-s6d-per-value-cuts.plan.md`.

Spawned only after `measure` merges with a REACHABLE verdict.

### Stage 2, building

Build exactly the cuts the S6d row names, one commit each, so each can be
measured alone. Expected to live in `std/json-tokenizer.ts`. A cut that needs
`runtime/runtime-bytes.c` or `src/` brings that area's obligations
(`docs/security/` record, `node scripts/security-scope.mjs`, the rolling
freeze, `node tests/run.js wasi` with `WASI_SYSROOT=/usr` and
`node tests/run.js performance`).

### Stage 2, exactness

- `numberF64`: bit-for-bit `parseFloat`'s on S6b's corpus as its row states,
  natively and under Node; new fast paths get native edge checks at their
  boundaries (for an integer path: 2^53, 19 and 20 digits, `-0`, the largest
  integer it takes and the first it hands on).
- The tokenizer: every JSONTestSuite verdict, error code and `errorAt` offset,
  the conformance corpus, the fuzz checksum and #582's mutation-pinned
  boundaries unchanged.

### Stage 2, the bar

Each cut, alone against main: tokenize on twitter and citm faster outside its
band; every other bench/json-compare row and bench/json-tokenizer's 242-byte
body not slower outside its band. Interleaved rounds, each binary beside a
byte-identical copy for its band (`.claude/testing.md` → "A `Measured:`
trailer"). A cut that misses is dropped and recorded with its figures. If the
cuts that ship no longer reach stage 1's arithmetic, say so in the S6d row;
stage 3 still runs and gives the measured answer.

## regate

**Owns:** `docs/wp38-simd.md`, `.claude/plans/wp38-s6d-per-value-cuts.plan.md`.

Spawned only after `cuts` merges.

### Stage 3, the re-gate

Same method, same prototype kernel, on main after stage 2. The kernel and
the walker see the same documents, so their figures carry over unless the
prototype is rebuilt, in which case it is re-counted and the new figure
used. Only the removable/kept split is re-measured. Report the ceiling with
the gate's original Total as numerator (the bar's base) and, beside it, the
ratio against the new main's own Total. Repeat the gate's sensitivity rows
(index and walker free, kernel free, walker at 4/16). Update the S6c row, the
gate section (a dated re-gate paragraph, the original kept as it is) and §8
Q5. If REACHABLE, say so and stop: S6c is not built in this run.
