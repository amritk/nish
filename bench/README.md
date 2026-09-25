# Nish benchmark suite

Seven programs, each written four times with the same data layout and the same
expression order (so the floating-point results agree bit for bit): Nish
(`.ts`), C (`.c`, `clang -O3`), Go (`.go`, `go build`) and Rust (`.rs`,
`rustc -C opt-level=3 -C panic=abort -C codegen-units=1`). `bench/run.mjs`
builds them all, checks that every binary prints the same checksum, times them
and writes [docs/BENCHMARKS.md](../docs/BENCHMARKS.md). The analysis of the results, and
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
node bench/run.mjs --no-go                # skip Go even when the go tool is installed
```

The report's header describes the **run**, not the checkout that happens to
hold it: the date, the machine, the toolchain versions, and the compiler's own
`--version` line and commit. The checked-in report therefore reads
`nish 0.0.0 (commit c72a68f)` — it was measured before the first release moved
`package.json` off `0.0.0`, and the commit it names is the working commit of
that run. The numbers are still the current compiler's: nothing in `src/`,
`self/`, `runtime/` or `bench/` has changed since that run, only the release
plumbing and the version string. Do not correct the header by hand;
`docs/BENCHMARKS.md` is generated, and a header edited to say something the run
did not is worse than a stale one. The next `node bench/run.mjs` on a quiet
machine rewrites the whole file, version line included — which is the only way
to refresh it, since a timing run on a busy machine measures the machine.

`rustc` is looked up on `PATH` and in `~/.cargo/bin`; `RUSTC=<path>` overrides
it and without one the Rust columns are skipped. `go` is looked up on `PATH`,
in `/usr/local/go/bin` and in `~/go/bin`, with `GO=<path>` the override and the
same skip when it is missing. `CC` picks the C compiler (default `clang`).
Build products go to `build/bench/`.

## The programs

| Name | What it measures | Nish flags | Size (`bench:n`) | Checksum |
| --- | --- | --- | --- | --- |
| `fib` | recursive calls, integer add | | fib(40) | `102334155` |
| `nbody` | a class with seven `f64` fields in an array, `Math.sqrt`, field read/write in a nested loop | `--number-mode f64` | 2e7 steps | energy before and after |
| `spectral` | `number[]` reads and writes, `f64` divide, `i32` index arithmetic | `--number-mode f64` | n = 3000 | `1.2742241526449527` |
| `sieve` | `boolean[]` strided stores with bounds checks, 20 passes over one 10 MB array | | n = 1e7 | `13291580` |
| `strbuild` | template literals with a number hole, `+` on immutable strings, the arena allocator | | 131072 pieces | `806394` (final length) |
| `vec3` | a `Vec3` class with methods called in a tight loop, no allocation in the loop | `--number-mode f64` | 5e7 iterations | position and energy |
| `result` | a fallible function returning `Result<number, number>` and one taking it, both by value in a register (WP17); the accumulator feeds the next input, so the loop carries a dependency | | 2e8 calls | `15873` |

Every size is chosen so the C version runs for at least a quarter of a second
on the reference machine (a 2.1 GHz Xeon virtual machine): fib(35) and a
single 1e7 sieve pass finish in 30-40 ms there, too short for the run-to-run
noise of a VM. The `bench:n` comment marks the one line the runner rewrites
for `--n`; the twins carry the same marker.

`result`'s twins are the shapes each language would use anyway: a C struct of
two words — the one `nish --emit-header` declares for
`Result<number, number>` — and Rust's own `Result<i32, i32>`. Go has no such
type, so `result.go` uses the same two-word struct as the C twin; Go's register
ABI returns and passes it in registers, exactly as Go's own `(value, ok)` pair
of results would be. All four are returned and passed in registers, so the four
columns should be the same code; an Nish column well behind them means a
`Result` went back to being a pointer into the arena. The gap this program
used to show, the respelling that did *not* close it and the private per-arm
ABI that did, are in
[docs/wp17-result-abi.md](../docs/wp17-result-abi.md) §4.

`strbuild` has one more version, `strbuild_naive.c`: the same immutable-string
algorithm with a `malloc` per string and a `free` as soon as a string has been
copied into its successor. Against `strbuild.c` (a bump arena that never
frees, i.e. the Nish runtime's model) it isolates what the arena costs and
saves. The Rust version allocates a fresh `String` per concatenation, the same
work as the naive C; the Go version does the same with `s + piece`, except that
a garbage collector, not `free` or an arena, reclaims the intermediates — so
`strbuild` is the one benchmark where the Go column is measuring a GC.

## Rules

- **Same algorithm, same order.** The twins are transliterations: the same
  loops, the same temporaries, the same left-to-right evaluation. No
  `-ffast-math`, no `-march=native` for C; Rust gets a separate
  `-C target-cpu=native` column because that is what Rust programmers commonly
  ship with. Go has no such knob — `go build` has one optimisation level and
  targets the baseline amd64 — so it gets one column, which is also what a Go
  programmer ships.
- **Same memory model where the language allows it.** C, Go and Rust objects
  are heap allocated (`malloc`, `&T{…}`, `Box`) like the arena objects in
  Nish; arrays are indexed with a 32-bit index converted to the native
  width. Rust's and Go's bounds checks stay on (`Vec` and slice indexing), like
  Nish's — no `-gcflags=-B`. Go's garbage collector runs at its default
  `GOGC=100`; only `strbuild` allocates enough for that to show.
- **Constants fold the same way.** A Go untyped constant expression is folded
  in arbitrary precision and rounded once, where C, Rust and Nish round
  every step to `f64`; `nbody.go` therefore spells its constants as typed
  variables, or one ULP in `SOLAR_MASS` would move the last digits of a
  chaotic system's final energy. Go does not fuse multiply-add on amd64, so no
  version needs to suppress FMA.
- **One checksum per program.** Outputs are compared token by token; numeric
  tokens must agree to 1e-9 relative, which lets `%.17g`, Rust's `{}`, Go's
  `%v` and Nish's JavaScript-style shortest round-trip formatting print
  the same double differently. A mismatch fails the run, and the CI test in
  `tests/run.js` (`WP9: bench`) validates `fib` and `sieve` at small sizes on
  every push.
- **Timing.** Wall time of the whole process, `process.hrtime.bigint()`
  around `spawnSync`, one warm-up run then five timed runs; the table shows
  minimum and median. Process start-up (about 1 ms) is included and identical
  for every column.
- **Sizes.** Every binary is stripped: Nish through `scripts/build.sh`
  (`-s`, section GC, LTO), C with `-s`, Rust with `-C strip=symbols`, Go with
  `-ldflags=-s -w`. The Nish `size` profile (`-Oz`) gets its own column.
  A Go binary still carries the runtime, the scheduler and the collector, so
  its floor is about a megabyte and the column is not a like-for-like one.
- **Memory.** Peak RSS of one run, from `wait4`'s `ru_maxrss` via
  `bench/rss.c`.

## Columns

| Column | Build |
| --- | --- |
| Nish | `nish <src> [--number-mode f64] --link <exe> --profile speed` |
| Nish `--nsw` | as above plus `--nsw` (integer benchmarks only): signed overflow becomes undefined, as in C |
| Nish (size profile) | `--profile size`, size table only |
| C `-O3` | `clang -O3 -s <src> -lm` |
| C `-O3` naive | `strbuild_naive.c` only |
| Go | `go build -trimpath -ldflags=-s -w` |
| Rust `-O3` | `rustc -C opt-level=3 -C panic=abort -C codegen-units=1 -C strip=symbols` |
| Rust native | as above plus `-C target-cpu=native` |

The `Nish / Go` and `Nish / Rust` columns divide the Nish
minimum by that language's minimum. The WP9 target is 1.10x or better for loop
and math code, and it is set against Rust: Go is reported for scale, not as a
gate.

## Are We Fast Yet

`bench/awfy/` holds Nish ports of seven of the
[Are We Fast Yet](https://github.com/smarr/are-we-fast-yet) benchmarks —
Bounce, List, Mandelbrot, Permute, Queens, Storage and Towers — with their
harness as `main.ts`, which makes the directory one multi-module program of the
self-hosting corpus (`tests/self/corpus.js`). They are not twins: there is no C
or Rust version to compare a checksum with, because each benchmark checks its
own result (`verifyResult`) and the harness panics when one is wrong. They
come from the port in `benchmarks/Nish/` of
[amritk/are-we-fast-yet](https://github.com/amritk/are-we-fast-yet) and keep
its code, under the licences in [awfy/LICENSE.md](awfy/LICENSE.md), with one
change: `Storage.benchmark` no longer brackets its tree with
`Arena.mark`/`Arena.release`, because the compiler gives it that scope itself
(the automatic arena scope in [docs/LANGUAGE.md](../docs/LANGUAGE.md#memory-model),
item 2). The rest is housekeeping: the harness is `main.ts` rather than
`harness.ts`, Mandelbrot's `escape` is `escaped` and `isKnownBenchmark` has a
concise body, both for the linter, and Mandelbrot's header names the licence
its kernel carries. The harness still releases the arena after
every measured iteration, standing in for the collector the other ports have.

```bash
node bench/run.mjs --only awfy              # build checked, time all seven
node bench/run.mjs --validate --only awfy   # one iteration of each, results verified
build/nish bench/awfy/main.ts --link build/awfy-harness --profile speed
build/awfy-harness Queens 30 1000           # benchmark, outer iterations, inner iterations
```

`--only awfy` builds the harness with `--profile speed` and nothing else, so
bounds checks stay on, and runs each benchmark for 30 outer iterations at the
inner counts the AWFY suite uses (Permute 1000, Queens 1000, Towers 600, List
1500, Bounce 1500, Mandelbrot 500, Storage 1000). It prints the median of the
last 20, with their minimum and maximum; the first 10 are the warm-up. It
writes nothing to `docs/BENCHMARKS.md`, and it runs only when `--only` names
it. `--validate` runs one outer and one inner iteration of each and fails when
any exits non-zero, and `tests/run.js` runs it in its `WP9: bench` check with
`fib` and `sieve`. The numbers against 0.10.0 and the profile of the gap to
C++ are in
[docs/wp9-optimisation.md](../docs/wp9-optimisation.md#are-we-fast-yet).

## Other files

- `sum.ts`, `ffi.mjs`: the WP8 FFI batching benchmark (`node bench/ffi.mjs`),
  not part of this suite.
- `substr.ts`: what proving a `substring` bound is worth (WP15 §8 `NL9009`),
  not part of this suite either. It times both shapes against each other inside
  one process and prints the two figures, so `nish bench/substr.ts --link x &&
  ./x` is the whole protocol: no baseline compiler and no second build.
- `hoist_field.ts`: what hoisting an array header out of a loop is worth
  (WP15 §2c candidate 2), not part of this suite either. Three scans do the same
  arithmetic over the same 8192 doubles and differ only in where the source
  array is *kept* — a parameter, a class field, and a class field read once into
  a `const` before the loop — timed against each other in alternating rounds
  inside one process, so there is no baseline compiler and no second build:

  ```bash
  npm run build
  build/nish bench/hoist_field.ts -o build/hoistir/ --link build/hoist --profile speed
  taskset -c 2 build/hoist
  ```

  `--link` alone would run it; `-o` keeps the module, which is where `opt -O2`
  shows the `umin` the file header tells you to look for.

  The field shape is `knownAtMost` in [self/bounds.ts](../self/bounds.ts) — the
  file header says why — so the distance between it and the other two is what
  candidate 2 of [docs/wp15-performance.md](../docs/wp15-performance.md) §2c has
  to recover.

  **The baseline, measured at `7f6e833`, before the hoist exists.** x86-64,
  four-core Intel Xeon at 2.10 GHz (a virtual machine), Ubuntu clang 18.1.3
  (LLVM 18), the box otherwise idle. Flags: `--profile speed` and nothing else —
  `f64` is spelled in the source, so there is no `--number-mode` to set. The
  statistic is the program's own minimum over its seven alternating rounds,
  taken again as the minimum over five runs of the binary, each pinned with
  `taskset -c 2`:

  | scan | where the array is kept | min | |
  | --- | --- | ---: | --- |
  | `param` | a parameter | 242 ms | one trip count, and it vectorises |
  | `field` | a class field | 576 ms | **2.38x behind**, and it does not |
  | `hoisted` | a class field, read into a `const` first | 240 ms | vectorises |

  §2c measured the same pair at 756 ms against 305 ms — **2.48x** — on a
  four-core box carrying several test suites at once, which is why it reported
  CPU time rather than wall time. This program has no CPU clock to read
  (`monotonicNanos` is elapsed time and the language has no `getrusage`), so it
  reports wall time and leans on the alternation instead: all three scans share
  every round, so a machine drifting under the run drifts under all three. On a
  busy box, pin it and read the ratio rather than the milliseconds.
- `rss.c`: the peak-RSS helper the runner compiles into `build/bench/rss`.
