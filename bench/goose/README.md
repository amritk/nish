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

Large size, on a 4-core cloud container, built by `build/nish` at this
branch's head: `node bench/goose/run.mjs --compiler build/nish --runs 5`.
All five checksums are identical.

| Program | n | Nish ms | Goose ms | Goose/Nish | Nish RSS KB | Goose RSS KB | Nish bytes | Goose bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tree | 24 | 2134 | 1409 | 0.66 | 788,256 | 395,148 | 7,832 | 18,864 |
| bintrees | 19 | 504 | 399 | 0.79 | 33,956 | 26,552 | 12,856 | 18,880 |
| records | 16000000 | 726 | 605 | 0.83 | 179,616 | 146,616 | 9,960 | 18,888 |
| strlist | 8000000 | 547 | 790 | 1.45 | 161,696 | 220,684 | 9,320 | 18,888 |
| words | 16000000 | 3199 | 2032 | 0.64 | 410,788 | 542,332 | 11,960 | 18,904 |

Geometric means, Goose over Nish (above 1 means Nish ahead). The "before"
column is `main` without the loop-guarded additions below, run the same way
in the same session just before.

| Measure | Before | After | Who is ahead |
| --- | ---: | ---: | --- |
| Binary size | 1.85 | 1.85 | Nish, on every program |
| Time | 0.81 | 0.83 | Goose. Nish wins strlist |
| Peak RSS | 0.90 | 0.90 | Goose on tree, bintrees and records; Nish on strlist and words |

The time geomean moves inside this machine's noise. Goose's own words binary,
which no Nish change touches, took 2058 ms in the "before" run and 2032 ms in
the "after" one. Records'
Goose/Nish went from 0.95 to 0.83 with no change that reaches it. The words
gain is measured apart, interleaved, below.

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
  (-14.7%), `same()` 239.4M (17.5%), `hash()` 216.5M (15.8%). Words at 16M,
  best of 10 wall-clock runs, the two `words-nish` binaries `run.mjs` built
  alternating: 3548 ms (3548 to 4053) before against 3110 ms (3110 to
  3423) after, so the ranges do not overlap: 12% faster on the best run.
  - **Next:** `same()` and `hash()` are now within two points of each other
    (17.5% and 15.8%). `same()` still compares one byte per iteration where
    a word-at-a-time compare (or `memcmp`) would do eight; `hash()` is a
    serial FNV-1a multiply chain per byte.
- **A tree node is twice the size.** A `tree.ts` node is 24 bytes: an `i32`,
  four bytes of padding and two 64-bit pointers. A Goose pool node is 12
  bytes, because its links are 32-bit indices into the pool. The tree at
  n = 24 is 33.5M nodes, so the difference is both the RSS gap (788 MB
  against 395 MB) and most of the time gap.
  - **Fix:** 32-bit references for a class whose instances all live in one
    arena.
- **bintrees allocates many small trees.** Its RSS gap is small. The time gap
  is most likely the same node size: 16 bytes in Nish against Goose's 8.
  This one has not been measured separately.
