# WP7: Runtime and intrinsics

Math builtins as LLVM intrinsics, the `i64` type with explicit numeric
conversions, `process.exit` and synchronous file I/O, and JavaScript-accurate
number formatting in the runtime. For every builtin: its TypeScript
signature, the exact lowering, the attributes on the callee, and its memory
effect (what it does to the purity of the function that calls it). Test cases
are `tests/cases/math_*.ts`, `i64_basic.ts`, `conversions.ts`, `io_files.ts`,
`process_exit.ts`, plus the `reject_*` cases listed at the end.

## Where the code lives

| Piece | Checker | Emitter |
| --- | --- | --- |
| Shared plumbing (`dottedName`, arity checks, `BuiltinCall` shape) | `src/checker/builtins.ts` | `src/codegen/emit/builtins.ts` |
| `Math.*`, `toI32/toI64/toF64`, literal typing | `src/checker/math.ts` | `src/codegen/emit/math.ts` |
| `process.exit`, `readFileSync`, `writeFileSync`, `appendFileSync` | `src/checker/io.ts` | `src/codegen/emit/io.ts` |

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
| `Math.random(): f64` | `call double @sts_random()` | `nounwind willreturn` | write |

`sts_random` is xorshift64\* over one global state word, seeded lazily from
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
| `process.exit(code: i32): void` | `call void @sts_exit(i32 code)` then `unreachable` | `noreturn nounwind` | write, `noreturn` |

Statement position only. The checker treats `process.exit(n);` as a
terminator for definite-return analysis, so a `number`-returning function may
end with it and nothing may follow it in the same block (`Unreachable code
after return`, the same diagnostic as after `return`). The emitter closes the
block with `unreachable` after the `noreturn` call. `sts_exit` calls libc
`exit`, so `atexit` handlers and stdio buffers of any C code in the binary are
flushed; the arena is simply abandoned to the OS.

`willreturn` promises that a call comes back, so every function that can
reach `sts_exit`, directly or through callees, loses it. `FunctionFacts` gained
`callsNoReturn`, propagated over the call graph in the same fixpoint as the
memory effects (`RuntimeFunction.noreturn` seeds it). In `process_exit.ts`
both `finish` (calls it) and `main` (calls `finish`) are emitted with just
`nounwind`.

### Files

| Signature | Lowering | Callee attributes | Effect |
| --- | --- | --- | --- |
| `readFileSync(path: string): string` | `call i8* @sts_read_file(i8* path)` | `nounwind`; param `nonnull readonly align 8 nocapture`; result `noalias nonnull align 8` | write |
| `writeFileSync(path: string, data: string): void` | `call void @sts_write_file(i8* path, i8* data)` | `nounwind`; params as above | write |
| `appendFileSync(path: string, data: string): void` | `call void @sts_append_file(i8* path, i8* data)` | same | write |

These are globals, not `import { readFileSync } from "fs"`: StaticTS has no
package resolution and rejects bare specifiers. Paths are relative to the
working directory. `sts_read_file` opens the file, sizes it with `lseek`,
allocates one arena string, and fills it with `pread`; the writers open with
`O_CREAT | O_TRUNC` (or `O_APPEND`) and mode `0644` and loop over `write`.
No stdio. A failure (missing file, permission denied, short write) prints
`statictsc: cannot read <path>` / `cannot write <path>` to stderr and exits
with status 1; there are no exceptions to throw. The string parameters are
`nocapture` in the declaration, so passing a parameter to them does not make
it escape (it keeps `nocapture` in the caller's signature).

`readFileSync` allocates in the arena and the writers do I/O, so all three
are `write`. Note on `willreturn`: like every allocating runtime call (which
can hit the out-of-memory `_exit` in `sts_arena_grow`), the file functions
can terminate the process on a fatal error and callers still keep
`willreturn`. That is the convention this compiler has used since WP3 for
fatal runtime errors; only the *intended* non-return of `process.exit` clears
the attribute.

### Strings and console.log with i64

`console.log(x)` and template holes accept `i64` (`isStringifiable` covers
every numeric type) and lower through `sts_str_from_i64(i64)` (`nounwind`,
effect write), which is also what `sts_str_from_i32` now delegates to.

## The `i64` type

| StaticTS | LLVM | Align |
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

`sts_str_from_f64` now produces exactly what `Number.prototype.toString`
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

| Value | Node | `sts_str_from_f64` |
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

`runtime/runtime.c` gained `sts_str_from_i64`, the new `sts_str_from_f64`,
`sts_random`, `sts_exit`, `sts_read_file`, `sts_write_file`, and
`sts_append_file`, and defines `_POSIX_C_SOURCE` for `pread`. Measured with
`clang -Oz -c runtime/runtime.c && size runtime.o`:

| | Before WP7 | After WP7 | Budget |
| --- | ---: | ---: | ---: |
| source bytes | 4,039 | 7,402 | 8,192 |
| `.text` at `-Oz` | 1,118 | 2,688 | 4,096 |

`tests/runtime_test.c` covers the integer and double formatting cases above,
1,000 draws of `sts_random` in `[0, 1)`, and a write/append/read/truncate
cycle on `build/test/runtime_test.txt`.

## Attributes

- Every intrinsic is declared with `nounwind willreturn readnone`. These are
  a subset of what LLVM itself attaches to them (`nocallback nofree nosync
  nounwind speculatable willreturn memory(none)`), so they are facts, and
  `llvm-as`/`opt -passes=verify` accept them. A function whose body is
  arithmetic plus Math intrinsics is `readnone willreturn` (`hypot`, `trig`,
  `clamp`, `square` in the goldens).
- `sts_random`, `sts_exit`, and the file functions are `write`; `sts_exit`
  is additionally `noreturn`, and `callsNoReturn` removes `willreturn` from
  every function that can reach it.
- `Math.PI`/`Math.E` are constants: no memory read, `readnone` preserved.
- Identifier builtins are not user callees, so `noteEscape` in
  `attributes.ts` does not run for their arguments; that is correct because
  every runtime function they lower to declares its string parameters
  `nocapture`. `collectBuiltinFacts` (in `emit/expressions.ts`) reports their
  callees to the fixpoint; dotted builtins are already covered by
  `collectStringFacts` through `builtinCallEmitters`.

## Linking

`llvm.sin/cos/exp/log/pow.f64` become calls to libm's `sin`, `cos`, `exp`,
`log`, `pow` when the argument is not a compile-time constant (`sqrt`,
`floor`, `ceil`, `trunc`, `fabs`, `minnum`, `smin`, ... are instructions).
`tests/run.js` links the native round trips with `-lm`.

Every native profile of `scripts/build.sh` links `-lm`.

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

Negative (`.err`): `reject_math_i32` (`Math.sqrt` on an i32 `number`),
`reject_math_min_arity`, `reject_toi32_string`, `reject_readfile_number`,
`reject_unknown_builtin` (`Math.foo`), `reject_i64_literal_float`,
`reject_i64_mixed`, `reject_exit_unreachable`.

## Not in this package

- `process.argv`: needs `string[]` (WP4). The entry wrapper already accepts
  `argc`/`argv`; exposing them is a matter of building the array.
- `Number(s)` / `parseInt(s)`: string-to-number parsing was left out to stay
  within the runtime budget headroom needed for arrays; a `strtod`/`strtol`
  wrapper is a small follow-up.
- `toString(x)`: template literals and `console.log` already convert; an
  explicit function can come with string methods.
- A WASI runtime variant: the syscall-level runtime (`write`, `open`,
  `pread`) compiles under wasi-libc unchanged, but no `--target wasm32-wasi`
  profile exists yet.
- `Math.min`/`Math.max` with more than two arguments, and `Math.round`
  returning `-0`.
