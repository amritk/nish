# StaticTS benchmark suite

Six programs, each written three times with the same data layout and the same
expression order (so the floating-point results agree bit for bit): StaticTS
(`.ts`), C (`.c`, `clang -O3`) and Rust (`.rs`, `rustc -C opt-level=3
-C panic=abort -C codegen-units=1`). `bench/run.mjs` builds them all, checks
that every binary prints the same checksum, times them and writes
[docs/BENCHMARKS.md](../docs/BENCHMARKS.md). The analysis of the results, and
of every gap over the 10 % target, is in
[docs/wp9-optimisation.md](../docs/wp9-optimisation.md).

```bash
npm run build
node bench/run.mjs                        # everything; ~3 minutes; writes docs/BENCHMARKS.md
node bench/run.mjs --only fib,vec3        # a subset
node bench/run.mjs --runs 10 --warmup 2   # more samples
node bench/run.mjs --n fib=30,sieve=1000000   # other sizes (rewrites the `bench:n` line)
node bench/run.mjs --validate --only fib,sieve --n fib=25,sieve=100000   # what CI runs: checksums only
node bench/run.mjs --no-rust              # skip Rust even when rustc is installed
```

`rustc` is looked up on `PATH` and in `~/.cargo/bin`; `RUSTC=<path>` overrides
it and without one the Rust columns are skipped. `CC` picks the C compiler
(default `clang`). Build products go to `build/bench/`.

## The programs

| Name | What it measures | StaticTS flags | Size (`bench:n`) | Checksum |
| --- | --- | --- | --- | --- |
| `fib` | recursive calls, integer add | | fib(40) | `102334155` |
| `nbody` | a class with seven `f64` fields in an array, `Math.sqrt`, field read/write in a nested loop | `--number-mode f64` | 2e7 steps | energy before and after |
| `spectral` | `number[]` reads and writes, `f64` divide, `i32` index arithmetic | `--number-mode f64` | n = 3000 | `1.2742241526449527` |
| `sieve` | `boolean[]` strided stores with bounds checks, 20 passes over one 10 MB array | | n = 1e7 | `13291580` |
| `strbuild` | template literals with a number hole, `+` on immutable strings, the arena allocator | | 131072 pieces | `806394` (final length) |
| `vec3` | a `Vec3` class with methods called in a tight loop, no allocation in the loop | `--number-mode f64` | 5e7 iterations | position and energy |

Every size is chosen so the C version runs for at least a quarter of a second
on the reference machine (a 2.1 GHz Xeon virtual machine): fib(35) and a
single 1e7 sieve pass finish in 30-40 ms there, too short for the run-to-run
noise of a VM. The `bench:n` comment marks the one line the runner rewrites
for `--n`; the twins carry the same marker.

`strbuild` has a fourth version, `strbuild_naive.c`: the same immutable-string
algorithm with a `malloc` per string and a `free` as soon as a string has been
copied into its successor. Against `strbuild.c` (a bump arena that never
frees, i.e. the StaticTS runtime's model) it isolates what the arena costs and
saves. The Rust version allocates a fresh `String` per concatenation, the same
work as the naive C.

## Rules

- **Same algorithm, same order.** The twins are transliterations: the same
  loops, the same temporaries, the same left-to-right evaluation. No
  `-ffast-math`, no `-march=native` for C; Rust gets a separate
  `-C target-cpu=native` column because that is what Rust programmers commonly
  ship with.
- **Same memory model where the language allows it.** C and Rust objects are
  heap allocated (`malloc`, `Box`) like the arena objects in StaticTS; arrays
  are indexed with a 32-bit index converted to the native width. Rust's
  bounds checks stay on (`Vec` indexing), like StaticTS's.
- **One checksum per program.** Outputs are compared token by token; numeric
  tokens must agree to 1e-9 relative, which lets `%.17g`, Rust's `{}` and
  StaticTS's JavaScript-style shortest round-trip formatting print the same
  double differently. A mismatch fails the run, and the CI test in
  `tests/run.js` (`WP9: bench`) validates `fib` and `sieve` at small sizes on
  every push.
- **Timing.** Wall time of the whole process, `process.hrtime.bigint()`
  around `spawnSync`, one warm-up run then five timed runs; the table shows
  minimum and median. Process start-up (about 1 ms) is included and identical
  for every column.
- **Sizes.** Every binary is stripped: StaticTS through `scripts/build.sh`
  (`-s`, section GC, LTO), C with `-s`, Rust with `-C strip=symbols`. The
  StaticTS `size` profile (`-Oz`) gets its own column.
- **Memory.** Peak RSS of one run, from `wait4`'s `ru_maxrss` via
  `bench/rss.c`.

## Columns

| Column | Build |
| --- | --- |
| StaticTS | `statictsc <src> [--number-mode f64] --link <exe> --profile speed` |
| StaticTS `--nsw` | as above plus `--nsw` (integer benchmarks only): signed overflow becomes undefined, as in C |
| StaticTS (size profile) | `--profile size`, size table only |
| C `-O3` | `clang -O3 -s <src> -lm` |
| C `-O3` naive | `strbuild_naive.c` only |
| Rust `-O3` | `rustc -C opt-level=3 -C panic=abort -C codegen-units=1 -C strip=symbols` |
| Rust native | as above plus `-C target-cpu=native` |

The `StaticTS / Rust` column divides the StaticTS minimum by the Rust `-O3`
minimum. The WP9 target is 1.10x or better for loop and math code.

## Other files

- `sum.ts`, `ffi.mjs`: the WP8 FFI batching benchmark (`node bench/ffi.mjs`),
  not part of this suite.
- `rss.c`: the peak-RSS helper the runner compiles into `build/bench/rss`.
