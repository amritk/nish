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
  records inline, measured slower (5,659 ms and 967 MB at 16M words) than
  the columns.

## Results

Large size, on a 4-core cloud container, built by `build/nish` at this
branch's head. All five checksums are identical.

| Program | n | Nish ms | Goose ms | Goose/Nish | Nish RSS KB | Goose RSS KB | Nish bytes | Goose bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tree | 24 | 2632 | 1437 | 0.55 | 788,320 | 395,308 | 7,800 | 18,864 |
| bintrees | 19 | 535 | 401 | 0.75 | 34,020 | 26,540 | 12,824 | 18,880 |
| records | 16000000 | 725 | 748 | 1.03 | 179,424 | 146,604 | 9,928 | 18,888 |
| strlist | 8000000 | 536 | 598 | 1.12 | 161,632 | 220,652 | 9,288 | 18,888 |
| words | 16000000 | 2532 | 1628 | 0.64 | 410,852 | 542,348 | 11,752 | 18,904 |

Geometric means, Goose over Nish (above 1 means Nish ahead). The "before"
column is the 0.41.0 seed, run on the same machine in the same session. It
has neither fix below.

| Measure | Before | After | Who is ahead |
| --- | ---: | ---: | --- |
| Binary size | 1.90 | 1.86 | Nish, on every program |
| Time | 0.72 | 0.79 | Goose. Nish now wins records and strlist |
| Peak RSS | 0.57 | 0.90 | Goose on tree, bintrees and records; Nish on strlist and words |

The fixes moved these programs:

| Program | Seed ms | Now ms | Seed RSS KB | Now RSS KB |
| --- | ---: | ---: | ---: | ---: |
| records | 886 | 725 | 392,160 | 179,424 |
| strlist | 628 | 536 | 358,112 | 161,632 |
| words | 3020 | 2532 | 803,936 | 410,852 |

tree and bintrees build no arrays, so the fixes do not touch them. Their
times are the same from either compiler. This machine runs tree slower
against Goose (0.55) than the machine of the first run did (0.72), with the
same 7,800-byte binary. Only ratios taken in one session compare. The binaries
that grow arrays are 376 to 440 bytes larger, which is the in-place growth
path in the runtime.

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
- **A map probe misses the cache three times.** The words count phase is
  most of what is left of the words gap. Each probe touches `keyAt`, `keyLen` and `counts` in three
  separate columns, where Goose's `Slot` puts all three in one cache line.
  Nish keeps a `Slot[]` inline, but that version was slower still.
  - **Fix:** find out why, then make the inline record array as fast as the
    columns.
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
