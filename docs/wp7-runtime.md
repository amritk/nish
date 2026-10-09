# WP7: Runtime and intrinsics

**Status: complete** (0.1.0). It added the `Math.*` intrinsics, the `i64` type
and explicit conversions, `process.exit`, synchronous file I/O, JavaScript
number formatting, `process.argv`, `parseInt` / `parseFloat` / `Number` on
strings, and the `wasi` build profile. Later work superseded several parts:

- signed overflow, `i64` included, is a checked panic by default (#426);
- the shortest-digits search was replaced by a port of Ryu;
- the runtime grew from one translation unit to six, each with its own measured
  budget (below).

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
  `0.49999999999999994` rounds to `0`. The one difference from JavaScript is
  that `Math.round(-0.3)` is `+0` here and `-0` there; both print `0`.
- **`Math.abs` / `min` / `max`** accept any numeric type. Integers lower to
  `llvm.abs` (with `i1 false`, so the minimum value wraps to itself rather
  than becoming poison) and `smin` / `smax`. Floats lower to `fabs` and
  `minnum` / `maxnum`. `minnum` returns the non-NaN operand where JavaScript
  returns NaN, and may return either zero for `min(0, -0)`. That is
  documented rather than patched, because the intrinsic is a single
  instruction on every target. The differential corpus keeps it as a known
  failure (`f64_minmax_nan`, and `f64_round_negzero` for the rounding case).
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
constant to raise. The gate is a counted skip off linux-x64 or without `size`,
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
| `runtime/runtime.c` | the core: arena, strings, arrays, formatting, `argv`, `Math.random`, panics, `nish_wipe` | 3,606 (`RUNTIME_TEXT_BUDGET`) | 3,606 |
| `runtime.c -DNISH_THREADS=1` | the same with a `_Thread_local` arena and seed (`--threads`) | 3,840 (`RUNTIME_THREADS_TEXT_BUDGET`) | 3,731 |
| `runtime/runtime-os.c` | syscall wrappers: files, directories, subprocesses, `getenv`, the clock, `realpath`, platform | 1,536 (`RUNTIME_OS_TEXT_BUDGET`) | 1,530 |
| `runtime/runtime-parallel.c` | the sequential fallback (and WASI) | 320 (`RUNTIME_PARALLEL_TEXT_BUDGET`) | 286 |
| `runtime-parallel.c -DNISH_THREADS=1` | the partitioner and a scope's tasks | 1,024 (`RUNTIME_PARALLEL_THREADS_TEXT_BUDGET`) | 905 |
| `runtime/runtime-host.c` | wall clock, entropy, mtime, signals, RT-9 ownership | 768 (`RUNTIME_HOST_TEXT_BUDGET`) | 764 |
| `runtime/runtime-net.c` | `nish:net` sockets, UDP, the readiness loop | 2,304 (`NET_TEXT_BUDGET`) | 2,303 |
| `runtime/runtime-simd.c` | byte searches a vector at a time: `nish_str_index_of_any`'s scalar, SSE2 and AVX2 paths and their resolver ([wp38](wp38-simd.md) S1) | 768 (`RUNTIME_SIMD_TEXT_BUDGET`) | 675 (2026-10-09) |

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
| 2026-10-02 | security audit (length limits, `nish_cpath`, `O_NOFOLLOW`, RT-9, one cold `nish_oom`) | none moved |
| 2026-10-03 | `nish_wipe` (#385): 3,583 → 3,604 | core 3,605 |
| after 0.16.0 | `nish_panic_overflow` (#426): 3,606 | core 3,606 |
| 2026-10-09 | `runtime-simd.c` (675), wp38 S1 | simd 768 |

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
