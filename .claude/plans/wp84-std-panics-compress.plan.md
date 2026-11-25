---
name: WP84 — std panic-free for std/compress
overview: std/compress holds 550 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (compress/checksum 27, compress/zlib 22, compress/gzip 103, compress/deflate 398); deflate alone has 322 overflow sites on bit-buffer and window arithmetic. This package removes or proves them - a corrupt or truncated stream is a Result, and the bit and window arithmetic gets bounds the compiler proves. Its first todo adds deflate and inflate instruction-count benches, baselined before any site changes; no PR may raise a count. S3, from the owner's decision on #2219, replaces the u32-cast wrapping sums, masks and loop caps S2 left in deflate.ts with sums the compiler proves or with an error result; S4 fixes the compression guide's stale wording.
priority: 210
labels: [ready]
issue: 2151
stages:
  - id: s1-wrappers
    title: WP84 S1 — checksum, zlib and gzip
    goal: The checksum and container sites are cleared; the deflate and inflate benches land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js compress && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2152
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - deflate and inflate of a fixed corpus buffer, crc32 and adler32, a gzip round trip; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP84 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/compress/checksum.ts, std/compress/zlib.ts, std/compress/gzip.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP84 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP84 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP84 S1
        status: pending
  - id: s2-deflate
    title: WP84 S2 — deflate and inflate
    goal: deflate.ts is cleared without raising the deflate or inflate count.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js compress && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2153
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/compress/deflate.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP84 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP84 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP84 S2
        status: pending
  - id: s3-checked-sums
    title: WP84 S3 — deflate, checked sums instead of wrapping ones
    goal: Every u32-cast wrapping sum, assumed-maximum mask and silent loop cap in deflate.ts is gone; each is a sum src/bounds.ts proves or a negative error code, and no instruction count rises.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js compress && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    issue: 2285
    todos:
      - id: s3-inventory
        content: List every toU32 use, mask and loop cap in std/compress/deflate.ts at the stage's base with its function, its kind (wrapping sum, assumed-maximum mask, loop cap, or a genuine unsigned operation) and whether corrupt, truncated or oversized input can reach it; the table goes in the PR body — see WP84 S3
        status: pending
      - id: s3-check
        content: Add a tests/run.js std-panics check that fails on any u32-cast wrapping sum in std/compress/*.ts, multi-line and any spacing included, with a listed reason for each kept genuine unsigned operation and a self-test that feeds it a missed site — see WP84 S3
        status: pending
      - id: s3-fix
        content: Replace every wrapping sum, mask and loop cap in std/compress/deflate.ts with an i32 sum src/bounds.ts proves (only where it cannot overflow) or a negative DEFLATE_ERR code where input can reach it, adding no panic site and raising no bench/instructions.json count — see WP84 S3
        status: pending
      - id: s3-tests
        content: Add a tests/run.js compress check per new error path, a corrupt, truncated or oversized input that reached a former wrap answering its code, and repeat the 16,304-stream corrupt and truncated sweep of gzip, zlib and raw inflate with its result in the PR body — see WP84 S3
        status: pending
      - id: s3-record
        content: Record the wrapping-sum finding in docs/security/compress.md as fixed, citing the checks that fail without each guard, and update its row in docs/security/README.md — see WP84 S3
        status: pending
      - id: s3-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP84 S3
        status: pending
      - id: s3-ratchet
        content: Lower tests/std-panics.json to the new exact counts and each instruction count that fell to CI's figure, with the before and after table and the criterion 5 verdict in the PR body — see WP84 S3
        status: pending
  - id: s4-guide
    title: WP84 S4 — compression guide wording
    goal: docs/guide/using-nish/compression.md states what gzip keeps today and that compressBound and deflateBound answer -1 past their largest n.
    verification: node tests/run.js guide && node tests/run.js performance && node docs/check-links.mjs && npm run lint
    issue: 2286
    todos:
      - id: s4-wording
        content: Rewrite the gzip panic sentence at docs/guide/using-nish/compression.md:17 and the allow-panics reasons at :29, :95 and :132 to say gzip keeps only its contract panics, as deflate does — see WP84 S4
        status: pending
      - id: s4-bounds
        content: State in docs/guide/using-nish/compression.md, by the compressBound example at :46 and :58, that compressBound answers -1 past 2,146,664,726 and deflateBound past 2,146,664,744, and what a caller does then — see WP84 S4
        status: pending
---

# WP84 — std panic-free for std/compress

## Context

std/compress holds 550 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (compress/checksum 27, compress/zlib 22, compress/gzip 103, compress/deflate 398); deflate alone has 322 overflow sites on bit-buffer and window arithmetic. This package removes or proves them: a corrupt or truncated stream is a Result, and the bit and window arithmetic gets bounds the compiler proves. Its first todo adds deflate and inflate instruction-count benches, baselined before any site changes; no PR may raise a count.

Examples unblocked: none named.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason. A `u32`-cast wrapping sum (`toI32(toU32(a) + toU32(b))`), or a mask or loop cap no wider than a maximum an invariant assumes (`per[l] & 511`, `depth < 288`), is a made-up-value guard, not a proof: when the invariant breaks it answers a wrong value instead of failing, and the site leaves the panic count without the compiler proving anything. Use a bound `src/bounds.ts` proves only where the sum really cannot overflow; where it can, return a Result (owner's decision on #2219). A `u32` operation whose wrap is the intended answer, such as a hash multiply or a little-endian load, is not a guard and stays.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Acceptance criteria (run #2213, S3 and S4)

1. No `std/compress/*.ts` line casts both operands of a `+`, `-` or `*` through `toU32` and the result back through `toI32`, except the genuine unsigned operations the new std-panics check lists with a reason; the check fails on a planted multi-line site.
2. A corrupt, truncated or oversized stream that reached a former wrapping sum, mask or loop cap answers a negative `DEFLATE_ERR_*` (or `GZIP_ERR_*`) code, never a wrong output and never a panic; the 16,304-stream sweep of gzip, zlib and raw inflate passes at S3's head.
3. `tests/std-panics.json`'s compress rows do not rise above main's at the run's base, and its kept list is unchanged.
4. No count in `bench/instructions.json` rises.
5. (#2213 criterion 5, re-checked) No `nish:unsafe` and no made-up-value guard is added to any `std/compress` module, under the amended rule 1.
6. (#2213 criterion 8, re-checked) The compression guide has no stale opt-out, says gzip keeps only its contract panics, and says `compressBound` answers -1 past 2,146,664,726 and `deflateBound` past 2,146,664,744 and what a caller does then; `node tests/run.js performance` passes.
7. CI is green on main after both merges.

## Stages

### S1 — checksum, zlib and gzip

The checksum and container sites are cleared; the deflate and inflate benches land first and are baselined.

Sites as of 071ed014 (152): compress/checksum 27, compress/zlib 22, compress/gzip 103. Kinds: overflow 96, index 36, panic 16, divide 2, array-length 2.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `Crc32.update`, `GzipWriter.write`, `GzipWriter.flush`, `GzipWriter.finish`.

### S2 — deflate and inflate

deflate.ts is cleared without raising the deflate or inflate count.

Sites as of 071ed014 (398): compress/deflate 398. Kinds: overflow 322, index 35, panic 31, range 7, array-length 3.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `deflateMatchLength`, `deflateRoom`, `inflateDouble`, `Deflater.addLiteral`, `Deflater.addMatch`, `Deflater.buildRle`, `Deflater.collectGreedy`, `Deflater.compressRange`, `Deflater.insert`, `Deflater.longest`, `Deflater.writeBlock`, `Deflater.writeSymbols`, `FixedDeflater.compress`, `Inflater.build`, `Inflater.constructor`, `Inflater.fill`, `Inflater.huffman`, `Inflater.readDynamic`, `deflateCanonical`, `deflateLengths`.

## WP84 S3 — deflate, checked sums instead of wrapping ones

Every u32-cast wrapping sum, assumed-maximum mask and silent loop cap in deflate.ts is gone; each is a sum `src/bounds.ts` proves or a negative error code, and no instruction count rises.

**Owns:** `std/compress/deflate.ts`, `std/compress/zlib.ts`, `std/compress/gzip.ts`, `std/net/http-compress.ts` (only to pass on a new error code), `tests/run.js`, `tests/std-panics.json`, `tests/nish-cmp.js`, `bench/instructions.json`, `tests/link/std_compress*/**`, `tests/link/std_http_compress/**`, `docs/security/compress.md`, `docs/security/README.md`, `std/README.md` (its compress rows), `docs/AI.md` (only for a new `DEFLATE_ERR_*` code), and in `docs/guide/using-nish/compression.md` only the error-code table (the `DEFLATE_ERR_*` rows), only for a new code.
**Merge order:** after S4, which owns the rest of `compression.md`. Development does not wait for it; a new code's guide row is merged over S4's wording when S3 updates before its merge.

**Why.** The owner's decision on #2219 ([comment](https://github.com/amritk/nish/issues/2219#issuecomment-7149155077)) is "Require checked bounds", with "result is much better": where a sum cannot be proven in range, return a Result rather than force a prover-bounded rewrite. S2 (#2217, 659dca57) cleared deflate.ts's overflow sites largely by casting through `u32`, which wraps, so those sites left the panic count without a proof. Rule 1 now names that idiom a made-up-value guard.

**What is there now** (main at 1908baed, the same as 659dca57 for this file):

| measure                                                                     | count                                                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `toU32(` uses in [`std/compress/deflate.ts`](../../std/compress/deflate.ts) | 167 (31 at 3f5be0d7, before S2)                                                                             |
| `toI32(toU32(` uses                                                         | 119                                                                                                         |
| the two-operand `toI32(toU32(a) + toU32(b))` form, #2219's count            | 113 (1 before S2), e.g. `deflate.ts:997`                                                                    |
| masks and loop caps S2 added, examples                                      | `deflate.ts:688` `while (avail > 0 && depth < 288)`, `deflate.ts:718` `per[limit] = (per[limit] & 511) - 1` |
| `Deflater.bitCount`                                                         | made `u32` in a9abb2a6, "its sums carry no overflow check"                                                  |

The 31 uses from before S2 are genuine unsigned operations (little-endian loads at `deflateLoad32`, hash multiplies by `DEFLATE_HASH_MUL`, `Math.clz32` arguments, bit packing into the `u64` bit buffer). The inventory confirms each one; any that stands in for a proof is replaced too.

**What to do.**

1. **Inventory** every `toU32` use, mask and loop cap at the stage's base: its function, its kind, and whether corrupt, truncated or oversized input reaches it (an `Inflater` path does, and so does a `Deflater` length or window sum that grows with the input; a Huffman-tree sum over the encoder's own counts is bounded by the 288-leaf alphabet). The table goes in the PR body.
2. **The check first.** A `tests/run.js` std-panics check, "std/compress has no u32-cast wrapping sum", scans `std/compress/*.ts` for a `toU32(...)` operand of `+`, `-` or `*` whose result goes back through `toI32`, tolerant of line breaks and spacing. It keeps a list of the genuine unsigned operations, each with its reason (a hash multiply that is meant to wrap, say), and fails on anything else. A self-test feeds it a multi-line missed site and asserts that it fails. Masks and loop caps cannot be matched mechanically. Each one is a row in the inventory table, and the PR body says which line replaced it.
3. **Replace** each site with one of:
   - **A proven `i32` sum,** only where the sum really cannot overflow, and with the bound `src/bounds.ts` reads from a guard or a range the code already has (a window length checked at entry, a code length at most 15, a bit count at most 63). `Deflater.bitCount` goes back to `i32` with its range proven.
   - **An error result** wherever input can reach it. deflate.ts's Result is its negative `DEFLATE_ERR_*` code, which every decoder and `Deflater.compress` already answer; zlib and gzip pass it on. An existing code is used where one fits (`DEFLATE_ERR_HUFFMAN` for an impossible tree, `DEFLATE_ERR_OUTPUT_LIMIT` or `DEFLATE_NO_ROOM` for an oversized length). A new code gets a doc comment, its guide row and the reference regeneration.
   - **An `Inflater` or `Deflater` loop cap or mask** (`depth < 288`, `& 511`) becomes a proof that the bound holds, or a check that answers the error code when it would not. It never becomes a silent stop or truncation.

   No site becomes a checked sum that can panic. `tests/std-panics.json`'s deflate row may not rise above S2's, and the kept list in it is unchanged.

4. **Hot loops.** Rule 6 holds: no count in [`bench/instructions.json`](../../bench/instructions.json) may rise, and counts come only from CI's table. Hoist a check rather than add one per iteration: test a length or window once at a block or call boundary so the sums inside are provable from it. A site whose only form that fits the budget would be a wrap stops the stage and goes to the owner as a `needs-decision`. It is not shipped as a wrap.
5. **Tests.** For each new error path, a `tests/run.js` compress check feeds a corrupt, truncated or oversized input that reached a former wrap site and asserts its code, failing when the guard is removed. Repeat the acceptance session's sweep from #2213 (16,304 corrupt or truncated streams through gzip, zlib and raw inflate: no wrong output, no panic) at the PR's head, and put its counts in the PR body.
6. **Security record.** [`docs/security/compress.md`](../../docs/security/compress.md) records the wrapping arithmetic S2 left as a finding, fixed in this stage, citing the check that fails without each guard. Its row in [`docs/security/README.md`](../../docs/security/README.md) moves with the counts. Run `node scripts/security-scope.mjs`.
7. **Pins and ratchet,** as in S1 and S2: rules 2 to 5.

**Acceptance.** WP84's acceptance criterion 5 (run #2213: "no `nish:unsafe` and no made-up-value guard added to any `std/compress` module") is checked again at S3's head under the amended rule 1. The PR body states the verdict with the inventory table and the new check's output.

Out of scope: the same idiom in other modules (`std/regex.ts` 111 at 3f5be0d7, `std/json-value.ts` 27, `std/net/hpack.ts` 26, `std/net/http1-codec.ts` 25). Those belong to WP85–WP87 under the same rule, per the decision.

## WP84 S4 — compression guide wording

docs/guide/using-nish/compression.md states what gzip keeps today and that `compressBound` and `deflateBound` answer -1 past their largest `n`. This is WP84's acceptance criterion 8 from #2213. It does not depend on S3 and may land before it.

**Owns:** `docs/guide/using-nish/compression.md` (all but the error-code table's rows, which S3 may add to)
**Model:** sonnet

- [`docs/guide/using-nish/compression.md`](../../docs/guide/using-nish/compression.md)`:17` says `nish/compress/gzip` "keeps panic sites no proof removes yet", and so do the `allow-panics` reasons at `:29`, `:95` and `:132`. Since S1 and S2, gzip keeps only its contract panics, as deflate does (the kept list in [`tests/std-panics.json`](../../tests/std-panics.json)). Rewrite the sentence and the three reasons to say so. Each reason still names what its snippet does: the guide check requires the reason line above every `--allow-panics` marker, and `performance` fails on a marker the snippet no longer needs.
- The example at `:46` sizes its output with `new Array<u8>(compressBound(n))`, and `:58` calls `compressBound` "the most any level writes". Neither says that [`compressBound`](../../std/compress/deflate.ts) answers -1 for `n` past 2,146,664,726, or `deflateBound` past 2,146,664,744, as their doc comments do. Say it there, and what a caller does with a -1: refuse the body, or send it uncompressed, as COMP-20 in [`docs/security/compress.md`](../../docs/security/compress.md) records for `HttpCompressor`.
- WP84's acceptance criterion 8 ("no stale opt-out; the guide states changed API; `performance` passes") is checked again at S4's head, and the PR body states the verdict.
