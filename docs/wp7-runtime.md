# WP7: Runtime and intrinsics

Math builtins as LLVM intrinsics, the `i64` type with explicit numeric
conversions, `process.exit` and synchronous file I/O, JavaScript-accurate
number formatting in the runtime, and (second round) `process.argv`,
string-to-number parsing (`parseInt`, `parseFloat`, `Number`), and the
`wasi` build profile. For every builtin: its TypeScript signature, the exact
lowering, the attributes on the callee, and its memory effect (what it does
to the purity of the function that calls it). Test cases are
`tests/cases/math_*.ts`, `i64_basic.ts`, `conversions.ts`, `io_files.ts`,
`process_exit.ts`, `argv_echo.ts`, `parse_numbers.ts`, plus the `reject_*`
cases listed at the end.

## Where the code lives

| Piece | Checker | Emitter |
| --- | --- | --- |
| Shared plumbing (`dottedName`, arity checks, `BuiltinCall` shape) | `src/checker/builtins.ts` | `src/codegen/emit/builtins.ts` |
| `Math.*`, `toI32/toI64/toF64`, `parseInt/parseFloat/Number`, literal typing | `src/checker/math.ts` | `src/codegen/emit/math.ts` |
| `process.exit`, `process.argv`, `readFileSync`, `writeFileSync`, `appendFileSync` | `src/checker/io.ts` | `src/codegen/emit/io.ts` |
| The `@main` wrapper (`nish_argv_init` call), `@nish_argv` in the `--runtime-decls` prelude | `src/compilation.ts` (`usesArgv`, `hasEntryMain`) | `src/codegen/emitter.ts` |
| The `wasi` profile and the runtime's `__wasi__` guards | `scripts/build.sh` | `runtime/runtime.c` |

Dotted callees (`Math.sqrt`, `process.exit`) are spread into the existing
`builtinCalls` / `builtinCallEmitters` tables next to `console.log`. Plain
identifier callees (`toI32`, `readFileSync`) go through a second pair of
tables, `builtinFunctions` (checker) and `builtinFunctionEmitters` (emitter),
consulted only when no user function of that name is in scope, so a user
`function toI32(...)` shadows the builtin. Declarations of runtime symbols
and intrinsics come from `src/codegen/runtime.ts`; a module declares exactly
the ones it uses (intrinsics are never part of the `--runtime-decls` prelude,
which documents the C ABI).

## Builtins

Effects are the `MemoryEffect` fed to the purity fixpoint in
`src/codegen/attributes.ts`: `none` keeps the caller `readnone`, `read` makes
it at most `readonly`, `write` clears both.

### Math (f64 only)

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `Math.sqrt(x: f64): f64` | `call double @llvm.sqrt.f64(double x)` | `nounwind willreturn readnone` | none |
| `Math.floor(x: f64): f64` | `@llvm.floor.f64` | same | none |
| `Math.ceil(x: f64): f64` | `@llvm.ceil.f64` | same | none |
| `Math.trunc(x: f64): f64` | `@llvm.trunc.f64` | same | none |
| `Math.round(x: f64): f64` | `floor` + compare + `select`, see below | `@llvm.floor.f64` as above | none |
| `Math.sin(x: f64): f64` | `@llvm.sin.f64` | same | none |
| `Math.cos(x: f64): f64` | `@llvm.cos.f64` | same | none |
| `Math.exp(x: f64): f64` | `@llvm.exp.f64` | same | none |
| `Math.log(x: f64): f64` | `@llvm.log.f64` | same | none |
| `Math.pow(x: f64, y: f64): f64` | `call double @llvm.pow.f64(double x, double y)` | same | none |
| `Math.PI: f64`, `Math.E: f64` | the constant (`0x400921FB54442D18`, `0x4005BF0A8B145769`) | n/a | none |

The argument must be `f64`. In the default i32 mode `number` is an `i32`, so
`Math.sqrt(n)` on a `number` is rejected with
`` `Math.sqrt` requires an f64 argument, got i32 (use --number-mode f64 or toF64(x)) ``.
A numeric literal argument is typed `f64` by context (`Math.sqrt(2)` works in
either mode, see "Numeric literals" below). `Math.PI` and `Math.E` are `f64`
in both modes; `const tau: f64 = Math.PI * 2` is fine under i32 mode.

**`Math.round`.** JavaScript rounds half toward +infinity: `Math.round(2.5)`
is `3` and `Math.round(-2.5)` is `-2`. That is neither `llvm.round.f64`
(half away from zero, gives `-3`) nor `llvm.roundeven.f64`, and
`floor(x + 0.5)` is wrong too: `0.49999999999999994 + 0.5` rounds up to `1.0`
in double arithmetic while JavaScript returns `0`. The emitted sequence is

```llvm
  %f = call double @llvm.floor.f64(double %x)
  %d = fsub double %x, %f
  %up = fcmp oge double %d, 0x3FE0000000000000     ; 0.5
  %f1 = fadd double %f, 0x3FF0000000000000         ; 1.0
  %r = select i1 %up, double %f1, double %f
```

`x - floor(x)` is exact for every finite double, so the comparison is exact.
NaN and both infinities pass through unchanged (the compare is false and
`floor` is the identity on them). The only observable difference from
JavaScript is the sign of a zero result: `Math.round(-0.3)` is `-0` there and
`+0` here; both print as `0`.

### Math (any numeric type)

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `Math.abs(x: i32): i32` | `call i32 @llvm.abs.i32(i32 x, i1 false)` | `nounwind willreturn readnone` | none |
| `Math.abs(x: i64): i64` | `@llvm.abs.i64(i64 x, i1 false)` | same | none |
| `Math.abs(x: f64): f64` | `@llvm.fabs.f64` | same | none |
| `Math.min(a: T, b: T): T` | i32/i64: `@llvm.smin.<T>`; f64: `@llvm.minnum.f64` | same | none |
| `Math.max(a: T, b: T): T` | i32/i64: `@llvm.smax.<T>`; f64: `@llvm.maxnum.f64` | same | none |

`Math.abs` returns the type of its argument. The `i1 false` operand of
`llvm.abs` makes `Math.abs(-2147483648)` wrap to itself instead of being
poison. `Math.min`/`Math.max` take exactly two operands of one numeric type
(`Math.min(1)` and `Math.min(x, 1.5)` with an `i32` `x` are errors). On
`f64` they use `minnum`/`maxnum`, which return the non-NaN operand when the
other is NaN (JavaScript returns NaN) and may return either zero for
`min(0, -0)`; this is documented rather than patched because the intrinsics
are single instructions on every target.

### Math.random

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `Math.random(): f64` | `call double @nish_random()` | `nounwind willreturn` | write |

`nish_random` is xorshift64\* over one global state word, seeded lazily from
`time(0)`, `getpid()`, and a constant, returning the top 53 bits scaled into
`[0, 1)`. It mutates the state, hence `write`: a function that draws random
numbers is never `readnone`/`readonly`, which is exactly right (two calls must
not be merged).

### Numeric conversions

| Signature | Lowering (by argument type) | Callee attributes | Effect |
| --- | --- | --- | --- |
| `toI32(x)` | i64: `trunc i64 to i32`; f64: `call i32 @llvm.fptosi.sat.i32.f64(double)`; i32: nothing | intrinsic: `nounwind willreturn readnone` | none |
| `toI64(x)` | i32: `sext i32 to i64`; f64: `@llvm.fptosi.sat.i64.f64`; i64: nothing | same | none |
| `toF64(x)` | i32/i64: `sitofp <T> to double`; f64: nothing | n/a | none |

The argument must be `i32`, `i64`, or `f64` (`toI32("x")` is rejected). The
f64-to-integer direction uses the *saturating* intrinsics so it is defined for
every input: NaN becomes `0`, values beyond the range clamp to the nearest
bound (`toI32(5e10)` is `2147483647`). This is the behaviour of a Rust `as`
cast, not JavaScript's modulo-2^32 `ToInt32`; a plain `fptosi` would be poison
for the same inputs. Integer-to-integer conversions wrap (`toI32(5000000000)`
is `705032704`). Same-type calls emit nothing.

### Process

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `process.exit(code: i32): void` | `call void @nish_exit(i32 code)` then `unreachable` | `noreturn nounwind` | write, `noreturn` |

Statement position only. The checker treats `process.exit(n);` as a
terminator for definite-return analysis, so a `number`-returning function may
end with it and nothing may follow it in the same block (`Unreachable code
after return`, the same diagnostic as after `return`). The emitter closes the
block with `unreachable` after the `noreturn` call. `nish_exit` calls libc
`exit`, so `atexit` handlers and stdio buffers of any C code in the binary are
flushed; the arena is simply abandoned to the OS.

`willreturn` promises that a call comes back, so every function that can
reach `nish_exit`, directly or through callees, loses it. `FunctionFacts` gained
`callsNoReturn`, propagated over the call graph in the same fixpoint as the
memory effects (`RuntimeFunction.noreturn` seeds it). In `process_exit.ts`
both `finish` (calls it) and `main` (calls `finish`) are emitted with just
`nounwind`.

### Files

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `readFileSync(path: string): string` | `call i8* @nish_read_file(i8* path)` | `nounwind`; param `nonnull readonly align 8 nocapture`; result `noalias nonnull align 8` | write |
| `writeFileSync(path: string, data: string): void` | `call void @nish_write_file(i8* path, i8* data)` | `nounwind`; params as above | write |
| `appendFileSync(path: string, data: string): void` | `call void @nish_append_file(i8* path, i8* data)` | same | write |

These are globals, not `import { readFileSync } from "fs"`: Nish has no
package resolution and rejects bare specifiers. Paths are relative to the
working directory. `nish_read_file` opens the file, sizes it with `lseek`,
allocates one arena string, and fills it with `pread`; the writers open with
`O_CREAT | O_TRUNC` (or `O_APPEND`) and mode `0644` and loop over `write`.
No stdio. A failure (missing file, permission denied, short write) prints
`nish: cannot read <path>` / `cannot write <path>` to stderr and exits
with status 1; there are no exceptions to throw. The string parameters are
`nocapture` in the declaration, so passing a parameter to them does not make
it escape (it keeps `nocapture` in the caller's signature).

`readFileSync` allocates in the arena and the writers do I/O, so all three
are `write`. Note on `willreturn`: like every allocating runtime call (which
can hit the out-of-memory `_exit` in `nish_arena_grow`), the file functions
can terminate the process on a fatal error and callers still keep
`willreturn`. That is the convention this compiler has used since WP3 for
fatal runtime errors; only the *intended* non-return of `process.exit` clears
the attribute.

### process.argv

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `process.argv: string[]` | `load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8` | n/a (a global, `@nish_argv = external global %struct.nish_array*, align 8`) | read |
| (entry wrapper) | `call void @nish_argv_init(i32 %argc, i8** %argv)` as the first statement of `@main` | `nounwind willreturn`; the `i8**` is `nocapture readonly` | write |

`process.argv` is a namespace property (`namespaceProperties["process.argv"]`
next to `Math.PI`) typed `string[]`, so everything an array supports applies
to it and lowers through the array emitters unchanged: `.length`, `a[i]`
with the bounds check, `for...of`, passing it to a function whose parameter
is `string[]`. The checker records `usesArgv` on the module; the Compilation
copies it onto the entry module so `emitEntryWrapper` inserts the
`nish_argv_init` call, which is why `tests/link/argv_import` (only the
imported module reads it) still gets the call in `main.ll`. Programs that
never read it keep the wrapper they had.

The runtime builds the array once, with `malloc` rather than the arena:
`nish_argv_init` allocates the 24-byte header plus one `nish_str *` per
argument, then each string as its own `{ len, bytes, 0 }` block, so
`Arena.reset()` / `nish_arena_release` can never invalidate it. Index 0 is
`argv[0]` as C sees it, the program path (Node's `process.argv[1]`-style
convention shifted by one, since there is no interpreter in front); the
differential shim maps it to `process.argv.slice(1)` for the same shape.

Three rules, all in `checkProcessArgv` (`src/checker/io.ts`):

- **It needs an entry point.** Only the `@main` wrapper has `argc`/`argv`,
  so a program without `export function main` (a wasm or N-API library, a
  file compiled for a C driver) rejects every use with
  `` `process.argv` requires a `main` entry point ``, in any module: the
  Compilation tells every checker whether the entry has `main`
  (`hasEntryMain`) before bodies are checked (`reject_argv_no_main`,
  `tests/link/argv_no_main`).
- **It is read-only.** `process.argv[i] = s`, `op=`, `++`/`--` on an element
  and `process.argv.push(s)` are `` `process.argv` is read-only ``
  (`mutatesArgv` walks up from the property access through parentheses to
  the consuming construct; `reject_argv_assign`, `reject_argv_push`).
  Aliasing it (`const args = process.argv`) and then storing through the
  alias is not caught; the array is a real `nish_array` with `cap == len`, so
  such a store works and a `push` would copy the data into the arena, which
  is the documented behaviour of any array.
- **It is a memory read.** `factCollectors` marks the load, so a function
  reading it is at most `readonly` (`count()` in `argv_echo.ll` is
  `nounwind willreturn readonly`); `nish_argv` is written exactly once,
  before any user code runs, so LLVM may still hoist and CSE the load.

### String to number

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `parseFloat(s: string): f64` | `call double @nish_parse_number(i8* s, i32 0)` | `nounwind willreturn`; param `nonnull readonly align 8 nocapture` | write |
| `Number(s: string): f64` | `call double @nish_parse_number(i8* s, i32 1)` | same | write |
| `Number(x: i32 \| i64): f64` | `sitofp <T> x to double` | n/a | none |
| `Number(b: boolean): f64` | `uitofp i1 b to double` | n/a | none |
| `Number(x: f64): f64` | nothing | n/a | none |
| `parseInt(s: string): i32` | `%d = call double @nish_parse_number(i8* s, i32 2)` then `call i32 @llvm.fptosi.sat.i32.f64(double %d)` | as above; the intrinsic `nounwind willreturn readnone` | write |

One runtime symbol with a mode instead of three, because every function in
`runtime.c` costs an unwind-table entry against the size budget (below).
The semantics, implemented in `nish_parse_number`:

- **Whitespace** is ASCII only (`" \t\n\v\f\r"`, skipped with `strspn`),
  not the Unicode `StrWhiteSpaceChar` set JavaScript trims.
- **`parseFloat` (mode 0):** after the whitespace, the longest
  `StrDecimalLiteral` (`[+-] digits [. digits] [e [+-] digits]`,
  `[+-] . digits [exponent]`, or `[+-] Infinity`), `NaN` when there is none
  (`""`, `"abc"`, `"."`, `"+"`, `"inf"`, `"nan"`). The conversion itself is
  `strtod`, which is correctly rounded and already linked for
  `nish_str_from_f64`; it accepts a superset of the JavaScript grammar, so the
  function first rules out the spellings JavaScript rejects (a first
  character that is neither a digit nor `.` must start exactly `Infinity`,
  checked with `strncmp`, which also excludes `inf`, `infinity`, `nan`) and
  then lets `strtod` find the end (`"1e"` is `1`, `"1.5e+"` is `1.5`,
  `"1e400"` is `Infinity`, `"-0"` is `-0`). The one superset left is the
  `0x` prefix: `strtod` reads `"0x1A"` as `26` (and hex floats such as
  `0x1p3`) where JavaScript's `parseFloat` stops at the `x` and gives `0`.
  Guarding it costs about 25 bytes that the budget does not have; it is
  documented in LANGUAGE.md and mirrored by the shim.
- **`Number` (mode 1):** the same literal must be the whole string bar
  surrounding whitespace, and a blank string is `0` (`Number("")`,
  `Number("   ")`); anything left over (`"12px"`, `"1e"`, `"Infinityx"`,
  `"1 2"`, an embedded NUL, since the check is against `len`, not the
  terminator) is `NaN`. Here the hex prefix agrees with JavaScript
  (`Number("0x1A")` is `26`); the `0b`/`0o` prefixes are `NaN` where
  JavaScript reads them.
- **`parseInt` (mode 2):** `strtoll(s, 0, 10)`, whose grammar is exactly
  JavaScript's base-10 `parseInt` (whitespace, sign, digits, stop at
  anything else, including `.`, `e`, and `x`), returned as a double. There is
  no `NaN` in an `i32`, so no digits give `0`; the compiler then applies
  `llvm.fptosi.sat.i32.f64`, the same saturating conversion `toI32` uses, so
  `"99999999999"` is `2147483647` and `"-99999999999"` is `-2147483648`
  (`strtoll` itself saturates at 2^63). JavaScript's automatic hex
  (`parseInt("0x10")` is `16`) is not reproduced: `0`. The result is `i32`
  in both number modes; `Number(s)` is the `f64` parser.

Effect: `strtod`/`strtoll` store `errno` on overflow, a write to memory the
caller can see, so the runtime function is neither `readonly` nor
`memory(argmem: read)` and a function that parses is at most `write`; the
string parameter is still `readonly nocapture`, so passing a parameter to a
parser keeps `nocapture` on it (`show` in `parse_numbers.ll`).

The unit test in `tests/runtime_test.c` checks 45 inputs against
`node -p "String(x)"` (plus the documented deviations), and
`tests/differential/corpus/parse_strings.ts` / `parse_argv_sum.ts` run the
same forms through the differential harness, whose shim (`runtime/shim.mjs`)
implements the runtime's grammar rather than JavaScript's built-ins.

### Strings and console.log with i64

`console.log(x)` and template holes accept `i64` (`isStringifiable` covers
every numeric type) and lower through `nish_str_from_i64(i64)` (`nounwind`,
effect write), which is also what `nish_str_from_i32` now delegates to.

## The `i64` type

| Nish | LLVM | Align |
| --- | --- | --- |
| `i64` | `i64` | 8 |

`i64` is a first-class integer type: arithmetic `+ - * / %` (`add`, `sub`,
`mul`, `sdiv`, `srem`, overflowing like `i32` — undefined by default, wrapping
under `--wrapping`), unary `-` (`sub i64 0, x`), comparisons (`icmp`),
parameters and returns (`noundef` like every scalar),
locals (`alloca i64, align 8`), `===`/`!==`. It is never the lowering of
`number`; `--number-mode` chooses between `i32` and `f64` only. There is no
implicit widening: `x + n` with `x: i64` and `n: number` is rejected with the
usual same-type message; write `x + toI64(n)`.

```ts
function square(x: i64): i64 { return x * x; }
const big: i64 = 3000000000;   // does not fit i32; fine as an i64 literal
console.log(square(big));      // 9000000000000000000
console.log(square(big) * 2);  // -446744073709551616 with --wrapping; overflow is UB without it
```

```llvm
define noundef i64 @square(i64 noundef %x) #0 {
entry:
  %0 = mul i64 %x, %x
  ret i64 %0
}
attributes #0 = { nounwind willreturn readnone }
```

### Numeric literals are typed by context

A numeric literal has the mode's default type (`i32`, or `f64` under
`--number-mode f64`) *unless its immediate context demands another numeric
type*, in which case it takes that type. The contexts, in
`contextualLiteralType` (`src/checker/math.ts`):

| Context | Example | Literal type |
| --- | --- | --- |
| annotated initializer | `let x: i64 = 5` | `i64` |
| return | `return 5` in a function returning `i64` | `i64` |
| user call argument | `square(5)` with `x: i64` | `i64` |
| binary operator, other operand typed | `x * 2`, `2 * x`, `x < 5`, `x = 5` | the other operand's type |
| `Math.min` / `Math.max` | `Math.max(x, 0)` | the other operand's type |
| f64-only Math functions, `toF64` | `Math.sqrt(2)`, `Math.pow(x, 0.5)`, `toF64(3)` | `f64` |
| `process.exit` | `process.exit(1)` in f64 mode | `i32` |

`-5` and `(5)` count as the literal. "Other operand typed" means its type is
cheap to see without checking it: an already-checked left operand, a
variable, or a call to a user function or to `toI32/toI64/toF64`. Anything
else (`5 + s.length`, say) keeps the default type, which is the right answer
in every case that exists today because `.length` and every other construct
yield `number`. A literal in an integer context must be an integer; in an
`i64` context it must also satisfy |n| <= 2^53, because TypeScript's parser
has already rounded larger literals to a double (`9223372036854775807` reads
back as `9223372036854776000`); build larger values arithmetically. The rule
also makes `let x: i32 = 5` legal under f64 mode and `let x: f64 = 5` under
i32 mode, which previously needed `5.0`-style workarounds that i32 mode
rejects anyway.

Emission: an `i64` literal is printed as a plain integer (`store i64
3000000000`), exact because of the 2^53 bound.

## JavaScript number formatting

`nish_str_from_f64` now produces exactly what `Number.prototype.toString`
produces (WP3 used `%.17g`, which printed `0.1` as `0.10000000000000001`).
The algorithm, in `runtime/runtime.c`:

1. Special cases: NaN -> `NaN`, +/-0 -> `0`, +/-Infinity -> `Infinity` /
   `-Infinity`; a leading `-` for negatives.
2. Shortest round-trip digits: for precision 1..17, `snprintf("%.*e")` and
   `strtod` back; the first precision that reproduces the value wins (17
   always does). This yields the shortest correctly rounded digit string,
   which is what ECMA-262 specifies (fewest digits; ties by closeness, and
   the correctly rounded string of a given length is the closest).
3. Layout per ECMA-262 `Number::toString` with `k` digits and exponent `n`
   (value = 0.digits x 10^n): plain integer digits padded with zeros when
   `k <= n <= 21`; a decimal point inside the digits when `0 < n <= 21`;
   `0.000ddd` when `-6 < n <= 0`; otherwise `d.ddde+X` / `de-X` with the
   JavaScript exponent syntax (sign always present, no zero padding).

Checked against Node in `tests/runtime_test.c` (expected strings are
`node -p "String(x)"`):

| Value | Node | `nish_str_from_f64` |
| --- | --- | --- |
| `0.1` | `0.1` | `0.1` |
| `1/3` | `0.3333333333333333` | `0.3333333333333333` |
| `1e21` | `1e+21` | `1e+21` |
| `1e-7` | `1e-7` | `1e-7` |
| `0.000001` | `0.000001` | `0.000001` |
| `123456789012` | `123456789012` | `123456789012` |
| `-0.0` | `0` | `0` |
| `NaN` | `NaN` | `NaN` |
| `Infinity` | `Infinity` | `Infinity` |
| `-Infinity` | `-Infinity` | `-Infinity` |
| `5e-324` | `5e-324` | `5e-324` |
| `1.7976931348623157e308` | `1.7976931348623157e+308` | `1.7976931348623157e+308` |
| `100` | `100` | `100` |
| `1.5` | `1.5` | `1.5` |
| `-2.5` | `-2.5` | `-2.5` |
| `1e20` | `100000000000000000000` | `100000000000000000000` |
| `1.5e300` | `1.5e+300` | `1.5e+300` |
| `2.5e-7` | `2.5e-7` | `2.5e-7` |
| `4.35` | `4.35` | `4.35` |
| `123e-20` | `1.23e-18` | `1.23e-18` |

Beyond the unit test, the formatter was compared with Node on 5,000
pseudo-random doubles (random bit patterns, decimal fractions, large
integers, tiny magnitudes) with zero differences. The cost is a handful of
`snprintf`/`strtod` calls per conversion, acceptable for a function that is
never on a hot path (`console.log`, template holes); a Ryu port would be
faster but does not fit the runtime budget.

## Runtime additions and budget

`runtime/runtime.c` gained `nish_str_from_i64`, the new `nish_str_from_f64`,
`nish_random`, `nish_exit`, `nish_read_file`, `nish_write_file`, and
`nish_append_file`, and defines `_POSIX_C_SOURCE` for `pread`; the second
round added `nish_argv` / `nish_argv_init` and `nish_parse_number`; the
2026-09-12 column adds `nish_readdir`, `nish_spawn_to`,
`nish_monotonic_nanos` and the shared `nish_spawn_impl` that `nish_spawn`
delegates to; the last column is the same runtime after those three moved out
of `runtime.c` into `runtime/runtime_os.c`, which is why it reads as a sum.
Measured with `clang -Oz -c runtime/runtime.c && size -A runtime.o`, per
section, and from the split onwards `clang -Oz -c runtime/runtime_os.c` as
well; the `text` column of plain `size` is the same code plus the read-only
constants and the `.eh_frame` unwind entries that the `size` build profile
strips:

| | Before WP7 | After WP7 | After argv + parsing | After WP14 D4 | 2026-09-12 | 2026-09-12, split (core + os) | Budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source bytes | 4,039 | 7,402 | 11,131 (arrays and WP6 in between) | 12,707 | 61,725 | 52,029 + 12,759 | — (was 8,192; exceeded since WP4, comments) |
| `size` text at `-Oz` | 1,118 | 2,688 | 4,093 (was 3,498) | 4,297 | 16,844 | 14,908 + 1,960 | — (was 4,096; counts `.eh_frame` and the Ryu tables) |
| `.text` section alone | | | 2,583 (was 2,172) | 2,544 (2,287 before D4) | 4,604 | 3,449 + 1,155 | — (was 4,096; the row below replaced it) |
| every `.text*` section, summed | | | | | 4,670 (4,154 before the three) | **3,480 + 1,190** | **3,584** core, **1,280** os (one budget of 4,864 until the split) |

The WP14 column is measured on the tree of that milestone, where the work
between WP7 and it had already brought `.text` back down to 2,287; the 2,583
beside it is the WP7 figure and is not the number D4 grew. The 2026-09-12
column is clang 18.1.3 on linux-x64.

The budget is the compiled code, and the two rows above it are history rather
than limits (`docs/MASTER_PLAN.md` §2): what a linked binary pays is
instructions, while those two measure comments, unwind tables, and — since the
Ryu formatter replaced the `snprintf` round trip — the 9,888 bytes of
power-of-five tables that `size` counts as text and that are constants rather
than code. WP14 D4's `nish_mkdir` and `nish_spawn` cost 257 bytes of it, and
cost a program that calls neither exactly nothing — `examples/hello.ts` at the
`size` profile is 4,696 bytes with them and 4,696 without, because
`-ffunction-sections -Wl,--gc-sections` drops both.

### 2026-09-12: 4,864 bytes, enforced by the suite

Two things moved at once. The metric is now the **sum of every `.text*`
section** rather than the single `.text` line the rows above quote: `clang -Oz`
puts cold code in `.text.unlikely.` (66 bytes today), a linked binary pays for
that section as well, and a ceiling on `.text` alone can be satisfied by moving
code into another section instead of by making it smaller.

And the number is now **4,864**. `nish_readdir` (294 bytes), `nish_spawn_impl`
(319, against the 172 the old `nish_spawn` body cost), `nish_monotonic_nanos`
(36), `nish_spawn_to` (33) and the 6 bytes `nish_spawn` is reduced to add 516
bytes of `.text` and 232 of `.eh_frame`, taking the `.text*` sum from 4,154 to
4,670. Most of the overshoot against the old 4,096 is older than these
functions, though: while the budget was a row in this document and a reviewer's
memory, the tree drifted from WP14 D4's 2,544 bytes to 4,088 with nobody
measuring. So the budget is the next 256-byte boundary above what was actually
measured, which leaves 194 bytes of headroom — enough that a small fix (one
more error path, an extra bounds check) does not need a commit that raises the
budget with it, and little enough that anything larger has to be a deliberate
decision with its own measurement in this section.

**The gate is `tests/run.js`, not a reviewer.** `RUNTIME_TEXT_BUDGET` there
compiles `runtime/runtime.c` with `clang -Oz`, sums every `.text*` row of
`size -A`, and fails with the measured number, the budget and the overshoot, so
whoever breaks it reads the size rather than a red line. It skips — through
`skip(reason)`, so the run counts it — when `clang` or `size` is missing, and
on any host that is not linux-x64, because a byte-exact ceiling is a fact about
one target and one compiler version rather than about the source.
`node tests/run.js budget` is the filter that selects it.

The `--gc-sections` claim holds for the three new functions too, and this is
the check that says so: `examples/hello.ts` at the `size` profile is 4,680
bytes against this runtime and 4,680 bytes against the one before it — the two
binaries are byte-identical, because a program that calls none of the three
drops all three.

The 595 bytes of the second round are `nish_argv_init` (162 bytes),
`nish_parse_number` (249), their two unwind entries and the constants
(`" \t\n\v\f\r"`, `"Infinity"`, NaN). Getting there from a first draft of
about 1,000 bytes: `strtoll` and `strtod` replace hand-written digit loops
(a hand-written double parser cannot be correctly rounded in that budget
anyway), `strspn` replaces four whitespace loops, the three parsers are one
symbol with a mode (each extra function is 30 to 60 bytes of `.eh_frame`),
`argv` strings are copied with `strcpy` after a `strlen` instead of a
length-carrying `memcpy`, and the `0x` guard in `parseFloat` was dropped
(documented deviation). Three bytes of headroom remain; the next runtime
feature has to pay for itself.

`tests/runtime_test.c` covers the integer and double formatting cases above,
1,000 draws of `nish_random` in `[0, 1)`, a write/append/read/truncate cycle
on `build/test/runtime_test.txt`, `nish_argv_init` (an empty argument, a UTF-8
one, survival of `nish_reset_arena`, `argc == 0`), and the 45 parsing inputs.

### 2026-09-12: two files, two budgets

The budget above moved for the wrong reason. `readdirSync`, `spawnSyncTo` and
`monotonicNanos` are syscall wrappers, so they have to be C, and they took the
ceiling from 4,096 to 4,864 — a number that a reader reasonably reads as "what
the runtime costs" and that had just grown by 516 bytes of code no program is
obliged to call. Section GC already said as much: `examples/hello.ts` at the
`size` profile was byte-identical against the runtime before those three and
after. The *measurement* was the thing that had not caught up, because one
translation unit can only have one ceiling.

So the operating-system half is now its own translation unit,
`runtime/runtime_os.c`, with its own measured ceiling. **The criterion is
whether the function wraps a system call** — whether the operating system is its
subject, rather than memory this process already owns — because that is the same
criterion that decides whether a builtin has to be written in C at all, and it
is exactly the surface that grows as the language reaches further out:

| Moved to `runtime_os.c` | Stayed in `runtime.c` |
| --- | --- |
| `nish_exit`, `nish_io_fail` | the arena: `nish_arena_grow`, `nish_alloc_struct`, `nish_reset_arena`, `nish_free_arena`, `nish_arena_mark` / `release` / `used` / `keep` |
| `nish_read_file`, `nish_read_file_or_null`, `nish_put_file`, `nish_write_file`, `nish_append_file` | the strings: `nish_str_new`, `nish_str_concat`, `nish_str_eq`, `nish_str_len`, `nish_str_at`, `nish_str_index_of`, `nish_write`, `nish_print` |
| `nish_is_dir`, `nish_mkdir` | number formatting: `str_from_digits`, `nish_str_from_i32` / `i64` / `u64`, Ryu and `nish_str_from_f64`, `nish_parse_number` |
| `nish_spawn_impl`, `nish_spawn`, `nish_spawn_to` | the arrays: `nish_alloc_array`, `nish_array_grow` |
| `nish_readdir` | `nish_random`, `nish_argv` / `nish_argv_init` |
| `nish_monotonic_nanos` | the panics: `nish_die`, `nish_panic_index`, `nish_panic_div` |
| `nish_getenv` | the `__wasi__` entry bridge (`__main_argc_argv`) |
| `nish_platform`, `nish_arch` | |

The file I/O went with them, and by the same reasoning rather than by
association: `open`, `pread` and `write` on a path are the operating system
answering about something outside this process, and `readFileSync` is the
builtin most likely to grow a sibling (a `statSync`, a `readFileSyncAt`) that
would then be measured against the arena.

Three of the decisions are worth their reasons, because each could have gone the
other way:

- **`nish_random` stays.** Its subject is a pseudo-random sequence over one
  static word; `time(0)` and `getpid()` are a one-time seed, not the answer, and
  `Math.random` grows with nothing in the list above.
- **`nish_argv` / `nish_argv_init` stay.** They make no system call at all: the
  entry point is *handed* `argc` and `argv`, and turning them into an array is
  `malloc`, `strlen` and `strcpy` over memory this process already has. So does
  the `__wasi__` bridge that forwards them, which every wasi program needs
  whether or not it reads `process.argv`, which is the second reason it belongs
  in the file every profile compiles.
- **`nish_platform` / `nish_arch` move**, although they make no system call
  either — they are two addresses in constant data, settled when the runtime was
  compiled. They are `process.platform` and `process.arch`: their subject is the
  host, and the branch list is what grows when a new one is supported.

**The two ceilings.** `clang -Oz -c <file>` and `size -A`, every `.text*`
section summed, clang 18.1.3 on linux-x64:

| File | `.text` | `.text.unlikely.` | Total | Budget | Headroom |
| --- | ---: | ---: | ---: | ---: | ---: |
| `runtime/runtime.c` | 3,484 | 31 (`nish_die`) | **3,515** | **3,584** | 69 |
| `runtime/runtime_os.c` | 1,216 | 35 (`nish_io_fail`) | **1,251** | **1,280** | 29 |
| both | 4,700 | 66 | 4,766 | 4,864 | 98 |
| `runtime.c -DNISH_THREADS=1` | 3,609 | 31 | **3,640** | **3,840** | 200 |

`runtime_os.c` was 1,190 until WP21 S2 put an `fstat`/`S_ISDIR` guard in
`nish_read_file_or_null`, which is 61 bytes and buys the answer `null` for a
directory: `open(O_RDONLY)` accepts one, `lseek` then answers `LONG_MAX`, and
the arena was asked for that many bytes. The ceiling did not move for it — 29
bytes of headroom is what the surface costs now, and the next syscall wrapper
is the one that has to argue for a raise. `runtime.c` has drifted 3,480 → 3,484
over the same span, from work that had nothing to do with this table; the rows
above are all freshly measured, so the `both` row is their sum and not the sum
of an older pair.

The split itself is what the numbers were taken to check, and it cost nothing:
at the time it was made, 3,480 + 1,190 was exactly the 4,670 that one file
measured, and every moved function was byte for byte the size it was
(`nish_readdir` 294, `nish_spawn_impl` 319, `nish_monotonic_nanos` 36,
`nish_spawn_to` 33, `nish_getenv` 80). It cost nothing to measure and nothing
to link.

Each budget is the next 256-byte boundary above its measurement, which is the
rule the 4,864 was set by. The consequences of the two numbers are deliberately
different:

- **3,584 for the core.** The core is a closed set — nothing in the language
  roadmap adds an arena or a second string representation — so this number
  should come down over time and never up. 104 bytes of headroom is tight on
  purpose: a commit that needs the room grew something that was not supposed to
  grow, and should have to say so.
- **1,280 for the operating-system half.** 90 bytes is less than one syscall
  wrapper (`nish_readdir` alone is 294), so the next builtin that reaches into
  the operating system *will* raise this number, in the commit that adds it,
  with its measurement — which is the whole point. It can no longer borrow room
  from the arena to hide in, and raising it says what it says: the OS-facing
  surface grew, and the core did not.

That the two sum to 4,864, the single budget they replace, is a coincidence of
where the 256-byte boundaries fall and not a constraint on either.

**What the split costs a program.** `nish_readdir` allocates through
`nish_alloc_struct` and `nish_str_new`, which are now in another translation
unit, so the inlined arena bump inside it is a real call without LTO. Measured
on the same host, `examples/hello.ts` and `tests/cases/io_readdir.ts` (which
creates a directory, writes three files and lists it twice), against the runtime
before the split and after:

| Program | Profile | Before | After |
| --- | --- | ---: | ---: |
| `examples/hello.ts` | `size` | 4,680 | 4,680 (byte-identical) |
| `examples/hello.ts` | `speed` | 4,680 | 4,680 (byte-identical) |
| `io_readdir.ts` | `size` | 9,456 | 9,456 |
| `io_readdir.ts` | `speed` | 9,696 | 9,696 |

Both profiles use `-flto`, so the two translation units are one module by the
time the inliner runs and nothing was lost: the `io_readdir` binaries are the
same size to the byte and the `hello` binaries are the same *bytes*, the
`--gc-sections` claim above holding as it did. Without LTO — the `debug`
profile, or a hand-written `clang -O2` line — the calls are real, and the answer
is still not a regression: at `-O2` the linked `io_readdir` binary's `.text*`
*falls* from 9,373 bytes to 8,584, because `nish_readdir` stops carrying an
inlined copy of the allocator (1,653 bytes of it down to 839), while the file
grows 32 bytes on section padding. The unoptimised `debug` profile, which
inlines nothing either way and strips nothing, grows 10 bytes of `.text*`.

And the calls do not cost time on the workload they are on. A loop of 4,000
`readdirSync` calls over a 37-entry directory (152,000 entries and as many
arena strings), best of nine runs:

| Build | Before | After |
| --- | ---: | ---: |
| `--profile speed` (LTO) | 41 ms | 41 ms |
| `clang -O2`, no LTO | 42 ms | 42 ms |

Which is what a cold path means: the time is in `getdents` and in the `strcmp`
of the insertion sort, not in the bump allocator, and a runtime call per entry
does not show above the noise (±4 ms between repetitions of either binary).

**Where the link lines are.** `scripts/build.sh` compiles `runtime_os.c` beside
any `runtime.c` it is handed, so every caller that names the runtime through it
is already correct: `nish --link` (`src/index.ts`), stage1's `--link`
(`self/compile.ts`), `scripts/size-report.sh`, the `napi`, `wasi` and `size`
profile builds in `tests/run.js`, `tests/differential/lib.js` (through
`--link`), and every `--profile` recipe in these documents and in the README. A
caller that already names both is left alone, since naming one object twice is a
duplicate-symbol error. Direct `clang` lines name both: `tests/run.js`
(`RUNTIME_C` there, used by the golden round trips, the panic cases, the layout
driver and the runtime unit test) and `tests/nish/run.ts`. Nothing in
`runtime.c` calls into `runtime_os.c`, so an older line naming `runtime.c` alone
still links a program that touches no files, directories, subprocesses,
environment or clock — which is most of `tests/cases` and every example except
`argv`.

**The freestanding and wasi profiles.** `runtime/runtime_wasm.c` is untouched: it
defines none of the moved functions and the `wasm` profile never names
`runtime.c`. The `wasi` profile compiles `runtime.c` and therefore
`runtime_os.c` too; both files compile clean under `-std=c11 -Wall -Wextra
-Werror` with the `__wasi__` branches taken (`nish_readdir` answers NULL,
`nish_spawn_impl` answers -1, `spawn.h` and `wait.h` are not included, and the
entry bridge stayed in `runtime.c`). The end-to-end wasi check still needs a
WASI sysroot and still skips, counted, without one.

**The gate.** `tests/run.js` holds `RUNTIME_TEXT_BUDGET` (3,584),
`RUNTIME_OS_TEXT_BUDGET` (1,280) and `RUNTIME_THREADS_TEXT_BUDGET` (3,840), and
measures all three configurations in one block, with the same skip behaviour as
before — a counted `skip(reason)` off linux-x64 or without `clang` or `size`,
because a byte-exact ceiling is a fact about one target and one compiler version.
Each failure names its own configuration, its own measurement, its own budget and
the constant to raise. `node tests/run.js budget` selects them.

The third row is the fourth line of the table above, and it exists because the
first two cannot see it. `-DNISH_THREADS=1` is the build `--threads` links (WP20
T0), where the arena and the RNG seed are `_Thread_local`, and at 3,605 bytes it
is 21 *above* the core's own ceiling — so for as long as only the default build
was measured, the code size of a configuration a user asks for by flag was
ungated, and `_Thread_local` storage is the kind of thing that grows quietly. It
is a separate number rather than a raised shared one on purpose: covering both
with 3,840 would hand the default build 360 bytes it has no business having, and
the whole point of splitting the budget was that a number should mean one thing.

## Attributes

- Every intrinsic is declared with `nounwind willreturn readnone`. These are
  a subset of what LLVM itself attaches to them (`nocallback nofree nosync
  nounwind speculatable willreturn memory(none)`), so they are facts, and
  `llvm-as`/`opt -passes=verify` accept them. A function whose body is
  arithmetic plus Math intrinsics is `readnone willreturn` (`hypot`, `trig`,
  `clamp`, `square` in the goldens).
- `nish_random`, `nish_exit`, and the file functions are `write`; `nish_exit`
  is additionally `noreturn`, and `callsNoReturn` removes `willreturn` from
  every function that can reach it.
- `Math.PI`/`Math.E` are constants: no memory read, `readnone` preserved.
- Identifier builtins are not user callees, so `noteEscape` in
  `attributes.ts` does not run for their arguments; that is correct because
  every runtime function they lower to declares its string parameters
  `nocapture` (`nish_parse_number` included). `collectBuiltinFacts` (in
  `emit/expressions.ts`) reports their callees to the fixpoint; dotted
  builtins are already covered by `collectStringFacts` through
  `builtinCallEmitters`.
- `nish_parse_number` is `write` (errno, see above), never `readonly`; a
  function whose only impurity is parsing loses `readonly`, which is the
  honest attribute. `Number` on a numeric or boolean argument reports no
  callee and keeps the caller `readnone`.
- `process.argv` is a load of a global: `readsMemory`, hence `readonly` at
  best; the `@main` wrapper that calls `nish_argv_init` stays `nounwind`
  only, as before.

## Linking

`llvm.sin/cos/exp/log/pow.f64` become calls to libm's `sin`, `cos`, `exp`,
`log`, `pow` when the argument is not a compile-time constant (`sqrt`,
`floor`, `ceil`, `trunc`, `fabs`, `minnum`, `smin`, ... are instructions).
`tests/run.js` links the native round trips with `-lm`.

Every native profile of `scripts/build.sh` links `-lm`.

### WASI target

`--target wasm32-wasi` only pins the data layout; running a string program
under wasm needs the runtime compiled against a libc, which the freestanding
`wasm` profile (`-nostdlib`, no runtime) cannot do. The `wasi` profile of
`scripts/build.sh` builds a command module:

```
nish examples/argv.ts --link build/argv.wasm --profile wasi
node examples/wasi-host.mjs build/argv.wasm 3 4 five      # or wasmtime build/argv.wasm 3 4 five
```

- **Sysroot.** `clang --target=wasm32-wasi --sysroot=<wasi-sysroot>` with
  the sysroot from `WASI_SYSROOT`, `/usr/lib/wasi-sysroot` (Debian's
  `wasi-libc` package), `/opt/wasi-sdk/share/wasi-sysroot`, or
  `/usr/share/wasi-sysroot`; without one the script prints
  `the wasi profile needs a WASI sysroot ...` and exits 2, and `tests/run.js`
  prints `SKIP  skipped: no WASI sysroot ...` instead of failing. With one
  (the CI image has none; set `WASI_SYSROOT` to run it), the test builds
  `argv_echo.ts` and checks that Node's `node:wasi` produces the native
  output for the same arguments.
- **Builtins.** wasi-libc's `strtoll` needs compiler-rt's `__multi3`.
  wasi-sdk and Debian's `libclang-rt-18-dev-wasm32` put
  `libclang_rt.builtins-wasm32.a` in clang's resource directory, where the
  driver links it by default; a bare distro clang has none and the link
  fails with `cannot open .../lib/wasi/libclang_rt.builtins-wasm32.a`, so
  the script then looks for wasi-sdk's separate builtins tarball unpacked
  next to the sysroot (or `WASI_BUILTINS=<file>`), passes it explicitly, and
  names libc itself (`-nodefaultlibs -lc`; wasi-libc's `libc.a` includes
  libm). Flags otherwise: `-Oz -DNDEBUG -ffunction-sections
  -fdata-sections -Wl,--gc-sections -Wl,--strip-all`. `examples/argv.ts`
  is 42,228 bytes this way, most of it wasi-libc's `printf`/`strtod`
  machinery behind `nish_str_from_f64`.
- **Entry.** wasi-libc's `_start` calls `__main_void`, which calls
  `__main_argc_argv`, the name clang gives a C `main(int, char **)`. The
  compiler's wrapper is a plain `@main`, so `runtime.c` bridges the two
  under `#ifdef __wasi__` with a weak asm-labelled declaration
  (`int nish_c_main(int, char **) __asm__("main")`) and a two-line
  `__main_argc_argv`; weak so that a reactor build without an entry still
  links. `process.argv` then comes from `args_get`: index 0 is whatever the
  host names the module (`examples/wasi-host.mjs` passes the file path, like
  the native `argv[0]`).
- **What the runtime needed.** Only `getpid`, which WASI lacks (wasi-libc
  marks it deprecated, `-Werror` fails): the `Math.random` seed uses the
  monotonic clock's nanoseconds instead. `write`, `open`, `lseek`, `pread`,
  `close`, `_exit`, `malloc`, `snprintf`, `strtod`, `strtoll`, `strspn`
  all exist in wasi-libc, and `runtime.c` compiles clean with
  `--target=wasm32-wasi -std=c11 -Wall -Wextra -Werror`. Files resolve
  against the host's preopened directories (`.` in the Node host).
- **Host.** `examples/wasi-host.mjs` (Node 20+, `node:wasi`, preview1) runs
  the module with `args`, stdout and the exit status wired through; any
  other WASI runtime (`wasmtime`, `wasmer`) works the same.

## Tests

Positive (`tests/cases/`, each with a golden `.ll`, an `llvm-as` pass, and a
native `.out` round trip):

| Case | Shows |
| --- | --- |
| `math_intrinsics` (`--number-mode f64`) | every f64 intrinsic, the `Math.round` sequence, `Math.PI`/`Math.E`; pure callers stay `readnone` |
| `math_i32` | `llvm.abs/smin/smax.i32`, `Math.PI` under i32 mode |
| `math_random` | 1,000 draws in `[0, 1)` without loops (fixed-arity unrolling), two draws differ |
| `i64_basic` | 64-bit multiply overflowing i32, wrap, template and `console.log` with i64, contextual literals |
| `conversions` | every `toI32/toI64/toF64` direction, saturation and wrapping |
| `io_files` | write, append, read back, `.length` |
| `process_exit` | `noreturn` + `unreachable`, terminator analysis, `willreturn` dropped transitively |
| `argv_echo` (run with `argv_echo.argv`) | the `@nish_argv` load, the `nish_argv_init` call in `@main`, a `readonly` reader, indexing, `for...of`, byte lengths of a UTF-8 argument, `parseInt` over the arguments |
| `parse_numbers` | every `parseInt` / `parseFloat` / `Number` form above including the deviations, `Number` on `i32`/`i64`/`f64`/`boolean` |
| `link/argv_import` | the import reads `process.argv`, the entry gets the init call (`expected.ir`), runs with no arguments |

`tests/run.js` passes the whitespace-separated words of `<name>.argv` to a
case's binary; the differential harness does the same for
`tests/differential/corpus/<name>.argv` on both the native and the Node
side, and `scripts/smoke.sh` honours `// smoke: argv <args>`
(`examples/argv.ts`). The wasi profile is exercised by the pipeline block of
`tests/run.js` when a sysroot is installed.

Negative (`.err`): `reject_math_i32` (`Math.sqrt` on an i32 `number`),
`reject_math_min_arity`, `reject_toi32_string`, `reject_readfile_number`,
`reject_unknown_builtin` (`Math.foo`), `reject_i64_literal_float`,
`reject_i64_mixed`, `reject_exit_unreachable`, `reject_argv_no_main`,
`reject_argv_assign`, `reject_argv_push`, `reject_parseint_number`,
`reject_number_array`, `tests/link/argv_no_main`.

## Not in this package

- `toString(x)`: template literals and `console.log` already convert; an
  explicit function can come with string methods.
- `Math.min`/`Math.max` with more than two arguments, and `Math.round`
  returning `-0`.
- `parseInt(s, radix)`, JavaScript's automatic hex in `parseInt`, the `0b` /
  `0o` prefixes in `Number`, Unicode whitespace in the parsers, and a `0x`
  guard in `parseFloat`: each is a few bytes of runtime that the budget
  cannot absorb; all are documented deviations mirrored by the shim.
- `process.env`, `process.stdin`: the wrapper has no `envp`, and stdin
  needs a reading primitive first.
- A WASI reactor profile (a library module with `_initialize` instead of
  `_start`) for calling exported functions from a wasm host with the runtime
  linked in; the `__main_argc_argv` bridge is already weak so it would link.
