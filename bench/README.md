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
node bench/run.mjs --no-rayon             # skip the Rayon twins of the parallel kernels
```

The report's header describes the **run**, not the checkout that happens to
hold it: the date, the machine, the toolchain versions, and the compiler's own
`--version` line and commit. The checked-in report therefore reads
`nish 0.0.0 (commit c72a68f)` — it was measured before the first release moved
`package.json` off `0.0.0`, and the commit it names is the working commit of
that run. The numbers are still the current compiler's: nothing in either
compiler (stage0 or the self-hosted one), `runtime/` or `bench/` has changed since that run, only the release
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

`strbuild` has one more version, `strbuild-naive.c`: the same immutable-string
algorithm with a `malloc` per string and a `free` as soon as a string has been
copied into its successor. Against `strbuild.c` (a bump arena that never
frees, i.e. the Nish runtime's model) it isolates what the arena costs and
saves. The Rust version allocates a fresh `String` per concatenation, the same
work as the naive C; the Go version does the same with `s + piece`, except that
a garbage collector, not `free` or an arena, reclaims the intermediates — so
`strbuild` is the one benchmark where the Go column is measuring a GC.

## Data parallelism

Six more programs measure `nish/threads`
([wp29](../docs/wp29-thread-surface.md) §4): five `parallelMapInto` against the
loop it replaces, and one scope whose tasks share a `Mutex`. Each is one Nish
binary that runs the loop when its first argument is `seq` and the parallel
form when it is `par`, and the two runs must print the same checksum. The
first table in `docs/BENCHMARKS.md` gives the loop's time, the parallel time on
every core the machine has, the ratio and the peak memory of both.

| Name | What it measures | Size (`bench:n`) |
| --- | --- | --- |
| `par-compute` | 64 dependent square roots per element, nothing shared and nothing allocated: the cores are the only limit | 2^21 elements |
| `par-alloc` | a string formatted and its bytes summed per element: the body allocates, the compiler says so (NL9012) and each element gives its bytes back | 2^22 elements |
| `par-nbody` | 1024 bodies under gravity, one map per step over 3n probes (one per body and axis), each summing over every other body | 1024 bodies, 16 steps |
| `par-short` | an eight-element map called 2^20 times, each call fed by the last: what calling a map costs when there is nothing to divide | 2^20 calls |
| `par-regions` | a 2^17-element map called 1,000 times, each call fed by the last: what one divided region costs | 1,000 calls |
| `par-histogram` | four tasks bin 50,000 values each into one `Mutex<Hist>`, taking the lock once per value: a lock fought over on every value. `seq` runs the four streams one after another, still locking | 16 rounds |
| `par-histogram-atomic` | the same four streams into an `AtomicI32` per bin, one `add` per value: the same contention on sixteen bins, no lock | 16 rounds |

```bash
node bench/run.mjs --only par            # all of them and their twins; `--only par-nbody` names one
node bench/run.mjs --validate --only par # both runs of each and every twin, checksums only
```

### Against Rust and Go

`par-compute`, `par-nbody`, `par-regions`, `par-histogram` and
`par-histogram-atomic` have twins, so
the second table in `docs/BENCHMARKS.md` compares the Nish `par` run with the
same program in Rust and in Go:

| File | Threads |
| --- | --- |
| `par-<kernel>.rs` | `std::thread::scope`, built by `rustc` with the flags of the main table |
| `par-<kernel>-rayon.rs` | Rayon's global pool (`par_iter_mut`, `rayon::scope` for the histogram), built by cargo as one package in `build/bench/rayon` with the same profile |
| `par-<kernel>.go` | goroutines and a `sync.WaitGroup`, built by `go build` |

Each twin does the same work at the same size (its `bench:n` line follows
`--n`) and must print the checksum the Nish `par` run prints, or the run fails.
The map twins cut the array into one contiguous chunk per thread and run the
first on the calling thread, as Nish's partitioner did before it cut up to
eight pieces per thread for the threads to claim as they finish; the Rayon
twins split as Rayon does. `par-regions`' scope twin starts
its threads on every call, because a scope cannot outlive it; the Rayon twin
and the Go twin are the ones with a pool to compare with Nish's workers. The
histogram takes a lock per value in every language (`Mutex`,
`std::sync::Mutex`, `sync.Mutex`), and `par-histogram-atomic` an atomic add per
value in every language (`AtomicI32.add`, `AtomicI32::fetch_add` with
`SeqCst`, `atomic.Int32.Add`), so a lock is never timed against an atomic.

**The same work is not the same checks or the same build**, and the table
says so. Nish keeps its default overflow and bounds checks
(`nish_panic_overflow` and `nish_panic_index` are reached from
`par-histogram`'s `binStream`); the Rust twins build as `--release` does,
bounds-checked and without overflow checks, and Go checks bounds only. Nish's
`--profile speed` links with LTO and neither Rust build does, a small edge to
Nish. In `par-nbody` a Nish probe reaches the bodies through class references
where the twins index an array of structs, which slightly favours Rust and Go.

**How it is timed.** Every binary divides over the same number of threads, the
count Nish's runtime picks here (the cores the process may use, lowered by a
cgroup quota): `bench/run.mjs` sets `NISH_NUM_THREADS`, `RAYON_NUM_THREADS`,
`GOMAXPROCS` and `PAR_THREADS` (which the scope twins read) to it, and the
table records it. The comparison runs whole `--twin-runs` times, three by
default, minutes apart. Each run is eleven interleaved rounds unless `--runs`
says otherwise, after `--warmup`: in each round every binary *and a
byte-identical copy of it* runs once, in an order that rotates by one each
round. In each run, separately for the minimum and the median, Nish is divided
by the fastest other column on that statistic, and the row's band is the
larger of Nish's gap to its copy and that column's gap to its copy. A ratio
reads as faster or slower only outside its band, and as at the band's edge
within half a percent of it. Ratios are printed to three decimals and judged
unrounded. The reading takes every run together: a kernel whose runs fall on
both sides of the band is "noisy, machine-dependent; no claim", and a loss past
1.10x says in how many runs it held. The table prints the spread of the ratios
over the runs and a second table prints every run, because this machine moves
between runs by more than the band inside one run shows. The section stamps
the date, the CPU, the cores, the threads, every compiler's version and the
commit: a run on a branch names the `main` commit the branch grew from,
because a squash merge does not keep the branch's own commits.

**Where Nish lost or loses**, and what has been measured of why. par-histogram is not tuned here:

- `par-regions` lost to Rayon by 1.9x to 2.2x until
  [#619](https://github.com/amritk/nish/issues/619), and the cause was the loop
  each chunk runs, not the pool: `mapRange` in `std/threads.ts` stored each
  element under `if (i < dst.length)`, and that conditional store kept LLVM's
  loop vectoriser off (no `pslld` or `psrad` in the binary, where Rust's
  vectorised `scramble` has both). Testing `dst`'s length in the loop condition
  as well lets LLVM drop the test after the call, and the loop vectorises when
  `f` inlines with no panic path. A body that keeps one does not vectorise,
  before or after #619: an overflow-checked `x + 7`, or a table lookup whose
  index is not proven, branches to its panic on every element. Timed in 11
  interleaved rounds after a warm-up, each binary beside a byte-identical
  copy, par-regions went from 588.9 / 624.0 to 183.3 / 190.6 ms (min /
  median) on one thread, 3.21x / 3.27x against a noise band of 3.3% / 1.5%,
  and from 168.8 / 218.6 to 58.0 / 73.7 ms on four, 2.91x / 2.97x against a
  band of 14.5% / 3.3%. In the table it is ahead of Rayon outside the band on
  the minimum in every run, and on the median in two runs of three, within the
  band in the third. `tests/run.js` pins the vector loop ("par_map_vector").
- `par-histogram`: a contended lock, and the most machine- and load-sensitive
  of the five; read its spread before its reading. What is measured: past 64
  spins `nish_mutex_wait` calls `sched_yield`, 640,000 to 850,000 times a run,
  and a run spends 0.6 to 0.8 s of system time against Go's 0.02 to 0.04 s.
  System time is not the whole story, though: Rust's futex lock spends about
  as much (0.46 s), and in those runs it came out about level with Nish, so
  parking on a futex is not shown to be the cure. Those figures are from an
  earlier session, in which Nish's `par` run took about 274 ms; in the table's
  latest runs it took 116 ms and Rust's 308 ms, with no change to either
  program, so par-histogram moves by 2x and more between sessions on this
  machine. Even the sign is not stable: the latest runs put Nish ahead of Go
  on every median, outside the band in two of the three, where earlier runs
  put it behind Go on every median.
- `par-histogram-atomic`: 1.59x to 1.95x behind Rust on the minimum and 1.81x
  to 1.96x on the median, past 1.10x in all three runs, and level with Go
  (101 / 129 ms against Rust's 61.3 / 69.2 and Go's 93.3 / 106). Swapping the
  lock for atomics takes Rust from 308 ms to 61 and Go from 194 to 93, but Nish
  only from 116 to 101. Why is not measured yet. The differences in the
  program are the checks above (an overflow check on `v * 75 + 74` and a
  bounds check on `j.bins[bin]` per value, neither of which Rust makes), and
  the bins: Nish's are an array of `AtomicI32` objects reached through the
  task's class, where Rust's and Go's are sixteen counters inline in one array:
  one more load per value in Nish, and a different layout in the cache.
- `par-nbody`: 1.11x to 1.17x behind Rayon, past 1.10x in all three runs,
  where on `main` at a1a5bf8a it was 0.96x to 1.06x. Part of that is
  [#731](https://github.com/amritk/nish/pull/731), which cuts a divided region
  into up to eight pieces per thread, claimed as threads finish: the same IR,
  linked against the runtime from just before #731 (20a4e65f) and from
  b1bf78f, timed in 3 runs of 41 interleaved rounds after a warm-up on four
  threads, each binary beside a byte-identical copy, went from 54.9–58.8 /
  63.2–65.3 ms to 63.5–63.7 / 67.6–68.9 (min / median): 1.08x to 1.16x slower
  on the minimum and 1.06x to 1.07x on the median, against a band of 1.1% to
  4.2% and 0% to 3.0%. [#743](https://github.com/amritk/nish/pull/743) does
  not touch it: a number map never calls `nish_cross_keep`, and its binary
  links byte-identical to #731's. Each step's map has 3,072 probes, so eight
  pieces a thread is 96 probes a piece, and the cost of each claim is the
  suspect; it is not measured which part of #731 costs it. The rest of the
  move, from 47.4 ms then to 63.1 ms in the table now, is the machine between
  sessions: the pre-#731 binary itself runs at 55 to 59 ms here.

A missing toolchain is a skipped column, never a failure: without `rustc` the
Rust columns go, without cargo or without crates.io the Rayon column goes, and
with neither `rustc` nor `go` the table is not measured and the report keeps
the one it has. Each says so on stderr.

`--only par` rewrites these two tables of `docs/BENCHMARKS.md` and nothing
else: every other section, the header and json-compare's marked section
included, stays byte for byte, and each table says the date, the CPU and the
commit it was measured at, since those may differ from the header's. A report
with no twins' table gets one under the data-parallel table. It writes only
when every parallel kernel ran and nothing else was timed. A subset
(`--only par-nbody`), a report with no data-parallel table, and the map half of
`--only maps,par` leave the file as it was, and the run says so; any run that
times the benchmark tables rewrites the whole report, as a full run does.

**They are not in the instruction-count gate.** It counts under valgrind,
which runs a program's threads one at a time, so a count would say nothing
about what these kernels exist to measure — how the work divides over the
cores — and the partitioner's thread start-up would add a scheduling-dependent
number to it.

## Map layouts

Four more programs are the WP32 layout prototypes
([docs/wp32-map.md](../docs/wp32-map.md) §2). Each is a monomorphic
`string → i32` and `i32 → i32` hash table written by hand in one candidate
layout. None of them uses `Map`, which did not exist when they were written, so
they compile on any compiler that builds this tree.

| Name | Layout |
| --- | --- |
| `map-proto-ordered` | insertion-ordered, a bucket per entry index: the shape `StringMap` (`src/map.ts`) had before WP32 S6 |
| `map-proto-ordered-fp` | insertion-ordered, an `i64` bucket holding the full hash above the entry index |
| `map-proto-ordered-fp32` | insertion-ordered, a `u32` bucket holding eight fingerprint bits above a 24-bit entry index, the layout WP32 chose |
| `map-proto-unordered` | unordered: hash, key and value in the bucket |

Each runs five workloads over string keys and then over integer keys: insert,
hit, miss, word count and delete churn. An LCG in the program drives them, with
no I/O. Each prints one checksum line per workload. The twin is not C:
`map-node.mjs` runs the same workloads on Node's global `Map`, and all five
must print the same ten lines. Given `time` as its first argument, each program
also prints every workload's elapsed nanoseconds to stderr. It measures around
the workload alone, so the table is not process wall time.

### The global `Map`, measured

Three more programs time the `Map` that shipped ([docs/wp32-map.md](../docs/wp32-map.md)
§10) on the same workloads, so every checksum line they print is one of the
ten `map-node.mjs` prints, and the unordered prototype's row is the same work.
Each runs two variants, and checks in the program that both reach the same
checksum:

| Name | Variants | Comparison | Node twin |
| --- | --- | --- | --- |
| `map-wordcount` | `fused`: `counts.set(w, (counts.get(w) ?? 0) + 1)`, one probe a word; `double`: a `get` into a `const`, then the `set`, which §9.1 leaves unfused, two probes a word | (b), on §2's `count` | `map-wordcount.mjs` |
| `map-presize` | `grow`, and `reserve`: `reserve(m, n)` from `nish/map` before the first insert | (c), on §2's `insert` | `map-presize.mjs`, where `reserve` is `nish/map`'s own body and does nothing |
| `map-vs-stringmap` | `map`: all ten workloads on `Map`; `stringmap`: `insert`, `hit`, `miss` and `count` on `StringMap`, which is `string -> i32` and has no `delete` | (d) | `map-node.mjs` |

`StringMap` is compiler-internal, so `map-vs-stringmap.ts` carries a copy of
it, lines 28 to 204 of `src/map.ts` between two marked rules, and the `bench`
check in `tests/run.js` fails when the copy is no longer a verbatim part of
`src/map.ts`. Given `time [variant]`, each program prints its workloads'
elapsed nanoseconds to stderr; naming a variant runs it alone. The runner times
every variant, and every twin, in a process of its own, because in one process
the second variant would run on the memory the first left, and under Node on a
warm JIT. `map-presize grow` and `map-presize reserve` are also each run once
for their peak RSS.

```bash
node bench/run.mjs                                  # everything; the map tables go to docs/BENCHMARKS.md
node bench/run.mjs --only maps                      # the seven map programs at 2^16 and 2^20; tables to stdout
node bench/run.mjs --only maps --n maps=1048576     # one size
node bench/run.mjs --validate --only maps           # checksums only, against Node's Map
```

The full run times the seven programs and their twins at two sizes, 2^16 keys,
inside the last-level cache, and 2^20, outside it, and writes comparisons (a)
to (d) to `docs/BENCHMARKS.md`, each cell `min / median`, with the cells whose
median is more than 5% above their minimum named under the tables. The columns
take turns round by round, so a slow stretch of a shared machine falls on all
of them. `--only maps` prints the same tables and writes nothing. `--n
maps=<n>` picks one size for all of them: `n` is the key count and must be a
power of two, because the workloads draw a key index by masking.
`tests/run.js` validates all seven at `n = 1024` in its `bench` check, and
holds the three measurements to no performance warning.

**They are in the instruction-count gate**, at `n = 16384`. They are
single-threaded, and they read the clock only when timing. `--instructions
--runs 3` counted each three times with a spread of 0. They are the only
hash-table code the gate holds, so a codegen regression in a probe loop, or in
`std/collections.ts`, moves their counts and no other program's.

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
- **A program adapted from elsewhere keeps its notice.** `nbody` and
  `spectral` are adapted from the Computer Language Benchmarks Game, so each of
  their four versions starts with the upstream program's name, contributors and
  copyright, and names [`LICENSE-benchmarksgame.md`](LICENSE-benchmarksgame.md);
  [`awfy/`](awfy/) carries its own licence. A new benchmark ported from
  somewhere follows [`.claude/licensing.md`](../.claude/licensing.md).
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
| Nish `--wrapping` | as above plus `--wrapping` (integer benchmarks only): signed arithmetic wraps with no overflow check, so the column against Nish is what the checks the compiler could not prove away cost |
| Nish (size profile) | `--profile size`, size table only |
| C `-O3` | `clang -O3 -s <src> -lm` |
| C `-O3` naive | `strbuild-naive.c` only |
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
[docs/wp9-optimisation.md](../docs/wp9-optimisation.md#are-we-fast-yet), and
[round 2](../docs/wp9-optimisation.md#are-we-fast-yet-round-2) re-measures
them after #217, with the reason a benchmark can move by 5 to 20% on one
virtual machine when neither its code nor its instruction count has: wall time
on this suite is sensitive to where the hot loop falls against 64-byte lines.
Read a timing change here against its instruction count first.

## Instruction counts

Wall time on a virtual machine moves by more than a codegen regression of a few
percent, so a regression can hide in the noise of the table above. What the
compiler emits is also caught by a number that does not move:
the instructions each program executes, counted by valgrind's cachegrind.
`bench/instructions.json` holds one count for each of the twenty-one programs: the
seven above, the four map layout prototypes, the three `Map` measurements and
the seven AWFY ports. `npm test`
fails when any of them runs more than 0.1% above its count.

```bash
node bench/run.mjs --instructions            # count all twenty-one and print them against the baseline
node bench/run.mjs --instructions --check    # ...and exit 1 when one is more than the tolerance above it
node bench/run.mjs --instructions --update   # rewrite the counts in bench/instructions.json
node bench/run.mjs --instructions --runs 3   # count each three times; the spread column should read 0
node bench/run.mjs --instructions --only Queens,fib   # a subset (`awfy` names the seven ports, `maps` the four prototypes)
```

Each program is built as the timing mode builds it: `--profile speed`, the
flags in its `.args`, bounds checks on, and the AWFY harness from
`bench/awfy/main.ts`. Each one then runs once under `valgrind --tool=cachegrind
--cache-sim=no`. The size is the `n` or `inner` beside the count in
`bench/instructions.json`. The AWFY ports run at the suite's own inner counts, and
the bench programs are sized to about 300 million instructions each. strbuild
is the exception and runs at its full `bench:n`. Mandelbrot has to run at 500,
because its `verifyResult` knows only 1, 500 and 750. The whole check takes about 16
seconds on a 2.8 GHz Xeon virtual machine, builds included.

**The whole process is counted.** That includes the dynamic loader and glibc's
start-up, about 120 thousand instructions of each count. Counting only `main`
would need either symbols, which a `--profile speed` binary does not keep, or
glibc's debug symbols to tell its code apart from the program's. CI's runner has
neither. So the start-up stays in the count, and whatever about it could vary
from one host to the next is pinned instead:

- **The environment.** The child's environment holds `GLIBC_TUNABLES` and
  nothing else. The loader scans every variable, and each one costs about 500
  instructions. This container's inherited 7.6 KB environment added 97,461 to
  fib, and a 64 KB variable adds 551.
- **argv[0].** The program runs as `./fib` from its own directory, so the
  checkout's path never reaches it. A 168-character absolute path added 151.
- **glibc's string routines.** glibc picks a `memcpy` and a `memset` for the
  CPU it finds, and switches strategy (`rep movsb`, non-temporal stores) at
  thresholds it derives from the cache sizes. Each choice executes a different
  number of instructions for the same copy. Left alone, strbuild counted
  72,136,198 here, 61,606,752 with a smaller non-temporal threshold, and
  50,457,172 with ERMS masked, a 30% spread for one binary. Storage moved 0.4%. The
  tunables in `PINNED_LIBC` (`bench/run.mjs`) send every x86-64 host to the SSE2
  baseline routines, with no `rep` string instructions and no non-temporal
  path. With those pinned, changing the cache sizes glibc sees moves strbuild
  by at most 3,315 instructions (0.006%) and Storage by at most 3,324
  (0.0008%).
  The program's own code is the same on every host already: `--profile speed`
  does not pass `-march`.

**Measured determinism, at `4fed2b7`.** Three counts of each program in one run,
and a second run of the whole set, agree to the instruction for thirteen of the
fourteen. Storage moves by up to 56 instructions, because the AWFY harness prints
its own elapsed time and the number of digits varies. Turning ASLR off
(`setarch -R`) changes nothing.

**The tolerance is 0.1%,** stored in the file as `tolerance`. The largest effect
measured above, after pinning, is strbuild's 0.006%, so 0.1% leaves a
sixteenfold margin for anything else that differs between runners, such as a
glibc patch release or a kernel's vDSO. A looser bound would have cost real
regressions: switching off the bounds prover in `src/bounds.ts` costs Queens
0.858% and changes no other benchmark by more than two instructions. A count below
its baseline by more than the tolerance does not fail. `--check` prints a note,
and the next `--update` makes the gain the new bar.

**The check checks itself.** `npm test` only ever sees `--check` pass, which
would not notice a comparison turned the wrong way round. So before it compares
anything, `--check` runs its own comparison on three made-up counts against a
baseline of 100 million: twice the tolerance above has to read `REGRESSED`,
twice below has to read as a gain, and the baseline itself has to read `ok`.
If one does not, it exits 2 and names the count it misread.

**Raising a baseline.** `--update` writes the counts it measured, the valgrind
version and the commit, and leaves the sizes and the tolerance alone. The
file-level `commit` and `valgrind` describe every count, so only an update of
all twenty-one restamps them. `--update --only Queens` stamps a `commit` and
`valgrind` on the Queens entry alone, and the next full update clears them. Those two
are edited by hand. A pull request that runs `--update` shows the table it
printed, the old count against the new one for every benchmark it moves, and
says in its body **why** each count went up: what the compiler now does that it
did not, and why that is worth the instructions. A count that goes up with no
reason given is a regression, whatever the timing table says. Resizing a program
changes its count as well, so a resize is its own update and says so.

**Where it runs.** `tests/run.js` runs `--instructions --check` with the compiler
under test. The counts are only meaningful on x86-64 Linux, and valgrind does not
run on macOS. So on any other host, or where valgrind is not on `PATH`, the check
is a counted skip that names the reason. CI's Linux job installs valgrind beside
LLVM, so the check runs there on every push.

## Crypto against other languages

[`crypto/`](crypto/README.md) holds the crypto twins: each family, such as
`crypto/hash/` (SHA-256, SHA-512, HMAC-SHA256, HKDF), is one program per
language over the same inputs. The languages are Nish, OpenSSL's libcrypto in
C, Go's standard library, RustCrypto and `node:crypto`, each with a portable
column where the library can switch its assembly off. `crypto/run.mjs` checks
that every program prints the family's pinned checksums and times them in
interleaved rounds beside a copy of the Nish binary, the noise band. It writes
the `crypto` block of docs/BENCHMARKS.md, which `bench/run.mjs` carries over
when it rewrites the file.

```bash
node bench/crypto/run.mjs --validate               # what CI runs: every checksum, and the portable proof
node bench/crypto/run.mjs --record                 # time every family; rewrite the crypto block
node bench/crypto/run.mjs --only hash --out x.md   # time one family into a file of its own
node bench/run.mjs --only crypto                   # --record, from this runner (no --no-rust or --no-go)
```

The two drivers below time Nish against itself only: they are baselines for
one kernel's own work packages, not comparisons with other languages.

## AES-GCM

`aes-gcm.ts` times the AEADs on the sizes a server seals and opens. AES-128-GCM
seal and open run on 16 KiB, a full TLS record, and on 1,200 bytes, a QUIC
packet. ChaCha20-Poly1305 runs on the same sizes, and `aesHeaderMask` on
16-byte samples. It is
[WP38 S5](../docs/wp38-simd.md#s5-aes-gcm-the-baseline)'s baseline, and the
measure the AES kernel is judged by. It is not in this suite's tables, and it
has no twins. `aes-gcm.mjs` builds it and drives it:

```bash
npm run build
node bench/aes-gcm.mjs --check                      # one short run; its checksum against the pinned one
node bench/aes-gcm.mjs --self --runs 15             # the baseline against a copy of itself: the noise band
node bench/aes-gcm.mjs --env NISH_AES=soft          # a column under an environment variable
node bench/aes-gcm.mjs --binary <other build>       # a column for another build of bench/aes-gcm.ts
```

The program times each workload alone, inside one process, so a figure leaves
out start-up, the key schedule and the sealing of the messages an open reads.
Every input changes on every iteration, and every answer goes into the
printed checksum. The driver runs all its columns in rotating rounds, each
going first equally often, and stops when two runs print different
checksums. It reports the minimum and median time of each workload, as MB/s
and cycles per byte. Cycles are derived: the time multiplied by the CPU's
nominal clock, taken from its model name or from `--ghz`, and not counted.
`--check` runs at a 64th of the size, and fails if the checksum differs from
the one pinned in the driver. Every build of `std/crypto/aes.ts`, kernel or
bitsliced, must keep printing that checksum.

## HTTP

`http1-server.ts` is a program built on `nish/net/http1-server` the way the
module's header says to build one: one `Http1Server` pool on plain TCP, one
readiness loop, one thread, nothing between the socket and the handler. It
answers `GET /plaintext` with 13 bytes and `GET /json` with
`{"message":"Hello, World!","n":<count>}` from a `JsonWriter` reset onto one
buffer per request. `POST /json-echo` takes the 545-byte order in
`http-payload.json`, decodes it with `jsonDecode` into one reused class, raises
its `revision` by one and encodes it back; `POST /json-echo-doc` gives the same
answer through one reused `JsonDocument`. It also answers the three routes of
the bun-http-framework-benchmark: `GET /` with `Hi`, `GET /id/:id?name=<name>`
with `<id> <name>` and an `x-powered-by: benchmark` header, and `POST /json`
with the posted object parsed and serialized again. Beside them it holds the
112-pattern table of `http-twins/extra-routes.mjs`, scanned after the measured
routes, so its route lookup is a small service's. `http.mjs` load-tests builds of it against each other with
[wrk](https://github.com/wg/wrk), with the server pinned to CPU 0 and wrk to
the other CPUs, so the server has one core to itself:

```bash
npm run build
build/nish bench/http1-server.ts --link build/bench/h1 --profile speed
cp build/bench/h1 build/bench/h1-copy
node bench/http.mjs build/bench/h1 build/bench/h1-copy      # the noise band: a build against its own copy
node bench/http.mjs build/bench/h1 build/bench/h1-other     # two builds, interleaved round by round
node bench/http.mjs --syscalls build/bench/h1               # system calls per request, under strace
node bench/http.mjs --only keep-alive --rounds 7 build/bench/h1
node bench/http.mjs --only startup build/bench/h1 build/bench/h1-copy   # spawn to first answer
```

Each scenario is one wrk run of five seconds after a one-second warm-up, and
each build gets a fresh server per round, on a pool of 16,384 slots
(`--slots`). The rounds alternate the order of the builds, and a scenario
reports the median of its rounds and their spread. It also reports the
server's user and system CPU per request, from `/proc/<pid>/stat` over the
timed run, and its peak RSS. `--syscalls` attaches `strace -c` to the running
server for two seconds of each scenario: a count, which does not drift with
the machine the way throughput does. The scenarios are keep-alive at 256 and
4,096 connections, `Connection: close` at 64 (every request a new TCP
connection), and the same churn while 8,000 idle connections hold the pool's
first slots, plus `post-json` and `post-json-doc` (keep-alive at 256, wrk
POSTing the payload through `http-post-json.lua`). The `ping`, `query` and
`body` scenarios come first, keep-alive at 500 connections as the
bun-http-framework-benchmark runs them; `body` POSTs `http-body.json` through
the same script, and the check before each scenario holds every server to the
exact bytes, and to the `x-powered-by` header on `query`.

`startup` is not a wrk scenario. Four times a round, for each build in the
round's order, it spawns the server pinned to CPU 0 and asks `GET /` every
millisecond until one answers; it reports the median time from spawn to that
first answer, the spread, and the RSS at that moment. It runs with the other
scenarios when `--only` is not given, and needs no wrk. On the commit that
added the scenario, a Nish server built its whole pool before it listened, so
its startup moved with `--slots`: 51.7 ms and 65.3 MB at 16,384 slots, 7.4 ms
and 5.8 MB at 1,024, against 9.6 ms and 7.4 MB for Go's `net/http`, which
allocates per connection. Now an `Http1Server` builds a slot's connection on
the first accept into it, the way Go does, and its start-up is the read
scratch and the slot bookkeeping. Five rounds, 20 starts a build, on a shared
four-vCPU VM, the base being `std/net/http1-server.ts` before that change:

| slots | base | base's copy | lazy slots | its copy |
| ---: | ---: | ---: | ---: | ---: |
| 16,384 | 36.2 ms, 65.3 MB | 36.2 ms, 65.3 MB | 4.7 ms, 2.6 MB | 4.6 ms, 2.6 MB |
| 1,024 | 6.2 ms, 5.8 MB | | 5.3 ms, 1.8 MB | 5.0 ms, 1.8 MB |

Under load, the peak RSS at 500 keep-alive connections fell from 65 MB to
4 MB on `ping` and `query` and from 67 MB to 7 MB on `body`: the slots the
connections never reached are never built. Throughput did not move outside the
noise band. Over seven rounds, the two byte-identical copies differed by up to
37% in a scenario, and the lazy build's medians fell inside that band.

**Measured on the commit that adds this section.** x86-64, four-core Intel
Xeon at 2.10 GHz (a virtual machine), Ubuntu clang 18.1.3, wrk 4.1.0, `-t3`.
The base is `std/net/http1-server.ts` before that commit; the copy is the base
binary, byte for byte, and its row is the noise band. Five rounds:

| scenario | base req/s | copy (noise) | this commit | user µs/req | sys µs/req |
| --- | ---: | ---: | ---: | ---: | ---: |
| keep-alive, c=256, `/plaintext` | 153,329 | −2.7% | 175,303 (**+14.3%**) | 1.17 → 1.16 | 5.18 → 4.44 |
| keep-alive, c=256, `/json` | 153,822 | +3.3% | 169,507 (**+10.2%**) | 1.35 → 1.21 | 5.25 → 4.40 |
| keep-alive, c=4096 | 86,269 | +0.4% | 93,088 (+7.9%) | 2.07 → 2.11 | 9.01 → 8.25 |
| close, c=64 | 63,710 | +3.9% | 66,967 (+5.1%) | 1.97 → 1.76 | 13.02 → 12.84 |
| close, c=64, 8,000 idle | 51,003 | +0.2% | 64,763 (**+27.0%**) | 7.23 → 1.82 | 11.88 → 13.18 |

The kernel is four fifths of what a request costs, so the change is fewer
system calls (`--syscalls`, the same run):

| scenario | base | this commit |
| --- | --- | --- |
| keep-alive | 4.10 a request: `recvfrom` 2, `epoll_ctl` 1, `sendto` 1 | 2.06: `recvfrom` 1, `sendto` 1 |
| close | 6.10: `recvfrom` 2, `accept4`, `epoll_ctl`, `sendto`, `close` | 5.10: `recvfrom` 1 and the rest |

The second `recvfrom` was `readable` reading until the socket answered -11;
it now stops at a short read, since level-triggered readiness wakes the loop
again for more input or the peer's close. The `epoll_ctl` was the program's
`pollModify` after every event; `rearm` answers whether the interest changed,
and on a keep-alive connection it does not. The idle row is `accept`, which
scanned the slots for a free one, walking past every busy slot on every
connection; it now pops a stack of free slots.

Two experiments that did not move the figures, so are not in the commit:
`TCP_NODELAY` on the listener (inherited by every accepted socket): each
response here is one `send`, so Nagle never holds anything back, and every
row stayed inside the noise band. A profile-guided build
(`scripts/build.sh --pgo-generate` / `--pgo-use`, trained on the same
scenarios) cut user time per request by 10 to 24% in every row, but user time
is a fifth of the whole: +4% on keep-alive, inside the band.

**Memory is what sets the connection count**, not the CPU. Until the output
pool, each slot allocated its `outputSize` at start-up, 64 KiB by default, so
a pool's resident size was about 72 KiB a slot. The servers measured beside
it hold no fixed output buffer per connection: Go's `net/http` borrows a
4 KiB reader and a 4 KiB writer per connection from `sync.Pool`s
(`net/http/server.go`), hyper starts an 8 KiB read buffer and queues the
response's own bytes, uWebSockets (under Bun) shares one 16 KiB output buffer
per event loop and gives a socket its own only under back-pressure, and
nginx starts with a 1 KiB header buffer. Now a pool's slots borrow their
output from one `Http1OutputPool` while they write and give it back once the
socket has taken everything, so the output memory follows the connections
the socket is holding back. Resident size after start-up, default
`Http1Config`:

| slots | each slot's own output | borrowed from the pool |
| ---: | ---: | ---: |
| 1,024 | 75 MB | 5.5 MB |
| 16,384 | 1,178 MB | 64 MB |
| 65,536 | 4,708 MB | 251 MB |

Under load, with 9,000 slots, peak RSS went from 633 MB to 35 MB in every
scenario. Throughput is unchanged at 256 connections (−0.5% and +1.8% over
seven rounds, against +2.2% and −3.7% for a byte-identical copy) and up
12.7% at 4,096 (copy +2.6%), where the slots no longer touch 4,096 cold
buffers. `net_http1_server` runs its whole plain section on one buffer.

**Against other servers.** [`http-twins/`](http-twins/README.md) holds ten
servers that answer what this one answers, byte for byte, on other runtimes:
`node:http`, uWebSockets.js, `Bun.serve`, Elysia and Hono on Bun, Go's
`net/http` and fasthttp, hyper, actix-web, and nginx answering from `return`.
Each runs on one core, as this server does. `bash bench/http-twins/run.sh`
builds `http1-server.ts` twice, as `nish` and a byte-identical `nish-copy`,
then runs `check.mjs` and times all twelve servers interleaved under
`http.mjs`. The copy's distance from `nish` is
the noise band, and every other difference is read against it.

The table below predates the Elysia and Hono twins and the `ping`, `query`,
`body` and `startup` scenarios. Measured on 2026-10-17 at `aa75cec`. The machine is a shared cloud VM (KVM),
with four vCPUs of an Intel Xeon @ 2.80 GHz at one thread per core, Linux
6.18.44, Ubuntu clang 18.1.3 and wrk 4.1.0 (Ubuntu's `4.1.0-4build2`). The
server runs on CPU 0 and wrk on CPUs 1–3 with `-t3`. The run was
`run.sh --rounds 5 --duration 5`: five rounds, each a one-second warm-up and a
five-second timed run, a fresh server per round, 16,384 slots. The versions:

| server | versions |
| --- | --- |
| `nish`, `nish-copy` | nish 0.18.0 (`build/nish` at `aa75cec`), `--profile speed`, 134,512 bytes |
| `node-http` | Node 26.12.0 |
| `uws` | uWebSockets.js v20.71.0 (`9ec36de7`), Node 26.12.0 |
| `bun` | Bun 1.4.3 |
| `go-nethttp` | Go 1.27.2, `GOMAXPROCS=1` |
| `go-fasthttp` | Go 1.27.2, fasthttp v1.75.0, `GOMAXPROCS=1` |
| `rust-hyper` | Rust 1.99.1, hyper 1.12.0, hyper-util 0.1.21, tokio 1.53.3, serde_json 1.0.154 |
| `rust-actix` | Rust 1.99.1, actix-web 4.17.0, serde_json 1.0.154 |
| `nginx` | nginx 1.30.6, `worker_processes 1`, `master_process off` |

Each cell is the median req/s, with the five rounds' min–max beneath it. The
last column is the noise band, `nish-copy`'s median against `nish`'s:

| scenario | nish | nish-copy | node-http | uws | bun | go-nethttp | go-fasthttp | rust-hyper | rust-actix | nginx | band |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| plaintext keep-alive c=256 | 112,078<br>105,705–131,314 | 118,246<br>56,686–132,872 | 21,919<br>20,608–23,718 | 97,945<br>92,922–107,106 | 56,614<br>50,558–65,313 | 27,003<br>25,948–29,333 | 58,683<br>57,284–61,311 | 66,305<br>62,796–73,910 | 64,754<br>64,112–70,603 | 65,997<br>62,134–67,095 | +5.5% |
| json keep-alive c=256 | 118,907<br>110,330–123,977 | 116,483<br>107,903–138,722 | 22,788<br>19,633–23,745 | 97,946<br>68,642–104,229 | 56,535<br>54,253–64,274 | 25,381<br>25,014–26,717 | 49,569<br>45,211–57,689 | 68,586<br>59,691–69,231 | 66,363<br>61,008–69,475 | 65,451<br>63,830–67,832 | −2.0% |
| post-json keep-alive c=256 | 38,888<br>33,874–45,603 | 37,888<br>33,579–41,356 | 12,585<br>12,373–13,953 | 24,813<br>23,323–27,029 | 25,101<br>23,901–25,832 | 15,978<br>15,122–16,708 | 22,467<br>21,088–23,862 | 36,522<br>31,404–39,801 | 31,836<br>30,757–41,411 | n/a¹ | −2.6% |
| post-json-doc keep-alive c=256 | 37,645<br>31,359–42,837 | 35,043<br>34,374–41,057 | n/a² | n/a² | n/a² | n/a² | n/a² | n/a² | n/a² | n/a² | −6.9% |
| plaintext keep-alive c=4096 | 69,743<br>55,592–74,015 | 68,545<br>44,565–78,226 | 18,395<br>17,778–20,838³ | 67,799<br>55,544–69,557 | 46,896<br>42,485–69,437 | 22,929<br>21,927–26,335 | 48,807<br>46,889–50,412 | 58,351<br>52,269–58,909 | 60,417<br>46,076–61,889 | 59,970<br>54,861–63,156³ | −1.7% |
| plaintext close c=64 | 47,813<br>46,052–50,230 | 44,595<br>43,104–47,525 | 10,532<br>8,404–11,134 | 39,701<br>35,178–40,819⁴ | 31,091<br>29,301–32,155⁴ | 18,198<br>16,310–18,806 | 31,122<br>28,587–32,254 | 34,702<br>34,343–39,217 | 19,493<br>16,664–21,374 | 33,323<br>29,049–33,877 | −6.7% |
| plaintext close c=64 + 8000 idle | 47,981<br>42,154–49,365 | 46,480<br>42,932–47,336 | 9,874<br>8,907–11,067 | 38,016<br>33,941–41,022⁴ | 30,270<br>28,806–31,401⁴ | 17,174<br>15,641–18,962 | 29,755<br>28,953–31,281 | 35,021<br>30,351–38,460 | 20,160<br>18,120–21,653 | 30,670<br>29,176–33,819 | −3.1% |
| peak RSS, keep-alive c=256 | 65 MB | 65 MB | 90 MB | 56 MB | 33 MB | 17 MB | 12 MB | 6 MB | 7 MB | 10 MB | |
| peak RSS, + 8000 idle | 65 MB | 65 MB | 233 MB | 59 MB | 45 MB | 158 MB | 115 MB | 84 MB | 81 MB | 14 MB | |

1. nginx answers `/json-echo` with 404: `return` cannot read a request body,
   so nginx has no echo, and the pre-check marks the cell n/a.
2. Only the Nish server has `/json-echo-doc`. Every twin answers it with 404,
   which the pre-check marks n/a.
3. wrk timeouts in every round: node-http 27 to 70 a round, nginx 12 to 55.
4. wrk read socket errors in every round, on top of the requests counted. uws
   had 176,251 to 204,437 a round on `close`, and 173,087 to 209,232 with the
   idle connections. bun had 149,421 to 160,985, and 146,913 to 160,149. No
   other server had any in these rows. The twins are as `http-twins/` builds
   them; this run does not explain the errors.

**Reading it against the band.** The band runs from 1.7% to 6.9% across the
rows. A single bad round can be wider still: one of the copy's plaintext
rounds ran at 56,686. Most rows are clear of it. In the GET rows at c=256,
`nish`'s median is above every twin's by more than the band: by 12.6% and
17.6% over uws (bands 5.5% and 2.0%), and by 40.8% to 80.8% over the rest. At
c=4096 it is above every twin but uws by at least 13.4%, against a band of
1.7%. Two rows are close:

- **uws at c=4096** is 2.8% lower, against a band of 1.7%. Its spread
  (55,544–69,557) sits inside `nish`'s (55,592–74,015) and the copy's
  (44,565–78,226), so this run cannot call them different.
- **hyper on post-json** is 6.1% lower, against a band of 2.6%. That is
  outside the band, but the two spreads overlap (31,404–39,801 and
  33,874–45,603), so the lead is narrow.

The other twins trail by 18.1% (actix) to 67.6% (node-http) on post-json.
With `Connection: close`, `nish` is above the next twin, uws, by 17.0% and
20.8% (bands 6.7% and 3.1%). In those rows uws and bun also took the read
errors of note 4.

`nish`'s 65 MB was the 16,384-slot pool it built at start-up when this table
was measured (the table above gives 64 MB). It did not grow with the 8,000 idle
connections. A pool now builds a slot's connection on the first accept into
it, so the pool's share follows the connections it has held (see `startup`
above). Every twin's
peak grows with them, except nginx, which stays at 14 MB.

**What was measured, header by header.** Every server sends a `Date` field:
`curl -si /plaintext` showed one on all ten. The Nish server's comes from
#675. The earlier table here predated it and said this server sent none, which
is no longer true. Beyond that, the servers differ in what they add:

- `Server: nish`, `Server: fasthttp` and `Server: nginx`, and uws's
  `uWebSockets: 20`.
- node-http's `Connection: keep-alive` and `Keep-Alive: timeout=5`, and
  nginx's `Connection: keep-alive`.
- node-http answers `/plaintext` with `Transfer-Encoding: chunked`. Every
  other server sends `Content-Length`.

nginx's `/json` `n` is `$connection_requests`, which counts per connection,
not per process.

**The idle connections stayed open.** Each server held 8,000 idle connections
for 10 s, with no requests on them. A round holds them about 6.2 s (0.2 s to
settle, the 1 s warm-up and the 5 s run). Eight servers kept all 8,000 for the
full 10 s, rust-actix among them: it sets `keep_alive(KeepAlive::Os)` and a
zero `client_request_timeout`. bun kept all 8,000 at 6.5 s, 8 s and 9.5 s, but
only 755 at 10 s, when its default `idleTimeout` of 10 s closed the rest.
Every timed round therefore ran with all 8,000 open on every server.

**On `nish/net/router`.** `http1-server.ts` used to compare each request's
target against its routes by hand. It now registers them on one
`nish/net/router` `Router`, with the 342-route table of
[`http-twins/`](http-twins/README.md#the-route-table), and switches on the
index `match` returns. `old` is the hand-dispatching server at `main` before
the change (142,960 bytes), and `nish` and `nish-copy` are two builds of the
router server (158,192 bytes), byte-identical to a build of this file at
`189685eb`. All are `--profile speed`, timed in the same interleaved rounds
with `http.mjs --rounds 10 --duration 5` on 2026-10-20. The machine was the
same kind of shared four-vCPU KVM VM, this time an Intel Xeon @ 2.10 GHz. The
band is `nish-copy`'s median against `nish`'s:

| scenario | old | nish | nish-copy | band |
| --- | ---: | ---: | ---: | ---: |
| plaintext keep-alive c=256 | 152,503<br>129,487–160,160 | 138,960<br>125,688–163,109 | 151,752<br>142,624–160,480 | +9.2% |
| json keep-alive c=256 | 151,313<br>112,094–161,204 | 151,972<br>127,956–169,453 | 139,871<br>127,577–150,452 | −8.0% |
| post-json keep-alive c=256 | 50,527<br>41,938–55,854 | 49,527<br>45,653–55,062 | 50,051<br>46,853–56,613 | +1.1% |
| deep-route keep-alive c=256 | n/a | 140,405<br>110,905–157,388 | 128,958<br>93,781–152,177 | −8.2% |

`nish` against `old` is −8.9% on plaintext and +0.4% on json, both inside
those rows' bands of 9.2% and 8.0%: this run finds neither faster nor slower.
On post-json it is −2.0%, outside that row's 1.1% band: by this run's own
measure, the router server is 2.0% slower than the hand-dispatching one on
post-json. The CPU columns lean the same way: user time per request is 1.52 µs
against `old`'s 1.35 on plaintext and 9.86 against 9.50 on post-json, though
`nish-copy`'s 1.49 and 9.82 show how far a byte-identical build moves. A
five-round run at `c1507260` gave −2.9%, −5.7% and +4.7% on the same three
rows, so the sign of a delta this size changes from run to run. The deep
route, eight segments and three parameters deep in the table, runs at 140,405:
101% of `nish`'s plaintext rate in the same rounds, with its answer built from
the three parameters. `old` has no such route, so its cell is n/a.

**On every core.** With `BENCH_CORES=N` above 1, `http1-server.ts` runs as N
workers under [`nish/net/prefork`](../std/net/prefork.ts), each with its own
`SO_REUSEPORT` listener and pool, and `http.mjs --cores` sets it. Worker 0
prints `listening` only once every worker has bound: the workers check in
over a UDP port, because wrk opens its connections once, at that line, and a
connection opened before a worker bound would stay on the others for the whole
run. `requests` (the `/json` `n`) counts per worker. Without `BENCH_CORES`,
or at 1, it is the one-process server above. A worker restarted after a crash
waits up to 5 s for a check-in nobody answers before it serves; the bench does
not crash it.

```bash
node bench/http.mjs --cores 1,2,4 --rounds 5 --duration 3 \
  --only "plaintext keep-alive c=256,post-json keep-alive,plaintext close c=64" \
  nish=build/bench/h1 nish-copy=build/bench/h1-copy
```

`nish` and `nish-copy` are byte-identical `--profile speed` builds (175,344
bytes), timed in the same interleaved rounds on 2026-10-22, on a shared
four-vCPU KVM VM (Intel Xeon @ 2.80 GHz, Linux 6.18, wrk 4.1.0). At N cores
the server has CPUs 0 to N−1 and wrk the rest, with as many threads; at 4
cores wrk has none of its own and shares the server's. Each cell is `nish`'s
median, its spread under it, and the band is `nish-copy`'s median against it:

| scenario | 1 core | 2 cores | 4 cores, client shares | band (1 / 2 / 4) |
| --- | ---: | ---: | ---: | ---: |
| plaintext keep-alive c=256 | 103,768<br>56,901–108,755 | 224,012<br>180,794–246,398 | 196,398<br>183,526–210,002 | +3.4% / −8.4% / −4.2% |
| post-json keep-alive c=256 | 30,584<br>28,919–34,032 | 82,443<br>76,709–93,989 | 112,420<br>110,874–119,031 | +9.4% / +5.0% / −1.6% |
| plaintext close c=64 | 39,361<br>38,041–45,491 | 31,514<br>28,290–33,238 | 42,201<br>39,155–46,854 | +2.0% / −2.4% / −1.9% |
| plaintext close c=64 + 8000 idle | 43,734<br>39,238–46,940 | 30,514<br>27,356–33,548 | 42,309<br>37,554–42,974 | −3.1% / −1.8% / −2.2% |

The same runs' system CPU per request and peak RSS (summed over the workers),
for `nish`, at 1 / 2 / 4 cores:

| scenario | sys µs/req | peak RSS MB |
| --- | ---: | ---: |
| plaintext keep-alive c=256 | 7.42 / 6.17 / 7.43 | 4 / 8 / 13 |
| post-json keep-alive c=256 | 18.34 / 11.51 / 10.25 | 5 / 9 / 14 |
| plaintext close c=64 | 20.42 / 27.60 / 30.45 | 3 / 7 / 13 |
| plaintext close c=64 + 8000 idle | 18.59 / 28.36 / 30.87 | 33 / 38 / 44 |

Keep-alive scales with the server's cores while wrk keeps cores of its own:
2.2× on plaintext and 2.7× on post-json at 2 cores, well outside the bands. At
4 cores plaintext falls back to 196,398, because wrk's four threads now take
CPU from the four workers; post-json, which spends more of each request in the
server, still rises to 3.7× one core. The `Connection: close` rows do not
scale on this machine: every request is a new TCP connection, and the
handshake costs the client and the kernel as much as the server, so at 2
cores, with wrk down from three CPUs to two, the rate falls by a fifth, and at
4 cores it is back at the 1-core figure. System time per request rises with
the cores on those rows (20.4 µs to 30.5 µs), the kernel's share of the
accept path. Peak RSS is the sum over the workers: 4 MB at 1 core, 8 MB at 2,
13 MB at 4 on plaintext.

## P-256

`p256.ts` times ECDSA over P-256 on the three calls a key's life makes:
`p256PublicKey` on a new private key, `p256SignSha256` on a 64-byte message,
which is what a TLS 1.3 server's CertificateVerify costs, and
`p256VerifySha256`. It is
[WP34 K5](../docs/wp34-hosting-cs.md#k5-p-256-the-baseline)'s baseline, and the
measure a fixed-base table is judged by. It is not in this suite's tables, and
it has no twins. `p256.mjs` builds it and drives it:

```bash
npm run build
node bench/p256.mjs --check                         # one short run; its checksum against the pinned one
node bench/p256.mjs --self --runs 16                # the baseline against a copy of itself: the noise band
node bench/p256.mjs --binary <other build>          # a column for another build of bench/p256.ts
```

The driver gives each workload a process of its own, and the program times
the workload's loop alone, so a figure leaves out start-up and the signatures
a verify reads, which are made before its clock starts. Public-key and sign get
a new private key or message on every iteration; verify cycles through a ring
of sixteen signed messages, so consecutive calls differ and each comes round
again every sixteen. Every answer goes into the printed checksum, verify's
included, and before its clock verify must refuse each of the sixteen
signatures once tampered with, so a verify that accepted everything would not
print the pinned checksum. The columns run in rotating rounds, each going first
equally often, and the driver stops when two runs of a workload print
different checksums. It reports each workload's minimum and median time a
call, in microseconds and calls a second. `--check` runs all three at a 16th of
the count, in one process, and fails if the checksum differs from the one
pinned in the driver. Every build of `std/crypto/p256.ts`, window or table,
must keep printing it.

## TLS handshake

`tls-handshake.mjs` times what one TLS 1.3 handshake costs the server, in CPU:
`tests/link/net_interop_server` run as `serve`, its own P-256 certificate,
answering new connections on its h2 port. It is
[WP34 K5](../docs/wp34-hosting-cs.md#k5-p-256-the-inversion--the-baseline)'s
measure for the scalar inversion, where `bench/p256.mjs` times the signature on
its own; [the result](../docs/wp34-hosting-cs.md#k5-p-256-the-inversion--the-result)
reads both against the bar. It is not in this suite's tables. It needs `curl` with HTTP/2 and
`taskset`.

```bash
npm run build
node bench/tls-handshake.mjs --check                # three handshakes: TLS 1.3, X25519 and h2, and CPU read
node bench/tls-handshake.mjs --runs 16              # this checkout's server against a copy of itself
node bench/tls-handshake.mjs --baseline main        # also the server built from another rev, and its copy
node bench/tls-handshake.mjs --json out.json        # every round's figures, for a script
```

The targets are the server built by this checkout, a byte-identical copy of
it, and with `--baseline REV` the server built from REV in a worktree under
`build/` by that tree's own `build/nish`, and a copy of that. A target is named
by its commit's short hash, with `+dirty` when the checkout has uncommitted
changes, and a `--baseline` that names a target already measured is refused,
since rounds are pooled by name. Each round starts
every target fresh, in an order rotated by one each round, pinned to CPU 0.
After five warm-up handshakes it makes `--handshakes` new connections (600 by
default), each one `curl --http2 --tlsv1.3 -k` process pinned to CPUs 1–3, so
every handshake is a full one and none is resumed. Each must return the
17-byte file over HTTP/2. The figure is the server's utime + stime over those
connections, read from `/proc/<pid>/stat`, a handshake's share of it: the
handshake, one request and its response. curl's own connect-to-handshake time
is reported beside it but is mostly the client's.

The report gives each target's minimum and median over the rounds, user and
system CPU apart, and each copy against its own build: whatever separates a
server from its copy is the machine, and a difference between builds reads as
one only outside that band. It also prints the fewest clock ticks
in any round (10 ms each) so their resolution can be read, and the handshake every server
negotiated, which must be the same for all of them or the run stops.

## Pool memory

The interop server (`tests/link/net_interop_server`, the runner's endpoint)
serves a connection pool per carrier: QUIC for HTTP/3, HTTP/2, HTTPS/1.1 and
plain HTTP/1.1, each `--slots` connections deep (1 to 4096, 64 by default; the
two HTTP/1.1 pools stop at 500, where `H1Loop`'s event tokens run out). Before
it listens a pool sizes its tables from `--slots`, and a slot's connection is
built on the first connection accepted into it, slots 0 up, with the
interop server's `WebTransport` bound beside an HTTP/3 slot when that slot
is first served as `h3`. Two scripts measure what that costs and what it serves:

```bash
build/nish tests/link/net_interop_server/main.ts -o build/interop.ir/ --link build/interop
node bench/pool-rss.mjs --bin build/interop --slots 16,64,256,1024    # memory and time to listen
node bench/pool-rss.mjs --bin build/interop --slots 64,256 --per-pool # what one slot of each pool costs
node bench/h2load.mjs --bin build/interop                             # throughput against itself: the noise band
node bench/h2load.mjs --bin build/interop-a --against build/interop-b
```

`pool-rss.mjs` times each server from exec until all four ports answer (a TCP
connect to each TCP port, and a QUIC packet of a reserved version, which only
the running loop answers with Version Negotiation), then reads `VmRSS` and
`VmHWM` and kills it. A server that does not answer within `--timeout`
seconds is reported as a timeout, and one past `--cap` MB resident (three
quarters of the memory free when the run starts, by default) as out of memory, so a count too
large for the machine ends its row rather than the container; a server the
kernel kills first is reported as a possible OOM kill. `--per-pool`
sizes one pool at a time with `--only`, the others at one slot, and divides
its growth over the all-one-slot server by the slots added.

`h2load.mjs` runs each build as its own server pinned to CPU 0, and h2load
(nghttp2 1.59.0, Ubuntu's `nghttp2-client`) on the other CPUs: HTTPS/1.1 with
`--h1` and HTTP/2 with eight streams a connection, 16 connections and 20,000
requests a run. That h2load is built without ngtcp2 and nghttp3 and cannot
speak HTTP/3, which the script reports on stderr; HTTP/3 is instead `main
h3-load`, the server and `client.ts`'s scripted QUIC client in one process on
CPU 0, one connection with 2,000 requests one after another. Its figure is the
server's and the client's work together: it compares builds, and is not
comparable to h2load's rows. Rounds alternate which build goes first; each row
gives the median requests a second and the median per-round ratio b / a with
its spread. `--rounds` is 5 by default and may not go below 3, and
`--clients` not below h2load's thread count.

Both scripts need Linux (`/proc` for the memory, `taskset` for the pinning)
and are run from the repository root, where the `www` directory and the
default `build/interop` path resolve.

### Baseline

Measured with `build/interop` built from this branch on top of `main` at
`249cbe9`, on 4 CPUs and 16 GB with no swap, 3 runs a count. Each figure is
the median, with the runs' spread (min–max) as its noise band.

| slots | VmRSS MB | VmHWM MB | listening ms | load generator |
| ---: | ---: | ---: | ---: | --- |
| 16 | 204.2 (204.2–204.2) | 204.2 (204.2–204.2) | 172 (158–174) | `pool-rss.mjs` |
| 64 | 808.6 (808.6–808.6) | 808.6 (808.6–808.6) | 607 (576–629) | `pool-rss.mjs` |
| 256 | 3,226.5 (3,226.5–3,226.5) | 3,226.5 (3,226.5–3,226.5) | 4,595 (3,666–13,185) | `pool-rss.mjs` |
| 1024 | timeout at 30 s, 6,701 MB resident; with `--timeout 120`, out of memory past the 11,590 MB cap | | | `pool-rss.mjs` |

256 slots fit; 1024 do not on this machine. At 12,460 kB a slot, the QUIC
pool alone wants about 12,460 MB, more than three quarters of 16 GB, and the
cap stops it there instead of the kernel's OOM killer. The 256-slot start's
wide time spread is one run of the three, which took 13 s.

Per pool, `--per-pool` at 64 and 256 slots against the all-one-slot server
(15.1 MB, 15.1–15.1; listening in 22 ms, 20–32):

| pool | VmRSS MB at 64 | VmRSS MB at 256 | per slot | listening ms at 256 |
| --- | ---: | ---: | ---: | ---: |
| QUIC (HTTP/3) | 781.8 (781.7–781.8) | 3,118.0 (3,118.0–3,118.0) | 12,460 kB | 2,241 (2,190–3,005) |
| HTTP/2 | 32.3 (32.3–32.3) | 84.4 (84.4–84.4) | 278 kB | 74 (72–114) |
| HTTPS/1.1 | 25.2 (25.2–25.2) | 54.9 (54.9–54.9) | 160 kB | 56 (55–59) |
| HTTP/1.1 | 15.4 (15.4–15.4) | 16.1 (16.1–16.1) | 4 kB | 19 (19–19) |

The QUIC pool is 97% of the 64-slot server's memory. The per-slot figures
agree between 64 and 256 to within 3%, HTTPS/1.1 the widest (164 kB a slot
at 64, 160 kB at 256), and the runs' RSS spread is under
0.1 MB, so their noise is below the precision shown.

Throughput, `h2load.mjs` with the build against itself at 64 slots, 5 rounds.
The b / a spread is the noise band for a comparison between two builds:

| scenario | load generator | a req/s | b req/s | b / a (min–max) |
| --- | --- | ---: | ---: | ---: |
| HTTPS/1.1, c=16 | h2load `--h1` | 47,354 | 45,476 | 0.960 (0.916–1.085) |
| HTTP/2, c=16, m=8 | h2load | 74,411 | 76,258 | 1.025 (0.797–1.182) |
| HTTP/3, one connection, 2,000 requests | `main h3-load` (in process) | 13,245 | 13,423 | 1.034 (0.886–1.081) |

A difference between two builds counts only outside that band: about ±10% for
HTTPS/1.1 and HTTP/3 and ±20% for HTTP/2 on this machine. HTTP/3 runs 2,000
requests rather than 20,000 because its rate falls as the one connection's
streams pile up (about 1,900 requests a second over 20,000), and a longer run
would measure that build-up rather than a request.

### Lazy slots

Start-up memory once every pool builds a slot on its first accept:
`pool-rss.mjs --per-pool --runs 1`, 3 rounds a count, each round running base
(`c8a00d6`), `main` at `c21e4a7` with the interop server's lazy `WebTransport`
binding, and a byte-identical copy of that build, in an order
that rotates each round. The machine has 4 CPUs and 16 GB with no swap. Each
figure is the median VmRSS in MB; the plain and TLS HTTP/1.1 pools stop at
500 slots (`TLS_SLOTS`), so their 1024 row is 500.

| pool | slots | base | main | copy |
| --- | ---: | ---: | ---: | ---: |
| all | 16 | 10.1 | 5.9 | 5.9 |
| all | 64 | 28.0 | 10.6 | 10.6 |
| all | 256 | 99.8 | 29.4 | 29.4 |
| all | 1024 | 358.7 | 104.3 | 104.3 |
| QUIC (HTTP/3) | 16 | 8.2 | 5.8 | 5.8 |
| QUIC (HTTP/3) | 64 | 20.1 | 10.2 | 10.2 |
| QUIC (HTTP/3) | 256 | 67.8 | 27.5 | 27.5 |
| QUIC (HTTP/3) | 1024 | 258.3 | 97.0 | 97.0 |
| HTTP/2 | 16 | 5.6 | 4.6 | 4.6 |
| HTTP/2 | 64 | 9.0 | 4.9 | 4.9 |
| HTTP/2 | 256 | 22.9 | 6.3 | 6.3 |
| HTTP/2 | 1024 | 78.3 | 11.7 | 11.7 |
| HTTPS/1.1 | 16 | 5.4 | 4.5 | 4.5 |
| HTTPS/1.1 | 64 | 7.9 | 4.5 | 4.5 |
| HTTPS/1.1 | 256 | 18.1 | 4.5 | 4.5 |
| HTTPS/1.1 | 1024 (500) | 31.2 | 4.6 | 4.6 |
| HTTP/1.1 | 16 to 1024 (500) | 4.5 | 4.5 | 4.5 |

The all-one-slot server is 4.5 MB in all three builds. Every count fits on
this machine at base too, so none is dropped: base `c8a00d6` already sat far
below the `249cbe9` figures above. The copy's median equals `main`'s in every
row and every round's spread is at most 0.1 MB, so the noise band is 0.1 MB and
every base-to-`main` difference but plain HTTP/1.1's, already lazy at base,
lies outside it. What `main` still takes grows
with the slots: QUIC's tables sized from `--slots` (about 93 kB a slot at
1024) and HTTP/2's (about 7 kB), not slots built before the first connection.
Time to listen with every pool at 1024 slots is 56 ms (52–58) on `main`
against 214 ms (209–216) at base; the copy's 54 ms (53–64) puts that noise band
at about 10 ms.

## HTTP/3 latency

`h3-latency.mjs` times `std/net`'s HTTP/3 server, run as
`tests/link/net_interop_server serve`, against nginx, with h2load over HTTP/3.
It is [issue #670](https://github.com/amritk/nish/issues/670)'s measure, and
[docs/h3-latency.md](../docs/h3-latency.md) records its figures and what
they showed. It is not in this suite's tables. The tools are not
dependencies of nish: `h3-latency/build-tools.sh` builds them once, into
`~/.cache/nish-h3-bench` by default, from pinned and checksummed tarballs:
OpenSSL, ngtcp2, nghttp3, h2load (nghttp2) with HTTP/3, and nginx with
`http_v3`. It needs gcc-14, libev, c-ares and zlib; its header names the
packages.

```bash
bash bench/h3-latency/build-tools.sh                # once; a second run skips what is installed
node bench/h3-latency.mjs --runs 5                  # single, c96 and c96m10, against nginx
node bench/h3-latency.mjs --runs 9 --size 4096      # a 4 kB body, where the pacer's stall shows
node bench/h3-latency.mjs --scenario single         # one scenario
node bench/h3-latency.mjs --baseline main           # also the server built from another rev
node bench/h3-latency.mjs --json out.json           # every run's figures, for a script
```

There are three scenarios: `single` is one connection with one request in
flight (`-c1 -m1`), `c96` is 96 connections (`-c96 -m1`), and `c96m10` is 96
connections with ten requests in flight on each (`-c96 -m10`). Each target
serves one file of `--size` bytes, 100 by default. The targets are the
interop server built by this checkout, a byte-identical copy of it, nginx
when `build-tools.sh` installed it, and with `--baseline REV` the server
built from REV in a worktree under `build/`. The copy is the noise band:
whatever separates the server from its copy is the machine, and the report
prints that spread beside the figures.

Each round runs every target on every scenario once, in turn, for
`--duration` seconds (5 by default) after a 1 s warm-up. The server is
pinned to CPU 0 and h2load to CPUs 1–3, so a busy share of 100 % means the
server never waited. p50 and p99 come from h2load's per-request log, and
server CPU from `/proc/<pid>/stat`. The busy share and CPU time cover h2load's
whole run (its spawn, the handshakes, the warm-up and the teardown), not only
the measured seconds. The report gives each figure's median and minimum over
the rounds: latency, req/s, the server's busy share and its CPU time per
request.

Only 2xx rows of the log count. Against nish, h2load logs a run's first
requests with status 0 while its summary counts them succeeded; the harness
drops those rows and reports how many in a `no status` column. A run stops
with an error when h2load reports a failed request, when the log holds any
other non-2xx row, when its row count differs from the requests h2load says
it completed, or when more than 5 % of rows have no status. Results gathered
before the error are still written and reported.

## Other files

- `sum.ts`, `ffi.mjs`: the WP8 FFI batching benchmark (`node bench/ffi.mjs`),
  not part of this suite.
- `substr.ts`: what proving a `substring` bound is worth (WP15 §8 `NL9009`),
  not part of this suite either. It times both shapes against each other inside
  one process and prints the two figures, so `nish bench/substr.ts --link x &&
  ./x` is the whole protocol: no baseline compiler and no second build.
- `hoist-field.ts`: what hoisting an array header out of a loop is worth
  (WP15 §2c candidate 2), not part of this suite either. Three scans do the same
  arithmetic over the same 8192 doubles and differ only in where the source
  array is *kept* — a parameter, a class field, and a class field read once into
  a `const` before the loop — timed against each other in alternating rounds
  inside one process, so there is no baseline compiler and no second build:

  ```bash
  npm run build
  build/nish bench/hoist-field.ts -o build/hoistir/ --link build/hoist --profile speed
  taskset -c 2 build/hoist
  ```

  `--link` alone would run it; `-o` keeps the module, which is where `opt -O2`
  shows the `umin` the file header tells you to look for.

  The field shape is `knownAtMost` in [src/bounds.ts](../src/bounds.ts) — the
  file header says why — so the distance between it and the other two is what
  candidate 2 of [docs/wp15-performance.md](../docs/wp15-performance.md) §2c had
  to recover, and did: the emitter hoist (#104) and property-path length facts
  (#179) took it from 577 ms to 242 ms.

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
