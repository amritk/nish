---
name: WP38 S4 — decline the lexer on indexOfAny, on its measurement
overview: S4 (src/lexer.ts onto indexOf and indexOfAny) cannot clear its bar because the lexer is not scan-bound. Record that measurement in docs/wp38-simd.md with a reproducible lexer benchmark, as S2's decline was recorded, and change no compiler code.
stages:
  - id: s4-decline
    title: "docs: record that WP38's S4, the lexer on indexOfAny, is declined for now"
    goal: wp38 §7 marks S4 declined for now, backed by a committed lexer benchmark and figures any reader can reproduce
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && build/nish bench/lexer.ts -o build/bench/lexer/ --link build/bench/lexer/app && cat src/*.ts > build/bench/lexer/src.ts && build/bench/lexer/app build/bench/lexer/src.ts
    status: pending
    todos:
      - id: bench-lexer
        content: Add bench/lexer.ts, which lexes one file many times through src/lexer.ts and prints a checksum and min and median ms — see Benchmark
        status: pending
      - id: measure
        content: Measure the lexer, the front end and bootstrap --verify on one machine, with the indexOf spike applied locally and never committed — see Measurement
        status: pending
      - id: wp38-decline
        content: Record S4 as declined for now in docs/wp38-simd.md (status line, §2.3 or §4, §7 table and a paragraph under it) — see The record
        status: pending
      - id: index-rows
        content: Update the WP38 rows in docs/MASTER_PLAN.md (table line and prose) and docs/README.md to say S4 is declined for now — see The record
        status: pending
---

# WP38 S4 — declined on its measurement

## Context

[docs/wp38-simd.md](../../docs/wp38-simd.md) §7 defines S4 as "`src/`'s lexer on S1's function, from the release after S1", and it ships only if `scripts/bootstrap.sh --verify` is measurably faster and its fixed point is reached. 0.18.0 shipped `indexOfAny` (#519) and `indexOf` with a start position (#513), so the rolling freeze no longer blocks it. Before planning the build, the lead measured it, and the owner chose to decline S4 on that measurement (2026-10-09).

The lead's figures (a 4-vCPU cloud container, stage2 built from the 0.18.0 seed at `308a8b1`):

| What | Figure |
| --- | --- |
| `src/*.ts` concatenated | 2,804,018 bytes, 42% of them in comment lines |
| One lex of that text through `src/lexer.ts` | about 12 ms (20 passes in 247–277 ms) |
| The same with the two comment skips on `indexOf` (spike below) | 20 passes in 240–248 ms: about 3% of the lexer. Identical token stream |
| `build/nish src/compile.ts -o <dir>/` (front end and IR, warm) | about 1.0 s |
| `scripts/bootstrap.sh` (seed to stage2) | 100 s |

So the lexer is about 1% of the front end, and the front end is about 1% of the bootstrap. A lexer made infinitely fast could not move `bootstrap --verify` measurably. The comment loops are cheap per byte, and the lexer's time goes into tokens: identifiers, keywords and the strings each token builds. `indexOfAny` cannot help with any of those, because they run *while* a byte is in a class rather than *until* one is.

The spike, applied to `skipTrivia` in [src/lexer.ts](../../src/lexer.ts) for measurement only:

```ts
// line comment
const lf = this.source.indexOf("\n", this.pos + 2)
this.pos = lf < 0 ? this.source.length : lf
// block comment
const close = this.source.indexOf("*/", this.pos + 2)
this.pos = close < 0 ? this.source.length : close + 2
```

## s4-decline

**Owns:** `bench/lexer.ts` (new), `docs/wp38-simd.md`, `docs/MASTER_PLAN.md`, `docs/README.md`

One PR. The todos are Benchmark, Measurement and The record, below. Nothing under `src/`, `std/`, `runtime/` or `tests/` changes.

## Benchmark

Add [bench/lexer.ts](../../bench/lexer.ts), in the style of [bench/index-of-any.ts](../../bench/index-of-any.ts): a header comment with the build and run commands, then `main`.

- It takes one path (`process.argv[1]`), reads it with `readFileSyncOrNull` and exits 2 with a usage line when the path is missing or unreadable.
- It imports `Lexer` from `../src/lexer` and `TOK_END` and `TOK_ERROR` from `../src/tokens`. It lexes the text to `TOK_END` (or stops at `TOK_ERROR`) for a fixed number of passes, at least 20.
- **The input changes on every pass, and the answer is folded into a printed checksum** (CLAUDE.md, `Measured:`). For example, each pass lexes the text with the pass number appended as a trailing line comment, and the checksum folds in every token's `kind`, `start` and `end`. Then the optimiser cannot compute it once.
- It times each pass with `monotonicNanos` and prints the checksum, the min and median ms per pass, and MB/s.

Usage, which goes in its header comment:

```
npm run build
build/nish bench/lexer.ts -o build/bench/lexer/ --link build/bench/lexer/app
cat src/*.ts > build/bench/lexer/src.ts
build/bench/lexer/app build/bench/lexer/src.ts
```

## Measurement

Take every figure on one machine, from `main` at one commit, with stage2 built by `npm run build` from the 0.18.0 seed (`bash scripts/fetch-seed.sh --force` first. `build/nish --version` says the version, and `build/seed/bin/nish --version` must say 0.18.0).

1. `bench/lexer.ts` over the concatenated `src/`, at least seven runs: min and median.
2. The same, with the spike above applied to `src/lexer.ts` and `npm run build` re-run, in alternating rounds against the unpatched binary, as `bench/simd-s0.mjs` alternates its builds. Check that the token streams agree. `build/nish src/dump-tokens.ts … --link` built both ways, with outputs `cmp`-equal over the concatenated text, is enough. **Revert the spike afterwards, then check that `git diff src/` is empty**: this stage changes no compiler code.
3. The front end: `build/nish src/compile.ts -o <tmp>/` timed warm, at least seven runs.
4. `scripts/bootstrap.sh --verify`, at least one run, beside S0's 150,771 ms (taken on another machine, so the note compares ratios rather than absolute times).

## The record

In [docs/wp38-simd.md](../../docs/wp38-simd.md):

- **Status line** (the bold paragraph at the top): S4 is declined for now, as S2 is.
- **§7 table, S4 row**: append **Declined for now**: see below, as S2's row does.
- **A paragraph under the table, after S2's**: "S4 is declined for now on its own bar". Give the figures from Measurement with the commit, the machine and the seed version, and the reason in one sentence (the lexer is about 1% of the front end and the front end about 1% of the bootstrap, so no lexer change can move `bootstrap --verify` measurably). Name `bench/lexer.ts` as how to reproduce it, and say what reopens S4: a front-end profile that shows a scan-bound loop in `src/`, or a bar restated in front-end time.
- **§4**: one sentence pointing at §7's S4 paragraph, so that §4's "the lexer can call the `std/text` function from the release after it lands" does not read as a plan still pending.
- **§2.2's lexer bullet** keeps its claim that the lexer walks byte by byte, which is still true. Add that §7 records what that costs.

In [docs/MASTER_PLAN.md](../../docs/MASTER_PLAN.md), the WP38 table row (line ~252) and the WP38 prose bullet (line ~432) both say S4 is declined for now rather than unbuilt. [docs/README.md](../../docs/README.md)'s wp38 row likewise.

The commit is the changelog entry: `docs: record that WP38's S4, the lexer on indexOfAny, is declined for now`, and its body carries the figures. The `Measured:` trailer states them: for example, `Measured: lexer 12.1 ms per pass over src/ (2.8 MB); indexOf comment skips 3% faster; front end 1.0 s; bootstrap 100 s`.

## Out of scope

- Any change to `src/`, `std/`, `runtime/` or `tests/`. That includes `src/lexer.ts`: the spike is measured and reverted.
- std/json on `indexOfAny` (S1's remainder, #507 stage 3) and S3.
- Profiling or speeding up the front end by other means.

## Verification

```
npm run check
npm run lint && npm run lint:dead
node docs/check-links.mjs
build/nish bench/lexer.ts -o build/bench/lexer/ --link build/bench/lexer/app && cat src/*.ts > build/bench/lexer/src.ts && build/bench/lexer/app build/bench/lexer/src.ts
git diff --stat origin/main -- src std runtime tests   # empty
```

`npm test` runs in CI (four shards), as the owner asked on 2026-10-09 (#516). The PR is merged when CI is green on its head, `bootstrap` included.
