# StaticTS IR cookbook

For every construct in [LANGUAGE.md](LANGUAGE.md): the smallest TypeScript
snippet that exercises it and the exact LLVM IR `statictsc` emits for it today.
The sections follow the same order as the language reference, so each heading
here has a counterpart there.

Every listing is generated, not typed in. The sources live in
[`docs/cookbook/`](cookbook/) (one `.ts` per listing, plus an `.args` file when
the snippet needs CLI flags) and [`docs/cookbook/regen.sh`](cookbook/regen.sh)
compiles each one and rewrites the block between its `<!-- cookbook:begin -->`
/ `<!-- cookbook:end -->` markers. Run it after any change to the emitter:

```bash
npm run build
docs/cookbook/regen.sh            # rewrite the listings
docs/cookbook/regen.sh --check    # CI-style: fail if the doc is stale
```

The module header (`; ModuleID`, `source_filename`) is stripped, exactly as
`tests/run.js` strips it when comparing goldens; everything else is verbatim,
including the `attributes #N` groups. Every listing passes `llvm-as` and
`opt -passes=verify` (the same snippets' shapes are covered by the goldens in
`tests/cases/`).

## Reading the attributes

Every attribute in a listing is a guarantee the compiler proved, not a hint
(see [ARCHITECTURE.md](ARCHITECTURE.md#attribute-soundness-rules)). One
sentence each:

| Attribute | Meaning |
| --- | --- |
| `nounwind` | The function never unwinds: StaticTS has no exceptions, and `throw` traps instead. |
| `willreturn` | The function always returns to its caller: every loop is a counted loop, there is no `throw`, nothing reachable calls `process.exit`, a checked `a[i]`, or an integer `/` / `%` (whose divisor check can panic), and every callee is `willreturn` too. |
| `readnone` | The function touches no memory except its own stack slots and calls only `readnone` callees (LLVM 16+ reads it as `memory(none)`). |
| `readonly` (function) | As `readnone`, except the body reads memory it does not own: a string or array header, a field, an element, or a reading callee such as `sts_str_eq`. |
| `memory(argmem: read)` | On a runtime `declare`: the callee reads only through its pointer arguments. |
| `noreturn` | The callee never returns (`sts_exit`, `sts_panic_index`, `sts_panic_div`); the call is followed by `unreachable`. |
| `cold` | The callee runs rarely (arena growth, a bounds-check failure); LLVM moves the call path out of the hot code. |
| `noinline` | Never inline the callee (`sts_arena_grow`), so the slow path stays out of the caller. |
| `alwaysinline` | Always inline the callee: the arena fast path `@sts_alloc_struct` becomes a few instructions in every caller. |
| `allocsize(0)` | The first argument is the size in bytes of the allocation the function returns, so LLVM can reason about the object's extent. |
| `noundef` | The value is never `undef` or `poison`: every StaticTS value is initialised. |
| `zeroext` | An `i1` (`boolean`) is zero-extended in a register, matching the C ABI for `bool`. |
| `nonnull` | The pointer is never null: only a `T \| null` parameter or return can be, and those do not carry it. |
| `align 8` (param/return) | The pointee is 8-byte aligned: string literals, arena strings, array headers and objects all are. |
| `dereferenceable(N)` | At least `N` bytes can be read through the pointer: `sizeof` of the struct the parameter points at, or `24` (the header) for an array. Never on a `T \| null`. |
| `readonly` (param) | The function never writes through this pointer: strings are immutable; a struct or array parameter that is never stored through, never escapes, and is only passed on to `readonly` parameters. |
| `noalias` (param) | No other pointer the function can see modifies the same memory: always true for immutable strings, and for the fresh `%this` of a constructor. |
| `noalias` (return) | The returned pointer aliases nothing the caller already holds: a fresh arena allocation. |
| `nocapture` | The function does not retain the pointer beyond the call: it is not returned, stored, or handed to a capturing callee. |
| `internal` | Linkage: the symbol is private to the module (`--strict-exports` for non-exported functions; always for the inline allocator). |
| `private unnamed_addr constant` | A string literal: module-private constant data whose address is not significant, so identical literals may be merged. |
| `align 4` / `align 8` on `alloca`, `load`, `store` | The natural alignment of the type, as clang and rustc emit. |
| `inbounds` on `getelementptr` | The computed address stays inside the object (field or element access on a valid pointer). |
| `immarg` | The operand must be a constant (the `isvolatile` flag of `llvm.memset`). |
| `nsw` (flag on `add`/`sub`/`mul`) | Only with `--nsw`: signed overflow is undefined, so LLVM may assume it never happens. Never on the compiler's own index and length arithmetic. |

`--plain` drops every attribute and alignment hint and produces the bare
form shown under [Functions](#functions).

## Functions

### A function

Parameters are SSA values (`%a`, `%b`); the module is target-neutral (no
`target triple`); the attribute group says the function is pure and always
returns.

<!-- cookbook:begin fn_add -->
```ts
function add(a: number, b: number): number {
  return a + b;
}
```

```llvm
define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn_add -->

### The same function with `--plain`

<!-- cookbook:begin fn_add_plain -->
Compiled with `--plain`.

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

```llvm
define i32 @add(i32 %a, i32 %b) {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}
```
<!-- cookbook:end fn_add_plain -->

### `--number-mode f64`

`number` becomes `double`; float constants are printed as IEEE-754 hex because
LLVM rejects decimal literals that do not round-trip exactly.

<!-- cookbook:begin fn_f64 -->
Compiled with `--number-mode f64`.

```ts
function halve(x: number): number {
  return x / 2.5;
}
```

```llvm
define noundef double @halve(double noundef %x) #0 {
entry:
  %0 = fdiv double %x, 0x4004000000000000
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn_f64 -->

## Types

### `i64` and the explicit conversions

`i64` arithmetic wraps like `i32`; `toI32` on an `i64` is a `trunc`.

<!-- cookbook:begin types_i64 -->
```ts
function square(x: i64): i64 {
  return x * x;
}

function low(x: i64): number {
  return toI32(x % 1000);
}
```

```llvm
declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef i64 @square(i64 noundef %x) #0 {
entry:
  %0 = mul i64 %x, %x
  ret i64 %0
}

define noundef i32 @low(i64 noundef %x) #1 {
entry:
  %0 = icmp eq i64 1000, 0
  %1 = icmp eq i64 %x, -9223372036854775808
  %2 = icmp eq i64 1000, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i64 %x, 1000
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end types_i64 -->

### `boolean`

`boolean` is `i1`, `zeroext` at the ABI boundary; `!` is `xor i1 %x, true`;
`&&` short-circuits through its own block and a `phi`.

<!-- cookbook:begin types_bool -->
```ts
function xor(a: boolean, b: boolean): boolean {
  return a !== b;
}

function neither(a: boolean, b: boolean): boolean {
  return !a && !b;
}
```

```llvm
define noundef zeroext i1 @xor(i1 noundef zeroext %a, i1 noundef zeroext %b) #0 {
entry:
  %0 = icmp ne i1 %a, %b
  ret i1 %0
}

define noundef zeroext i1 @neither(i1 noundef zeroext %a, i1 noundef zeroext %b) #0 {
entry:
  %0 = xor i1 %a, true
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = xor i1 %b, true
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end types_bool -->

### Numeric literals and contextual typing

`3000000000` takes `i64` from the annotation, `2` takes `f64` from the other
operand, and every `f64` constant is IEEE-754 hex.

<!-- cookbook:begin expr_literals -->
```ts
function literals(): f64 {
  const big: i64 = 3000000000;
  const ratio: f64 = 0.1;
  const scaled = ratio * 2;
  return scaled + toF64(big);
}
```

```llvm
define noundef double @literals() #0 {
entry:
  %big.addr = alloca i64, align 8
  %ratio.addr = alloca double, align 8
  %scaled.addr = alloca double, align 8
  store i64 3000000000, i64* %big.addr, align 8
  store double 0x3FB999999999999A, double* %ratio.addr, align 8
  %0 = load double, double* %ratio.addr, align 8
  %1 = fmul double %0, 0x4000000000000000
  store double %1, double* %scaled.addr, align 8
  %2 = load double, double* %scaled.addr, align 8
  %3 = load i64, i64* %big.addr, align 8
  %4 = sitofp i64 %3 to double
  %5 = fadd double %2, %4
  ret double %5
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr_literals -->

## Declarations

### Locals

`let` and `const` get an `alloca` hoisted into `entry` (`%x.addr`); reads are
`load`s, writes are `store`s. `opt -mem2reg` (part of `-O1`) promotes them to
registers, so this costs nothing.

<!-- cookbook:begin decl_locals -->
```ts
function polynomial(x: number, k: number): number {
  let acc: number = x * x * 3;
  acc = acc + k * 2;
  const bias = 7;
  return acc - bias;
}
```

```llvm
define noundef i32 @polynomial(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %acc.addr = alloca i32, align 4
  %bias.addr = alloca i32, align 4
  %0 = mul i32 %x, %x
  %1 = mul i32 %0, 3
  store i32 %1, i32* %acc.addr, align 4
  %2 = load i32, i32* %acc.addr, align 4
  %3 = mul i32 %k, 2
  %4 = add i32 %2, %3
  store i32 %4, i32* %acc.addr, align 4
  store i32 7, i32* %bias.addr, align 4
  %5 = load i32, i32* %acc.addr, align 4
  %6 = load i32, i32* %bias.addr, align 4
  %7 = sub i32 %5, %6
  ret i32 %7
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl_locals -->

### Module constants

A top-level `const` is not a global: it emits no symbol and no initialiser.
The checker folds it, and every use site carries the value — `AREA` reaches
`sts_str_from_i32` as the literal `64`, and `ret i32 64` is the whole of
`return AREA`. The template literal around it is still built at run time:
folding stops at the constant, and `${...}` is not itself a constant
expression.

<!-- cookbook:begin decl_const -->
```ts
const WIDTH: i32 = 8;
const AREA: i32 = WIDTH * WIDTH;
const LABEL: string = "area = ";

export function main(): number {
  console.log(`${LABEL}${AREA}`);
  return AREA;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"area = \00" }, align 8

declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define noundef i32 @sts_main() #0 {
entry:
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i8* @sts_str_from_i32(i32 64)
  %1 = call i8* @sts_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* %0)
  call void @sts_print(i8* %1)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 64
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end decl_const -->

### `export function main` and the entry wrapper

The user's `main` becomes `@sts_main`; the compiler adds a C-ABI `@main` that
calls it, releases the arena, and returns the exit code.

<!-- cookbook:begin decl_main -->
```ts
export function main(): number {
  console.log("hello from StaticTS");
  return 0;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"hello from StaticTS\00" }, align 8

declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @sts_main() #0 {
entry:
  call void @sts_print(i8* bitcast ({ i64, [20 x i8] }* @.str.0 to i8*))
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end decl_main -->

### `--strict-exports`

Non-exported functions get `internal` linkage so LLVM may inline, specialise
or drop them.

<!-- cookbook:begin decl_strict_exports -->
Compiled with `--strict-exports`.

```ts
export function double(n: number): number {
  return helper(n) * 2;
}

function helper(n: number): number {
  return n + 1;
}
```

```llvm
define noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = call i32 @helper(i32 %n)
  %1 = mul i32 %0, 2
  ret i32 %1
}

define internal noundef i32 @helper(i32 noundef %n) #0 {
entry:
  %0 = add i32 %n, 1
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl_strict_exports -->

### Modules: the exporter

<!-- cookbook:begin mod_math -->
```ts
export function square(n: number): number {
  return n * n;
}
```

```llvm
define noundef i32 @square(i32 noundef %n) #0 {
entry:
  %0 = mul i32 %n, %n
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end mod_math -->

### Modules: the importer

The importer `declare`s `square` with exactly the attributes the exporter's
`define` carries; the attribute-group numbers are per module, the contents are
identical.

<!-- cookbook:begin mod_main -->
```ts
import { square } from "./mod_math";

export function main(): number {
  return square(7);
}
```

```llvm
declare noundef i32 @square(i32 noundef) #0
declare void @sts_free_arena() #2

define noundef i32 @sts_main() #0 {
entry:
  %0 = call i32 @square(i32 7)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
```
<!-- cookbook:end mod_main -->

## Statements

### `if` / `else`

Blocks are named `if.then`, `if.else`, `if.end` (`.N` suffixes when reused).
A branch that already ended in `ret` gets no `br`.

<!-- cookbook:begin stmt_if -->
```ts
function abs(x: number): number {
  if (x < 0) {
    return -x;
  }
  return x;
}

function pick(flag: boolean, a: number, b: number): number {
  let r = 0;
  if (flag) {
    r = a;
  } else {
    r = b;
  }
  return r;
}
```

```llvm
define noundef i32 @abs(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sub i32 0, %x
  ret i32 %1

if.end:
  ret i32 %x
}

define noundef i32 @pick(i1 noundef zeroext %flag, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %r.addr = alloca i32, align 4
  store i32 0, i32* %r.addr, align 4
  br i1 %flag, label %if.then, label %if.else

if.then:
  store i32 %a, i32* %r.addr, align 4
  br label %if.end

if.else:
  store i32 %b, i32* %r.addr, align 4
  br label %if.end

if.end:
  %0 = load i32, i32* %r.addr, align 4
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt_if -->

### `while`

Loop-carried variables stay in allocas (no `phi`); `mem2reg` rebuilds the SSA
form. A loop that is not a counted `for` drops `willreturn`.

<!-- cookbook:begin stmt_while -->
```ts
function countDigits(n: number): number {
  let digits = 0;
  let rest = n;
  while (rest > 0) {
    rest = rest / 10;
    digits = digits + 1;
  }
  return digits;
}
```

```llvm
declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @countDigits(i32 noundef %n) #0 {
entry:
  %digits.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %digits.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %rest.addr, align 4
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %rest.addr, align 4
  %3 = icmp eq i32 10, 0
  %4 = icmp eq i32 %2, -2147483648
  %5 = icmp eq i32 10, -1
  %6 = and i1 %4, %5
  %7 = or i1 %3, %6
  br i1 %7, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = sdiv i32 %2, 10
  store i32 %8, i32* %rest.addr, align 4
  %9 = load i32, i32* %digits.addr, align 4
  %10 = add i32 %9, 1
  store i32 %10, i32* %digits.addr, align 4
  br label %while.cond

while.end:
  %11 = load i32, i32* %digits.addr, align 4
  ret i32 %11
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
```
<!-- cookbook:end stmt_while -->

### `do ... while`

<!-- cookbook:begin stmt_do -->
```ts
function sumDigits(n: number): number {
  let sum = 0;
  let rest = n;
  do {
    sum += rest % 10;
    rest = rest / 10;
  } while (rest > 0);
  return sum;
}
```

```llvm
declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @sumDigits(i32 noundef %n) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %do.body

do.body:
  %0 = load i32, i32* %sum.addr, align 4
  %1 = load i32, i32* %rest.addr, align 4
  %2 = icmp eq i32 10, 0
  %3 = icmp eq i32 %1, -2147483648
  %4 = icmp eq i32 10, -1
  %5 = and i1 %3, %4
  %6 = or i1 %2, %5
  br i1 %6, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = srem i32 %1, 10
  %8 = add i32 %0, %7
  store i32 %8, i32* %sum.addr, align 4
  %9 = load i32, i32* %rest.addr, align 4
  %10 = icmp eq i32 10, 0
  %11 = icmp eq i32 %9, -2147483648
  %12 = icmp eq i32 10, -1
  %13 = and i1 %11, %12
  %14 = or i1 %10, %13
  br i1 %14, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @sts_panic_div(i1 zeroext %10)
  unreachable

div.ok.1:
  %15 = sdiv i32 %9, 10
  store i32 %15, i32* %rest.addr, align 4
  br label %do.cond

do.cond:
  %16 = load i32, i32* %rest.addr, align 4
  %17 = icmp sgt i32 %16, 0
  br i1 %17, label %do.body, label %do.end

do.end:
  %18 = load i32, i32* %sum.addr, align 4
  ret i32 %18
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
```
<!-- cookbook:end stmt_do -->

### `for`

A counted loop (`i < n; i++` with `i` and `n` untouched in the body) keeps
`willreturn`. `continue` jumps to `for.inc`.

<!-- cookbook:begin stmt_for -->
```ts
function sumTo(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += i;
  }
  return sum;
}
```

```llvm
define noundef i32 @sumTo(i32 noundef %n) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %sum.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = add i32 %2, %3
  store i32 %4, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i32, i32* %sum.addr, align 4
  ret i32 %7
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt_for -->

### `switch`

One `switch` instruction: a constant-to-label table and a default edge, which
the backend turns into a jump table once the labels are dense enough. Empty
clauses have no block of their own — `case 1:` points at the body of `case 2:`,
which is the whole of StaticTS's fallthrough. A label that names a module
constant is folded before the table is written, so `KIND_CALL` is a `4` here.

<!-- cookbook:begin stmt_switch -->
```ts
const KIND_CALL: i32 = 4;

function classify(kind: number): number {
  switch (kind) {
    case 0:
      return 10;
    case 1:
    case 2:
      return 20;
    case KIND_CALL:
      return 30;
    default:
      return 40;
  }
}
```

```llvm
define noundef i32 @classify(i32 noundef %kind) #0 {
entry:
  switch i32 %kind, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.1
    i32 4, label %sw.case.2
  ]

sw.case:
  ret i32 10

sw.case.1:
  ret i32 20

sw.case.2:
  ret i32 30

sw.default:
  ret i32 40
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt_switch -->

### `break` / `continue`

`break` is `br label %for.end`; `continue` is `br label %for.inc`. Both end
the block they are in, so `if.then` gets no second branch. The `break` here
also disqualifies nothing: the loop is still counted, so `willreturn` stays.

<!-- cookbook:begin stmt_break_continue -->
```ts
function sumOdd(n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      continue;
    }
    if (s > 1000) {
      break;
    }
    s += i;
  }
  return s;
}
```

```llvm
declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @sumOdd(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp eq i32 2, 0
  %4 = icmp eq i32 %2, -2147483648
  %5 = icmp eq i32 2, -1
  %6 = and i1 %4, %5
  %7 = or i1 %3, %6
  br i1 %7, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = srem i32 %2, 2
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %if.then, label %if.end

if.then:
  br label %for.inc

if.end:
  %10 = load i32, i32* %s.addr, align 4
  %11 = icmp sgt i32 %10, 1000
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.end

if.end.1:
  %12 = load i32, i32* %s.addr, align 4
  %13 = load i32, i32* %i.addr, align 4
  %14 = add i32 %12, %13
  store i32 %14, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %s.addr, align 4
  ret i32 %17
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
```
<!-- cookbook:end stmt_break_continue -->

### `throw`

No unwinding: the operand is evaluated (here the literal is interned and then
unused), `llvm.trap` fires, and the block ends in `unreachable`. The function
loses `willreturn`, `readnone` and `readonly`.

<!-- cookbook:begin stmt_throw -->
```ts
function checkedDiv(a: number, b: number): number {
  if (b === 0) {
    throw "division by zero";
  }
  return a / b;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"division by zero\00" }, align 8

declare void @llvm.trap()
declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @checkedDiv(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @llvm.trap()
  unreachable

if.end:
  %1 = icmp eq i32 %b, 0
  %2 = icmp eq i32 %a, -2147483648
  %3 = icmp eq i32 %b, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 %a, %b
  ret i32 %6
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
```
<!-- cookbook:end stmt_throw -->

### `process.exit(code)`

A `noreturn` call plus `unreachable`; it is a terminator, so `finish` needs
no `return`. Every function that can reach it loses `willreturn`.

<!-- cookbook:begin stmt_process_exit -->
```ts
function finish(code: number): number {
  console.log("exiting");
  process.exit(code);
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"exiting\00" }, align 8

declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_exit(i32 noundef) #2

define noundef i32 @finish(i32 noundef %code) #0 {
entry:
  call void @sts_print(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  call void @sts_exit(i32 %code)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
```
<!-- cookbook:end stmt_process_exit -->

### `for (const x of a)`

An index loop over the header's `len`, re-read every iteration; no bounds
check is needed because the loop condition is the check.

<!-- cookbook:begin stmt_for_of -->
```ts
function total(xs: number[]): number {
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  return sum;
}
```

```llvm
%struct.sts_array = type { i64, i64, i8* }

define noundef i32 @total(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %sum.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = add i32 %9, %10
  store i32 %11, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load i32, i32* %sum.addr, align 4
  ret i32 %14
}

attributes #0 = { nounwind willreturn readonly }
```
<!-- cookbook:end stmt_for_of -->

## Expressions

### Ternary

<!-- cookbook:begin expr_ternary -->
```ts
function max(a: number, b: number): number {
  return a > b ? a : b;
}
```

```llvm
define noundef i32 @max(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp sgt i32 %a, %b
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ %a, %cond.true ], [ %b, %cond.false ]
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr_ternary -->

### Short-circuit `&&` / `||`

The right operand lives in its own block (`land.rhs`, `lor.rhs`), so
`zeroOrSmallQuotient(0)` never divides by zero.

<!-- cookbook:begin expr_logical -->
```ts
function inRange(x: number, lo: number, hi: number): boolean {
  return x >= lo && x < hi;
}

function zeroOrSmallQuotient(x: number): boolean {
  return x === 0 || 100 / x < 50;
}
```

```llvm
declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef zeroext i1 @inRange(i32 noundef %x, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %0 = icmp sge i32 %x, %lo
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp slt i32 %x, %hi
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define noundef zeroext i1 @zeroOrSmallQuotient(i32 noundef %x) #1 {
entry:
  %0 = icmp eq i32 %x, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp eq i32 %x, 0
  %2 = icmp eq i32 100, -2147483648
  %3 = icmp eq i32 %x, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 100, %x
  %7 = icmp slt i32 %6, 50
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %div.ok ]
  ret i1 %8
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end expr_logical -->

### Compound assignment, `++` / `--`

Load, apply, store; postfix yields the old value, prefix the new one.

<!-- cookbook:begin expr_compound -->
```ts
function step(): number {
  let x = 10;
  x += 5;
  x *= 2;
  const a = x++;
  const b = --x;
  return a + b;
}
```

```llvm
define noundef i32 @step() #0 {
entry:
  %x.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  store i32 10, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = add i32 %0, 5
  store i32 %1, i32* %x.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = mul i32 %2, 2
  store i32 %3, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = add i32 %4, 1
  store i32 %5, i32* %x.addr, align 4
  store i32 %4, i32* %a.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = sub i32 %6, 1
  store i32 %7, i32* %x.addr, align 4
  store i32 %7, i32* %b.addr, align 4
  %8 = load i32, i32* %a.addr, align 4
  %9 = load i32, i32* %b.addr, align 4
  %10 = add i32 %8, %9
  ret i32 %10
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr_compound -->

### Bitwise `& | ^` and `~`

One instruction each, and no panic path: unlike `/` these leave the function
`readnone` and `willreturn`. `~a` is `xor a, -1`, because LLVM has no `not`.

<!-- cookbook:begin expr_bitwise -->
```ts
function mix(a: i32, b: i32): i32 {
  return (a & b) | (a ^ b);
}

function invert(a: i32): i32 {
  return ~a;
}

function pack(hi: i32, lo: i32): i32 {
  return (hi << 16) | (lo & 65535);
}
```

```llvm
define noundef i32 @mix(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = and i32 %a, %b
  %1 = xor i32 %a, %b
  %2 = or i32 %0, %1
  ret i32 %2
}

define noundef i32 @invert(i32 noundef %a) #0 {
entry:
  %0 = xor i32 %a, -1
  ret i32 %0
}

define noundef i32 @pack(i32 noundef %hi, i32 noundef %lo) #0 {
entry:
  %0 = shl i32 %hi, 16
  %1 = and i32 %lo, 65535
  %2 = or i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr_bitwise -->

### Shifts, and the count mask

`<<` is `shl`, `>>` is `ashr` (sign-filling) and `>>>` is `lshr`
(zero-filling). The count is masked to the operand width — 31 for `i32`, 63
for `i64` — because LLVM makes a wider shift poison while JavaScript wraps the
count; StaticTS follows JavaScript. A constant count is masked at compile time
and no `and` appears (`a >> 3` below); a variable one costs the `and`.

<!-- cookbook:begin expr_shifts -->
```ts
function constantCount(a: i32): i32 {
  return a >> 3;
}

function variableCount(a: i32, n: i32): i32 {
  return a << n;
}

function fills(a: i32, n: i32): i32 {
  return (a >> n) + (a >>> n);
}

function wide(a: i64, n: i64): i64 {
  return a << n;
}
```

```llvm
define noundef i32 @constantCount(i32 noundef %a) #0 {
entry:
  %0 = ashr i32 %a, 3
  ret i32 %0
}

define noundef i32 @variableCount(i32 noundef %a, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = shl i32 %a, %0
  ret i32 %1
}

define noundef i32 @fills(i32 noundef %a, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = ashr i32 %a, %0
  %2 = and i32 %n, 31
  %3 = lshr i32 %a, %2
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i64 @wide(i64 noundef %a, i64 noundef %n) #0 {
entry:
  %0 = and i64 %n, 63
  %1 = shl i64 %a, %0
  ret i64 %1
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr_shifts -->

### Checked integer division

`/` and `%` on `i32` / `i64` test the divisor before dividing: a zero
divisor or `MIN / -1` branches to the cold `div.fail` block, which calls the
`noreturn` `sts_panic_div` (`attempt to divide by zero` when its `i1`
argument is true, `attempt to divide with overflow` otherwise) and exits 1;
`div.ok` holds the plain `sdiv`. Because the panic path exists the function
is neither `willreturn` nor `readnone`. LLVM folds the check away for a
constant divisor at `-O1`. `f64` division is a bare `fdiv`.

<!-- cookbook:begin expr_div_checked -->
```ts
function div(a: number, b: number): number {
  return a / b;
}
```

```llvm
declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @div(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  %1 = icmp eq i32 %a, -2147483648
  %2 = icmp eq i32 %b, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 %a, %b
  ret i32 %5
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
```
<!-- cookbook:end expr_div_checked -->

### Unsigned integers

`u8`/`u16`/`u32`/`u64` *are* `i8`/`i16`/`i32`/`i64`: LLVM has no unsigned
types, so the signedness is carried by the instruction. `udiv` replaces
`sdiv`, `icmp ult` replaces `icmp slt`, `>>` becomes `lshr` instead of `ashr`,
and a widening conversion is `zext` instead of `sext`. Two things are worth
looking at in the listing below:

- `divide` checks the divisor with **one** `icmp eq ..., 0`. Unsigned division
  has no `MIN / -1` case, so the three extra instructions the signed version
  needs above are simply absent.
- `reinterpret` has an empty body. A conversion between two integers of the
  same width and different signedness moves no bits and emits no instruction,
  which is why an unsigned type costs nothing to represent.

<!-- cookbook:begin expr_unsigned -->
```ts
function divide(a: u32, b: u32): u32 {
  return a / b;
}

function below(a: u32, b: u32): boolean {
  return a < b;
}

function halve(a: u32): u32 {
  return a >> 1;
}

function widen(a: u32): u64 {
  return toU64(a);
}

function reinterpret(a: i32): u32 {
  return toU32(a);
}
```

```llvm
declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef i32 @divide(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  br i1 %0, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %1 = udiv i32 %a, %b
  ret i32 %1
}

define noundef zeroext i1 @below(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = icmp ult i32 %a, %b
  ret i1 %0
}

define noundef i32 @halve(i32 noundef %a) #1 {
entry:
  %0 = lshr i32 %a, 1
  ret i32 %0
}

define noundef i64 @widen(i32 noundef %a) #1 {
entry:
  %0 = zext i32 %a to i64
  ret i64 %0
}

define noundef i32 @reinterpret(i32 noundef %a) #1 {
entry:
  ret i32 %a
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end expr_unsigned -->

### `f32`

`f32` is LLVM's `float`: the same instructions as `f64`, one width down.
`fptrunc` narrows from a double and `fpext` widens back, and a float-to-integer
conversion uses the saturating intrinsic with an `.f32` source suffix.

The constant is the part worth reading closely. LLVM writes a `float` constant
with the **64-bit** hex of the double it equals, and requires that double to be
exactly representable as a float — so `0.1` as an `f32` is
`0x3FB99999A0000000`, the double nearest to `(float) 0.1`, and not the `f64`
spelling `0x3FB999999999999A`.

<!-- cookbook:begin expr_f32 -->
```ts
function blend(a: f32, b: f32): f32 {
  return (a + b) / b;
}

function narrow(x: f64): f32 {
  return toF32(x);
}

function widen(x: f32): f64 {
  return toF64(x);
}

function truncate(x: f32): i32 {
  return toI32(x);
}

function tenth(): f32 {
  return 0.1;
}
```

```llvm
declare i32 @llvm.fptosi.sat.i32.f32(float) #0

define noundef float @blend(float noundef %a, float noundef %b) #0 {
entry:
  %0 = fadd float %a, %b
  %1 = fdiv float %0, %b
  ret float %1
}

define noundef float @narrow(double noundef %x) #0 {
entry:
  %0 = fptrunc double %x to float
  ret float %0
}

define noundef double @widen(float noundef %x) #0 {
entry:
  %0 = fpext float %x to double
  ret double %0
}

define noundef i32 @truncate(float noundef %x) #0 {
entry:
  %0 = call i32 @llvm.fptosi.sat.i32.f32(float %x)
  ret i32 %0
}

define noundef float @tenth() #0 {
entry:
  ret float 0x3FB99999A0000000
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr_f32 -->

## Strings

### Literals

A literal is `{ i64 len, [len+1 x i8] }` constant data referenced through a
constant `bitcast`; identical literals share one constant; no allocation, so
the functions stay `readnone`.

<!-- cookbook:begin str_literal -->
```ts
function greeting(): string {
  return "hello, world";
}

function same(): string {
  return "hello, world";
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"hello, world\00" }, align 8

define noundef nonnull align 8 i8* @greeting() #0 {
entry:
  ret i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*)
}

define noundef nonnull align 8 i8* @same() #0 {
entry:
  ret i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*)
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end str_literal -->

### `+`, `===`, `.length`

`+` calls `sts_str_concat` (allocates: effect `write`), `===` calls
`sts_str_eq` (reads: caller becomes `readonly`), `.length` is a direct
`load i64` of the header (no call).

<!-- cookbook:begin str_ops -->
```ts
function join(a: string, b: string): string {
  return a + b;
}

function same(a: string, b: string): boolean {
  return a === b;
}

function len(s: string): number {
  return s.length;
}
```

```llvm
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @sts_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2

define noundef nonnull align 8 i8* @join(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call i8* @sts_str_concat(i8* %a, i8* %b)
  ret i8* %0
}

define noundef zeroext i1 @same(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #1 {
entry:
  %0 = call zeroext i1 @sts_str_eq(i8* %a, i8* %b)
  ret i1 %0
}

define noundef i32 @len(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn memory(argmem: read) }
```
<!-- cookbook:end str_ops -->

### The byte methods

`charCodeAt` is the array bounds check against the byte length, one
`getelementptr` past the 8-byte header and a `load i8` — no call, so a
function that only reads bytes stays `readonly`. `substring` is JavaScript's
clamp (`llvm.smin` / `llvm.smax` into `[0, len]`, then the pair in order) and
one `sts_str_new`: one allocation, one `memcpy`. `startsWith` and `endsWith`
are a single `sts_str_at`, which reads through `nocapture readonly`
parameters.

Under `opt -O2` the clamp of a literal `0` folds away entirely and `head`
becomes `max(0, min(n, len))` and the call.

<!-- cookbook:begin str_bytes -->
```ts
function firstByte(s: string): number {
  return s.charCodeAt(0);
}

function head(s: string, n: number): string {
  return s.substring(0, n);
}

function has(s: string, sub: string): boolean {
  return s.startsWith(sub) || s.endsWith(sub);
}
```

```llvm
declare noalias noundef nonnull align 8 i8* @sts_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare zeroext i1 @sts_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4

define noundef i32 @firstByte(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds i8, i8* %s, i64 8
  %4 = getelementptr inbounds i8, i8* %3, i64 0
  %5 = load i8, i8* %4, align 1
  %6 = zext i8 %5 to i32
  ret i32 %6
}

define noundef nonnull align 8 i8* @head(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %n) #1 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @llvm.smin.i64(i64 0, i64 %1)
  %3 = call i64 @llvm.smax.i64(i64 %2, i64 0)
  %4 = sext i32 %n to i64
  %5 = call i64 @llvm.smin.i64(i64 %4, i64 %1)
  %6 = call i64 @llvm.smax.i64(i64 %5, i64 0)
  %7 = call i64 @llvm.smin.i64(i64 %3, i64 %6)
  %8 = call i64 @llvm.smax.i64(i64 %3, i64 %6)
  %9 = sub i64 %8, %7
  %10 = getelementptr inbounds i8, i8* %s, i64 8
  %11 = getelementptr inbounds i8, i8* %10, i64 %7
  %12 = call i8* @sts_str_new(i8* %11, i64 %9)
  ret i8* %12
}

define noundef zeroext i1 @has(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub) #0 {
entry:
  %0 = call zeroext i1 @sts_str_at(i8* %s, i64 0, i8* %sub)
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = bitcast i8* %sub to i64*
  %4 = load i64, i64* %3, align 8
  %5 = sub i64 %2, %4
  %6 = call zeroext i1 @sts_str_at(i8* %s, i64 %5, i8* %sub)
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  ret i1 %7
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
```
<!-- cookbook:end str_bytes -->

### Template literals

Constant parts are interned, holes are converted (`sts_str_from_i32`, a
`select` for booleans, identity for strings), and everything is chained
through `sts_str_concat`.

<!-- cookbook:begin str_template -->
```ts
function describe(n: number, ok: boolean, name: string): string {
  return `${name}: n=${n}, ok=${ok}`;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c": n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c", ok=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define noundef nonnull align 8 i8* @describe(i32 noundef %n, i1 noundef zeroext %ok, i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %0 = call i8* @sts_str_concat(i8* %name, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = call i8* @sts_str_from_i32(i32 %n)
  %2 = call i8* @sts_str_concat(i8* %0, i8* %1)
  %3 = call i8* @sts_str_concat(i8* %2, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %4 = select i1 %ok, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %5 = call i8* @sts_str_concat(i8* %3, i8* %4)
  ret i8* %5
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end str_template -->

### `console.log`

<!-- cookbook:begin str_console_log -->
```ts
function report(): void {
  console.log("text");
  console.log(7);
  console.log(false);
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"text\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define void @report() #0 {
entry:
  %arena.mark = call i64 @sts_arena_mark()
  call void @sts_print(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %0 = call i8* @sts_str_from_i32(i32 7)
  call void @sts_print(i8* %0)
  %1 = select i1 false, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %1)
  call void @sts_arena_release(i64 %arena.mark)
  ret void
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end str_console_log -->

## Arrays

### `a[i]` read and write, with the bounds check

Unsigned compare against `len`; the failing branch calls the `noreturn cold`
`sts_panic_index`. `a` is `readonly` in `get` (never stored through) and only
`nocapture` in `set`.

<!-- cookbook:begin arr_index -->
```ts
function get(a: number[], i: number): number {
  return a[i];
}

function set(a: number[], i: number, v: number): void {
  a[i] = v;
}
```

```llvm
%struct.sts_array = type { i64, i64, i8* }

declare void @sts_panic_index(i64 noundef, i64 noundef) #1

define noundef i32 @get(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4
  ret i32 %8
}

define void @set(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) nocapture %a, i32 noundef %i, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  store i32 %v, i32* %7, align 4
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
```
<!-- cookbook:end arr_index -->

### `--unchecked-indexing`

The compare, the branch and the panic block disappear; `get` regains
`willreturn` and becomes `readonly`. Out-of-range is then undefined
behaviour.

<!-- cookbook:begin arr_unchecked -->
Compiled with `--unchecked-indexing`.

```ts
function get(a: number[], i: number): number {
  return a[i];
}
```

```llvm
%struct.sts_array = type { i64, i64, i8* }

define noundef i32 @get(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %a, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4
  ret i32 %5
}

attributes #0 = { nounwind willreturn readonly }
```
<!-- cookbook:end arr_unchecked -->

### Literals and `push`

`[]` stores `len = cap = 0` and a null `data`; `push` grows through
`sts_array_grow` only when `len == cap`; `[1, 2]` allocates the header (24
bytes) and the data (`n * sizeof(T)`).

<!-- cookbook:begin arr_literal_push -->
```ts
function squares(n: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i * i);
  }
  return xs;
}

function pair(): number[] {
  return [1, 2];
}
```

```llvm
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef nonnull align 8 dereferenceable(24) %struct.sts_array* @squares(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8
  store %struct.sts_array* %1, %struct.sts_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = mul i32 %8, %9
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %7, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 %10, i32* %19, align 4
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  ret %struct.sts_array* %24
}

define noundef nonnull align 8 dereferenceable(24) %struct.sts_array* @pair() #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8
  %4 = call i8* @sts_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4
  ret %struct.sts_array* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end arr_literal_push -->

### `new Array<T>(n)` and `.length`

`new Array<number>(n)` allocates and zero-fills with `llvm.memset`;
`.length` is one `load` of the header.

<!-- cookbook:begin arr_new -->
```ts
function zeros(n: number): number[] {
  return new Array<number>(n);
}

function len(xs: number[]): number {
  return xs.length;
}
```

```llvm
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef nonnull align 8 dereferenceable(24) %struct.sts_array* @zeros(i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = call i8* @sts_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.sts_array*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8
  %5 = mul i64 %0, 4
  %6 = call i8* @sts_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false)
  %7 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8
  ret %struct.sts_array* %2
}

define noundef i32 @len(%struct.sts_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end arr_new -->

## Classes and interfaces

### Class, `new`, constructor, method, field read and write

`%struct.Point = type { i32, i32 }`; `new` is the inline allocator plus a
`bitcast` and a constructor call; methods are `@Point.method` with `%this`
first; fields are `getelementptr inbounds` + `load`/`store`.

<!-- cookbook:begin cls_point -->
```ts
class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}

function origin(): number {
  const p = new Point(3, 4);
  p.x = 0;
  return p.manhattan();
}
```

```llvm
%struct.Point = type { i32, i32 }

define void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  ret void
}

define noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @origin() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %0, i32 0, i32 0
  store i32 0, i32* %1, align 4
  %2 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %3 = call i32 @Point.manhattan(%struct.Point* %2)
  ret i32 %3
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
```
<!-- cookbook:end cls_point -->

### Field initializers without a constructor

`new Defaults()` stores the literals inline; there is no
`@Defaults.constructor` symbol.

<!-- cookbook:begin cls_initializers -->
```ts
class Defaults {
  n: number = 42;
  flag: boolean = true;
  name: string = "anon";
}

function make(): Defaults {
  return new Defaults();
}
```

```llvm
%struct.Defaults = type { i32, i1, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"anon\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef nonnull align 8 dereferenceable(16) %struct.Defaults* @make() #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Defaults*
  %2 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 0
  store i32 42, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 1
  store i1 true, i1* %3, align 1
  %4 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 2
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %4, align 8
  ret %struct.Defaults* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end cls_initializers -->

### Interfaces, object literals, `implements`

An object literal allocates and stores every field; a class that `implements`
an interface converts to it with one `bitcast` because the layouts are
identical.

<!-- cookbook:begin cls_interface -->
```ts
interface Pair {
  first: number;
  second: number;
}

class Ordered implements Pair {
  first: number;
  second: number;

  constructor(a: number, b: number) {
    this.first = a;
    this.second = b;
  }
}

function swap(p: Pair): Pair {
  return { first: p.second, second: p.first };
}

function asPair(o: Ordered): Pair {
  return o;
}
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Ordered = type { i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @Ordered.constructor(%struct.Ordered* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Ordered, %struct.Ordered* %this, i32 0, i32 0
  store i32 %a, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Ordered, %struct.Ordered* %this, i32 0, i32 1
  store i32 %b, i32* %1, align 4
  ret void
}

define noundef nonnull align 8 dereferenceable(8) %struct.Pair* @swap(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #0 {
entry:
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 %6, i32* %7, align 4
  ret %struct.Pair* %1
}

define noundef nonnull align 8 dereferenceable(8) %struct.Pair* @asPair(%struct.Ordered* noundef nonnull align 8 dereferenceable(8) %o) #1 {
entry:
  %0 = bitcast %struct.Ordered* %o to %struct.Pair*
  ret %struct.Pair* %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end cls_interface -->

### Inheritance: `extends`, `super`, static dispatch

`%struct.Square` starts with `%struct.Shape`'s fields, so a `Square` becomes a
`Shape` with one `bitcast` (the argument of `areaOf`, the `this` of
`Shape.constructor` and `Shape.area`). Every call is resolved by the
receiver's declared type: `sq.area()` is `Square.area`, `s.area()` inside
`areaOf` is `Shape.area` even when the object is a `Square`, and
`super.area()` names the base implementation.

<!-- cookbook:begin cls_inheritance -->
```ts
class Shape {
  x: number;

  constructor(x: number) {
    this.x = x;
  }

  area(): number {
    return 0;
  }
}

class Square extends Shape {
  side: number;

  constructor(x: number, side: number) {
    super(x);
    this.side = side;
  }

  area(): number {
    return this.side * this.side;
  }

  baseArea(): number {
    return super.area();
  }
}

// Static dispatch: `s` is declared a Shape, so this is always Shape.area.
function areaOf(s: Shape): number {
  return s.area() + s.x;
}

function squareArea(sq: Square): number {
  return sq.area() + areaOf(sq) + sq.baseArea();
}
```

```llvm
%struct.Shape = type { i32 }
%struct.Square = type { i32, i32 }

define void @Shape.constructor(%struct.Shape* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #0 {
entry:
  %0 = getelementptr inbounds %struct.Shape, %struct.Shape* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  ret void
}

define noundef i32 @Shape.area(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  ret i32 0
}

define void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %side) #0 {
entry:
  %0 = bitcast %struct.Square* %this to %struct.Shape*
  call void @Shape.constructor(%struct.Shape* %0, i32 %x)
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4
  ret void
}

define noundef i32 @Square.area(%struct.Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = mul i32 %1, %3
  ret i32 %4
}

define noundef i32 @Square.baseArea(%struct.Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = bitcast %struct.Square* %this to %struct.Shape*
  %1 = call i32 @Shape.area(%struct.Shape* %0)
  ret i32 %1
}

define noundef i32 @areaOf(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(4) nocapture %s) #2 {
entry:
  %0 = call i32 @Shape.area(%struct.Shape* %s)
  %1 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  %3 = add i32 %0, %2
  ret i32 %3
}

define noundef i32 @squareArea(%struct.Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %sq) #2 {
entry:
  %0 = call i32 @Square.area(%struct.Square* %sq)
  %1 = bitcast %struct.Square* %sq to %struct.Shape*
  %2 = call i32 @areaOf(%struct.Shape* %1)
  %3 = add i32 %0, %2
  %4 = call i32 @Square.baseArea(%struct.Square* %sq)
  %5 = add i32 %3, %4
  ret i32 %5
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn readonly }
```
<!-- cookbook:end cls_inheritance -->

## Memory

### A stack-allocated object

An object (or object literal, or array literal) whose value provably never
outlives its function is an entry-block `alloca` instead of an arena bump
([LANGUAGE.md: Memory model](LANGUAGE.md#memory-model)). `swapped` only
reads and writes its own `%Pair.obj`, so it is `readnone`; `nearest` runs
the constructor on `%Point.obj` and inherits its `write` effect. Nothing in
the module touches the arena, so there is no arena prelude at all.

<!-- cookbook:begin mem_stack_object -->
```ts
interface Pair {
  first: number;
  second: number;
}

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}

// An object literal that is only read: the function's own memory, so `readnone`.
function swapped(a: number, b: number): number {
  const p: Pair = { first: b, second: a };
  return p.first * 10 + p.second;
}

// A constructed object that never escapes: an alloca, the constructor writes through it.
function nearest(x: number): number {
  const p = new Point(x, 4);
  return p.manhattan();
}
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Point = type { i32, i32 }

define void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  ret void
}

define noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #2 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %Pair.obj = alloca %struct.Pair, align 8
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 0
  store i32 %b, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 1
  store i32 %a, i32* %1, align 4
  store %struct.Pair* %Pair.obj, %struct.Pair** %p.addr, align 8
  %2 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = mul i32 %4, 10
  %6 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = add i32 %5, %8
  ret i32 %9
}

define noundef i32 @nearest(i32 noundef %x) #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  call void @Point.constructor(%struct.Point* %Point.obj, i32 %x, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %1 = call i32 @Point.manhattan(%struct.Point* %0)
  ret i32 %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end mem_stack_object -->

### The same module with `--no-stack-alloc`

Every object is bumped from the arena by the inlined allocator, and because
each one still dies with its function, both functions get an automatic
arena scope: `sts_arena_mark` after the allocas, `sts_arena_release` before
the `ret`. This is the IR every `new` produced before WP6.

<!-- cookbook:begin mem_stack_object_arena -->
Compiled with `--no-stack-alloc`.

```ts
interface Pair {
  first: number;
  second: number;
}

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}

// An object literal that is only read: the function's own memory, so `readnone`.
function swapped(a: number, b: number): number {
  const p: Pair = { first: b, second: a };
  return p.first * 10 + p.second;
}

// A constructed object that never escapes: an alloca, the constructor writes through it.
function nearest(x: number): number {
  const p = new Point(x, 4);
  return p.manhattan();
}
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Point = type { i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  ret void
}

define noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add i32 %1, %3
  ret i32 %4
}

define noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %b, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 %a, i32* %3, align 4
  store %struct.Pair* %1, %struct.Pair** %p.addr, align 8
  %4 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %5 = getelementptr inbounds %struct.Pair, %struct.Pair* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = mul i32 %6, 10
  %8 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %9 = getelementptr inbounds %struct.Pair, %struct.Pair* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  %11 = add i32 %7, %10
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %11
}

define noundef i32 @nearest(i32 noundef %x) #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 %x, i32 4)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  %2 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %3 = call i32 @Point.manhattan(%struct.Point* %2)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %3
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end mem_stack_object_arena -->

### An arena-scoped function

A string built by `+` is an arena temporary that cannot go on the stack. In
`greet` it dies with the call (it is only printed), so the function marks
the arena on entry and releases it before returning: called a million
times, `Arena.used()` stays flat. `label` returns its template, so the
caller owns that memory and `label` gets no scope.

<!-- cookbook:begin mem_arena_scope -->
```ts
// The concatenation is an arena temporary that dies with the call, so the
// function marks the arena on entry and releases it before returning.
function greet(name: string): void {
  console.log("hello, " + name + "!");
}

// The template is returned, so the caller owns it: no scope here.
function label(name: string): string {
  return `<${name}>`;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"hello, \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8

declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0

define void @greet(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i8* @sts_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* %name)
  %1 = call i8* @sts_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  call void @sts_print(i8* %1)
  call void @sts_arena_release(i64 %arena.mark)
  ret void
}

define noundef nonnull align 8 i8* @label(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %0 = call i8* @sts_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %name)
  %1 = call i8* @sts_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  ret i8* %1
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end mem_arena_scope -->

### `Arena.mark` / `release` / `used` / `reset`

The explicit builtins lower to one runtime call each. `measure` calls
`Arena.release` itself, so the compiler never wraps it in an automatic
scope (its own mark would be invalidated by the user's release); the
8000-byte `new Array<number>(2000)` is over the 4096-byte stack cap, so it
is an arena allocation that the release reclaims.

<!-- cookbook:begin mem_arena_builtins -->
```ts
function measure(): i64 {
  const m = Arena.mark();
  const xs = new Array<number>(2000); // 8000 bytes: over the 4096-byte stack cap, so arena
  const used = Arena.used();
  Arena.release(m);
  return used + toI64(xs.length);
}

function recycle(): void {
  Arena.reset();
}
```

```llvm
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare void @sts_reset_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noundef i64 @sts_arena_used() #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i64 @measure() #0 {
entry:
  %m.addr = alloca i64, align 8
  %xs.addr = alloca %struct.sts_array*, align 8
  %used.addr = alloca i64, align 8
  %0 = call i64 @sts_arena_mark()
  store i64 %0, i64* %m.addr, align 8
  %1 = call i8* @sts_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.sts_array*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 0
  store i64 2000, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 1
  store i64 2000, i64* %4, align 8
  %5 = mul i64 2000, 4
  %6 = call i8* @sts_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false)
  %7 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8
  store %struct.sts_array* %2, %struct.sts_array** %xs.addr, align 8
  %8 = call i64 @sts_arena_used()
  store i64 %8, i64* %used.addr, align 8
  %9 = load i64, i64* %m.addr, align 8
  call void @sts_arena_release(i64 %9)
  %10 = load i64, i64* %used.addr, align 8
  %11 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %12 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = sext i32 %14 to i64
  %16 = add i64 %10, %15
  ret i64 %16
}

define void @recycle() #0 {
entry:
  call void @sts_reset_arena()
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end mem_arena_builtins -->

### `T | null` and narrowing

A nullable value is the same pointer type as `T`; `null` is the constant
`null` and the tests are `icmp eq` / `icmp ne` against it. Narrowing costs
nothing at run time: inside the guarded region the checker simply reads the
variable as `T`. Nullable parameters and returns lose `nonnull` and
`dereferenceable` but keep `align 8`, `readonly`, and `nocapture` where the
usual rules allow them.

<!-- cookbook:begin mem_nullable -->
```ts
class Node {
  value: number;
  next: Node | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

function valueOr(n: Node | null, fallback: number): number {
  return n !== null ? n.value : fallback;
}

function sum(head: Node | null): number {
  let total = 0;
  let cur: Node | null = head;
  while (cur !== null) {
    total += cur.value;
    cur = cur.next;
  }
  return total;
}
```

```llvm
%struct.Node = type { i32, %struct.Node* }

define void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* null, %struct.Node** %0, align 8
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %1, align 4
  ret void
}

define noundef i32 @valueOr(%struct.Node* noundef readonly align 8 nocapture %n, i32 noundef %fallback) #1 {
entry:
  %0 = icmp ne %struct.Node* %n, null
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %fallback, %cond.false ]
  ret i32 %3
}

define noundef i32 @sum(%struct.Node* noundef align 8 %head) #2 {
entry:
  %total.addr = alloca i32, align 4
  %cur.addr = alloca %struct.Node*, align 8
  store i32 0, i32* %total.addr, align 4
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %1 = icmp ne %struct.Node* %0, null
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %4 = getelementptr inbounds %struct.Node, %struct.Node* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = add i32 %2, %5
  store i32 %6, i32* %total.addr, align 4
  %7 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %7, i32 0, i32 1
  %9 = load %struct.Node*, %struct.Node** %8, align 8
  store %struct.Node* %9, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %10 = load i32, i32* %total.addr, align 4
  ret i32 %10
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind readonly }
```
<!-- cookbook:end mem_nullable -->

## Builtins

### `Math.*` on `f64`

`Math.sqrt` is `llvm.sqrt.f64`; `Math.round` is the floor/compare/select
sequence that matches JavaScript's round-half-up; `Math.min`/`max` are
`llvm.minnum`/`maxnum`. All intrinsics are `readnone willreturn`, so the
callers stay pure.

<!-- cookbook:begin builtin_math_f64 -->
Compiled with `--number-mode f64`.

```ts
function hypot(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

function roundHalfUp(x: number): number {
  return Math.round(x);
}

function clamp01(x: number): number {
  return Math.min(Math.max(x, 0), 1);
}
```

```llvm
declare double @llvm.sqrt.f64(double) #0
declare double @llvm.floor.f64(double) #0
declare double @llvm.minnum.f64(double, double) #0
declare double @llvm.maxnum.f64(double, double) #0

define noundef double @hypot(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fmul double %a, %a
  %1 = fmul double %b, %b
  %2 = fadd double %0, %1
  %3 = call double @llvm.sqrt.f64(double %2)
  ret double %3
}

define noundef double @roundHalfUp(double noundef %x) #0 {
entry:
  %0 = call double @llvm.floor.f64(double %x)
  %1 = fsub double %x, %0
  %2 = fcmp oge double %1, 0x3FE0000000000000
  %3 = fadd double %0, 0x3FF0000000000000
  %4 = select i1 %2, double %3, double %0
  ret double %4
}

define noundef double @clamp01(double noundef %x) #0 {
entry:
  %0 = call double @llvm.maxnum.f64(double %x, double 0x0000000000000000)
  %1 = call double @llvm.minnum.f64(double %0, double 0x3FF0000000000000)
  ret double %1
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin_math_f64 -->

### `Math.abs` / `min` / `max` on integers, `Math.PI`

<!-- cookbook:begin builtin_math_i32 -->
```ts
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

function magnitude(x: number): number {
  return Math.abs(x);
}

function tau(): f64 {
  return Math.PI * 2;
}
```

```llvm
declare i32 @llvm.abs.i32(i32, i1) #0
declare i32 @llvm.smin.i32(i32, i32) #0
declare i32 @llvm.smax.i32(i32, i32) #0

define noundef i32 @clamp(i32 noundef %x, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %0 = call i32 @llvm.smax.i32(i32 %x, i32 %lo)
  %1 = call i32 @llvm.smin.i32(i32 %0, i32 %hi)
  ret i32 %1
}

define noundef i32 @magnitude(i32 noundef %x) #0 {
entry:
  %0 = call i32 @llvm.abs.i32(i32 %x, i1 false)
  ret i32 %0
}

define noundef double @tau() #0 {
entry:
  %0 = fmul double 0x400921FB54442D18, 0x4000000000000000
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin_math_i32 -->

### `toI32` / `toI64` / `toF64`

`sext`, `sitofp`, and the saturating `llvm.fptosi.sat` for `f64` to integer.

<!-- cookbook:begin builtin_conversions -->
```ts
function widen(n: number): i64 {
  return toI64(n);
}

function narrow(x: f64): number {
  return toI32(x);
}

function toDouble(n: number): f64 {
  return toF64(n);
}
```

```llvm
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

define noundef i64 @widen(i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  ret i64 %0
}

define noundef i32 @narrow(double noundef %x) #0 {
entry:
  %0 = call i32 @llvm.fptosi.sat.i32.f64(double %x)
  ret i32 %0
}

define noundef double @toDouble(i32 noundef %n) #0 {
entry:
  %0 = sitofp i32 %n to double
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin_conversions -->

### `Math.random`

`sts_random` mutates global state (effect `write`), so `coin` is not pure.

<!-- cookbook:begin builtin_random -->
```ts
function coin(): boolean {
  return Math.random() < 0.5;
}
```

```llvm
declare noundef double @sts_random() #0

define noundef zeroext i1 @coin() #0 {
entry:
  %0 = call double @sts_random()
  %1 = fcmp olt double %0, 0x3FE0000000000000
  ret i1 %1
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end builtin_random -->

### File I/O

<!-- cookbook:begin builtin_files -->
```ts
export function main(): number {
  writeFileSync("out.txt", "hello\n");
  appendFileSync("out.txt", "world\n");
  const text = readFileSync("out.txt");
  console.log(text.length);
  return 0;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"out.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"hello\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"world\0A\00" }, align 8

declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @sts_main() #0 {
entry:
  %text.addr = alloca i8*, align 8
  %arena.mark = call i64 @sts_arena_mark()
  call void @sts_write_file(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  call void @sts_append_file(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  %0 = call i8* @sts_read_file(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %text.addr, align 8
  %1 = load i8*, i8** %text.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = call i8* @sts_str_from_i32(i32 %4)
  call void @sts_print(i8* %5)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end builtin_files -->

## Optimisation flags

### `--nsw`

Every user-level integer `add`, `sub`, and `mul` (binary operators, unary
minus, `op=`, `++`/`--`) carries `nsw`: signed overflow becomes undefined
behaviour, as in C, and LLVM may widen induction variables and fold
`(a + 1) - 1`. Division and remainder have no `nsw` form and the compiler's
own index and length arithmetic is never flagged. The default emits no
`nsw` at all (wrapping, as in Rust release builds).

<!-- cookbook:begin opt_nsw -->
Compiled with `--nsw`.

```ts
function poly(x: number, y: number): number {
  return x * x - 3 * y + -x;
}
```

```llvm
define noundef i32 @poly(i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = mul nsw i32 %x, %x
  %1 = mul nsw i32 3, %y
  %2 = sub nsw i32 %0, %1
  %3 = sub nsw i32 0, %x
  %4 = add nsw i32 %2, %3
  ret i32 %4
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end opt_nsw -->

### `--target`

The module carries `target datalayout` and `target triple` (the strings
clang 18 emits for that triple), so `opt -O2 -S` and `llc` see the real
pointer size, alignments, and vector width without `-mtriple`. Without the
flag the module is target-neutral and clang fills both in at link time.
`--target host` picks the running machine's triple.

<!-- cookbook:begin opt_target -->
Compiled with `--target x86_64-unknown-linux-gnu`.

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

```llvm
target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"
target triple = "x86_64-unknown-linux-gnu"

define noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end opt_target -->

## The runtime prelude

`--runtime-decls` forces every runtime declaration plus the inline arena
allocator into the module (normally only the symbols a module uses are
declared). This is the complete C ABI a compiled module can depend on; the
struct layouts must match `runtime/runtime.c` byte for byte.

<!-- cookbook:begin runtime_prelude -->
Compiled with `--runtime-decls`.

```ts
function identity(s: string): string {
  return s;
}
```

```llvm
%struct.sts_arena = type { i8*, i64, i64, i8* }
%struct.sts_array = type { i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8
@sts_argv = external global %struct.sts_array*, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare void @sts_reset_arena() #2
declare void @sts_free_arena() #2
declare noundef i64 @sts_arena_mark() #2
declare void @sts_arena_release(i64 noundef) #2
declare noundef i64 @sts_arena_used() #2
declare noalias noundef nonnull align 8 i8* @sts_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @sts_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare zeroext i1 @sts_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @sts_str_len(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i64(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_u64(i64 noundef) #2
declare noundef double @sts_random() #2
declare void @sts_exit(i32 noundef) #4
declare noalias noundef nonnull align 8 i8* @sts_read_file(i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @sts_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 %struct.sts_array* @sts_alloc_array(i64 noundef, i64 noundef) #2
declare void @sts_panic_index(i64 noundef, i64 noundef) #5
declare void @sts_panic_div(i1 noundef zeroext) #5

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #6 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef nonnull align 8 i8* @identity(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  ret i8* %s
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end runtime_prelude -->
