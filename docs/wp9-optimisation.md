# WP9: Optimisation and benchmarking

What this package added, what each flag does and buys, the measured standing
of AmritScript against C and Rust, and a diagnosis with a proposed fix for every
benchmark that misses the target. The numbers quoted here are from
[BENCHMARKS.md](BENCHMARKS.md), which `node bench/run.mjs` regenerates; the
programs and the measurement rules are described in
[bench/README.md](../bench/README.md).

> **After WP6 (re-run on the merged tree, `docs/BENCHMARKS.md`):** stack allocation of
> non-escaping objects closed the vec3 gap (2.02x -> 0.95x) and most of nbody's
> (1.24x -> 1.11x); fib 0.98x, spectral 1.02x, sieve 0.85x. String building stays at
> 1.9x: `join` returns every intermediate string, so it escapes and no arena scope can
> reclaim it. Reclaiming a returned temporary at the call site (the caller knows the
> value is consumed immediately by another concat) is the remaining item.

## Summary

| Benchmark | AmritScript / Rust `-O3` | AmritScript / C `-O3` | Target (1.10x) |
| --- | ---: | ---: | --- |
| fib(40) | 0.93x | 1.20x | met against Rust; PGO closes the gap to C (see below) |
| spectral norm | 1.03x | 1.00x | met |
| sieve | 0.79x | 1.24x | met against Rust; bounds checks cost 24 % against C |
| nbody | 1.24x | 1.21x | **missed**: arena objects cannot be proven distinct |
| vec3 | 2.02x | 2.25x | **missed**: same cause, every field lives in memory |
| string building | 1.54x | 0.93x vs arena C, 1.48x vs naive C | **missed**: the arena never frees, so it page-faults |

Binary sizes are 5-12 KB for AmritScript against 14.5 KB for C and 350-380 KB
for Rust (which links `std` statically). Peak memory is 1.3-1.8 MB for the
compute benchmarks, below both C and Rust.

Three of six benchmarks meet the target; the three misses share one root
cause, which WP6 owns: LLVM cannot tell two arena allocations apart, and the
arena cannot reclaim memory. Both are diagnosed with experiments below and
neither needs a change to the language.

## What shipped

### `--target <triple>` and `--target host`

`src/codegen/target.ts` maps a triple to the data layout string that clang 18
emits for it, and the emitter writes both lines after `source_filename`:

```llvm
target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"
target triple = "x86_64-unknown-linux-gnu"
```

| `--target` | Data layout |
| --- | --- |
| `x86_64-unknown-linux-gnu` (`x86_64-linux-gnu`, `x86_64-linux`) | `e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128` |
| `aarch64-unknown-linux-gnu` (`aarch64-linux-gnu`, `aarch64-linux`) | `e-m:e-i8:8:32-i16:16:32-i64:64-i128:128-n32:64-S128` |
| `x86_64-apple-darwin` (`x86_64-apple-macosx`) | `e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128` |
| `aarch64-apple-darwin` (`arm64-apple-darwin`, `arm64-apple-macosx`, `aarch64-apple-macosx`) | `e-m:o-i64:64-i128:128-n32:64-S128` |
| `wasm32-unknown-unknown` (`wasm32`) | `e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20` |
| `wasm32-wasi` (`wasm32-unknown-wasi`) | same as above |
| `host` | whichever of the above matches `process.platform` / `process.arch` |

The default stays target-neutral: no lines at all, and clang fills them in
from its own `--target` at link time, so `--link` builds are unaffected either
way. What the flag changes is the *standalone* `opt` and `llc` experience: a
target-neutral module gives `opt` a generic layout with no vector registers,
so `opt -O2 -S module.ll` never vectorises and does not show the IR the binary
is actually built from. `tests/run.js` checks that `opt -O2` on
`opt_target_triple.ll` vectorises its sum loop *without* `-mtriple` (the WP1
test needs `-mtriple=x86_64-unknown-linux-gnu` for the same loop), that
`--target host` resolves to this machine's triple, and that an unknown triple
is a usage error listing the supported ones. An unsupported host (Windows,
32-bit) gets the same error. The layout strings are copied from
`clang --target=<triple> -S -emit-llvm`; if a future clang disagrees, the link
fails with a clear layout-mismatch error rather than miscompiling.

Measured impact on the suite: none, by construction (the benchmark binaries
are linked by clang, which supplies the layout). Left for later:
`scripts/build.sh` still passes `-Wno-override-module` unconditionally, which
is harmless when the triple is present.

### `--nsw`

Every user-level integer `add`, `sub` and `mul` on `i32` and `i64` carries the
`nsw` flag: binary operators, unary minus (`sub nsw i32 0, %x`), `op=` on
locals, fields and array elements, and `++`/`--`. Division and remainder have
no `nsw` form, and the compiler's own `i64` index, length and allocator
arithmetic is never flagged (`opt_nsw.ll` is checked for both facts). One
helper, `intOpcode` in `src/codegen/emit/context.ts`, is the only place the
decision is made.

Semantics: signed overflow becomes undefined behaviour, exactly as in C (Rust
release builds wrap instead, like the AmritScript default). What LLVM gains is
the right to assume that an `i32` induction variable never wraps, so it can
widen it to the native 64-bit width once instead of sign-extending it on every
iteration, and to fold `(a + 1) - 1` and friends.

| Benchmark | wrapping (default) | `--nsw` | Change |
| --- | ---: | ---: | ---: |
| fib | 355 ms | 358 ms | none (no induction variable) |
| sieve | 793 ms | 727 ms | **-8 %** (four `sext i32` per marking iteration become zero) |
| strbuild | 22.9 ms | 22.2 ms | none (runtime-bound) |

The default stays wrapping: it is the documented language semantics and the
safe choice; `--nsw` is for code that carries its own overflow argument.

### `dereferenceable(24)` on array parameters and returns

Every `%struct.sts_array*` parameter and return value now carries
`dereferenceable(24)`, the size of the `{ i64 len, i64 cap, i8* data }`
header. The guarantee is structural: an array value only ever comes from a
literal, `new Array<T>(n)`, or a function that returned one of those, and all
of them write a complete header (the arena hands out at least 24 bytes and
literals store every field). LLVM may therefore load `len` speculatively,
which lets it hoist the length load out of a loop *before* the bounds branch
rather than after it. Struct pointers already carried `dereferenceable(sizeof
X)`; this closes the gap for arrays.

Every `arr_*` golden changed on its signature lines only (15 lines across 11
files, regenerated); no other test moved. Measured impact on the suite is
within noise: the loops that matter (sieve, spectral) already had the length
load hoisted because the panic block is `noreturn` and `cold`.

### PGO recipe in `scripts/build.sh`

```bash
scripts/build.sh app.ll runtime/runtime.c -o app.instr --profile speed --pgo-generate
LLVM_PROFILE_FILE=app-%p.profraw ./app.instr      # one or more training runs
llvm-profdata merge -o app.profdata app-*.profraw
scripts/build.sh app.ll runtime/runtime.c -o app --profile speed --pgo-use app.profdata
```

`--pgo-generate` adds `-fprofile-generate`, `--pgo-use <file>` adds
`-fprofile-use=<file>` (and refuses a missing file with a hint), for the
`speed`, `size` and `napi` profiles. The instrumented link needs the
compiler-rt profile runtime (`libclang-rt-18-dev` on Ubuntu; part of Apple
clang and Homebrew llvm). Measured, training on the benchmark input itself:

| Benchmark | `-O3` | `-O3` + PGO | Change | C `-O3` |
| --- | ---: | ---: | ---: | ---: |
| fib(40) | 356 ms | 288 ms | **-19 %** | 297-311 ms |
| nbody | 1180 ms | 1149 ms | -3 % | 962 ms |

PGO takes fib past C: the profile tells LLVM which of the two recursive calls
is hot and how deep the recursion goes, which drives its block layout and
partial unrolling. nbody gains little because its cost is memory traffic, not
branch layout (see below).

## Diagnosis of the misses

The experiments below rewrite the emitted `.ll` by hand or add flags, then
rebuild with `scripts/build.sh --profile speed` and time with the same
harness (minimum of three runs). They are reproducible from
`build/bench/*.ll` after `node bench/run.mjs`.

### vec3: 2.02x (753 ms against Rust 372 ms, C 334 ms)

The loop calls six small methods on four `Vec3` objects and allocates
nothing. After `-O3 -flto` every method is inlined, but the loop body still
contains **34 `load double` / `store double`** where the C version has
**none**: C keeps all twelve fields in registers for 5e7 iterations.

Why: the four objects come from the inline arena allocator, so each one is
`buf + offset` where `buf` and `offset` are reloaded from `@sts_arena` after
a possible call to `sts_arena_grow`. To LLVM they are four pointers of unknown
provenance that may alias each other, so every store to `v.x` forces `p.x`,
`g.x` and `kick.x` to be reloaded before their next use. In C the four
`malloc` results are `noalias`; in Rust the four `Box`es are.

| Experiment | Time | Note |
| --- | ---: | --- |
| baseline | 757 ms | |
| `--strict-exports` | 747 ms | inlining is not the problem |
| replace the four `sts_alloc_struct` calls in `main` with `alloca i8, i64 24` | **349 ms** | what WP6's escape analysis will emit: none of the four objects escapes `main` |
| make the allocator `noinline` (its `noalias` return then survives) | **356 ms** | distinct provenance is all LLVM needs |
| C `-O3` | 334 ms | |

Proposed fix (WP6, already in its scope): allocate non-escaping `new`
results with `alloca`, which gives LLVM distinct objects for free. For objects
that do escape, keep the fast path but hand LLVM the provenance: either emit
each `new` through a small `noinline` wrapper with a `noalias` return when the
allocation is outside every loop of the function (one call per object, no
cost in the loop), or attach `!noalias` / `!alias.scope` metadata to the
loads and stores of objects the checker knows are distinct (every `new` is a
fresh object; two locals initialised from two `new`s never alias until one is
assigned to the other, which the checker can see).

### nbody: 1.24x (1186 ms against Rust 960 ms, C 984 ms)

Same cause, one level up. The inner pair loop in AmritScript's `advance` runs
**58 instructions with 12 loads and 6 stores**; C's is **46 instructions with 3
loads and 4 stores**. `bodies[i]`, `bi.x`, `bi.y`, `bi.z` and `bi.mass` are
reloaded on every `j` iteration because the stores to `bj.vx`, `bj.vy`,
`bj.vz` may, as far as LLVM knows, hit `bi` or the array's `data` buffer. In
C the five bodies are `malloc` results and the pointer array is a stack array
that SROA turns into five registers once `advance` is inlined and the `i`
loop is unrolled, so `bi` is a specific `noalias` object per inner loop.

| Experiment | Time | Change |
| --- | ---: | ---: |
| baseline | 1173 ms | |
| `--unchecked-indexing` | 1166 ms | 0 %: the bounds checks are hoisted already |
| `--strict-exports` | 1166 ms | 0 %: `advance` still is not inlined (the check blocks raise its cost) |
| both | 1145 ms | -2 % |
| `noinline` allocator (`noalias` provenance for the bodies) | 1107 ms | -6 % |
| PGO | 1149 ms | -2 % |
| C `-O3` | 962 ms | |

Provenance alone recovers a third of the gap; the rest is the array. The five
`Body` pointers live in arena memory, so even with distinct bodies the load
of `bodies[i]` cannot move out of the `j` loop while `bj` fields are stored
through a pointer LLVM cannot relate to the array.

Proposed fix: the WP6 changes above (the bodies are distinct objects) plus
stack allocation of the array literal when it does not escape, which lets
SROA do for `bodies` what it does for the C stack array. Independently, a
`readonly`-style fact for array *data* is worth adding to `attributes.ts`:
when a function never stores an element of type `T[]` (nbody's `advance`
writes body fields, never array slots), the loads of `bodies[i]` can be
marked `!invariant.load` inside that function, which removes the reload
regardless of provenance.

### String building: 1.54x (22.9 ms against Rust 14.9 ms)

Here the AmritScript binary matches its arena twin in C (24.7 ms) and loses to
the *naive* C that `malloc`s and `free`s every string (15.5 ms) and to Rust
(14.9 ms), which does the same. The peak-RSS column explains it: 48.7 MB for
the arena versions, 3.6 MB for the others. The arena never frees, so building
an 806 KB string through a 32-way join tree touches 48 MB of *fresh* pages,
and the run is dominated by page faults (about two thirds of it is system
time), whereas `malloc`/`free` recycles a few hot pages that stay in cache.

Proposed fix (WP6, in scope): arena scopes. `join` is the textbook case:
`sts_arena_mark()` before the recursion into a sub-range, copy the result
out, `sts_arena_release(mark)` after, and the working set drops to roughly
twice the final string. A cheaper follow-up in the runtime: reuse chunks that
a release or reset has emptied before calling `malloc` for a new one, so the
steady state stops touching new pages at all. Neither changes the emitted
code for programs that do not opt in.

Two caveats for reading this row: the run is short (25 ms) because the
quadratic memory of the arena model bounds the size, so a millisecond of
noise is 4 %; and the Rust twin deliberately allocates a fresh `String` per
concatenation to match the algorithm. Idiomatic Rust (`push_str` into one
growing buffer) is a different, linear algorithm.

### sieve and fib against C

Both meet the target against Rust and miss it against C, for reasons worth
recording.

**sieve** (793 ms; Rust 1005 ms; C 642 ms). Rust pays the same bounds checks
as AmritScript and is slower still. Against C the costs are: the marking loop's
`sext` per iteration (fixed by `--nsw`, -8 %) and the bounds check in all
three loops. With checks the clearing and counting loops do not vectorise at
all (zero vector instructions in `sieve`); with `--unchecked-indexing` both
vectorise exactly as C does (twelve `<16 x i8>`-class operations), but that
buys only -4 % because the strided marking loop dominates. The remaining
check in the marking loop cannot be hoisted by LLVM: the loop bound `n` is
unrelated to `composite.length` in the IR. Proposed fix: the range-check
hoisting noted in docs/wp4-arrays.md, i.e. a guard `n < a.length` emitted
once before a counted loop whose index provably stays in `[0, n]`, after
which the per-element check folds; and, for loops that only read, the
`for...of` form, which carries no check.

**fib** (355 ms; Rust 381 ms; C 297 ms). C's `static` function with one call
site is inlined and its recursion partially unrolled by clang; AmritScript's
`fib` has external linkage and `--strict-exports` did not change the result
(352 ms). PGO does (288 ms), so the difference is block layout and unrolling
depth, not the IR the compiler emits.

**result** (650 ms; C 444 ms; Rust 251 ms) — added with WP17, and the first
miss whose cause is the *ABI* rather than the memory model.
`Result<number, number>` travels in one `i64`: the discriminant in the low
half, the live payload in the high half. The same program written in C the
same way — `uint64_t`, `<< 32`, `|` — times at 653 ms, i.e. exactly the
AmritScript column, so the emitted IR is not at fault. What the faster two
columns have is the ok arm and the error arm as *separate SSA values*: then
instcombine folds `odd ? n : n >> 1` into one variable shift, where a
`select` on the combined word leaves the shift in the loop. Loop unrolling
and the checked-division blocks were both ruled out by measurement, and
respelling the pack as clang's two-word coercion (store the halves, `load
i64`) produced byte-identical assembly, so it was not taken.

Proposed fix, and it is not a peephole: give an internal function a private
ABI of two scalars — rustc's `ScalarPair` — and pack only where a host can
see the signature. That makes `--strict-exports` load-bearing rather than
advisory, which is already one of the two open questions below.
`docs/wp17-result-abi.md` §4 has the four-way table.

## Left out, and why

- `noalias` on struct parameters under an aliasing rule, and `dso_local` /
  `unnamed_addr` on functions: not measured to matter on this suite (string
  constants are already `private unnamed_addr`; the parameters that would
  gain `noalias` are the ones whose objects LLVM cannot distinguish anyway,
  see the vec3 diagnosis). They stay on the list behind the WP6 provenance
  work, which is where the benefit is.
- Range-check hoisting for counted loops: a WP4 follow-up with its own
  checker proof; the sieve numbers above bound its value at about 4-20 %
  depending on the loop shape.
- `hyperfine`: not installed here; `bench/run.mjs` measures with
  `process.hrtime.bigint` and reports min and median, which is what the plan
  asked for from the runner.
- Benchmark sizes differ from the first draft of the plan (fib 35, nbody
  5e6, spectral 1000, vec3 1e7) because those runs take 30-70 ms on this VM;
  every size was raised until the C version needs at least a quarter of a
  second (bench/README.md). The `--n` option restores any size.
- Peak RSS is measured with a small C helper (`bench/rss.c`) because
  `/usr/bin/time` is not installed in this environment.

## Runtime budget

`docs/MASTER_PLAN.md` section 2 caps `runtime/runtime.c` at 4 KB compiled at
`-Oz` and 8 KB of source. The argv/parsing round of WP7 left the compiled
size at 4,195 bytes (`clang -Oz -c runtime/runtime.c && size runtime.o`, the
`text` column, which also counts the read-only constants and the `.eh_frame`
unwind entries the `size` profile strips) and the source at 11,432 bytes.
This pass brought both back down without changing any observable behaviour:
no prototype, symbol name, message, exit status or output byte moved, and
`tests/runtime_test.c` asserts exactly what it did before.

| | Before | After | Target |
| --- | ---: | ---: | ---: |
| `size` text at `-Oz` | 4,195 | 3,714 | 3,900 (budget 4,096) |
| of which `.text` (+ `.text.unlikely`) | 2,637 | 2,245 | |
| of which `.eh_frame` | 1,344 | 1,240 | |
| of which read-only data | 214 | 229 | |
| source bytes | 11,432 | 9,392 | 9,000 (budget 8,192) |

`scripts/size-report.sh` now prints the compiled number as a `runtime` row
above the profile rows, so a pull request that grows the runtime shows it.

Every step was measured and kept only when it paid (text at `-Oz` after each
one, starting from 4,195):

1. **One cold exit path.** `sts_die(msg)` is `noreturn, cold, noinline`; the
   two panics that format a number or a path (`sts_panic_index`,
   `sts_io_fail`) use one `dprintf(2, ...)` instead of hand-written digit
   loops and four `write` calls, and `sts_panic_div` calls `sts_die` with the
   literal it picked. 3,981 (-214). A variadic `sts_die(fmt, ...)` over
   `vdprintf` was measured first and rejected: the x86-64 register save area
   of `va_start` costs more than it shares (4,072).
2. **Number formatter.** `sts_str_from_f64` no longer copies the digits out
   of the `%.*e` buffer: a `DIG(j)` macro indexes them in place, the digit
   count is the loop counter of the shortest-round-trip search, and the four
   JS layouts (integer with trailing zeros, decimal point inside, `0.000ddd`,
   exponent form) come out of one loop with an `if (i == n) '.'` and a
   trailing `snprintf("e%+d")` for the exponent form. Checked against Node's
   `String(x)` on 40,024 doubles (random bit patterns, decimal fractions,
   integers up to 1e21, every boundary in the test) with zero mismatches, on
   top of the 27 cases in `tests/runtime_test.c`. 3,738 (-243).
3. **`sts_argv_init` with one `malloc`** for the header, the pointer table
   and every string: rejected, the second `strlen` pass costs more than the
   second out-of-memory check saved (3,775; a `strlen(strcpy())` variant of
   the original loop was 3,747, also worse than the original 3,738).
4. **`sts_parse_number` letting `strtod` do the prefix work** and rejecting
   `inf`/`nan` afterwards: rejected, the `end - q` arithmetic and `memcmp`
   cost more than the range check they replaced (3,761).
5. **One chunk-freeing loop.** `sts_reset_arena`, `sts_free_arena` and
   `sts_arena_release` share `sts_free_until(c, end)`. 3,723 (-15).
6. **`sts_put_file`** checks the descriptor before the write loop instead of
   inside it. 3,719 (-4). Two other shapes (one failure site through a
   sentinel, `sts_io_fail` as a macro) were larger (3,732 and 3,755).
7. **`sts_read_file`** accumulates the byte count in a local instead of
   `s->len`. 3,714 (-5). Folding `sts_io_fail` into a three-argument
   `sts_die(what, len, bytes)` to save its unwind entry was measured too:
   the wider call sites cost more than the entry (3,723).

The source pass changed no code generation (the object is byte-for-byte the
same size per function): implicit conversions the C standard performs anyway
lost their casts, the three copies of the out-of-memory literal and of the
`noreturn, cold, noinline` attribute list sit behind one macro each, `NAN` /
`INFINITY` from `<math.h>` replace the builtins (same bit patterns), and the
comments were cut to their contract content. Three source-only rewrites
that did move code generation were reverted: a compound-literal store in
`sts_arena_grow` (+6), and initialising `stop` or `p` in the declarations of
`sts_parse_number`, which hoists work above the `mode == 2` early return
(+4 / +7). The source target of 9,000 bytes is missed by 392: what is left is
one comment per function stating its contract (the two `%struct` layout
lines, the string layout, the scope semantics, the `malloc`-not-arena rule
for `process.argv`, the parse modes by reference to `amritc.h`) and the
WASI entry-point bridge; getting under 9,000 means deleting those.

Ideas measured to be neutral or worse and not taken: `__attribute__((cold))`
on the exported panic functions (exactly neutral at 3,714; at `-Oz` every
function is already optimised for size), a one-`malloc` argv table (above),
`strtoll` replaced by a digit loop (it is libc, so it is not in `runtime.o`
at all; keeping it is free).

Smoke binaries (`npm run smoke`, size profile) did not grow: `hello` 4,696
and `multi/main` 4,488 unchanged, `argv` 10,808 -> 10,304, `nbody` 8,800 ->
8,536. No WASI sysroot is installed here, so the `wasi` profile could not be
linked; the guarded block compiles on the host with `-D__wasi__
-fsyntax-only -Wall -Wextra -Werror`, and `runtime/runtime_wasm.c` is
untouched.

## Tests

- `tests/cases/opt_target_triple.ts` (+ `.args`, `.out`): golden with the
  x86_64 layout lines; `tests/run.js` runs `opt -O2` on it without
  `-mtriple` and expects a vectorised loop, checks `--target host`, and checks
  the usage error for an unknown triple.
- `tests/cases/opt_nsw.ts` (+ `.args --nsw`, `.out`): golden in which every
  user-level `i32` `add`/`sub`/`mul` carries `nsw` and no internal `i64`
  operation does; the runner also checks that a default build contains no
  `nsw` at all.
- Regenerated `arr_*.ll` goldens for `dereferenceable(24)`.
- `WP9: bench` in `tests/run.js`: `bench/run.mjs --validate --only fib,sieve
  --n fib=25,sieve=100000` builds every variant (speed, `--nsw`, size
  profile, C, Rust, Rust native) and requires identical checksums; Rust is
  skipped when `rustc` is missing.
