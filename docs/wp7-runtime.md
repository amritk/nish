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
| The `@main` wrapper (`amrit_argv_init` call), `@amrit_argv` in the `--runtime-decls` prelude | `src/compilation.ts` (`usesArgv`, `hasEntryMain`) | `src/codegen/emitter.ts` |
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
| `Math.random(): f64` | `call double @amrit_random()` | `nounwind willreturn` | write |

`amrit_random` is xorshift64\* over one global state word, seeded lazily from
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
| `process.exit(code: i32): void` | `call void @amrit_exit(i32 code)` then `unreachable` | `noreturn nounwind` | write, `noreturn` |

Statement position only. The checker treats `process.exit(n);` as a
terminator for definite-return analysis, so a `number`-returning function may
end with it and nothing may follow it in the same block (`Unreachable code
after return`, the same diagnostic as after `return`). The emitter closes the
block with `unreachable` after the `noreturn` call. `amrit_exit` calls libc
`exit`, so `atexit` handlers and stdio buffers of any C code in the binary are
flushed; the arena is simply abandoned to the OS.

`willreturn` promises that a call comes back, so every function that can
reach `amrit_exit`, directly or through callees, loses it. `FunctionFacts` gained
`callsNoReturn`, propagated over the call graph in the same fixpoint as the
memory effects (`RuntimeFunction.noreturn` seeds it). In `process_exit.ts`
both `finish` (calls it) and `main` (calls `finish`) are emitted with just
`nounwind`.

### Files

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `readFileSync(path: string): string` | `call i8* @amrit_read_file(i8* path)` | `nounwind`; param `nonnull readonly align 8 nocapture`; result `noalias nonnull align 8` | write |
| `writeFileSync(path: string, data: string): void` | `call void @amrit_write_file(i8* path, i8* data)` | `nounwind`; params as above | write |
| `appendFileSync(path: string, data: string): void` | `call void @amrit_append_file(i8* path, i8* data)` | same | write |

These are globals, not `import { readFileSync } from "fs"`: AmritScript has no
package resolution and rejects bare specifiers. Paths are relative to the
working directory. `amrit_read_file` opens the file, sizes it with `lseek`,
allocates one arena string, and fills it with `pread`; the writers open with
`O_CREAT | O_TRUNC` (or `O_APPEND`) and mode `0644` and loop over `write`.
No stdio. A failure (missing file, permission denied, short write) prints
`amritc: cannot read <path>` / `cannot write <path>` to stderr and exits
with status 1; there are no exceptions to throw. The string parameters are
`nocapture` in the declaration, so passing a parameter to them does not make
it escape (it keeps `nocapture` in the caller's signature).

`readFileSync` allocates in the arena and the writers do I/O, so all three
are `write`. Note on `willreturn`: like every allocating runtime call (which
can hit the out-of-memory `_exit` in `amrit_arena_grow`), the file functions
can terminate the process on a fatal error and callers still keep
`willreturn`. That is the convention this compiler has used since WP3 for
fatal runtime errors; only the *intended* non-return of `process.exit` clears
the attribute.

### process.argv

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `process.argv: string[]` | `load %struct.amrit_array*, %struct.amrit_array** @amrit_argv, align 8` | n/a (a global, `@amrit_argv = external global %struct.amrit_array*, align 8`) | read |
| (entry wrapper) | `call void @amrit_argv_init(i32 %argc, i8** %argv)` as the first statement of `@main` | `nounwind willreturn`; the `i8**` is `nocapture readonly` | write |

`process.argv` is a namespace property (`namespaceProperties["process.argv"]`
next to `Math.PI`) typed `string[]`, so everything an array supports applies
to it and lowers through the array emitters unchanged: `.length`, `a[i]`
with the bounds check, `for...of`, passing it to a function whose parameter
is `string[]`. The checker records `usesArgv` on the module; the Compilation
copies it onto the entry module so `emitEntryWrapper` inserts the
`amrit_argv_init` call, which is why `tests/link/argv_import` (only the
imported module reads it) still gets the call in `main.ll`. Programs that
never read it keep the wrapper they had.

The runtime builds the array once, with `malloc` rather than the arena:
`amrit_argv_init` allocates the 24-byte header plus one `amrit_str *` per
argument, then each string as its own `{ len, bytes, 0 }` block, so
`Arena.reset()` / `amrit_arena_release` can never invalidate it. Index 0 is
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
  alias is not caught; the array is a real `amrit_array` with `cap == len`, so
  such a store works and a `push` would copy the data into the arena, which
  is the documented behaviour of any array.
- **It is a memory read.** `factCollectors` marks the load, so a function
  reading it is at most `readonly` (`count()` in `argv_echo.ll` is
  `nounwind willreturn readonly`); `amrit_argv` is written exactly once,
  before any user code runs, so LLVM may still hoist and CSE the load.

### String to number

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `parseFloat(s: string): f64` | `call double @amrit_parse_number(i8* s, i32 0)` | `nounwind willreturn`; param `nonnull readonly align 8 nocapture` | write |
| `Number(s: string): f64` | `call double @amrit_parse_number(i8* s, i32 1)` | same | write |
| `Number(x: i32 \| i64): f64` | `sitofp <T> x to double` | n/a | none |
| `Number(b: boolean): f64` | `uitofp i1 b to double` | n/a | none |
| `Number(x: f64): f64` | nothing | n/a | none |
| `parseInt(s: string): i32` | `%d = call double @amrit_parse_number(i8* s, i32 2)` then `call i32 @llvm.fptosi.sat.i32.f64(double %d)` | as above; the intrinsic `nounwind willreturn readnone` | write |

One runtime symbol with a mode instead of three, because every function in
`runtime.c` costs an unwind-table entry against the size budget (below).
The semantics, implemented in `amrit_parse_number`:

- **Whitespace** is ASCII only (`" \t\n\v\f\r"`, skipped with `strspn`),
  not the Unicode `StrWhiteSpaceChar` set JavaScript trims.
- **`parseFloat` (mode 0):** after the whitespace, the longest
  `StrDecimalLiteral` (`[+-] digits [. digits] [e [+-] digits]`,
  `[+-] . digits [exponent]`, or `[+-] Infinity`), `NaN` when there is none
  (`""`, `"abc"`, `"."`, `"+"`, `"inf"`, `"nan"`). The conversion itself is
  `strtod`, which is correctly rounded and already linked for
  `amrit_str_from_f64`; it accepts a superset of the JavaScript grammar, so the
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
every numeric type) and lower through `amrit_str_from_i64(i64)` (`nounwind`,
effect write), which is also what `amrit_str_from_i32` now delegates to.

## The `i64` type

| AmritScript | LLVM | Align |
| --- | --- | --- |
| `i64` | `i64` | 8 |

`i64` is a first-class integer type: arithmetic `+ - * / %` (`add`, `sub`,
`mul`, `sdiv`, `srem`, wrapping like `i32`), unary `-` (`sub i64 0, x`),
comparisons (`icmp`), parameters and returns (`noundef` like every scalar),
locals (`alloca i64, align 8`), `===`/`!==`. It is never the lowering of
`number`; `--number-mode` chooses between `i32` and `f64` only. There is no
implicit widening: `x + n` with `x: i64` and `n: number` is rejected with the
usual same-type message; write `x + toI64(n)`.

```ts
function square(x: i64): i64 { return x * x; }
const big: i64 = 3000000000;   // does not fit i32; fine as an i64 literal
console.log(square(big));      // 9000000000000000000
console.log(square(big) * 2);  // -446744073709551616 (wraps, like i32)
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

`amrit_str_from_f64` now produces exactly what `Number.prototype.toString`
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

| Value | Node | `amrit_str_from_f64` |
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

`runtime/runtime.c` gained `amrit_str_from_i64`, the new `amrit_str_from_f64`,
`amrit_random`, `amrit_exit`, `amrit_read_file`, `amrit_write_file`, and
`amrit_append_file`, and defines `_POSIX_C_SOURCE` for `pread`; the second
round added `amrit_argv` / `amrit_argv_init` and `amrit_parse_number`. Measured
with `clang -Oz -c runtime/runtime.c && size runtime.o` (the `text` column
of `size`, which also counts the read-only constants and the `.eh_frame`
unwind entries that the `size` build profile strips):

| | Before WP7 | After WP7 | After argv + parsing | Budget |
| --- | ---: | ---: | ---: | ---: |
| source bytes | 4,039 | 7,402 | 11,131 (arrays and WP6 in between) | 8,192 (exceeded since WP4; comments) |
| `size` text at `-Oz` | 1,118 | 2,688 | 4,093 (was 3,498) | 4,096 |
| `.text` section alone | | | 2,583 (was 2,172) | |

The 595 bytes of the second round are `amrit_argv_init` (162 bytes),
`amrit_parse_number` (249), their two unwind entries and the constants
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
1,000 draws of `amrit_random` in `[0, 1)`, a write/append/read/truncate cycle
on `build/test/runtime_test.txt`, `amrit_argv_init` (an empty argument, a UTF-8
one, survival of `amrit_reset_arena`, `argc == 0`), and the 45 parsing inputs.

## Attributes

- Every intrinsic is declared with `nounwind willreturn readnone`. These are
  a subset of what LLVM itself attaches to them (`nocallback nofree nosync
  nounwind speculatable willreturn memory(none)`), so they are facts, and
  `llvm-as`/`opt -passes=verify` accept them. A function whose body is
  arithmetic plus Math intrinsics is `readnone willreturn` (`hypot`, `trig`,
  `clamp`, `square` in the goldens).
- `amrit_random`, `amrit_exit`, and the file functions are `write`; `amrit_exit`
  is additionally `noreturn`, and `callsNoReturn` removes `willreturn` from
  every function that can reach it.
- `Math.PI`/`Math.E` are constants: no memory read, `readnone` preserved.
- Identifier builtins are not user callees, so `noteEscape` in
  `attributes.ts` does not run for their arguments; that is correct because
  every runtime function they lower to declares its string parameters
  `nocapture` (`amrit_parse_number` included). `collectBuiltinFacts` (in
  `emit/expressions.ts`) reports their callees to the fixpoint; dotted
  builtins are already covered by `collectStringFacts` through
  `builtinCallEmitters`.
- `amrit_parse_number` is `write` (errno, see above), never `readonly`; a
  function whose only impurity is parsing loses `readonly`, which is the
  honest attribute. `Number` on a numeric or boolean argument reports no
  callee and keeps the caller `readnone`.
- `process.argv` is a load of a global: `readsMemory`, hence `readonly` at
  best; the `@main` wrapper that calls `amrit_argv_init` stays `nounwind`
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
amritc examples/argv.ts --link build/argv.wasm --profile wasi
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
  machinery behind `amrit_str_from_f64`.
- **Entry.** wasi-libc's `_start` calls `__main_void`, which calls
  `__main_argc_argv`, the name clang gives a C `main(int, char **)`. The
  compiler's wrapper is a plain `@main`, so `runtime.c` bridges the two
  under `#ifdef __wasi__` with a weak asm-labelled declaration
  (`int amrit_c_main(int, char **) __asm__("main")`) and a two-line
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
| `argv_echo` (run with `argv_echo.argv`) | the `@amrit_argv` load, the `amrit_argv_init` call in `@main`, a `readonly` reader, indexing, `for...of`, byte lengths of a UTF-8 argument, `parseInt` over the arguments |
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
