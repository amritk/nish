# pg-decode: Postgres DataRow decode and Bind encode, with no server

`main.ts` builds canned backend bytes once, starts a `PgConnection` on them
itself (startup, SCRAM nonce and all, with no socket), and then times four
kernels. Each one folds every byte written and every value read into a
checksum:

| kernel | what one operation is |
| --- | --- |
| `rows <n>` | a binary-format group on one `PgConnection`: Bind (one `int8` by `paramInt`), Execute and Sync written and drained; then BindComplete, RowDescription, `<n>` DataRows, CommandComplete and ReadyForQuery fed through `receive`/`next` (`readRow`), with every column read |
| `text <n>` | `rows` with the group in the text format, as a `bindStart` (not `bindStartBinary`) execution is answered: the `int8` by `int`, the `timestamptz` by `text.timestamp`, the `int8[]` by `PgArrayWalker` and `text.int` |
| `pool <n>` | the same group through a one-slot `PgPool`: `request`, `dispatch`, bind, send, and `PgPool.next` for every event |
| `params <n>` | a text-format Bind as `PgBatcher`'s `PG_BATCH_TEXT` writes one: an array of `<n>` text keys of 8 to 64 bytes (`arrayElement`), an `int8[]` of `<n>` ids (`paramIntArray`, so `putDecimal`) and one `int8`, then Execute and Sync |

A row is an `int8` id, a text of 8 to 64 bytes, a `timestamptz`, an `int8[]`
of 0, 1, 4 or 8 elements, and a text that is NULL on two rows in three. The
`int8` and the `timestamptz` are read by `binaryInt`, so through `getI64BE`;
the array is read by `PgBinaryArray`. `text` carries the same values in the
text format: row 1's `timestamptz`, `788918401000003` microseconds after
PostgreSQL's epoch in binary, is `2025-01-01 00:00:01.000003+00` there.

Each case's label carries the bytes it handles, which `main bytes <n> 1`
prints and `run.mjs` checks against the label before it times anything:

| rows | `rows`, `pool`: binary answer | `text`: text answer | `params`: Bind, Execute and Sync written |
| --- | --- | --- | --- |
| 1 | 214 B | 218 B | 104 B |
| 20 | 2,892 B | 2,464 B | 1,051 B |
| 100 | 14,019 B | 12,153 B | 5,179 B |

```bash
npm run build
node bench/pg-decode/run.mjs --validate            # every checksum, no timing
node bench/pg-decode/run.mjs --base origin/main    # ns/op against main's std/
node bench/pg-decode/run.mjs --callgrind --base origin/main
node bench/pg-decode/run.mjs --cpu x86-64-v3 --case rows
```

`run.mjs` builds `main.ts` with `--profile speed` into
`build/bench/pg-decode/`, plus a byte-identical copy. The copy's distance from
the build is the noise band, and a change inside it is noise. `--base <rev>`
builds the same `main.ts` with the same compiler against `std/` as it is at
`<rev>`. `--binary [name=]<path>` adds any other build as a column. Every case
calibrates one iteration count to about 200 ms. The rounds interleave the
columns (`bench/json-compare/rounds.mjs`), at least 11 of them, and each
column's median is reported with its min-max spread. Before timing, each
column must print the case's pinned checksum; `--validate` checks only that.
`--callgrind` counts instructions an operation instead: the count at 110
iterations less the count at 10, over 100, so setup cancels. The header
stamps the CPU model, its flags and the build flags.

## Result

An Intel Xeon @ 2.10 GHz virtual machine (4 cores; `avx2`, `bmi2`, `sha_ni` and
`avx512f` present), LLVM 18.1.3. `base` is `std/` at `1d92417e` (main before
the `getU64BE` fast path), built by the same compiler. ns/op are medians of 12
interleaved rounds, with the min-max spread. The band is the byte-identical
copy's distance from the build, so a change inside it is noise.

`--cpu x86-64` (the default), second of two runs:

| case | nish ns/op (spread) | base ns/op (spread) | base vs nish | band |
| --- | --- | --- | --- | --- |
| rows 1 | 277.8 (262.9-335.7) | 284.7 (273.6-418.4) | +2.5% | ±0.6% |
| rows 20 | 1676 (1514-2292) | 2000 (1785-2763) | +19.3% | ±12.2% |
| rows 100 | 7346 (6709-8808) | 8756 (8537-12308) | +19.2% | ±0.7% |
| pool 1 | 345.1 (309.5-457.1) | 317.6 (299.5-388.4) | -8.0% | ±8.7% |
| pool 20 | 1901 (1693-2888) | 2158 (1989-2725) | +13.5% | ±1.8% |
| pool 100 | 7782 (7193-8695) | 9454 (8863-11145) | +21.5% | ±0.9% |
| params 1 | 387.9 (338.5-431.0) | 368.6 (343.4-558.8) | -5.0% | ±2.1% |
| params 20 | 3422 (3259-3914) | 3563 (3151-3873) | +4.1% | ±0.7% |
| params 100 | 17609 (16588-19613) | 17922 (16879-20199) | +1.8% | ±5.2% |

In the first run, `pool 20` (+24.3%, band ±3.9%) and `pool 100` (+26.7%,
±9.6%) repeated outside the band. `rows 100` (+2.8%) fell inside that run's
±16.3% band, because the run shared the machine with a build.

`--cpu x86-64-v3`, two runs (base vs nish, band):

| case | run a | run b |
| --- | --- | --- |
| rows 20 | +19.7% (±0.9%) | +21.4% (±3.7%) |
| rows 100 | +29.8% (±1.4%) | +20.0% (±6.9%) |
| pool 20 | +28.3% (±1.9%) | +24.4% (±5.8%) |
| pool 100 | +26.2% (±6.4%) | +25.7% (±1.1%) |
| params 20 | -0.1% (±3.3%) | +2.8% (±2.1%) |
| params 100 | +3.6% (±3.9%) | +1.8% (±5.4%) |

Instructions an operation (`--callgrind`). The copy column is identical to
the build in every case:

| case | x86-64 nish | x86-64 base | | x86-64-v3 nish | x86-64-v3 base | |
| --- | --- | --- | --- | --- | --- | --- |
| rows 1 | 3,656 | 3,772 | +3.2% | 3,649 | 3,767 | +3.2% |
| rows 20 | 26,505 | 32,595 | +23.0% | 26,300 | 32,495 | +23.6% |
| rows 100 | 120,986 | 151,436 | +25.2% | 119,961 | 150,936 | +25.8% |
| text 1 | 4,008 | 4,008 | 0.0% | 3,999 | 3,999 | 0.0% |
| text 20 | 40,363 | 40,375 | 0.0% | 40,183 | 40,195 | 0.0% |
| text 100 | 196,572 | 196,572 | 0.0% | 195,672 | 195,672 | 0.0% |
| pool 1 | 4,121 | 4,237 | +2.8% | 4,114 | 4,232 | +2.9% |
| pool 20 | 27,920 | 34,010 | +21.8% | 27,715 | 33,910 | +22.4% |
| pool 100 | 126,449 | 156,899 | +24.1% | 125,424 | 156,399 | +24.7% |
| params 1 | 3,922 | 3,922 | 0.0% | 3,916 | 3,916 | 0.0% |
| params 20 | 30,747 | 30,747 | 0.0% | 30,554 | 30,554 | 0.0% |
| params 100 | 148,396 | 148,397 | 0.0% | 147,341 | 147,342 | 0.0% |

**The cut.** `getU64BE` (so `getI64BE` and `getF64BE`) checks the range once
and reads the eight bytes unchecked. Its ors are grouped in pairs, and its
byte-by-byte path is a separate function. It now lowers to one `mov` and one
`bswap` after a two-compare guard: about 16 instructions a call in
`--profile speed`, down from about 74. `params` reads no `int8`, and `text`
reads its `int8`s and times as text (`PgText`), so neither moves. The
`text` rows are the control: the same values as `rows`, and 62% more
instructions to decode than `rows` after the cut (196,572 against 120,986 at
100 rows).

**Does `getI64BE` lower to one load and `bswap`?** It does now, and did not
before. Before, it was an eight-iteration loop with an overflow check and a
bounds check on every byte. Two other shapes did not lower either:

- A straight chain of eight ors, with the byte loop in the same function:
  SimplifyCFG sank the last byte's load into the return block that both paths
  share, and load combining gave up. The binary kept eight `movzbl`/`shl`/`or`.
- The guard `off < toI32(b.length) - 7`: the checker did not prove the indices
  from it, so every bounds check stayed.

## Where the instructions go

Callgrind on the `-g` speed build after the cut, 200 iterations of
`rows 100` (25.1M instructions in all) and `params 100` (29.9M). Here is what
`pg-decode-2` should take next, largest first. Each estimate is the
instructions a change would save, from its call count and the cost per call
measured here.

| rank | candidate | where | now | estimate |
| --- | --- | --- | --- | --- |
| 1 | `putDecimal` reserves once, but then writes one digit at a time: a signed `i64` `%` and `/` by 10, a bounds-checked store through `this.out`, and a load and store of `this.outEnd`. A second loop reverses the digits, again with checks. Write two digits a step from a 200-byte table into the reserved room from its end (the length is `pgDecimalLength`), with no reversal | `std/net/postgres.ts` `putDecimal` | 375 instr a call (20,200 calls: 7.57M, 25% of `params 100`) | -50 to -60% of it: about -4M of `params 100`, about -13% |
| 2 | `arrayElement` scans each key a byte at a time for `"` and `\` before it copies the key with `copyBytes`. It also writes the comma and both quotes through `putByte`, which reserves each time (`reserve` costs 2.36M, 7.9%, nearly all from these). A byte-class run for the scan (`nish/bytes`'s runtime kernels), and one reserve covering the comma, the quotes and the key | `std/net/postgres.ts` `arrayElement`, `putByte`, `reserve` (inlined into the bench's `nish_main`) | 11.2M (37.5% of `params 100`), about 110 instr an element of 8 to 64 bytes | -40% of it: about -4M, -13% |
| 3 | The same fast path on `getU32BE`/`getI32BE`: 140,000 calls (7 a row) at 25 instr each, all from code inlined into `readRow`: the array's header words and its per-element lengths. The column-length read in `readRow` already has its own guard | `std/bytes.ts` `getU32BE` | 3.5M (14% of `rows 100`) | about 10 instr a call: -2.1M, about -8% of `rows 100` |
| 4 | `PgConnection.readRow` together with the inlined column loop: each column re-reads its length and stores its window into per-column arrays. One bounds proof per message (checking the length words once against the message end) could drop the per-column checks | `std/net/postgres.ts` `readRow`, `reserveColumns` | 11.2M (45% of `rows 100`), about 110 instr a row | uncertain: -10 to -20% of it |
| 5 | `binaryInt` re-checks the column's type, length and NULL on every read before it calls `getI64BE` | `std/net/postgres.ts` `binaryInt` | 37 instr a call (40,000 calls: 1.48M, 5.9%) | -0.6M, about -2% |

`getU64LE` has the same byte loop as the old `getU64BE`, but no Postgres path
reads it. Its users (`std/crypto`) keep their own copies.

## Tried and dropped

| idea | measured | why dropped |
| --- | --- | --- |
| `getU64BE` as one straight chain of eight ors, with the byte loop in the same function | lowered to eight `movzbl`/`shl`/`or` (no `bswap`); not timed | the shared return block stopped load combining; the pair-grouped tree in its own function is what shipped |
| `getU64BE` guarded by `off < toI32(b.length) - 7` | every bounds check stayed in the IR | the checker proves the indices only from `off < 2147483640 && off + 8 <= toI32(b.length)` |
