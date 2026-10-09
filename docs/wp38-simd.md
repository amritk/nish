# WP38: SIMD — which loops get vectors, and how a program asks for them

**Status: accepted; S0–S2 in progress (tracking issue #516).** The owner
took the decisions in §8 on 2026-10-09, as recommended. S0's baselines are in
§2.3. Nothing else in this note has a flag, a type or a runtime symbol yet:
each one arrives with its stage, and its rule goes into
[LANGUAGE.md](LANGUAGE.md) then. [MASTER_PLAN.md](MASTER_PLAN.md) lists the
work as additive. LANGUAGE.md stays normative and this note adds no rule to
it; where they disagree, LANGUAGE.md wins.

The question came from `bench/json`, the cross-language JSON benchmark of
#507. In its recorded report Nish's `std/json` read three fields per line in
about the time Go's gjson took, and simdjson in about a third of that. #499,
#500 and #507's own stages narrow the gap without SIMD, but do not close it. simdjson is a SIMD
structural indexer, so the gap raises a wider question: what SIMD should the
language have? This note answers it in four parts. §2 says what vectorises
today and what does not, with the test or the record for each claim. §3 sets
out four ways to get further, each judged by
[wp33-round-trip.md](wp33-round-trip.md) §6's rule: every construct states its
TypeScript reading, and none costs the native build of a program that does
not use it. §5 and §6 cover the target policy and constant-time code. §7
gives the order of the stages and the measured bar each must clear before it
ships.

---

## 1. The decision

**Put vectors where the bytes are, behind ordinary functions, before giving
programs vector types. Keep the default target at the baseline CPU.** Five
rules:

1. **Runtime kernels come first (§3.1).** These are a few byte-search
   primitives in a new runtime unit with its own size ceiling, written for the
   16-byte vectors every 64-bit target has: SSE2 on x86-64, NEON on AArch64.
   A wider path is chosen at run time, per kernel, on its first call.
   Programs reach them through `std` functions that are ordinary Nish
   loops. The compiler recognises such a function and replaces the one inner
   call that walks the bytes with the kernel, keeping the rest of the body,
   the way it already does for `std/threads`. Under Node the loop runs, so the
   construct is class A.
2. **The default target stays the baseline CPU (§5).** `--profile speed` does
   not pass `-march` today, and it keeps not passing it. A wider target is an
   opt-in flag. It ships only when it clears a measured bar, and only once the
   constant-time checker reads what that flag emits.
3. **A `nish:simd` module of fixed 128-bit vector types comes third (§3.2),
   and only if it clears its bar.** Its operations are portable: they lower to
   LLVM vector IR, never to a named target instruction. Every operation has a
   lane-by-lane TypeScript reading. Integer lanes wrap, and their names say so,
   as `nish:unsafe`'s `wrappingAdd` does.
4. **No target intrinsics in the language (§3.3).** Each one would tie a
   program to an instruction set, and none has a TypeScript reading that is
   not an emulator. Where one is worth having, as AES-NI may be, it goes into
   the runtime behind a function, as rule 1 does for byte search.
5. **Auto-vectorisation stays the default way numeric code gets vectors
   (§3.4).** Getting more loops into a shape LLVM vectorises is ordinary work
   for the bounds and overflow pipelines (WP15, #426), and needs no surface.

---

## 2. What exists

### 2.1 What vectorises today

There are no vector types and no intrinsics in the language
(`runtime/nish.d.ts` declares neither). What vectorises is what LLVM's loop
vectoriser finds in counted loops. The suite pins that it does:

| What | Pinned by |
| --- | --- |
| A reduction over a counted loop vectorises under `--wrapping` | `tests/run.js`, "opt -O2 vectorises the cf_sum_loop reduction" (WP1) |
| The same loop under the checked default keeps its overflow exit and does **not** vectorise | `tests/run.js`, "cf_sum_loop_checked: … does not vectorise" |
| An array sum vectorises with `--unchecked-indexing`, and the checked one only once inlined with a constant length, because LLVM 18's vectoriser does not take multi-exit loops | `tests/run.js`, the WP4 `arr_sum` checks; [wp4-arrays.md](wp4-arrays.md) |
| An element loop vectorises once header and element accesses are in separate alias domains | `tests/run.js`, "arr_alias_domains: opt -O2 vectorises the element loop" (WP15 §2b) |
| `--target host` gives the module a data layout, so `opt -O2` vectorises it without `-mtriple` | `tests/run.js`, "opt -O2 vectorises opt_target_triple without -mtriple" (WP9) |
| A loop over an array held in a class field compiles to the same loop, register for register, as one over a `const` copy, so it vectorises where that one does. Before the header hoist (#104) and property-path facts (#179) the field shape was 2.38x behind and did not vectorise | `tests/run.js`, "arr_header_hoist: @fieldScale's loop is @constScale's, register for register"; [wp15-performance.md](wp15-performance.md) §2c |

At the baseline CPU those vectors fit 128-bit registers on x86-64. `scripts/build.sh`
gives clang `-O3 -flto` under `--profile speed` and no `-march`. Its comment
says the IR is target-neutral and "clang fills the triple in", so the CPU is
clang's baseline: SSE2 on x86-64. [bench/README.md](../bench/README.md) relies
on this for the instruction gate ("`--profile speed` does not pass `-march`"),
and so does the constant-time checker
([LANGUAGE.md](LANGUAGE.md#constant-time-ctselect-and-cteq),
[CT-16](security/ct-verification.md)).

The runtime has one hand-picked vector path. `s.indexOf(sub)` is a call to
`nish_str_index_of`, which looks for the first byte with libc `memchr` and
checks the rest with `memcmp` (`runtime/runtime.c`). glibc's `memchr` is
vectorised, and it chooses its width when the program starts. That took one
search on an 880 KB haystack from 53.7 ms to about 3 ms, **17–18x**
([wp15-performance.md](wp15-performance.md#7c-indexof-gets-a-real-algorithm--done)).
#507's first stage gives it a start position, so that a scanner can use it
mid-string.

### 2.2 What does not

A loop that stops at the first interesting byte has an exit that depends on
the data. LLVM 18 does not vectorise it, so it runs one byte per iteration.
These scanners all have that shape:

- **`std/json`.** `jsonEndOfString`, the in-string branch of `jsonEndOfValue`,
  `jsonSkipBlank`, the key compare and `jsonUnescape` each walk the text with
  `charCodeAt`. #507's stage 3 moves the string bodies onto the `memchr`
  search. The structure scan (depth, commas, colons) stays byte-wise.
- **The compiler's lexer.** `src/lexer.ts` walks comments, identifiers,
  numbers and string literals byte by byte. Each step is a `charCodeAt` in a
  `while` with an early exit. Self-compilation time is the compiler's own
  speed, and nothing gates it today ([wp33](wp33-round-trip.md) §9).
- **`bench/scan.ts`.** This is the hot loop of a bytes-in JSON validator, kept
  as a proxy. As freestanding wasm it scans about 346 MB/s
  ([wp30-bytes-interop.md](wp30-bytes-interop.md)).

### 2.3 The numbers that motivate it

`bench/json` reads `code`, `line` and `message` from each of 100,000 lines
(43.8 MB). Its harness and its report, `docs/BENCHMARKS-json.md`, are on #507's
benchmark branch and not yet on `main`. The report, taken at 0.17.0, gave these
minima:

| Reader | min ms |
| --- | ---: |
| simdjson On-Demand | 36.8 |
| yyjson | 53.4 |
| serde_json, typed | 82.4 |
| gjson | 118.3 |
| Nish `std/json`, `jsonField` ×3 | 122.7 |

#499 measured 156.9 to 130.8 ms on its own machine. #507's plan records
about 90 ms after #500 on the report's machine, and its stage 3 trailer is the
figure that counts. Even at 90 ms simdjson is about 2.4x ahead, and what is
left to Nish is the structure scan, still one byte at a time (§2.2): the part
simdjson does with vectors.

The numeric side shows how much a wider target could buy, because
[BENCHMARKS.md](BENCHMARKS.md) times Rust at both `-O3` and
`-C target-cpu=native`, on the same machine as Nish's baseline build:

| Benchmark | Nish | Rust `-O3` | Rust native | native / `-O3` |
| --- | ---: | ---: | ---: | ---: |
| nbody | 1283 | 1382 | 1221 | 0.88x |
| vec3 | 396 | 436 | 394 | 0.90x |
| spectral | 498 | 460 | 466 | 1.01x |
| sieve | 717 | 1059 | 1076 | 1.02x |

Nish at the baseline already beats Rust `-O3` on three of the four. A wider
target bought Rust about 10–12% on the two float kernels and nothing on the
other two. So `-march` buys a little, and only on some programs (§3.4).

#### S0: the baselines

S0 measured these with `node bench/simd-s0.mjs`, with `main`'s compiler
(`f772bd2`; the branch adds only this note and that script). The scan and
bootstrap rows were taken at `97210d5`, and the `-march` rows at `c4dd861`,
once the script ran the two builds in alternating rounds. Between those
commits the script changed only in how it times, and in a comment. The machine
was an `Intel(R) Xeon(R) Processor @ 2.10GHz` (lscpu: family 6, model 207; 4
vCPUs under KVM; AVX2, FMA and AVX-512 present). Each row is seven runs after
one warm-up, in ms. Every later bar in §7 is a ratio against this table, on
this machine, so a stage that measures elsewhere re-runs the script there
first.

| Row | Build | min ms | median ms |
| --- | --- | ---: | ---: |
| `bench/json`, `jsonFields` | pending #507: its harness is on #507's benchmark branch, not on `main`, and S1 judges against it after #507's stage 3, so `s1-json` takes this row | — | — |
| `bench/scan.ts`, 1,000 passes over 1 MiB | native, `--profile speed` | 1783.2 | 1942.9 |
| `bench/scan.ts`, the same passes | freestanding wasm under Node 22, through `scanBatch` | 2334.6 | 2644.2 |
| nbody | baseline | 1139.8 | 1195.8 |
| nbody | `-march=x86-64-v3` | 1093.5 | 1193.5 |
| vec3 | baseline | 420.0 | 439.1 |
| vec3 | `-march=x86-64-v3` | 408.5 | 440.5 |
| spectral | baseline | 567.4 | 634.4 |
| spectral | `-march=x86-64-v3` | 506.6 | 541.0 |
| `scripts/bootstrap.sh --verify` | seed to stage3 | 150771.2 | 153702.1 |

The scan rows are about 590 MB/s natively and 450 MB/s as wasm. The wasm
figure includes copying the document into linear memory on every pass, as
any host must. Both print the same checksum. Each pass first turns the `1` of
one more piece into a comma, so no pass scans the document the one before it
did.

The `-march=x86-64-v3` rows link the same `.ll` as the baseline rows. Only
clang's CPU changes, for the module (through LTO) and for the runtime alike,
and both binaries print the same checksum. The two binaries run in alternating
rounds, so a slow stretch of the shared machine falls on both columns. The
wider binary uses VEX encodings and `ymm` registers. It has no FMA, because the
IR carries no `contract` flag. The baseline binary has neither.

A second sample of fifteen alternating rounds, at the same commit, gave these
gains (minimum, then median):

- spectral: 21.3% and 14.8% (506.2 → 398.4 and 533.4 → 454.2 ms)
- nbody: 2.2% and 4.1%
- vec3: −1.2% and −1.0%

The first, unalternated run of this script, at `97210d5`, put spectral at 8.0%
and nbody at −3.5%. That is the drift alternating removes, and it is why
these rows replace it.

**For S2's bar this is met, by spectral alone.** The bar is ≥10% at one level
on at least one of nbody, vec3 or spectral, with no loss on the others. Per
benchmark:

- **spectral meets it.** It gained 10.7% on the minimum and 14.7% on the
  median here, and 21.3% and 14.8% in the second sample.
- **nbody does not meet it, and does not lose.** It gained 4.1% and 0.2%
  here, and 2.2% and 4.1% in the second sample.
- **vec3 does not meet it, and shows no loss this machine can tell from
  noise.** It changed by +2.7% and −0.3% here, and by −1.2% and −1.0% in the
  second sample. Its sign flips between samples, and every figure is inside
  the ±3.5% spread this machine shows between runs of one binary.

So `s2-cpu` takes the branch that builds the flag. Its own PR re-measures
vec3 at the level it ships, and treats a vec3 loss that is still there,
outside that spread, as the "loss on the others" that withholds it. This
matches what Rust's native column said above: a real gain on some programs,
and next to nothing on the rest.

---

## 3. The options

Every option is judged on the same eight questions: cost, what it buys, what
it withdraws, the TypeScript reading, Node, wasm and N-API, constant-time
code, and the rolling freeze. The table is the summary; the subsections give
the reasons.

| | (a) Runtime kernels | (b) `nish:simd` types | (c) Target intrinsics | (d) Auto-vectorisation and `-march` |
| --- | --- | --- | --- | --- |
| Cost | S–M per kernel; a new runtime unit and its ceiling | L: a type family, the checker, emitter, `nish.mjs` | L, and again for every ISA | S for a flag; ongoing for loop shapes |
| Buys | the byte scans of §2.2 | hand-written numeric and byte kernels | everything, on one ISA | ~10% on some float kernels (§2.3) |
| Withdraws on 0.x | nothing | nothing (a new module) | nothing at first; a promise per ISA after | nothing as a flag; the default is not moved |
| TS reading | A: the `std` loop | A, if integer lanes wrap by name | D, or an emulator | A: no source change |
| wasm | the scalar loop, or simd128 | simd128, or scalarised by LLVM | none | `-msimd128` as the wasm level |
| CT checker | outside `expose` unless listed | inside the baseline it reads | outside it (CT-16) | outside it, at any level above the baseline |
| Freeze | `src/` from the next release | `src/` from the next release | — | none |

### 3.1 (a) Runtime kernels, chosen at run time

**What.** These are C functions in the style of `nish_str_index_of`, in a new
translation unit, `runtime/runtime-simd.c` (the name is open). They cannot go
in `runtime/runtime.c`: its ceiling is 3,606 bytes and it measures 3,606
([wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget)), and wp7's
rule is that a new surface gets its own unit and its own ceiling rather than
borrowing room. Two candidates:

1. **Find the first byte from a small set**, starting at an offset. For JSON
   the set is a quote and a backslash, or the structural bytes. For the lexer
   it is the end of a comment or a string. This is what `memchr` does for one
   byte. It is written once with SSE2 or NEON, which every 64-bit target has,
   so it needs no dispatch at all.
2. **Classify a block.** This gives a 64-bit mask with one bit per byte that
   belongs to a set, which is simdjson's first stage. It is only built if (1)
   misses its bar (§7).

A wider path (AVX2) is compiled with `__attribute__((target("avx2")))` and
chosen lazily, per kernel, on that kernel's first call. Each kernel is called
through a pointer that starts at a resolver. The resolver asks
`__builtin_cpu_supports` (after `__builtin_cpu_init`), stores the path it
picks and calls it. A later call goes straight to the stored path. Nothing
runs when the program starts, so a program that never calls a kernel pays
nothing, in time or in instructions, and `bench/instructions.json` cannot
move for it. glibc's `memchr` and simdjson also choose their paths at run
time. The binary stays a baseline binary.

**How a program reaches it.** Through a `std/text` function. Its working name
is `indexOfAny(text, bytes, from)`, and the name is open. The function checks
its arguments and clamps `from`, then hands the walk itself to one inner
function, the plain Nish loop over the bytes. The compiler recognises the
exported function by module and name, replaces that one inner call with the
kernel, and emits the rest of the body as written. So the argument checks and
the answer at the edges are the `std` file's, whichever way the program is
compiled. This is `std/threads.ts`'s mechanism. There the compiler replaces
the one call that walks the range (`mapRange` in a map, `reduceBlocks` in a
reduce) with the parallel region (`src/emit-parallel.ts`), and the length
check and combine order stay as written
([wp29](wp29-thread-surface.md) §4.1).

**TypeScript reading: class A.** Under Node the loop is the function, so
nothing needs translating and `runtime/nish.mjs` gains nothing. A golden pins
that the native and Node answers agree, as every builtin's does.

**wasm and N-API.** `--profile wasi` compiles the runtime units against wasi-libc.
The kernel there keeps a portable scalar fallback, or gets a `wasm_simd128.h`
path under `-msimd128` (§5). `runtime-wasm.c` has no strings, so freestanding
wasm has nothing to call it with. An N-API addon is built with the speed
flags, so it gets the native kernel unchanged.

**Cost.** The new unit costs what each of its siblings did:
- a ceiling constant in `tests/run.js`, set at the next 256-byte boundary
  above its first measurement, with a row in wp7's budget table and in
  MASTER_PLAN §2's table of units. The AVX2 path and the resolver count
  against that ceiling.
- its place in `scripts/build.sh`'s list of the units that `runtime.c`
  brings with it, for every profile that links strings, wasi included. The
  compiler's `--link` hands `scripts/build.sh` only `runtime/runtime.c`
  (`src/compile.ts`), so the pairing there is the one link change.
- tests that run the scalar, SSE2 or NEON, and AVX2 paths on the same inputs.

`-ffunction-sections -Wl,--gc-sections` drops it from a program that does not
call it, as it does for the other units. The instruction gate pins glibc to its SSE2 routines
(`PINNED_LIBC` in `bench/run.mjs`, [bench/README.md](../bench/README.md)), so
the runtime's own choice of path needs a way to be pinned too, such as an
environment variable the resolver reads. Otherwise a counted program's count depends
on the host.

**What it withdraws.** Nothing. It adds a `std` function, and every existing
program's IR is unchanged.

**What it does not buy.** Numeric code, and any scan whose step is not "find
the next byte from this set".

### 3.2 (b) `nish:simd`, fixed-width portable vectors

**What.** A builtin module with these types: `u8x16`, `i16x8`, `i32x4`,
`u32x4`, `f32x4` and `f64x2`. They are exactly 128 bits wide: the width SSE2,
NEON and wasm simd128 all share. The operations are functions, because
TypeScript has no operator overloading, and `a + b` on two objects is TS2365
before Nish sees the program:

- `load` and `store` from an array at an offset, bounds-checked as a whole
  vector
- `splat`, lane-wise arithmetic and comparisons into a mask
- `select`, `min` and `max`, and horizontal sums
- `extract` and `shuffle` with constant indices
- `bitmask`, the one operation a byte scanner needs to turn a compare into an
  offset

Each one lowers to LLVM vector IR (`<16 x i8>`, `<4 x float>`) or a
target-independent `llvm.*` intrinsic such as `llvm.vector.reduce.add`. None
lowers to `llvm.x86.*` or `llvm.aarch64.*`.

**TypeScript reading.** Under Node a vector is a small frozen object of lanes,
and `runtime/nish.mjs` gains the module. That would be the third `nish:`
import the prelude resolves, after `nish:unsafe` and `nish:secret`
([RUN_UNDER_NODE.md](RUN_UNDER_NODE.md)). Floats are class A: `f64` lanes are
`number`, and `f32` lanes use `Math.fround` on every result, as scalar `f32`
does. Integer lanes are the hard part. An LLVM vector `add` wraps, but Nish's
scalar `+` traps on overflow (#426). Making lanes trap would add an
overflow-mask reduction to every operation, which costs the speed the type
exists for. So integer operations wrap, and their names say so (`addWrapping`,
`mulWrapping`), the way `nish:unsafe`'s `wrappingAdd` does. Their reading is
then `| 0`, `Math.imul` or a `& 0xff` mask on each lane: class A, with no
ledger row. Under Node this is slow, an object for every vector. That is the
right side to pay on ([wp33](wp33-round-trip.md) §9).

**wasm and N-API.** With `-msimd128` these lower to simd128 instructions.
Without it, LLVM splits each vector into scalars, which is correct and slow.
Vectors do not cross the host boundary. An exported signature that names one
is refused, the way `wasmSkipReason` (`src/interop-wasm.ts`) already leaves
out the types the loader cannot carry ([wp8](wp8-interop.md)), and the refusal is a negative test.

**Checker rules a type family needs, each with a negative test:**

- a vector in an exported, N-API or wasm signature is refused
- a non-constant lane index to `extract` or `shuffle` is refused
- mixing lane types without an explicit `bitcast` is refused
- a vector as a `Map` key is refused
- `Secret<T>` does not take a vector at first (§6)
- an array of vectors gets a layout pinned by `tests/layout`, because it is
  contiguous storage the C header has to describe

**Cost.** Large. It adds a type family across the checker, the emitter, the
side tables, the `.ll` goldens, `nish.d.ts`, `nish.mjs` and the cookbook. It
is also a permanent part of the language: on 0.x a later change to a lane rule
is a breaking minor, and after 1.0 a major.

**What it withdraws.** Nothing. A `nish:` specifier that did not resolve
before now resolves.

**What it buys.** Hand-vectorised kernels that LLVM does not find, such as
mat-vec in `spectral`, ChaCha20's four-lane quarter round, or a 16-byte
compare-and-bitmask scan. Every one of them stays inside the baseline ISA.

### 3.3 (c) Explicit target intrinsics

**What.** These would expose `llvm.x86.*` and `llvm.aarch64.*` operations, or
a C-header-style set like `_mm_cmpeq_epi8`, to programs.

**Why not.** Each intrinsic only exists on one instruction set, so a program
that uses one no longer compiles for every `--target` that `src/target.ts`
knows, and its IR is no longer target-neutral. Its only TypeScript reading is
an emulator of that instruction. That is class D in
[wp33](wp33-round-trip.md) §2's terms, which rule 2 there refuses. The
constant-time checker reads the baseline CPU only. [CT-5 and CT-6](security/ct-verification.md)
record BMI2 and AVX-512 instructions it had to be taught to model although CI,
building for the baseline, never emits them, and CT-16 leaves the rest open.
Every intrinsic above the baseline widens that gap. The one strong case is AES-NI and
PCLMULQDQ for `std/crypto/aes.ts`, which is bitsliced today so that no table
is ever indexed. That case belongs under §3.1 as a runtime kernel and §6's
rules. It does not need a language surface. **Declined** (§9).

### 3.4 (d) Auto-vectorisation, and the `-march` policy

**What.** Two separate things:

1. **Loop shapes.** The checked default keeps an overflow exit in a reduction,
   and a bounds check adds a second exit. Each one blocks the vectoriser
   (§2.1). Every proof that removes one gives a counted loop back, which is
   what WP15's bounds pipeline and the `nsw` proofs of #426 already do. This
   needs no new surface. It is ongoing, and each step is measured on its own.
2. **A CPU level.** This would be an opt-in `--cpu` flag. Its values would be
   levels like `x86-64-v2`, `x86-64-v3` and `armv8.2-a`, plus `native` for a
   binary that never leaves the machine that built it. It passes `-march` to
   clang for the module and the runtime alike.

**TypeScript reading: class A.** The source does not change, and neither does
what any operation means, provided nothing is fused. The emitted IR carries no
`contract` flag, but clang compiles C with `-ffp-contract=on`, so on a level
with FMA `runtime.c`'s float code could round differently. The flag therefore
also passes `-ffp-contract=off` for the runtime. `-ffast-math` stays refused,
as [bench/README.md](../bench/README.md) refuses it for C.

**What it buys.** §2.3 bounds it: about 10–12% on nbody and vec3 for Rust, and
nothing on spectral or sieve.

**What it withdraws.** Nothing, as long as it stays a flag. Making it the
default would withdraw something real: a release binary that dies with
`SIGILL` on an older CPU. §5 refuses that.

---

## 4. The rolling freeze and `src/`

`src/` is built by the last release, so it may use a new construct only from
the release that ships it (CLAUDE.md). For (a), the lexer can call the
`std/text` function from the release after it lands. Until then, `src/`'s
self-compilation time is the place to measure what it would buy:
`scripts/bootstrap.sh --verify`, before and after. For (b), the same rule
applies, and the lexer is unlikely to need it if (a) is enough. (d) touches no
source, so `src/` gets its loop shapes on the next bootstrap.

---

## 5. The target policy

- **The default target stays the baseline**: SSE2 on x86-64, ARMv8-A with NEON
  on AArch64. This keeps three things true. A release binary runs on every
  machine of its triple. The instruction gate counts the same code on every
  host. The constant-time checker reads what ships.
- **Wider code is chosen at run time, inside the runtime** (§3.1). This is the
  answer simdjson and glibc give, and the only one that keeps a single binary
  per triple.
- **Asking for a wider target is opt-in, and is a flag** (§3.4). The level a
  binary was built for is recorded where a deployer can read it, such as the
  capability report ([wp35](wp35-capabilities.md)).
- **wasm.** `-msimd128` is a level for the wasm and wasi profiles, behind the
  same flag. Node 22, the version the suite runs, has simd128, but a host that
  lacks it refuses the whole module, so the default stays without it until a
  measured stage says otherwise.
- **The prebuilt `nish` compiler** ([wp12](wp12-release.md)) stays baseline. It
  gets its speed from (a) through the lexer, not from a wider target.

---

## 6. `Secret` and constant-time code

Byte search is variable-time on purpose: it stops at the first match.
`src/secret.ts`'s `isPureRuntime` lists the runtime symbols that `expose` may
reach. It already lists `nish_str_index_of`, because the list is about
effects, not about timing. A new kernel goes on that list only with a reason
written beside it, and it is documented as variable-time. `std/crypto` must
not call it on secret data. The asm check only reads the fixtures it names,
so that rule rests on review, as every loop in `std/crypto` does today
([LANGUAGE.md](LANGUAGE.md#constant-time-ctselect-and-cteq)).

(b) is the option that suits constant-time code. A fixed-width lane operation
has no data-dependent exit, and at 128 bits it stays inside the baseline ISA
the checker reads. A wipe cannot reach a vector register, though, so a vector
holding key material would need a record in its area's audit, as ECC-2 and
X509-7 have for scalars. `Secret<T>` does not take a vector until that record
exists. (c) and (d) both leave the checker's reach: CT-16 is open for exactly
that reason. So the `--cpu` flag of (d) ships only once `tests/ct-asm.js`
reads each level the flag accepts (§7 S2). Refusing the flag for programs
that import `std/crypto` is not offered instead: a package can reach
`std/crypto` through another package, and the checker's reading, not an
import rule, is what the constant-time promise rests on.

---

## 7. Stages, and the bar each must clear

Every stage keeps [wp33](wp33-round-trip.md) §1 rule 6. The `.ll` goldens of
programs that do not use the stage do not move, and `node bench/run.mjs
--instructions --check` passes with `bench/instructions.json` unchanged. Every figure comes
from the same machine, as a minimum and a median of at least seven runs, from
a loop whose input changes on every iteration and whose answer is folded into
a printed checksum.

| Stage | What | Ships only if |
| --- | --- | --- |
| **S0** | Measurement, nothing built. It records the baselines that S1–S3 are judged against: `bench/json` after #507's stage 3, `bench/scan.ts` natively and as wasm, nbody, vec3 and spectral at the baseline and with `-march=x86-64-v3` on the same `.ll`, and `scripts/bootstrap.sh --verify`. | It is written into this note's §2.3 with the commit it was taken at. **Done**: [S0: the baselines](#s0-the-baselines), at `97210d5` and `c4dd861`, except `bench/json`, pending #507. |
| **S1** | (a): the find-first-of-a-set kernel, its `std/text` function and the compiler's recognition of it. `std/json`'s structure scan and string skip move onto it. | `bench/json` with `jsonFields` is **at least 1.5x faster** than S0 on the same machine: from about 90 ms to about 60, between typed serde and yyjson. None of #507's non-benchmark shapes is slower: a compiler `--json` line, a 50-key object with the field last, a miss, and a line of short strings only. The kernel's three paths agree on a fuzzed corpus. The runtime stays within its budget. |
| **S1b** | (a): the block classifier, only if S1 misses its `bench/json` bar | It reaches S1's `bench/json` bar where S1 alone did not, under S1's other conditions. |
| **S2** | (d): the `--cpu` flag | A **≥10%** gain at one level on at least one of nbody, vec3 or spectral, with no loss on the others. `tests/ct-asm.js` reads every level the flag accepts, and its fixtures pass at each one (§6). |
| **S3** | (b): `nish:simd` | A kernel written with it is **≥1.5x** faster than the same kernel in scalar Nish at the default target. It must do that on a numeric program from `bench/` and on a byte scan that S1's kernel cannot express (`bench/scan.ts`'s depth counting). Every operation has a golden, a negative test and a Node reading checked by a native round trip. |
| **S4** | `src/`'s lexer on S1's function, from the release after S1 | `scripts/bootstrap.sh --verify` is measurably faster, and its fixed point is reached. |

S0 comes first, because every later bar is a ratio against it. S1 comes before
S3 because it is cheaper, withdraws nothing, and is aimed at the gap that was
measured. S2 is independent and can be taken at any point after S0. S3 waits
for S1, because S1's result says whether the byte half of S3 is needed at all.

---

## 8. Decisions

The owner took all four on 2026-10-09, each as recommended. The reason
beside each is the one the recommendation gave, and it is the reason the
decision stands on: a stage that finds it untrue comes back here before it
builds anything else.

| # | Question | Options | Decided |
| --- | --- | --- | --- |
| Q1 | The SIMD surface | (a) runtime kernels behind `std`; (b) `nish:simd` types; (c) target intrinsics; (d) auto-vectorisation and a CPU flag | **(a) first, (d) beside it, (b) on its bar, (c) declined.** (a) is S1, (d)'s flag is S2 and ships only on its bar, (b) is S3 and waits for S1's result (§7), and (c) is in §9. |
| Q2 | The default target | baseline; a newer level (`x86-64-v2`); `native` | **Baseline.** Wider code is chosen at run time in the runtime, or by an opt-in flag. |
| Q3 | Integer lanes in (b) | wrap, named so; trap, as scalars do | **Wrap, named so.** A trapping lane costs a mask reduction per operation, and wrapping by name keeps the reading class A. |
| Q4 | Vector width in (b) | 128 bits only; 128 and 256; scalable | **128 only.** It is the width every target shares, simd128 included. Wider work is the runtime's job (§3.1). |

---

## 9. Declined

- **Target intrinsics as a language surface** (§3.3). They are class D, and
  they are tied to one ISA.
- **A wider default target** (§5). It breaks the release binary on older
  machines, and the instruction gate and constant-time checker with it.
- **`-ffast-math` or contraction under any flag.** Its answers change with the
  optimiser, which no TypeScript reading can match.
- **A C JSON parser in the runtime.** The kernels in §3.1 are byte primitives
  any scanner can use. A whole parser in C would put `std/json` beside the
  language rather than in it, and help nothing else.
