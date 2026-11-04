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

## Result: the `putDecimal` cut

`putDecimal` (so `paramInt`, `paramIntArray` and `arrayInt`) now writes each
integer once, right to left, into the `pgDecimalLength(value)` bytes it
reserved. Each step takes two digits from the magnitude as a `u64`, by an
unchecked `% 100` and `/ 100`, with no table. The old writer wrote a digit a
step, with a checked signed `%` and `/`, and then reversed them. The helper, `pgPutDecimal`, checks its window once:
`at + n` must fit the buffer, or it panics with "a decimal outside its room".
Its one caller reserves the room first, so no input reaches that panic. The
bytes written are the same for every `i64`. `tests/link/std_postgres_decimal`
checks this against the old writer for every digit count, both signs and both
`i64` limits. It also checks a number whose last digit lands in the output
buffer's last byte.

Same machine and compiler as below. `base` is `std/` at `119a74c5` (main
before this cut). Instructions an operation, from `--callgrind`. The copy
column is within one instruction of the build in every case:

| case | x86-64 nish | x86-64 base | | x86-64-v3 nish | x86-64-v3 base | |
| --- | --- | --- | --- | --- | --- | --- |
| params 1 | 3,917 | 3,984 | +1.7% | 3,917 | 3,979 | +1.6% |
| params 20 | 29,129 | 31,074 | +6.7% | 29,129 | 30,882 | +6.0% |
| params 100 | 138,193 | 149,900 | +8.5% | 138,193 | 148,846 | +7.7% |
| rows 100 | 122,437 | 122,490 | +0.0% | 121,412 | 121,465 | +0.0% |
| text 100 | 197,658 | 197,711 | +0.0% | 196,758 | 196,811 | +0.0% |
| pool 100 | 127,717 | 127,770 | +0.0% | 126,692 | 126,745 | +0.0% |

Every `rows`, `text` and `pool` case is 53 instructions an operation lower, at
1, 20 and 100 rows alike, because each operation binds one `int8` by
`paramInt`. `params 100` writes 101 integers an operation and saves 11,707
instructions at `x86-64`, about 116 an integer.

ns/op (`--base 119a74c5`), median and min-max spread. The band is the
byte-identical copy's distance from the build:

| case | run | nish ns/op (spread) | base ns/op (spread) | base vs nish | band |
| --- | --- | --- | --- | --- | --- |
| params 1 | x86-64, 1 | 538.4 (343.9-577.1) | 477.4 (359.7-575.6) | -11.3% | ±10.7% |
| params 1 | x86-64, 2 | 569.7 (367.3-603.6) | 574.0 (523.9-603.5) | +0.8% | ±2.2% |
| params 20 | x86-64, 1 | 3701.8 (3008.0-4506.2) | 4212.6 (3412.0-4708.8) | +13.8% | ±3.7% |
| params 20 | x86-64, 2 | 3284.5 (2999.0-4222.0) | 4019.2 (3415.9-4859.5) | +22.4% | ±23.2% |
| params 100 | x86-64, 1 | 15744.3 (14422.3-20729.0) | 18478.1 (17394.2-20652.2) | +17.4% | ±1.9% |
| params 100 | x86-64, 2 | 17362.5 (15266.3-22228.5) | 20968.3 (17147.9-24065.6) | +20.8% | ±4.0% |
| params 1 | x86-64-v3, 1 | 448.3 (360.2-567.0) | 418.7 (363.4-551.7) | -6.6% | ±11.9% |
| params 1 | x86-64-v3, 2 | 514.8 (362.0-637.3) | 430.0 (357.8-655.1) | -16.5% | ±15.4% |
| params 20 | x86-64-v3, 1 | 3336.1 (3042.3-4360.8) | 3657.7 (3249.7-4623.0) | +9.6% | ±2.3% |
| params 20 | x86-64-v3, 2 | 3239.3 (3056.3-3458.6) | 3677.2 (3365.3-4572.6) | +13.5% | ±1.0% |
| params 100 | x86-64-v3, 1 | 15869.3 (14695.7-20105.3) | 18382.2 (16836.9-24027.6) | +15.8% | ±13.1% |
| params 100 | x86-64-v3, 2 | 17512.2 (14939.1-21555.8) | 19604.4 (16871.3-22907.2) | +11.9% | ±1.7% |

The time gain repeats outside the band in both runs for `params 100` at
`x86-64`, and for `params 20` and `params 100` at `x86-64-v3`. That
includes run 1's +15.8% against ±13.1%. `params 1`, one key and two integers,
is noise. The machine was noisy in these runs: controls with identical
instructions moved outside their bands. `pool 100` went -14.8% (±1.2%) and
`text 100` -7.7% (±1.7%) in v3 run 2. `rows 100` went -9.6% (±2.5%) and
`text 20` +36.7% (±5.9%) in x86-64 run 2. `rows 1` went +21.9% (±4.8%) in
x86-64 run 1. So the claim rests on the instruction counts. The times agree
with them in sign and roughly in size.

## Result: the `getU64BE` cut

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
| text 1 | 316.5 (295.9-470.8) | 329.0 (293.8-510.8) | +3.9% | ±6.3% |
| text 20 | 3165 (2929-3864) | 3220 (2914-4361) | +1.7% | ±14.2% |
| text 100 | 15560 (14539-18203) | 16667 (14617-21001) | +7.1% | ±0.3% |
| pool 1 | 345.1 (309.5-457.1) | 317.6 (299.5-388.4) | -8.0% | ±8.7% |
| pool 20 | 1901 (1693-2888) | 2158 (1989-2725) | +13.5% | ±1.8% |
| pool 100 | 7782 (7193-8695) | 9454 (8863-11145) | +21.5% | ±0.9% |
| params 1 | 387.9 (338.5-431.0) | 368.6 (343.4-558.8) | -5.0% | ±2.1% |
| params 20 | 3422 (3259-3914) | 3563 (3151-3873) | +4.1% | ±0.7% |
| params 100 | 17609 (16588-19613) | 17922 (16879-20199) | +1.8% | ±5.2% |

The first `--cpu x86-64` run (base vs nish, band):

| case | run 1 |
| --- | --- |
| rows 1 | +9.0% (±0.9%) |
| rows 20 | +18.7% (±0.8%) |
| rows 100 | +2.8% (±16.3%) |
| pool 1 | +2.7% (±8.0%) |
| pool 20 | +24.3% (±3.9%) |
| pool 100 | +26.7% (±9.6%) |
| params 1 | +3.4% (±4.6%) |
| params 20 | -7.9% (±7.6%) |
| params 100 | -1.7% (±2.2%) |

`rows 100` fell inside run 1's ±16.3% band, because the run shared the
machine with a build. So at `--cpu x86-64` the gain repeats outside the band
in time for `rows 1`, `rows 20`, `pool 20` and `pool 100`, but not `rows 100`.
At `--cpu x86-64-v3` it repeats for `rows 1`, `rows 20`, `rows 100`, `pool 20`
and `pool 100`. The claim rests on the instruction counts below, which are
exact and repeat; the times agree with them where the band is narrow.

`text` is the control: its instruction counts are the same with and without
the cut, so no `text` difference is real. The first `--cpu x86-64` run had
`text 100` at +1.1% (band ±5.5%). The +7.1% above did not repeat, and it shows
that one copy's distance can understate the noise of a single run.

`--cpu x86-64-v3`, two runs (base vs nish, band):

| case | run a | run b |
| --- | --- | --- |
| rows 1 | +7.3% (±2.0%) | +9.1% (±5.2%) |
| rows 20 | +19.7% (±0.9%) | +21.4% (±3.7%) |
| rows 100 | +29.8% (±1.4%) | +20.0% (±6.9%) |
| pool 1 | +9.8% (±2.4%) | +2.5% (±3.3%) |
| pool 20 | +28.3% (±1.9%) | +24.4% (±5.8%) |
| pool 100 | +26.2% (±6.4%) | +25.7% (±1.1%) |
| text 20 | -8.1% (±8.6%) | +4.7% (±7.8%) |
| text 100 | +31.7% (±10.1%) | +3.4% (±4.7%) |
| params 1 | +1.6% (±1.0%) | +3.6% (±6.3%) |
| params 20 | -0.1% (±3.3%) | +2.8% (±2.1%) |
| params 100 | +3.6% (±3.9%) | +1.8% (±5.4%) |

`text 100`'s +31.7% in run a is noise in the same way: the instructions are
identical, and that run's spreads were the widest measured (14,027 to
27,142 ns for `base`).

Instructions an operation (`--callgrind`, run under the same pinned
`GLIBC_TUNABLES` and `NISH_SIMD=base` as `bench/run.mjs`). The copy column is
within one instruction of the build in every case:

| case | x86-64 nish | x86-64 base | | x86-64-v3 nish | x86-64-v3 base | |
| --- | --- | --- | --- | --- | --- | --- |
| rows 1 | 3,699 | 3,815 | +3.1% | 3,692 | 3,810 | +3.2% |
| rows 20 | 26,803 | 32,893 | +22.7% | 26,598 | 32,793 | +23.3% |
| rows 100 | 122,490 | 152,940 | +24.9% | 121,466 | 152,440 | +25.5% |
| text 1 | 4,050 | 4,050 | 0.0% | 4,041 | 4,041 | 0.0% |
| text 20 | 40,598 | 40,598 | 0.0% | 40,418 | 40,418 | 0.0% |
| text 100 | 197,712 | 197,711 | 0.0% | 196,812 | 196,811 | 0.0% |
| pool 1 | 4,167 | 4,283 | +2.8% | 4,160 | 4,278 | +2.8% |
| pool 20 | 28,195 | 34,286 | +21.6% | 27,990 | 34,186 | +22.1% |
| pool 100 | 127,770 | 158,220 | +23.8% | 126,745 | 157,720 | +24.4% |
| params 1 | 3,984 | 3,984 | 0.0% | 3,979 | 3,979 | 0.0% |
| params 20 | 31,074 | 31,074 | 0.0% | 30,882 | 30,882 | 0.0% |
| params 100 | 149,900 | 149,900 | 0.0% | 148,846 | 148,846 | 0.0% |

**The cut.** `getU64BE` (so `getI64BE` and `getF64BE`) checks the range once
and reads the eight bytes unchecked. Its ors are grouped in pairs, and its
byte-by-byte path is a separate function. It now lowers to one `mov` and one
`bswap` after a two-compare guard: about 16 instructions a call in
`--profile speed`, down from about 74. `params` reads no `int8`, and `text`
reads its `int8`s and times as text (`PgText`), so neither moves. The
`text` rows are the control: the same values as `rows`, and 61% more
instructions to decode than `rows` after the cut (197,712 against 122,490 at
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

Callgrind on the `-g` speed build, 200 iterations of `rows 100` (25.1M
instructions in all, after the `getU64BE` cut) and `params 100` (27.8M, after
the `putDecimal` cut, down from 29.9M). The `putDecimal` cut moved `rows 100`
by 10,600 instructions, so its figures still hold. Here is what the next stage
should take, largest first. Each estimate is the
instructions a change would save, from its call count and the cost per call
measured here. The figures come from:

```sh
D=build/bench/pg-decode/g && mkdir -p $D
build/nish bench/pg-decode/main.ts -o $D/ --link $D/pg-decode --profile speed -g
cd $D
valgrind --tool=callgrind --callgrind-out-file=cg.rows ./pg-decode rows 100 200
valgrind --tool=callgrind --callgrind-out-file=cg.params ./pg-decode params 100 200
callgrind_annotate --inclusive=no cg.rows     # self cost a function
callgrind_annotate --tree=caller cg.rows      # call counts, by caller
```

| rank | candidate | where | now | estimate |
| --- | --- | --- | --- | --- |
| 1 | `arrayElement` scans each key a byte at a time for `"` and `\` before it copies the key with `copyBytes`. It also writes the comma and both quotes through `putByte`, which reserves each time (`reserve` costs 2.36M, 8.5%, nearly all from these). A byte-class run for the scan (`nish/bytes`'s runtime kernels), and one reserve covering the comma, the quotes and the key | `std/net/postgres.ts` `arrayElement`, `putByte`, `reserve` | 8.95M in `arrayElement` itself (32.2% of `params 100`), about 450 instr an element of 8 to 64 bytes (20,000 elements), plus `reserve` | -40% of it: about -3.6M, -13% |
| 2 | What is left of `putDecimal` after its cut: `pgDecimalLength` still divides by 100 a step to count the digits before the writer divides again. Comparisons against the powers of ten would count them without dividing. Split the length from the write with `--dump-instr=yes` before taking it | `std/net/postgres.ts` `pgDecimalLength` (inlined into `putDecimal`) | 293 instr a call (20,200 calls: 5.92M, 21.3% of `params 100`), down from 375 | uncertain, at most the length's share of it |
| 3 | The same fast path on `getU32BE`/`getI32BE`: 140,000 calls (7 a row) at about 25 instr each (3.53M), all from code inlined into `readRow`: the array's header words and its per-element lengths. The column-length read in `readRow` already has its own guard | `std/bytes.ts` `getU32BE` | 3.5M (14% of `rows 100`) | from about 25 to about 10 instr a call, so about 15 saved a call: -2.1M, about -8% of `rows 100` |
| 4 | `PgConnection.readRow` together with the inlined column loop: each column re-reads its length and stores its window into per-column arrays. One bounds proof per message (checking the length words once against the message end) could drop the per-column checks | `std/net/postgres.ts` `readRow`, `reserveColumns` | 11.2M (45% of `rows 100`: 6.73M inlined plus 4.51M in `readRow` itself), about 560 instr a row (20,000 rows) | uncertain: -10 to -20% of it |
| 5 | `binaryInt` re-checks the column's type, length and NULL on every read before it calls `getI64BE` | `std/net/postgres.ts` `binaryInt` | 37 instr a call (40,000 calls: 1.48M, 5.9%) | -0.6M, about -2% |

The text path (`text 100`, 200 iterations, 40.2M instructions in all) ranks
differently. None of these is taken here:

| rank | candidate | where | now | estimate |
| --- | --- | --- | --- | --- |
| 1 | `PgText.int` checks each digit for overflow against `minTenth`. An integer of at most 18 digits cannot overflow, so a length test before the loop could skip that check, keeping the full check for longer input | `std/net/postgres.ts` `PgText.int` | 85,000 calls (65,000 array elements, 20,000 ids) at about 117 instr each: 9.99M, 25% of `text 100` | -25 to -35% of it: about -3M, -6 to -9% |
| 2 | `PgArrayWalker.next` tests five refused bytes (`{`, `}`, `"`, `\`, space) on every byte of an unquoted element as it scans for the comma | `std/net/postgres.ts` `PgArrayWalker.next` (inlined into the bench's `answer`) | 2.56M on the scan line alone, 6.4% | a byte-class test: about -1.5M, -4% |
| 3 | `PgText.timestamp` counts non-digits in the fixed 19 bytes with a bounds test per byte, after a guard that already proves them | `std/net/postgres.ts` `PgText.timestamp` (inlined) | 1.32M, 3.3% | about -0.7M, -2% |
| 4 | `readRow`: the same candidate as rank 4 above | `std/net/postgres.ts` `readRow` | 4.51M, 11.2% | uncertain |

`getU64LE` has the same byte loop as the old `getU64BE`, but no Postgres path
reads it. Its users (`std/crypto`) keep their own copies.

## Tried and dropped

| idea | measured | why dropped |
| --- | --- | --- |
| `getU64BE` as one straight chain of eight ors, with the byte loop in the same function | lowered to eight `movzbl`/`shl`/`or` (no `bswap`); not timed | the shared return block stopped load combining; the pair-grouped tree in its own function is what shipped |
| `getU64BE` guarded by `off < toI32(b.length) - 7` | every bounds check stayed in the IR | the checker proves the indices only from `off < 2147483640 && off + 8 <= toI32(b.length)` |
