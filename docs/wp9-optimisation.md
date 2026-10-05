# WP9: Optimisation and benchmarking

**Status: complete** (0.1.0). It shipped `--target`, `nsw` arithmetic,
`dereferenceable(24)` on arrays, the PGO recipe, the benchmark suite against C
and Rust, and the call-site reclaim. The Are We Fast Yet rounds came later
(round 1 after #208–#210, round 2 #217, both in 0.11.0). Two outcomes have
since been overturned:

- **`--nsw` is gone.** Since #426, signed overflow is a checked panic by
  default: an operation the bounds walk proves fits keeps `nsw`, and any
  other is `llvm.s*.with.overflow` plus a branch to `nish_panic_overflow`.
  `--nsw` is refused with exit 2, and `--wrapping` is deprecated in favour of
  `wrappingAdd` / `Sub` / `Mul` from `nish:unsafe`.
- **`--unchecked-indexing` is deprecated** (#459, NL7002). `nish --fix`
  rewrites the sites it affects into `uncheckedGet` / `uncheckedSet` from
  `nish:unsafe`.

The live standing is [BENCHMARKS.md](BENCHMARKS.md), which `node bench/run.mjs`
regenerates. The programs and measurement rules are in
[bench/README.md](../bench/README.md), and the normative flag rules are in
[LANGUAGE.md](LANGUAGE.md). Every number below was measured when its section
was written, and the experiments mean something only against the numbers they
were run on.

## Summary

At landing, measured against Rust `-O3` and C `-O3`, with a target of 1.10x:

| Benchmark | Nish / Rust | Nish / C | Then |
| --- | ---: | ---: | --- |
| fib(40) | 0.93x | 1.20x | met against Rust; PGO closes the gap to C |
| spectral norm | 1.03x | 1.00x | met |
| sieve | 0.79x | 1.24x | met against Rust |
| nbody | 1.24x | 1.21x | missed: arena objects not provably distinct |
| vec3 | 2.02x | 2.25x | missed: the same cause |
| string building | 1.54x | 0.93x against arena C | missed: the arena never freed, so it page-faulted |

All three misses had one root cause, which belonged to WP6: LLVM could not tell
two arena allocations apart, and the arena could not reclaim memory. All three
have since closed:

- **vec3**: 2.02x → 0.95x, through WP6's stack allocation.
- **strbuild**: 1.64x → 0.90x, through [the call-site reclaim](#the-call-site-reclaim).
- **nbody**: 1.23x → 0.96x, through `!tbaa` on class fields (below).

`result` arrived with WP17 at 2.49x and went to 1.00x once a `Result` got a
private ABI with one slot per arm ([wp17-result-abi.md](wp17-result-abi.md)
§4). On the 0.11.0 run, every program was within 1.10x of Rust (fib's 1.15x
on one run was spread: interleaved re-runs gave 261 ms against Rust's 262).
That stopped being true with #426, which made signed overflow a checked panic:
on the 0.16.0 run in BENCHMARKS.md (2026-10-05) fib is 1.68x Rust by default
and at parity under `--wrapping` (564 ms against 338), because every `+` in its
recursion now carries an overflow check the bounds walk cannot prove away.
The other six are within 1.10x. On a shared VM the medians sit 15–20 % above the minima, and the
ratios move by about that much between back-to-back runs. **A row near 1.10x
needs several runs, or cachegrind, before it means anything.** Nish binaries
are 5.5–21 KB, against 14.5 KB for C and 350–380 KB for Rust, and Nish is
ahead of the Go twins on all seven programs.

### nbody was alias information, not code generation

Instructions retired (callgrind, `n = 150000`):

| | instructions |
| --- | ---: |
| C `-O3` | 80,344,647 |
| Rust `-O3` | 82,132,809 |
| Nish, before | 87,514,731 |
| C `-O3 -fno-strict-aliasing` | 93,394,660 |
| **Nish with `!tbaa`** | **80,014,745** |

The control experiment was C with its alias information removed, and it did
more work than Nish. So Nish's code generation was not behind; it was handing
LLVM less. A store to `bi.vx` and a load of `bj.mass` are both "a double
behind a `%struct.Body*`". Struct-path `!tbaa` (`src/tbaa.ts`) separates them
by offset, so `bj.mass` loads once and `bi`'s fields leave the loop. This is
not a general "TBAA is worth 9 %": vec3 and spectral retire exactly the same
count with or without it. Clang still SLP-vectorises nbody's x/y pair where
Nish stays scalar.

## What shipped

### `--target <triple>` and `--target host`

`src/target.ts` maps a triple (x86_64 / aarch64 Linux, x86_64 / arm64 Darwin,
`wasm32`, `wasm32-wasi`, and their aliases) to the `target datalayout` string
clang 18 emits for it. It writes that line and `target triple`. `host`
resolves from the running machine, and an unknown triple is a usage error
(exit 2). The default emits neither line, and clang supplies them at link
time, so `--link` builds are unaffected. The flag exists for standalone `opt`
and `llc`: a target-neutral module gets a generic layout with no vector
registers, so `opt -O2` never vectorises it. `tests/run.js` checks that
`opt_target_triple.ll` vectorises without `-mtriple`. The suite measured no
impact, by construction.

### `--nsw`

**Superseded; the flag is refused today.** WP9 added an opt-in `nsw` flag on
user-level `i32` / `i64` `add`, `sub` and `mul`. The compiler's own index and
length arithmetic was never flagged. With `nsw`, LLVM may assume an induction
variable never wraps and widen it once. That bought **sieve −8 %**: four
`sext` per marking iteration disappeared. fib and strbuild did not move. That
measurement made `nsw` the default in WP15 §3, with `--wrapping` to opt out.
#426 then made unproven overflow a checked panic. The bounds walk still proves
the sieve's counters and keeps `nsw` on them, which preserves the win the flag
was measured for. The `opt_nsw` golden now pins that default.

### `dereferenceable(24)` on array parameters and returns

An array value always points at a complete `{ len, cap, data }` header, so
every `%struct.nish_array*` parameter and return carries
`dereferenceable(24)`. LLVM may then load `len` speculatively. The suite
measured it within noise, because the hot loops' length loads were already
hoisted.

### PGO recipe in `scripts/build.sh`

```bash
scripts/build.sh app.ll runtime/runtime.c -o app.instr --profile speed --pgo-generate
LLVM_PROFILE_FILE=app-%p.profraw ./app.instr
llvm-profdata merge -o app.profdata app-*.profraw
scripts/build.sh app.ll runtime/runtime.c -o app --profile speed --pgo-use app.profdata
```

PGO works for the `speed`, `size` and `napi` profiles, and needs compiler-rt's
profile runtime. Measured while overflow was still undefined, training on the
benchmark input: **fib 356 → 288 ms (−19 %), past C's 297–311**, from block
layout and unrolling depth. nbody gained 3 %, because its cost was memory
traffic.

## Diagnosis of the misses

These are the experiments that located each cause. The fixes came from other
packages, and **WP15 §2b's header/element alias domains later changed the
attribution**:

- **vec3**: 34 `load`/`store double` in the loop body, where C had none. The
  four objects came from the inline arena bump, so they had unknown
  provenance. `alloca` for the four took 757 → 349 ms, C being 334, which is
  what WP6's escape analysis now emits.
- **nbody**: bodies and `bodies[i]` were reloaded on every `j` iteration. A
  `noinline` allocator, which gives each body a `noalias` return, was −6 % at
  the time. Re-measured after WP6 it was noise, so that trade (a real call
  per allocation, for provenance) **should not be made**
  ([wp15-performance.md](wp15-performance.md) §7d). TBAA was the real fix.
- **strbuild**: the arena twin in C was as slow as Nish, and both peaked at
  48.7 MB. The cost was page faults on fresh arena pages, about two thirds of
  the run in system time. The fix was the call-site reclaim.
- **sieve against C**: the bounds checks blocked vectorisation of the clearing
  and counting loops. Removing them was worth only −4 % at the time, and only
  0.5 % once the alias domains let LICM hoist the header. The cost had been
  the reloaded `len`, not the compare. The range-check hoisting proposed here
  was built as WP15's bounds pipeline and call-site index ranges (#222).
- **result**: the cause was the ABI, not memory. The one-word pack hid the two
  arms from instcombine, and a C program written the same way timed the same.
  WP17's private ABI (`{ i1, T, E }`, one slot per arm) fixed it.

## What the number mode costs

i32 is the default because it is faster. `--number-mode f64` exists because it
is the only mode in which Node runs a program unmodified
([RUN_UNDER_NODE.md](RUN_UNDER_NODE.md)). This was a one-off measurement
(`--profile speed`, 3 warm-up and 15 timed runs, min / median in ms), not a
generated table.

| Benchmark | i32 | f64 | f64 / i32 |
| --- | ---: | ---: | ---: |
| fib | 343.8 / 346.2 | 469.3 / 474.6 | 1.36x |
| sieve | 658.5 / 707.3 | 1183.1 / 1225.2 | 1.80x |
| strbuild (repaired) | 15.2 / 15.4 | 23.1 / 23.9 | 1.52x |
| sum of a `number[]`, 20M elements | 184.6 / 201.5 | 630.6 / 645.2 | 3.42x |
| sum of a `number[]`, 100k elements (cache-resident) | 34.2 / 34.5 | 490.3 / 492.9 | 14.3x |

Not every program crosses modes:

- `result.ts` does not compile in f64 mode, because bitwise operators need an
  integer.
- `strbuild.ts` compiles but answers differently, because
  `(count + 31) / 32` assumes truncating `/`. It was timed with a
  `Math.floor` repair.

Binaries are a flat ~12.2 KB larger in f64 mode. The only difference is
`nish_str_from_f64`: printing a double links the shortest-digits formatter and
its tables. That is also why BENCHMARKS.md's nbody, spectral and vec3 binaries
are about 18–21 KB while the rest are about 6 KB.

The three mechanisms behind the slowdown:

1. **Every subscript pays an `fptosi`.**
2. **A float induction variable gets no `nsw`**, so it cannot be widened or
   strength-reduced.
3. **Reductions cannot be reassociated.** The i32 sum vectorises to 13
   `paddd`, about 0.24 cycles per element. The f64 sum is one serial `addsd`
   per element, about 3.4 cycles, because IEEE-754 addition is not
   associative. That is the 14×, and it is a limit of the semantics rather
   than a missing optimisation. Check it with `objdump -d` on the shipped
   binary, not with hand-run `opt | llc`.

i32 has costs of its own: overflow panics above 2³¹, where f64 is exact to
2⁵³ and then rounds silently; `/` truncates; and `Math.*` needs `toF64`.

## The call-site reclaim

`join` returns what it built, so WP6's scope cannot apply to it, and its
intermediates lived for the whole program: strbuild's 48 MB. The caller is in
a better position than the callee, because **a call hands back exactly one
value**. At a call to `f`, the emitter writes `nish_arena_mark()` after the
arguments, the call, and then `nish_arena_keep(mark, t)`, and uses the kept
pointer from then on. It does this when all four of these hold
(`reclaimsReturnedString`, `src/escape.ts`):

1. `f` returns a plain `string`. Only a string is one flat block with no
   interior pointers, so only a string can be moved.
2. `!f.allocEscapes`: nothing `f` allocated can be reached by the caller
   except through the return value. The fact is transitive over callees.
3. `!f.usesArenaControl`, so the mark is still valid.
4. `f.allocates`. This is profit, not proof.

**Why it is sound.** In the released window, the returned string is moved
rather than freed, and its only holder was the call's SSA value. The dropped
intermediates are unreachable by condition 2. Nothing else exists to worry
about, because the language has no globals, closures or function values. The
rule needs no claim about how the caller uses the result, which makes it
stronger than "consumed by the next concat" and easier to trust.

**`allocEscapes` versus `allocLeaks`.** WP6's `leaks` flow treats `s = s + t`
(an assignment to a frame local) the same as `out.text = s`. That is right for
the stack rule, which needs a fixed binding, and wrong for "can the caller
reach it". Every `Outcome` therefore carries a third bit, `escapes`, which
follows a local assignment into that local's outcome. `allocEscapes` implies
`allocLeaks`, never the reverse, and `flow` is unchanged, so no existing
decision moved. When a cycle (`a = b; b = a`) is re-entered, the answer is
`escapes: true`, which can cost a reclaim but never permits a wrong one.

**Why not `mark` / `release`.** Rewinding to the mark would free the kept value,
because it is the newest block, and a targeted free would need block headers
and a free list. `nish_arena_keep` instead moves the block down onto the mark
and frees the newer chunks. When the mark's chunk has no room for the block,
the block stays where it is and the chunks in between are unlinked. That
second arm was worth 13 MB on its own, because strbuild's strings are larger
than a chunk. Refusing a reclaim only costs memory, so `nish_arena_keep`
refuses whenever it is unsure: a pass-through return, a stale mark or `0`.

| strbuild (131,072 pieces, 806 KB result) | Before | After |
| --- | ---: | ---: |
| Peak resident set | 48,676 KB | **16,420 KB** |
| Peak live arena bytes | 51,503,624 | **15,196,680** |
| Arena chunks freed during the run | 0 | 620 of 628 |

The bytes bumped are unchanged: the reclaim frees memory but does not stop the
copying. Under contention, wall time went from 43–81 ms to a steady 21 ms. The
runtime's `.text` grew from 2,561 to 2,775 bytes. The goldens are
`mem_reclaim_call`, `mem_reclaim_argument`, `mem_reclaim_guards` (read this
one first: one of four calls is bracketed) and `mem_reclaim_no_stack_alloc`.
`tests/runtime-test.c` drives `nish_arena_keep` directly, and the cookbook
entry is `docs/cookbook/mem-reclaim.ts`. There is no `reject_*` case, because
the reclaim adds no syntax.

**Left out:**

- keeping the concatenation's result instead (about 0.8 MB, for a larger
  `memmove`);
- lifting `allocLeaks` to the `escapes` precision, which would change when
  memory is freed in existing programs;
- nullable, array and struct returns, which would need a copying collector;
- a mark of `0`.

The remaining 16 MB was the caller's own accumulator, which WP6 §2d's
loop-pass scope later addressed for the shapes it proves.

## Are We Fast Yet

The seven ports of [Are We Fast Yet](https://github.com/smarr/are-we-fast-yet)
live in `bench/awfy/` ([bench/README.md](../bench/README.md#are-we-fast-yet)).
Round 1 measured them after the callee arena scopes (#210), the
repeated-check removal (#209) and element TBAA (#208). The protocol was
`taskset -c 3 <harness> <Name> 30 <inner>`, the median of the last 20
iterations, then the median of five alternating rounds. The comparison was
against 0.10.0 and the AWFY C++ port at `-O3 -flto`, on 2026-09-25.

| Benchmark | 0.10.0 → main | main vs 0.10.0 | C++ |
| --- | --- | ---: | ---: |
| Permute | 36.6 → 31.2 ms | −14.7 % | 18.7 |
| Queens | 21.5 → 22.6 | +5.2 % | 8.0 |
| Towers | 23.3 → 24.1 | +3.3 % | 24.9 |
| Bounce | 26.1 → 31.1 | +19.2 % | 28.8 |
| Storage | 381.4 → 166.2 | −56.4 % | 305.9 |

Storage's peak RSS went from 390,064 to 1,708 KB, and `List 1 100000`'s from
49,840 to 1,460 KB, which is #210's callee scope (WP6 §2c). Cachegrind counted
**the same or fewer instructions** for Bounce, Queens and Towers, so their
slowdowns were code placement rather than extra work. Relinking with
`-align-loops=64` made main's Bounce 13.9 % faster than 0.10.0. The profile
found two more costs:

- an extra dependent load per array access, from `this` to the header to
  `data` (Queens);
- `header.data` reloaded after every class-field store, because the header
  loads had no `!tbaa` (Towers).

It proposed two fixes: header TBAA, and fixed-length array fields stored
inline. Both were built in round 2.

## Are We Fast Yet, round 2

Round 2 (#217) shipped four fixes, with the instruction-count guard (#218)
landing first:

- header TBAA (#220, `arr_header_tbaa*`);
- loop-pass arena scopes (#221, WP6 §2d);
- call-site index ranges (#222, trimmed in #236, `arr_range_call*`);
- inline fixed-length array fields (#230).

The protocol was round 1's with fifteen rounds instead of five, because this VM
drifts between speed states on a scale of seconds, and with paired per-round
ratios. Each "vs" figure is the median ratio, and a change inside its
interquartile range is not claimed. It ran on one x86-64 VM (Emerald Rapids)
on 2026-09-26. **The plan's second machine was not measured.**

| Benchmark | 0.10.0 | main | main vs 0.10.0 | main `--unchecked-indexing` | C++ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Permute | 55.5 | 18.3 | **−67.0 %** | 18.4 | 18.2 |
| Queens | 13.6 | 10.1 | **−25.6 %** | 7.3 | 7.2 |
| Towers | 23.2 | 14.5 | **−37.9 %** | 18.9 | 15.9 |
| List | 18.3 | 17.9 | −2.5 % | 18.2 | 17.9 |
| Bounce | 13.2 | 11.0 | **−17.4 %** | 13.9 | 11.6 |
| Mandelbrot | 35.5 | 35.5 | −0.1 % | 35.9 | 35.5 |
| Storage | 234.4 | 100.5 | **−56.8 %** | 101.1 | 212.9 |

- The geometric mean against C++ was **0.92×** checked, 0.95× unchecked, and
  1.40× for 0.10.0.
- No row was slower than the tree round 2 started from.
- Permute's checked and unchecked instruction counts match to 800, because
  #222 proved every index in `swap`.
- Queens is 1.40× C++ checked and 1.01× unchecked, so its whole remaining gap
  is its checks.
- Towers beats C++.
- #216's loop probe stays at the process floor, 1,316 KB at every round count.

### Layout, not work

List's `.ll` was byte-identical across round 2, yet on the lead's VM it was 7–18
% slower than 0.10.0. The machine code of each hot loop shows why. Every
slowdown without extra work, round 1's Bounce and Queens and round 2's List,
matches **one more 64-byte line under the hot loop**. Code shrinking elsewhere
in the binary moved `List.tail` from 16 to 32 mod 64. The Skylake JCC-erratum
rule does not fit the data, and `-mbranches-within-32B-boundaries` made List
slower, so that is recorded as a negative result. The penalty depends on the
front end, and this machine did not pay it.

Three remedies were proposed to the owner: `-falign-functions=64`,
`-mllvm -align-loops=64`, or reading this suite through cachegrind, which
#218's guard already does. Either flag would change every binary
`nish --link` produces. **Neither flag was adopted.** `scripts/build.sh` sets
no alignment.

## Left out, and why

- **`noalias` on struct parameters, `dso_local`, `unnamed_addr`**: not measured
  to matter on this suite.
- **`hyperfine`** was not installed. `bench/run.mjs` times with
  `process.hrtime.bigint`, and `bench/rss.c` stands in for `/usr/bin/time`.
- **Benchmark sizes** were raised until the C version runs for at least a
  quarter of a second. `--n` restores any size.

## Runtime budget

This pass took the WP7 runtime from 4,195 to 3,714 bytes of `size` text at
`-Oz` without changing any observable behaviour. The measured steps were:

- one `noreturn cold` `nish_die` with `dprintf` for the panics (−214);
- an in-place digit layout for the old `%.*e` formatter (−243);
- one shared chunk-freeing loop (−15);
- two small I/O reshapes (−9).

Variadic `nish_die`, a single-`malloc` argv table and letting `strtod` parse
prefixes were all measured larger and rejected. `scripts/size-report.sh`
gained its `runtime` row then. The ceilings that apply today, one per
translation unit, are in
[wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget).

## Tests

- `opt_target_triple`: vectorises under `opt -O2` without `-mtriple`. The
  same check covers `--target host` and the unknown-triple usage error.
- `opt_nsw`, `opt_wrapping`: the overflow default, now proven `nsw` or
  checked, and the deprecated opt-out.
- The `arr_*` goldens carry `dereferenceable(24)`.
- `WP9: bench` in `tests/run.js`: `bench/run.mjs --validate` builds fib and
  sieve in every variant and requires identical checksums, and runs each AWFY
  port once against its own `verifyResult`. Rust is skipped when `rustc` is
  missing.
