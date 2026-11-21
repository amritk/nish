---
name: WP84 — std panic-free for std/compress
overview: std/compress holds 550 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (compress/checksum 27, compress/zlib 22, compress/gzip 103, compress/deflate 398); deflate alone has 322 overflow sites on bit-buffer and window arithmetic. This package removes or proves them - a corrupt or truncated stream is a Result, and the bit and window arithmetic gets bounds the compiler proves. Its first todo adds deflate and inflate instruction-count benches, baselined before any site changes; no PR may raise a count.
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
---

# WP84 — std panic-free for std/compress

## Context

std/compress holds 550 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 (compress/checksum 27, compress/zlib 22, compress/gzip 103, compress/deflate 398); deflate alone has 322 overflow sites on bit-buffer and window arithmetic. This package removes or proves them: a corrupt or truncated stream is a Result, and the bit and window arithmetic gets bounds the compiler proves. Its first todo adds deflate and inflate instruction-count benches, baselined before any site changes; no PR may raise a count.

Examples unblocked: none named.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

## Stages

### S1 — checksum, zlib and gzip

The checksum and container sites are cleared; the deflate and inflate benches land first and are baselined.

Sites as of 071ed014 (152): compress/checksum 27, compress/zlib 22, compress/gzip 103. Kinds: overflow 96, index 36, panic 16, divide 2, array-length 2.

### S2 — deflate and inflate

deflate.ts is cleared without raising the deflate or inflate count.

Sites as of 071ed014 (398): compress/deflate 398. Kinds: overflow 322, index 35, panic 31, range 7, array-length 3.
