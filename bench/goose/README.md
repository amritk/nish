# Nish against Goose

[Goose](https://github.com/aardappel/goose) is a systems language that compiles
to C. Its pools give 32-bit references, its unions are sized to their
variant, and it keeps data inline. Its repository has a benchmark suite of 16
programs, timed against C. This directory holds Nish ports of five of them and
`run.mjs`, which builds each program both ways and compares the two. The goal is
for Nish to be faster on the geometric mean and to produce the smaller
binary on every program.

The ports are copies of Goose's programs, under the Apache License 2.0 in
[LICENSE](LICENSE). The upstream files are at commit `3a0aa2e`, and each port
names its upstream file in its header. The licensing record is in
[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

## Running it

Goose is not vendored. Clone it and build its compiler (CMake and a C++20
compiler):

```bash
git clone https://github.com/aardappel/goose build/goose-src
```

```bash
cmake -S build/goose-src -B build/goose-src/build -DCMAKE_BUILD_TYPE=Release && cmake --build build/goose-src/build
```

Then:

```bash
node bench/goose/run.mjs --compiler build/nish
```

Use `build/nish`, which `npm run build` writes from this checkout. The seed in
`build/seed` links its own release's runtime, so it measures that release and
not the runtime in `runtime/`.

The defaults are a checkout at `build/goose-src` (pass `--goose <dir>` for
another), the large size and the best of three timed runs after two warm-ups.
`--size s|m|l` picks Goose's small, medium or large size, `--only tree,words`
narrows the set, and `--validate` builds everything and compares checksums
without timing. The run exits 1 if any checksum differs.

The protocol is Goose's own, from its `bench/run_bench.py`:

- Goose is built with `goose -O2 --standalone`, then with
  `clang -O2 -DGS_STACK_RESERVE=2147483648ull`.
- Nish is built with `--link --profile speed`.
- The size is written onto the program's size line: `// BENCH_N` in the Goose
  source and `// bench:n` in the port.
- Time is wall clock for the whole process.
- Peak RSS is `ru_maxrss` from [`bench/rss.c`](../rss.c).
- Size is the stripped executable. The script strips a copy of Goose's
  binary; a speed-profile Nish binary is already stripped.

## The programs

| Port | Goose program | What it stresses |
| --- | --- | --- |
| `tree.ts` | `tree.goose` | Builds one binary tree of 2^(n+1) - 1 nodes, each with a pseudo-random value, then walks it eight times |
| `bintrees.ts` | `bintrees.goose` | The Benchmarks Game's binary-trees: many short-lived trees plus one long-lived tree |
| `records.ts` | `records_var.goose` | A stream of tagged events (tick, move, say, quit) built and then replayed |
| `strlist.ts` | `strlist.goose` | Builds a text of random words, splits it on spaces and scans the pieces |
| `words.ts` | `words.goose` | Word frequency: draws a skewed text from a vocabulary, splits it and counts with an open-addressing map |

Each port computes the same values in the same order as its Goose program
and prints the same tokens. Two ports change the data layout where Nish has
no equivalent:

- **`records.ts`** stores events as columns: a tag byte, an id, a 32-bit
  payload and a byte column for the Say text. Goose stores them as a
  variant-sized union array.
- **`words.ts`** stores the map as three columns. Goose uses one array of
  `Slot` structs. A `Slot[]` version of the port, in which Nish keeps the
  records inline, runs level with the columns since arrays grow in place
  (see "A map probe" below), so the port keeps the columns.

## Results

Large size, on a 4-core cloud container:
`node bench/goose/run.mjs --compiler <nish> --runs 5`. "After" is `build/nish`
at 883d233b, the last commit to `src/`, `std/` or `runtime/` on this branch,
which added the loop guard below. "Before" is the same build at its parent,
491984b1. The suite ran four times in one session, alternating before, after,
before, after. The table is the first "after" run, with the "before" row for
words from the run just ahead of it. All five checksums are identical in
every run.

| Program | n | Nish ms | Goose ms | Goose/Nish | Nish RSS KB | Goose RSS KB | Nish bytes | Goose bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tree | 24 | 2016 | 1371 | 0.68 | 788,256 | 395,320 | 7,832 | 18,864 |
| bintrees | 19 | 511 | 440 | 0.86 | 33,956 | 26,552 | 12,856 | 18,880 |
| records | 16000000 | 626 | 621 | 0.99 | 179,616 | 146,552 | 9,960 | 18,888 |
| strlist | 8000000 | 455 | 703 | 1.55 | 161,696 | 220,668 | 9,320 | 18,888 |
| words, before | 16000000 | 2950 | 1620 | 0.55 | 410,788 | 542,348 | 11,848 | 18,904 |
| words | 16000000 | 2393 | 1736 | 0.73 | 410,788 | 542,332 | 11,960 | 18,904 |

Geometric means, Goose over Nish (above 1 means Nish ahead), from both runs
of each compiler:

| Measure | Before | After | Who is ahead |
| --- | ---: | ---: | --- |
| Binary size | 1.85, 1.85 | 1.85, 1.85 | Nish, on every program |
| Time | 0.84, 0.81 | 0.92, 0.86 | Goose. Nish wins strlist |
| Peak RSS | 0.90, 0.90 | 0.90, 0.90 | Goose on tree, bintrees and records; Nish on strlist and words |

The noise band is wide. Each figure is one best of 5 after two warm-ups.
Across the four runs, the Goose binaries, which no Nish change touches,
ranged by up to 24.6%: tree 1282 to 1371 ms (6.9%), bintrees 353 to 440 ms
(24.6%), records 621 to 666 ms (7.2%), strlist 680 to 742 ms (9.1%) and
words 1527 to 1736 ms (13.7%). The two compilers build tree, bintrees,
records and strlist byte for byte the same (compared at the ports' own
`bench:n` sizes), and those Nish rows ranged by up to 16.5%: tree 1960 to 2056 ms (4.9%), bintrees 472 to 532 ms (12.7%),
records 605 to 699 ms (15.5%) and strlist 455 to 530 ms (16.5%). Every
Goose/Nish ratio therefore moves by more than the guard changes any program
but words, and the two time geomeans overlap within that noise: 0.81 and
0.84 before, 0.86 and 0.92 after. Words alone moved by more than the band:
2950 and 2798 ms before, 2393 and 2383 ms after, 14.8% apart on the best
runs. Its instruction count, which does not depend on the machine's noise,
fell 14.7% (below).

The guard costs words 112 bytes of binary (11,848 before, 11,960 after).

An earlier session moved these programs with the first two fixes below, from
the 0.41.0 seed. Its times do not compare with the table above:

| Program | Seed ms | Now ms | Seed RSS KB | Now RSS KB |
| --- | ---: | ---: | ---: | ---: |
| records | 886 | 725 | 392,160 | 179,424 |
| strlist | 628 | 536 | 358,112 | 161,632 |
| words | 3020 | 2532 | 803,936 | 410,852 |

tree and bintrees build no arrays, so those fixes do not touch them. Only
ratios taken in one session compare. The binaries that grow arrays are 376 to
440 bytes larger, which is the in-place growth path in the runtime.

## Where Nish loses

Each loss below has a measured or read cause. Each one points to a compiler
or runtime change.

- **Fixed: array growth left the old block behind.** `nish_array_grow`
  (`runtime/runtime.c`) copied a doubled array into a new arena block and
  never gave the old one back. So an array built by `push` cost about twice
  its final size. It now grows in place when its block is the last one the
  arena handed out, which is the case while one column is being built. RSS
  fell by 54 to 55% on records, strlist and words.
- **Fixed: a byte append was one call per byte.** A `for` loop whose body is
  one `dst.push(src[P + j])` is now one capacity check and one `memcpy`
  behind its range guards (`emitAppendRange`, `src/emit-arrays.ts`). It gains
  about 11% on words: 2290 to 2370 ms against 2557 to 2640 ms at 16M words,
  with the loop written so the rewrite does not apply. That is far less than
  the 1,100 ms the old reading put on the append. Where the rest of that
  time goes has not been measured.
- **The map probe is not the layout.** The words count phase is most of
  what is left of the words gap. Each probe touches `keyAt`, `keyLen` and
  `counts` in three separate columns, where Goose's `Slot` puts all three
  in one 12-byte record. A `Slot[]` port (`interface Slot { key: i32; len:
  i32; count: i32 }`, probed as `const slot = slots[idx]`) now matches the
  columns: best of 10, interleaved, at 16M words, 2377 to 2565 ms for
  `Slot[]` against 2377 to 2536 ms for the columns, with the count phase
  about 1.7 to 1.8 s either way and the same 410,780 KB RSS. The old
  5,659 ms and 967 MB came from the array growth leak that in-place
  growth fixed. Cachegrind shows `Slot[]` cutting D1 misses from 14.0M
  to 10.3M with no change in time, so cache misses on the map are not
  what the gap costs. The -O2 probe reads fields in place (no record
  copy), uses Goose's 12-byte stride and reloads no array header per
  probe. Its one extra cost, a bounds check on `slots[idx]` that the
  prover cannot discharge from `idx = h & mask`, measured as nothing when
  removed by hand (count phase best 1797 ms without it, 1745 ms with it), so no
  codegen change was made.
- **Fixed: `same()` checked `a + i` and `b + i` on every byte.** A profile
  of words at 4M words (`build/nish words.ts --link words-g --profile speed
  -g`, then `valgrind --tool=callgrind ./words-g` and `callgrind_annotate
  --auto=yes`, with the `bench:n` line set to 4000000) put 512.0M of 1,603.5M
  instructions (31.9%) on `same()` and 212.5M (13.25%) on `hash()`. In
  `same()` each byte paid two `llvm.sadd.with.overflow` branches and two
  sign extensions before its loads. A counted loop
  `for (let i = J; i < B; i++)` now tests each `x + i` in its body, with `x`
  and `B` loop-invariant, once before the loop: when `x + J` and
  `x + (B - 1)` both fit, the additions are `add nsw`, and otherwise they are
  checked as before and panic where they run (`emitAddGuards`,
  `src/emit-arrays.ts`; `tests/cases/ovf_loop_guard`). LLVM unswitches the
  loop on that test. The same profile after the fix: 1,368.3M instructions
  (-14.7%), `same()` 239.4M (17.5%), `hash()` 216.5M (15.8%). The total
  fell 235.2M while `same()` fell 272.6M and `hash()` rose 4.0M. Per line,
  the 33M left over is +44.0M on instructions callgrind gives no source
  line, +8.0M on the probe's `while (true)`, +4.0M on the two
  `uncheckedSet(counts, ...)` lines, -18.7M on the probe's `same(...)` call
  and -4.0M on `starts.push`. Why the unattributed instructions grew was not
  measured. Words at 16M,
  best of 10 wall-clock runs, the two `words-nish` binaries `run.mjs` built
  alternating: 3548 ms (3548 to 4053) before against 3110 ms (3110 to
  3423) after, so the ranges do not overlap: 12% faster on the best run.
  At the large size itself (the `bench:n` line set to 16000000, built and
  profiled the same way by 491984b1 and 883d233b), the total fell from
  6,410.9M instructions to 5,469.8M (-14.7%). `same()` fell from 2,048.4M
  (32.0%) to 958.0M (17.5%), and `hash()` went from 849.4M (13.2%) to
  865.4M (15.8%). The count phase, the word loop's own lines plus both
  functions, fell from 3,361.4M (52.4%) to 2,260.0M (41.3%). Instructions
  in `main` with no source line rose from 427.0M to 603.2M, and libc's
  `memcpy` and `memset` stayed at 364.9M.
  - **Next:** `same()` and `hash()` are now within two points of each other
    (17.5% and 15.8%), at 4M and at 16M words. `same()` still compares one byte per iteration where
    a word-at-a-time compare (or `memcmp`) would do eight; `hash()` is a
    serial FNV-1a multiply chain per byte.
- **Fixed: a tree node was twice the size.** A `tree.ts` node was 24 bytes:
  an `i32`, four bytes of padding and two 64-bit pointers. A Goose pool node
  is 12 bytes, because its links are 32-bit indices into the pool. The
  compiler now picks `TNode` as a compact class by itself (WP48,
  [`docs/wp48-ref32-classes.md`](../../docs/wp48-ref32-classes.md) §5.6): its
  links are 32-bit offsets into one reserved range and the node is 12 bytes.
  At n = 24, `build/nish` at 568e1ef5 against the same build with
  `--compact off`, 11 rounds alternating which ran first, process wall under
  `bench/rss.c`: 1888 ms against 2806 ms (median gap −33.5%, range −37.6%
  to −30.0%), peak RSS 394,720 KB against 788,320 KB. Goose was not rebuilt
  in that session; the table above has it at 395,320 KB, so the RSS gap is
  closed, and its 1371 ms is from another session, so the time ratio is not
  restated here. The binary is 1,528 bytes larger (9,360 against 7,832): the
  range allocator.
- **bintrees allocates many small trees.** Its node is 16 bytes in Nish
  against Goose's 8. The compiler leaves it wide, on measurement: narrowed
  under an earlier version of the rule it took half the memory but ran 18.8% slower at depth 19 (median of 9
  rounds, range +1.8% to +25.5%; §5.5 of the same note). Each tree is freed
  before the next, so the smaller node saves little traffic, and four 16-byte
  nodes already fit in a cache line. The rule therefore counts a saving only
  on a class of at least 24 bytes. Where the time gap goes is not measured.
