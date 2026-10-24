# WP7: Runtime and intrinsics

**Status: complete** (0.1.0). It added the `Math.*` intrinsics, the `i64` type
and explicit conversions, `process.exit`, synchronous file I/O, JavaScript
number formatting, `process.argv`, `parseInt` / `parseFloat` / `Number` on
strings, and the `wasi` build profile. Later work superseded several parts:

- signed overflow, `i64` included, is a checked panic by default (#426);
- the shortest-digits search was replaced by a port of Ryu;
- the runtime grew from one translation unit to nine, each with its own
  measured budget (below).

The living reference for every builtin is [LANGUAGE.md](LANGUAGE.md) ("Math",
"Numeric conversions", "Files", the `nish:process` module). This note keeps the
decisions behind them and the runtime size budget, which `tests/run.js`
enforces.

Each builtin is declared once in `src/builtins.ts` and `src/runtime.ts`, with
its signature, its lowering, the attributes on its callee, and the
`MemoryEffect` it contributes to the purity fixpoint in `src/attributes.ts`.
Identifier builtins (`toI32`, `readFileSync`) are consulted only when no user
function of that name is in scope, so a user's function shadows the builtin. A
module declares only the runtime symbols and intrinsics it uses.

## Builtins

**Math.** `sqrt`, `floor`, `ceil`, `trunc`, `sin`, `cos`, `exp`, `log` and
`pow` are `llvm.*.f64` intrinsics, declared `nounwind willreturn readnone`, a
subset of what LLVM itself attaches. A function made of arithmetic and these
intrinsics stays `readnone`. They take `f64`, so `Math.sqrt(n)` on an i32
`number` is rejected (`` `Math.sqrt` requires an f64 argument, got i32 (use
--number-mode f64 or toF64(x)) ``). A literal argument is typed `f64` by
context. `sin`, `cos`, `exp`, `log` and `pow` become libm calls, so every
native profile links `-lm`.

- **`Math.round`** is `floor`, then `x - floor(x) >= 0.5`, then `select`. This
  matches JavaScript's round-half-up, which `llvm.round` (half away from zero)
  does not, and is exact where `floor(x + 0.5)` is not:
  `0.49999999999999994` rounds to `0`. A `llvm.copysign.f64` then gives the
  result the operand's sign, so `Math.round(-0.3)` is `-0`, as in JavaScript.
- **`Math.abs` / `min` / `max`** accept any numeric type. Integers lower to
  `llvm.abs` (with `i1 false`, so the minimum value wraps to itself rather
  than becoming poison) and `smin` / `smax`. Floats lower to `fabs`, and
  `min` / `max` answer as JavaScript's do: a NaN operand gives NaN and `-0`
  orders below `+0`. Natively that is a NaN test, a compare and select, and a
  sign-bit pick on equal operands; wasm32 keeps `llvm.minimum` /
  `llvm.maximum`, its `f64.min` / `f64.max` (`tests/cases/math_minmax_float`,
  and `f64_minmax_nan` and `f64_round_negzero` in the differential corpus).
- **`Math.random`** is xorshift64\* over one state word, seeded lazily from
  the time and the pid (the monotonic clock under WASI, which has no
  `getpid`). Its effect is `write`, so two calls are never merged.

**Conversions.** `toI32`, `toI64` and `toF64` emit nothing when the type is
already right. Integer narrowing wraps (`toI32(5000000000)` is `705032704`).
The f64-to-integer direction uses `llvm.fptosi.sat`, so NaN becomes `0` and
out-of-range values clamp (`toI32(5e10)` is `2147483647`), as Rust's `as`
does. JavaScript's modulo-2³² `ToInt32` is not followed, and a plain `fptosi`
would be poison for the same inputs.

**`process.exit(code)`** calls `nish_exit`, which is `noreturn` and calls libc
`exit`, and is followed by `unreachable`. The checker treats it as a
terminator for definite-return analysis. `FunctionFacts.callsNoReturn`
propagates over the call graph and removes `willreturn` from every function
that can reach it. A fatal runtime error (out of memory, an I/O failure) is
the exception: it also exits, but callers keep `willreturn`. That convention
dates from WP3, and only an *intended* non-return clears the attribute.

**Files.** `readFileSync`, `writeFileSync` and `appendFileSync` are globals,
not `fs` imports. Their string parameters are `nocapture readonly`, so passing
a parameter to one of them does not make it escape. A failure prints
`nish: cannot read <path>` and exits 1. All three now live in
`runtime-os.c`, and the security audit later added NUL refusal and
`O_NOFOLLOW` ([security/runtime.md](security/runtime.md)).

**`process.argv`** is a load of `@nish_argv`, which `nish_argv_init` fills from
`@main`'s `argc` / `argv` before any user code runs. It is a `string[]`, so
every array operation applies. It is built with `malloc` rather than in the
arena, so `Arena.reset()` cannot invalidate it. Index 0 is the program path.
The checker enforces three rules:

- it needs an entry `main` (`reject_argv_no_main`);
- it is read-only (`reject_argv_assign`, `reject_argv_push`), although a store
  through an alias is not caught;
- reading it is a memory read, so a reader is at most `readonly`.

### String to number

`parseFloat`, `Number(s)` and `parseInt` are one runtime symbol,
`nish_parse_number(s, mode)`, because every extra function costs an unwind
entry against the budget. Its effect is `write`, because `strtod` and `strtoll`
set `errno`. The string parameter stays `readonly nocapture`. `Number` on a
number or a `boolean` is a plain conversion with no callee.

- Whitespace is ASCII only (`strspn`), not JavaScript's Unicode set.
- **`parseFloat`** reads the longest decimal literal or `Infinity`, using
  `strtod` once spellings JavaScript rejects (`inf`, `nan`) are ruled out.
  `strtod` still reads `0x1A` as `26` where JavaScript gives `0`. Guarding
  that would have cost about 25 bytes, so it is a documented deviation.
- **`Number`** requires the literal to be the whole string, apart from
  surrounding whitespace. A blank string is `0`. Hex agrees with JavaScript,
  but `0b` / `0o` give `NaN`.
- **`parseInt`** is `strtoll(s, 0, 10)`, saturated into `i32` by
  `llvm.fptosi.sat`. No digits gives `0`, since an `i32` has no `NaN`, and the
  automatic hex prefix is not reproduced.

`runtime/shim.mjs` implements the runtime's grammar rather than JavaScript's,
so the differential harness agrees with the native build (`parse_numbers`,
`parse_strings`; `parse_argv_sum` agreed too until #426, and is now a known
failure because its sum overflows `i32`, which panics natively).

## The `i64` type

`i64` is a first-class integer (`alloca i64, align 8`, `noundef`), never the
lowering of `number`. Its arithmetic follows the same overflow rule as `i32`:
a checked panic unless the compiler proves the result fits (#426). Wrapping is
available through `wrapping*` from `nish:unsafe`, or under the deprecated
`--wrapping` flag. There is no implicit widening, so write `x + toI64(n)`.
`console.log` and template holes accept it through `nish_str_from_i64`.

**Numeric literals are typed by context.** A literal takes the type its
immediate context demands:

- an annotated initializer;
- a `return`;
- a user-call argument;
- the other operand of a binary operator, or of `Math.min` / `max`;
- `f64` for the f64-only `Math` functions and `toF64`;
- `i32` for `process.exit`.

Anywhere else it takes the mode's default type. In an `i64` context the
literal must satisfy |n| ≤ 2⁵³, because a larger one has already been rounded
to a double by the parser.

## JavaScript number formatting

`nish_str_from_f64` prints exactly what `Number.prototype.toString` prints:

- `NaN`, `0` for both zeros, `±Infinity`;
- otherwise the shortest round-trip digits, laid out by ECMA-262's
  `Number::toString` (plain digits up to 10²¹, `0.000ddd` down to 10⁻⁶,
  otherwise `d.ddde±X`).

WP7 found the digits by trying `snprintf("%.*e")` and `strtod` at each
precision from 1 to 17. That is now a port of Ryu (`runtime/LICENSE-ryu`,
`THIRD_PARTY_NOTICES.md`). The search was slow, and it was also *wrong* for
values like `7.120236347223045e-307`, where the correctly rounded k-digit
string is not the shortest one that round-trips. Ryu's two power-of-five
tables are about 9.9 KB of `.rodata`, which only a binary that formats a
double links. `tests/runtime-test.c` checks the formatter against
`node -p "String(x)"`.

## Runtime additions and budget

**The metric** is the sum of every `.text*` section of `clang -Oz -c <file>`,
as `size -A` reports it, with clang 18.1.3 on linux-x64. It covers every
`.text*` section and not just `.text`, because cold code goes into
`.text.unlikely.` and a linked binary pays for that too. Source bytes and the
`text` column of plain `size` are not limits: they count comments, `.eh_frame`
and the Ryu tables. **The gate is `tests/run.js`** (`node tests/run.js
budget`). Each failure names its file, the measurement, the budget and the
constant to raise. The constants live in `tests/runtime-budgets.js`, which
`scripts/size-report.sh` reads too, so the report CI attaches prints one row
per line of the table below with the same ceiling, and the gate fails if it
does not. The gate is a counted skip off linux-x64 or without `size`,
because a byte-exact ceiling is a fact about one target and one compiler.

**The rule.** Each ceiling is set at the next 256-byte boundary above a fresh
measurement. A raise lands in the commit that needs it, with its measurement
recorded here. A new surface gets its own translation unit and its own ceiling
rather than borrowing room from an existing one. `-ffunction-sections
-Wl,--gc-sections` drops every function a program does not call, so each
file's cost is paid only by programs that use it: `examples/hello.ts` at the
`size` profile was 4,680 bytes, byte-identical, before and after each split.

| File | Subject | Budget (constant) | Measured 2026-10-05 |
| --- | --- | ---: | ---: |
| `runtime/runtime.c` | the core: arena, strings, arrays, formatting, `argv`, `Math.random`, panics, `nish_wipe` | 3,698 (`RUNTIME_TEXT_BUDGET`) | 3,698 (2026-10-23) |
| `runtime.c -DNISH_THREADS=1` | the same with a `_Thread_local` arena and seed (`--threads`), and the claim that lets only the first panic print | 3,899 (`RUNTIME_THREADS_TEXT_BUDGET`) | 3,899 (2026-10-23) |
| `runtime/runtime-os.c` | syscall wrappers: files, directories, subprocesses (`spawnSync`, and `spawn`, `kill`, `waitPid`), `getenv`, the clock, `realpath`, platform, the CPU count and physical memory | 2,560 (`RUNTIME_OS_TEXT_BUDGET`) | 2,383 (2026-10-20) |
| `runtime/runtime-parallel.c` | the sequential fallback (and WASI) | 768 (`RUNTIME_PARALLEL_TEXT_BUDGET`) | 610 (2026-10-16) |
| `runtime-parallel.c -DNISH_THREADS=1` | the partitioner, a scope's tasks, a lock's contended path, channels and the worker pool | 2,560 (`RUNTIME_PARALLEL_THREADS_TEXT_BUDGET`) | 2,522 (2026-10-20) |
| `runtime/runtime-host.c` | wall clock, entropy, mtime, signals, RT-9 ownership | 768 (`RUNTIME_HOST_TEXT_BUDGET`) | 764 |
| `runtime/runtime-net.c` | `nish:net` sockets, `SO_REUSEPORT` listeners, UDP, the readiness loop | 2,560 (`NET_TEXT_BUDGET`) | 2,335 (2026-10-20) |
| `runtime/runtime-simd.c` | byte searches a vector at a time: `nish_str_index_of_any`'s and `nish_regex_scan`'s scalar, base and AVX2 paths and their resolvers ([wp38](wp38-simd.md) S1) | 2,560 (`RUNTIME_SIMD_TEXT_BUDGET`) | 2,337 (2026-10-23) |
| `runtime/runtime-aes.c` | AES-GCM on AES-NI and PCLMULQDQ: the key schedule with H's powers, one block, GCTR, GHASH and `nish_aes_hw` ([wp38](wp38-simd.md) S5) | 2,560 (`RUNTIME_AES_TEXT_BUDGET`) | 2,532 (2026-10-11) |
| `runtime/runtime-cross.c` | the copies at a join: a task's or a chunk's `string` or scalar array out of its arena and into the taker's, every string a `Channel<string>` sends, a map element kept as its chunk rewinds, and the copies a `Mutex` owns | 1,536 (`RUNTIME_CROSS_TEXT_BUDGET`) | 1,427 (2026-10-17) |
| `runtime-cross.c -DNISH_THREADS=1` | the same, with the lock over the set of a `Mutex`'s copies | 1,536 (`RUNTIME_CROSS_THREADS_TEXT_BUDGET`) | 1,508 (2026-10-17) |
| `runtime/runtime-term.c` | `nish:term`: stdin's non-blocking read and wait, `isatty`, the window size, raw mode and its restore | 1,536 (`RUNTIME_TERM_TEXT_BUDGET`) | 1,419 (2026-10-23) |

**How the ceilings moved.**

| Date | Change | Ceiling |
| --- | --- | --- |
| WP7 | one file, `.text` alone; 2,583 bytes after argv and parsing | 4,096 |
| 2026-09-12 | `.text*` sum; the tree had drifted to 4,154 unmeasured, plus `readdir`, `spawnSyncTo`, `monotonicNanos` = 4,670 | 4,864 |
| 2026-09-12 | split by subject: core 3,480, os 1,190 (sum unchanged) | 3,584 + 1,280 |
| 2026-09-12 | the threads build measured separately (3,605, above the core's ceiling) | 3,840 |
| 2026-09-18 | `runtime-parallel.c` (49 / 482) | 256 / 512 |
| 2026-09-20 | `nish_realpath` (157 bytes) | os 1,536 |
| 2026-09-27 | wp29 P2's scope tasks (286 / 901) | 320 / 1,024 |
| 2026-09-29 | `runtime-host.c` (571); `runtime-net.c` (853) | 768; 1,024 |
| 2026-09-30 | UDP (1,782), then the readiness loop (2,071) | net 2,048, then 2,304 |
| 2026-10-11 | wp29 P3's channels (597 / 1,403; 304 / 954 with the lock alone) | 768 / 1,536 |
| 2026-10-02 | security audit (length limits, `nish_cpath`, `O_NOFOLLOW`, RT-9, one cold `nish_oom`) | none moved |
| 2026-10-03 | `nish_wipe` (#385): 3,583 → 3,604 | core 3,605 |
| after 0.16.0 | `nish_panic_overflow` (#426): 3,606 | core 3,606 |
| 2026-10-09 | `runtime-simd.c` (675), wp38 S1 | simd 768 |
| 2026-10-11 | `runtime-aes.c` (2,532), wp38 S5 | aes 2,560 |
| 2026-10-11 | the worker pool (#586): `nish_pool_disable` in the fallback (610), the pool, the core count and `NISH_NUM_THREADS` in the threads build (2,660) | parallel threads 2,816 |
| 2026-10-12 | `nish_panic` (#611): one call for `panic`'s message and exit, 3,606 → 3,622; its claim, threads build only | core 3,622 |
| 2026-10-16 | `nish_write` retries `EINTR` (#611), so a panic's message is not cut short by a handler without `SA_RESTART`: core 3,622 → 3,656, threads 3,840 → 3,860 | core 3,656, threads 3,860 |
| 2026-10-16 | the newline too, and `nish_die` through the same loop rather than `fputs` (#611): core 3,656 → 3,684, threads 3,860 → 3,885 | core 3,684, threads 3,885 |
| 2026-10-16 | `runtime-cross.c` (1,170 / 1,235), threads-complete's copy-at-join; folded into `runtime-parallel.c` it measured 1,786 / 3,889 | cross 1,280 / 1,280 |
| 2026-10-17 | threads-complete's adoption (#686): 1,196 / 1,277 → 1,427 / 1,508. The join's copy-back below 64 KB, so a small map in a loop stops growing the caller's chunk list, is 205 of the 231 bytes (`nish_cross_adopt` 51 → 256); `nish_cross_end` recording a block's use and `nish_cross_keep`'s doubling sizes are the rest. Nothing shrank first: the file already sat at 1,277 of 1,280 threaded, and its next largest function, the guard's kept set (`nish_kept_put`, 225), is the `Mutex` stage's, unchanged here. `runtime-parallel.c`'s thresholds and idle trim (30 and 110 bytes; 2,805 threaded) fit its ceiling | cross 1,536 / 1,536 |
| 2026-10-17 | the idle trim reaches the workers' arenas (#686): `runtime-parallel.c` threaded 2,805 → 2,900. `malloc_trim(0)` cuts back only the main arena's top, so a parked worker lowers the trim threshold, frees a 16 MB block through its own arena and then trims, and the next region restores it (`nish_pool_drain` 381 → 441, `nish_jobs_run` 572 → 607). Four maps of 1.2 million strings on four threads idled at 82 MB before and 2.3 MB after (`tests/link/par_map_idle`). Dropping the 64 MB threshold instead took those maps from 440–466 ms to 586–700 ms | parallel threads 2,944 |
| 2026-10-20 | `tcpListenFlags` (`SO_REUSEPORT`): `runtime-net.c` 2,303 → 2,335 | net 2,560 |
| 2026-10-20 | a divided region's pieces claimed dynamically (threads-followups): `runtime-parallel.c` threaded 2,900 → 3,097. Up to eight pieces a thread off an atomic counter, the arena rewound between them (`nish_par_run` 21 → 102, `nish_par_piece` 49 and `nish_par_run_lead` 21 new, `nish_parallel_range` 245 → 280); bench/par-heavy.ts at four threads 846 → 792 ms | parallel threads 3,328 |
| 2026-10-20 | a map element's rewind keeps the chunk its body grew (threads-followups): `runtime-cross.c` 1,444 / 1,513 → 1,552 / 1,631, all of it `nish_cross_keep` (262 → 370) with `nish_rewind` inlined. A mark at the end of a full chunk had every element's body `malloc` a 64 KB chunk and the release `free` it; the newest 64 KB chunk is now kept, emptied, in front of the mark's. 1M short strings at one thread 72.8 → 54.9 ms, inside the loop's band; the file's other functions are the join's and the guard's, unchanged | cross 1,664 / 1,664 |
| 2026-10-20 | WP34 N12's `spawn`, `kill`, `waitPid`, `availableParallelism` and `totalMemory`: `runtime-os.c` 1,530 → 2,383. The four process and memory builtins are 276 bytes (`nish_spawn_start` split from `spawnSync` +31, `nish_spawn_child` 9, `nish_kill` 53, `nish_wait_pid` 134, `nish_total_memory` 49); the other 577 is the CPU count's reading (sysconf, affinity, cgroup, `NISH_NUM_THREADS`), moved from `runtime-parallel.c` so that `availableParallelism` works without `--threads`. `runtime-parallel.c` threaded 3,097 → 2,522; the two files together grew by 278 | os 2,560, parallel threads 2,560 |
| 2026-10-23 | `nish_fatal_exit`: the panics' `_exit(1)` behind one noreturn call that runs `nish_fatal_hook` first, so raw mode is restored after a failed check: core 3,684 → 3,698, threads 3,885 → 3,899. Calling the hook from `nish_panic_claim` instead measured 3,752 / 3,900, because every call site kept more registers live across it. It stays in the core rather than a unit of its own because `runtime.c` links alone and its panics call it; defined in `runtime-term.c` the core measured 3,675, but a lone `runtime.c` no longer linked | core 3,698, threads 3,899 |
| 2026-10-23 | `runtime-term.c` (1,319), `nish:term` | term 1,536 |
| 2026-10-23 | `waitStdin` after a caught Ctrl-Z asks again for what is left of a deadline on the monotonic clock, rather than for what `select` left in its timeout, which no system promises after an error: `runtime-term.c` 1,319 → 1,419, all of it `nish_stdin_ready` (161 → 261). The clock is read only for a positive timeout, once before the first `select` and again only after a stop, so `readStdin`'s zero-timeout question and a wait for ever never ask it. A program that waits also links `runtime-os.c`'s `nish_monotonic_nanos` (36 bytes), which this file's ceiling does not count | term 1,536 |
| 2026-10-23 | `nish/regex`'s match-start scan, `nish_regex_scan`: `runtime-simd.c` 675 → 2,337. The scan is the 1,631: the AVX2 path 1,323 (one copy each for a window of 1, 2 and 3 positions, so the tables stay in registers; a width of 4 shares the third), the scalar path 202, its resolver 97 and the entry point 9. `indexOfAny`'s resolver now calls `nish_simd_choose` (158) rather than inlining it (203 → 76), so the two share one CPU question. Out of line, the candidate check would save 76 bytes (2,261) but took `/example/` over the bench prose from 0.195 to 0.215 ms, against 0.199 for Rust's `regex` crate, so it stays inlined | simd 2,560 |

**Why the split by subject.** The criterion is whether a function wraps a
system call, whether the operating system is its subject, because that same
question decides whether a builtin has to be C at all. It is also the surface
that grows as the language reaches further. The core is a closed set: its
ceiling should come down and never go up, and its last two raises were each
the exact measured size of what was added. Three placements could have gone
the other way:

- `nish_random` stayed in the core, because its time-and-pid seed is used
  once;
- `nish_argv_init` stayed in the core, because it makes no system call;
- `nish_platform` / `nish_arch` moved, because their subject is the host.

The threads build is a separate ceiling rather than a raised shared one, so
that the default build is not handed room it has no use for. The default
build of `runtime-parallel.c` is gated too, so that nothing but a fallback is
linked by a program that never spawns.

**What the split costs a program.** `nish_readdir` now calls the arena across a
translation-unit boundary. With `-flto`, which both the `speed` and `size`
profiles use, the binaries are byte-identical. Without LTO, at `-O2`,
`io_readdir`'s `.text*` *fell* from 9,373 to 8,584 bytes. 4,000
`readdirSync` calls took 41 ms either way. `scripts/build.sh` pairs the other
files with any `runtime.c` it is handed, and `runtime.c` never calls into
them, so a link line that names only `runtime.c` still builds a program that
uses none of them. The freestanding `runtime/runtime-wasm.c` is a separate
file and has no budget.

### The vector unit

`runtime/runtime-simd.c` (wp38 S1, [wp38-simd.md](wp38-simd.md) §3.1) holds
the byte searches that read sixteen or thirty-two bytes at a time. Each one
has a scalar path, a base path on the vectors every machine of the target has
(SSE2 on x86-64, NEON on AArch64, simd128 on wasm only under `-msimd128`), and
on x86-64 an AVX2 path compiled with `target("avx2")`. A kernel is called
through a pointer that starts at its resolver, which picks a path on the first
call; `NISH_SIMD=scalar|base|avx2` pins the pick, and `bench/run.mjs` sets
`base` so that an instruction count does not depend on the host. Its 675
bytes are the scalar path 105, SSE2 189, AVX2 169, the resolver 203 and the
entry point 9.

The resolver asks `cpuid` itself rather than calling
`__builtin_cpu_supports`. That builtin reads libgcc's `__cpu_model`, and the
object that defines it runs a constructor at start-up in every program whose
link names it, kernel called or not: `examples/hello.ts` at `--profile speed`
went from 4,712 bytes to 10,000 and ran 374 more instructions with it. With
`cpuid.h`, which is inline assembly, hello measured byte-identical with and
without the unit on 2026-10-09. What `tests/run.js` pins on every run
(`node tests/run.js simd`) is the part of that which can regress: at the speed
and size profiles, the link map of hello names no symbol of the unit and no
libgcc CPU probe, while a program that calls the kernel keeps every path.

### The AES unit

`runtime/runtime-aes.c` (wp38 S5, [wp38-simd.md](wp38-simd.md) §3.1) holds
AES-128 and AES-256 in counter mode and GHASH on AES-NI and PCLMULQDQ, or on
the ARMv8 AES and PMULL instructions: four kernels the compiler calls in
place of four private functions of `std/crypto/aes.ts`, behind `nish_aes_hw`.
It has no portable path of its own; a machine without the instructions, and
`NISH_AES=soft`, run the bitsliced Nish code. Its 2,532 bytes are the key
schedule with H and its powers 594, one block 84, GCTR 654, GHASH 1,082 and
`nish_aes_hw` 118.

It is a seventh unit rather than more of `runtime-simd.c`, because the rule
above decides it: folded in, the two measured 3,207 bytes against
`runtime-simd.c`'s ceiling of 768, which would have to be raised, and a new
unit with its own measured ceiling is the rule's answer. Apart, a program that
searches text links no AES and one that speaks TLS no byte search.
`nish_aes_hw` asks `cpuid` itself for the reason the vector unit does, and
`node tests/run.js simd` holds hello, linked at the speed and size profiles
with and without the unit, to the same bytes.

`scripts/build.sh` pairs it with `runtime.c`, as it does the other six. Its
`--runtime-from` link needs an object for every unit it pairs, and `nish run`'s
runtime cache holds only the units `src/run-cache.ts` lists, so the pairing and
that list changed in one commit, the one in which the compiler first called the
unit (WP38 S5's lowering). A program that never reaches a seam of
`std/crypto/aes.ts` keeps none of it, by section GC.

### The copy-at-join unit

`runtime/runtime-cross.c` (threads-complete's copy-at-join) holds the copies
that let a `string` or a scalar array cross from one arena to another: out of a
task's arena when it returns, or a parallel chunk's when it finishes, and into
the arena of the thread that takes the answer; every string a
`Channel<string>` sends; and the copies a `Mutex` owns of the strings stored
through its guards. A map's chunk packs each element it answers into a
transfer block of its own, 4 KB doubling to 64 KB (`nish_cross_keep`), and
rewinds its arena to the element's mark, and after the join the caller links
the blocks into its arena as chunks when they hold 64 KB or more, or copies
the elements in and frees them when they hold less (`nish_cross_adopt`):
copying a large region's answers in costs one link per block, and a single answer of 64 KB or more is linked rather than copied by
`nish_cross_in`. An adopted block is freed by the release that would have freed
the copy. Adoption measured 1,196 bytes of `.text` (1,277 in the threads build,
where the transfer state is thread-local), and retired the sorted span table
and the `_range` pair a copy-out per slot needed; the copy-back for a small
join and the doubling block sizes took it to 1,427 (1,508).

Under glibc, `nish_pool_ready` raises `M_MMAP_THRESHOLD` to 32 MB and
`M_TRIM_THRESHOLD` to 64 MB, so a 1 MB temporary a task or an element builds,
freed at its release, is not returned to the kernel and faulted back in by the
next one: 200 such tasks took 314 ms at one thread and take 48 ms. These are
the values glibc's sliding thresholds reach by themselves once a chunk of 32 MB
is unmapped on a 64-bit target, so they move when memory is kept rather than
how much: the 0.18.0 release, which never set them, idled at 118–135 MB after
ten rounds of 8 tasks that each build a 16 MB temporary on 4 CPUs, and this
runtime idles at 68 MB before its trim. A worker that frees an arena larger
than one chunk waits for its next job with a one-second timeout, and on the
timeout calls `malloc_trim(0)` once before it parks for good: the same burst
then idles at 52 MB, and a 1 MB burst at 5.0 MB rather than 6.0, with no
change to the burst's own time (36–45 ms against 39–43). A region below its
grain runs as the loop it would have been, and keeps that loop's cost. The
thresholds cost 30 bytes of the threads build's `runtime-parallel.c` and the
trim 110 more. A pool with no worker, at one CPU or `NISH_NUM_THREADS=1`,
has no thread that parks, so nothing trims: what a join freed stays with the
process up to the 64 MB at which glibc trims the heap top itself. Trimming at
the end of each join instead took that idle 18 MB to 2 MB, but took ten joins of
eight 16 MB tasks from 93 ms to 121–138 ms, since each join faulted its
temporaries in again, and it did not fit the threads build's ceiling.

It is an eighth unit rather than more of `runtime-parallel.c`: folded in, the
copies took that file from 610 bytes to 1,786 against its ceiling of 768, and
2,665 to 3,889 in the threads build against 2,816. Both configurations define
them, because a task's arena is rewound once it returns whether it ran on a
thread of its own or on the calling thread at the join. `runtime.c` does not
include `nish.h`, so the arena chunk's layout, which both files walk, is pinned
by the same `_Static_assert`s in each. `scripts/build.sh` pairs the unit and
`src/run-cache.ts` lists it in one commit, as the AES unit's were. A program
that answers, sends or guards no string keeps none of it, by section GC.

### Checked arithmetic

When signed `+ - *`, negation and the loop steps became checked panics (#426),
the core gained `nish_panic_overflow(op)` ("attempt to add with overflow" and
its siblings, exit 1). It has to be in the core, because any program with an
unproven `+` can call it. The first shape tried was a second function with its
own four strings, which cost 23 bytes. Sharing one table of six messages with
`nish_panic_div` cost 2 bytes (3,604 → 3,606, and 3,729 → 3,731 threaded). The
core was one byte under its ceiling, so the ceiling moved by exactly the one
missing byte. A unit of its own would have added a file to every link line for
22 bytes of code.

### What FFI does and does not do to the budget

WP27's `declare function` lets a program call its own C, and
[wp27-ffi.md](wp27-ffi.md) §6 asks whether that makes the runtime an open set.
It does not, because the budgets measure what ships in every binary. A foreign
declaration adds a `declare` line and a link symbol to one program, and
nothing to any runtime file. What FFI *does* open is the set of C that a
*program* can reach. `docs/LANGUAGE.md` used to bound that set by having no
way to name a foreign function. WP27 removed that bound deliberately, and the
cost is paid in the attribute fixpoint rather than in bytes (wp27 §2).

## Linking

### WASI target

`--target wasm32-wasi` only pins the data layout. The `wasi` profile of
`scripts/build.sh` compiles the runtime against wasi-libc and links a command
module (`node examples/wasi-host.mjs` or `wasmtime` runs it):

- **Sysroot.** It looks in `WASI_SYSROOT`, `/usr/lib/wasi-sysroot`,
  `/opt/wasi-sdk/share/wasi-sysroot` and `/usr/share/wasi-sysroot`. Without
  one the script exits 2 and `tests/run.js` records a counted skip.
- **Builtins.** `strtoll` needs compiler-rt's `__multi3`. When clang has no
  wasm32 `libclang_rt.builtins` of its own, the script finds wasi-sdk's
  tarball, or uses `WASI_BUILTINS`, and links `-nodefaultlibs -lc` explicitly.
- **Entry.** wasi-libc's `_start` calls `__main_argc_argv`. `runtime.c`
  bridges it to the compiler's `@main` under `#ifdef __wasi__`, with a weak
  declaration so that a reactor build without an entry would still link.

`runtime.c` and `runtime-os.c` compile with `-Werror` under `__wasi__`, where
`nish_readdir` answers NULL and `nish_spawn_impl` answers -1. The freestanding
`wasm` profile does not use them; it uses `runtime/runtime-wasm.c`.

## Not in this package

- **`toString(x)`**: templates and `console.log` already convert.
- **`Math.min` / `max` with more than two operands, and a `-0` from
  `Math.round`.**
- **Parser deviations**: `parseInt(s, radix)`, automatic hex, `0b` / `0o` in
  `Number`, Unicode whitespace, and a `0x` guard in `parseFloat`. Each is a
  documented deviation, mirrored by the shim.
- **`process.env`**: still not provided. It later arrived as the `getenv(name)`
  call (WP19 R1), deliberately a call rather than member access
  (LANGUAGE.md).
- **A WASI reactor profile** (`_initialize` instead of `_start`). Not built.
