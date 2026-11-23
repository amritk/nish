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

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `Crc32.update`, `GzipWriter.write`, `GzipWriter.flush`, `GzipWriter.finish`.

**Owns:** `std/compress/checksum.ts`, `std/compress/zlib.ts`, `std/compress/gzip.ts`, `bench/run.mjs`, the new instruction-count bench programs under `bench/` (for example `bench/std-compress-deflate.ts`, `bench/std-compress-inflate.ts`, `bench/std-compress-gzip.ts`, `bench/std-compress-checksum.ts`, and their corpus file), `bench/crc32.ts`, `bench/adler32.ts`, `bench/crc32.mjs`, `bench/adler32.mjs`, `bench/adler32/**`, `tests/link/std_compress_crc_*/**`, `tests/link/std_compress_adler_*/**`, `tests/link/std_compress_gzip_files/**`, and any new `tests/link/std_compress_{checksum,zlib,gzip}_*` directory. Shared with the other stage, own entries only (this stage's modules' rows, counts, records, checks and markers; S2 takes S1's lines in from `main` when it syncs): `tests/std-panics.json`, `tests/nish-cmp.js`, `tests/run.js`, `bench/instructions.json`, `bench/README.md`, `docs/BENCHMARKS.md`, `docs/security/compress.md`, `docs/security/README.md`, `docs/guide/using-nish/compression.md`, `std/README.md` (its `nish/compress` rows), `tests/link/std_compress/**`, `tests/link/std_compress_node/**`, `tests/link/std_http_compress/**`, `bench/gzip/**`, `bench/http-compress/**`, `tests/layout/compact-bench/zlib-each.ts`, `docs/wp68-shared-libraries.md` (its `std/compress` line quotes). Generated (regenerate with the repo's tooling, never hand-edit or hand-merge): `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `tests/differential/goldens/**`, `docs/IR_COOKBOOK.md`, `tests/wordings/*.err`, `tests/link/*/expected.caps.json`, `docs/reference/diagnostics/**`, `docs/wp48-layout-survey.txt`.

Keep every exported signature where a caller outside this list uses it (`std/net/http-compress.ts`, `std/net/http1-server.ts` and the other `std/net` callers belong to WP80 and WP82). A fix that has to change one asks the lead for an Owns amendment first; it never edits that caller unasked.

**Depends on:** nothing. It merges first: its bench programs are the baseline S2 measures against.

**Model:** the lead's (which failures are real and become a Result is a judgement on attacker-supplied streams).

### S2 — deflate and inflate

deflate.ts is cleared without raising the deflate or inflate count.

Sites as of 071ed014 (398): compress/deflate 398. Kinds: overflow 322, index 35, panic 31, range 7, array-length 3.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `deflateMatchLength`, `deflateRoom`, `inflateDouble`, `Deflater.addLiteral`, `Deflater.addMatch`, `Deflater.buildRle`, `Deflater.collectGreedy`, `Deflater.compressRange`, `Deflater.insert`, `Deflater.longest`, `Deflater.writeBlock`, `Deflater.writeSymbols`, `FixedDeflater.compress`, `Inflater.build`, `Inflater.constructor`, `Inflater.fill`, `Inflater.huffman`, `Inflater.readDynamic`, `deflateCanonical`, `deflateLengths`.

**Owns:** `std/compress/deflate.ts`, `tests/link/std_compress_f64/**`, and any new `tests/link/std_compress_{deflate,inflate}_*` directory. Shared with the other stage, own entries only (this stage's modules' rows, counts, records, checks and markers; S2 takes S1's lines in from `main` when it syncs): `tests/std-panics.json`, `tests/nish-cmp.js`, `tests/run.js`, `bench/instructions.json`, `bench/README.md`, `docs/BENCHMARKS.md`, `docs/security/compress.md`, `docs/security/README.md`, `docs/guide/using-nish/compression.md`, `std/README.md` (its `nish/compress` rows), `tests/link/std_compress/**`, `tests/link/std_compress_node/**`, `tests/link/std_http_compress/**`, `bench/gzip/**`, `bench/http-compress/**`, `tests/layout/compact-bench/zlib-each.ts`, `docs/wp68-shared-libraries.md` (its `std/compress` line quotes). Generated (regenerate with the repo's tooling, never hand-edit or hand-merge): `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `tests/differential/goldens/**`, `docs/IR_COOKBOOK.md`, `tests/wordings/*.err`, `tests/link/*/expected.caps.json`, `docs/reference/diagnostics/**`, `docs/wp48-layout-survey.txt`.

Keep every exported signature where a caller outside this list uses it (`std/net/http-compress.ts`, `std/net/http1-server.ts` and the other `std/net` callers belong to WP80 and WP82). A fix that has to change one asks the lead for an Owns amendment first; it never edits that caller unasked.

**Depends on:** S1 for its merge, not its start. It is developed against `main` in parallel. Once S1 merges it takes in `main` and S1's deflate and inflate bench counts, which it must not raise and lowers where they fell, from CI's table.

**Model:** the lead's (322 overflow sites on bit-buffer and window arithmetic need proofs the prover accepts, without a slower inner loop).

## Acceptance criteria

1. `tests/std-panics.json` on `main` records, for each of the four `std/compress` modules, a count below its 071ed014 figure (checksum 27, zlib 22, gzip 103, deflate 398; 550 in all), each site still listed being on the kept list with its reason, and `node tests/run.js std-panics` passes.
2. `Crc32.update`, `GzipWriter.write`, `GzipWriter.flush`, `GzipWriter.finish`, `deflateMatchLength`, `deflateRoom`, `inflateDouble`, `Deflater.addLiteral`, `Deflater.addMatch`, `Deflater.buildRle`, `Deflater.collectGreedy`, `Deflater.compressRange`, `Deflater.insert`, `Deflater.longest`, `Deflater.writeBlock`, `Deflater.writeSymbols`, `FixedDeflater.compress`, `Inflater.build`, `Inflater.constructor`, `Inflater.fill`, `Inflater.huffman`, `Inflater.readDynamic`, `deflateCanonical` and `deflateLengths` hold no explicit `panic(...)`, and none is on the kept list.
3. A truncated or corrupted gzip, zlib and raw DEFLATE stream handed to `GzipDecompressor`, `GzipReader`, `ZlibDecompressor` and `Inflater` (`decompress` and `inflate`) answers an error the caller sees (a `*_ERR_*` code or a Result), never a panic, and a `GzipWriter` used after `finish` answers an error too; a test in the suite shows each.
4. `bench/instructions.json` holds programs reaching deflate, inflate, CRC-32, Adler-32 and a gzip round trip, added in S1 before any `std/compress` site changed; no count in it rose across the package, and every count it holds came from CI's runner table.
5. No `nish:unsafe` and no made-up-value guard was added to any `std/compress` module (`git diff` of the package's merges).
6. The interop and round-trip programs still pass: `tests/link/std_compress`, `tests/link/std_compress_node` (every level against Node's zlib both ways) and `tests/link/std_http_compress`.
7. `docs/security/compress.md` and its row in `docs/security/README.md` name the moved findings at their new files and lines, and `node scripts/security-scope.mjs` passes.
8. No opt-out the package made unneeded remains, the compression guide page states any changed API, and `node tests/run.js performance` passes.
9. CI is green on `main` after the last merge, with every nish-cmp move declared (`node tests/nish-cmp.js` passes).
