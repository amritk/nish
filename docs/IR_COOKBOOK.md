# Nish IR cookbook

For every construct in [LANGUAGE.md](LANGUAGE.md): the smallest TypeScript
snippet that exercises it and the exact LLVM IR `nish` emits for it today.
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
| `nounwind` | The function never unwinds: Nish has no exceptions, no `throw`, and no landing pads. A failure a caller should handle is a `Result<T, E>`. |
| `willreturn` | The function always returns to its caller: every loop is a counted loop, nothing reachable calls `process.exit`, `panic`, `expect` on a failed `Result`, a checked `a[i]`, or an integer `/` / `%` (whose divisor check can panic), and every callee is `willreturn` too. |
| `readnone` | The function touches no memory except its own stack slots and calls only `readnone` callees (LLVM 16+ reads it as `memory(none)`). |
| `readonly` (function) | As `readnone`, except the body reads memory it does not own: a string or array header, a field, an element, or a reading callee such as `nish_str_eq`. |
| `memory(argmem: read)` | On a runtime `declare`: the callee reads only through its pointer arguments. |
| `noreturn` | The callee never returns (`nish_exit`, `nish_panic_index`, `nish_panic_slice`, `nish_panic_div`); the call is followed by `unreachable`. |
| `cold` | The callee runs rarely (arena growth, a bounds-check failure); LLVM moves the call path out of the hot code. |
| `noinline` | Never inline the callee (`nish_arena_grow`), so the slow path stays out of the caller. |
| `alwaysinline` | Always inline the callee: the arena fast path `@nish_alloc_struct` becomes a few instructions in every caller. |
| `allocsize(0)` | The first argument is the size in bytes of the allocation the function returns, so LLVM can reason about the object's extent. |
| `noundef` | The value is never `undef` or `poison`: every Nish value is initialised. Not emitted for a by-value `Result` under the private ABI, whose dead arm is `undef` on purpose (WP15 §7b). |
| `!tbaa` | What the access *is*, not where it points: a field named by its class, LLVM type and byte offset. Lets LLVM keep a store to `bi.vx` from blocking a load of `bj.mass` through a different pointer. Only on classes that implement no interface. |
| `zeroext` | An `i1` (`boolean`) is zero-extended in a register, matching the C ABI for `bool`. |
| `nonnull` | The pointer is never null: only a `T \| null` parameter or return can be, and those do not carry it. |
| `align 8` (param/return) | The pointee is 8-byte aligned: string literals, arena strings, array headers and objects all are. |
| `dereferenceable(N)` | At least `N` bytes can be read through the pointer: `sizeof` of the struct the parameter points at, or `24` (the header) for an array. Never on a `T \| null`. |
| `readonly` (param) | The function never writes through this pointer: strings are immutable; a struct or array parameter that is never stored through, never escapes, and is only passed on to `readonly` parameters. |
| `noalias` (param) | No other pointer the function can see modifies the same memory: always true for immutable strings, and for the fresh `%this` of a constructor. |
| `noalias` (return) | The returned pointer aliases nothing the caller already holds: a fresh arena allocation. |
| `nocapture` | The function does not retain the pointer beyond the call: it is not returned, stored, or handed to a capturing callee. |
| `internal` | Linkage: the symbol is private to the module. Every function without `export` gets it by default (`--no-strict-exports` opts out); the inline allocator always does. |
| `private unnamed_addr constant` | A string literal: module-private constant data whose address is not significant, so identical literals may be merged. |
| `align 4` / `align 8` on `alloca`, `load`, `store` | The natural alignment of the type, as clang and rustc emit. |
| `inbounds` on `getelementptr` | The computed address stays inside the object (field or element access on a valid pointer). |
| `immarg` | The operand must be a constant (the `isvolatile` flag of `llvm.memset`). |
| `nsw` (flag on `add`/`sub`/`mul`) | On every user-level **signed** integer add/sub/mul by default: signed overflow is undefined, so LLVM may assume it never happens. `--wrapping` removes it. Never on an unsigned type (those are defined to wrap) and never on the compiler's own index and length arithmetic. |

`--plain` drops every attribute and alignment hint and produces the bare
form shown under [Functions](#functions).

## Functions

### A function

A function is an arrow bound to a module-level `const`
([Declarations](LANGUAGE.md#declarations)), and a **concise body** (`=> a + b`)
is the single `return` it means. Parameters are SSA values (`%a`, `%b`); the
module is target-neutral (no `target triple`); the attribute group says the
function is pure and always returns. `add` is not `export`ed, so it is
`internal` — that is the default
([Linkage](#linkage-export-and---no-strict-exports)) — and the `nsw` on its
`add` is the other default ([Integer overflow](#integer-overflow-nsw-by-default---wrapping-to-opt-out)).

<!-- cookbook:begin fn_add -->
```ts
const add = (a: number, b: number): number => a + b;
```

```llvm
define internal noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add nsw i32 %a, %b
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn_add -->

### The same function with the `function` keyword

The declaration form is a spelling, not a lowering
([wp22-arrow-functions.md](wp22-arrow-functions.md)): the emitter reads the
checked signature and never the syntax that produced it, so the legacy
`function` spelling and the arrow above compile to the same module, instruction
for instruction — attribute group included. `function` is still accepted, and
this listing is the only one in the cookbook that uses it.

<!-- cookbook:begin fn_add_function -->
```ts
function add(a: number, b: number): number {
  return a + b;
}
```

```llvm
define internal noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add nsw i32 %a, %b
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn_add_function -->

### The same function with `--plain`

<!-- cookbook:begin fn_add_plain -->
Compiled with `--plain`.

```ts
const add = (a: number, b: number): number => a + b;
```

```llvm
define internal i32 @add(i32 %a, i32 %b) {
entry:
  %0 = add nsw i32 %a, %b
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
const halve = (x: number): number => x / 2.5;
```

```llvm
define internal noundef double @halve(double noundef %x) #0 {
entry:
  %0 = fdiv double %x, 0x4004000000000000
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn_f64 -->

## Types

### `i64` and the explicit conversions

`i64` arithmetic overflows like `i32` — undefined by default, wrapping under
`--wrapping`; `toI32` on an `i64` is a `trunc`, which wraps either way.

<!-- cookbook:begin types_i64 -->
```ts
const square = (x: i64): i64 => x * x;

const low = (x: i64): number => toI32(x % 1000);
```

```llvm
declare void @nish_panic_div(i1 noundef zeroext) #2

define internal noundef i64 @square(i64 noundef %x) #0 {
entry:
  %0 = mul nsw i64 %x, %x
  ret i64 %0
}

define internal noundef i32 @low(i64 noundef %x) #1 {
entry:
  %0 = icmp eq i64 1000, 0
  %1 = icmp eq i64 %x, -9223372036854775808
  %2 = icmp eq i64 1000, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
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
const xor = (a: boolean, b: boolean): boolean => a !== b;

const neither = (a: boolean, b: boolean): boolean => !a && !b;
```

```llvm
define internal noundef zeroext i1 @xor(i1 noundef zeroext %a, i1 noundef zeroext %b) #0 {
entry:
  %0 = icmp ne i1 %a, %b
  ret i1 %0
}

define internal noundef zeroext i1 @neither(i1 noundef zeroext %a, i1 noundef zeroext %b) #0 {
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
const literals = (): f64 => {
  const big: i64 = 3000000000;
  const ratio: f64 = 0.1;
  const scaled = ratio * 2;
  return scaled + toF64(big);
};
```

```llvm
define internal noundef double @literals() #0 {
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
const polynomial = (x: number, k: number): number => {
  let acc: number = x * x * 3;
  acc = acc + k * 2;
  const bias = 7;
  return acc - bias;
};
```

```llvm
define internal noundef i32 @polynomial(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %acc.addr = alloca i32, align 4
  %bias.addr = alloca i32, align 4
  %0 = mul nsw i32 %x, %x
  %1 = mul nsw i32 %0, 3
  store i32 %1, i32* %acc.addr, align 4
  %2 = load i32, i32* %acc.addr, align 4
  %3 = mul nsw i32 %k, 2
  %4 = add nsw i32 %2, %3
  store i32 %4, i32* %acc.addr, align 4
  store i32 7, i32* %bias.addr, align 4
  %5 = load i32, i32* %acc.addr, align 4
  %6 = load i32, i32* %bias.addr, align 4
  %7 = sub nsw i32 %5, %6
  ret i32 %7
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl_locals -->

### Module constants

A top-level `const` is not a global: it emits no symbol and no initialiser.
The checker folds it, and every use site carries the value — `AREA` reaches
`nish_str_from_i32` as the literal `64`, and `ret i32 64` is the whole of
`return AREA`. The template literal around it is still built at run time:
folding stops at the constant, and `${...}` is not itself a constant
expression.

<!-- cookbook:begin decl_const -->
```ts
const WIDTH: i32 = 8;
const AREA: i32 = WIDTH * WIDTH;
const LABEL: string = "area = ";

export const main = (): number => {
  console.log(`${LABEL}${AREA}`);
  return AREA;
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"area = \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 64)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 64
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end decl_const -->

### Type aliases

A `type` alias is a second name for a type that already exists, so it emits
nothing: `Byte` is `u8`, `Bytes` is `u8[]`, `Label` is `string`, and the IR
below is the IR of the same program with the aliases written out. There is no
listing for "the alias", because there is nothing for it to be.

<!-- cookbook:begin decl_type_alias -->
```ts
type Byte = u8;
type Bytes = Byte[];
type Label = string;

const widen = (b: Byte): i32 => toI32(b);

export const main = (): number => {
  const data: Bytes = [toU8(2), toU8(3)];
  const label: Label = "sum = ";
  console.log(`${label}${widen(data[0]) + widen(data[1])}`);
  return 0;
};
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"sum = \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i32 @widen(i8 noundef %b) #0 {
entry:
  %0 = zext i8 %b to i32
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %data.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %label.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = trunc i32 2 to i8
  %1 = trunc i32 3 to i8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast [2 x i8]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 %0, i8* %7, align 1, !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 %1, i8* %8, align 1, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %data.addr, align 8
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %label.addr, align 8
  %9 = load i8*, i8** %label.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4
  %13 = icmp ult i64 0, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4
  %16 = bitcast i8* %15 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 0
  %18 = load i8, i8* %17, align 1, !alias.scope !4, !noalias !3
  %19 = call i32 @widen(i8 %18)
  %20 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4
  %23 = icmp ult i64 1, %22
  br i1 %23, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %22)
  unreachable

bounds.ok.1:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4
  %26 = bitcast i8* %25 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 1
  %28 = load i8, i8* %27, align 1, !alias.scope !4, !noalias !3
  %29 = call i32 @widen(i8 %28)
  %30 = add nsw i32 %19, %29
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %9, i8* %31)
  call void @nish_print(i8* %32)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end decl_type_alias -->

### `export const main` and the entry wrapper

The user's `main` becomes `@nish_main`; the compiler adds a C-ABI `@main` that
calls it, releases the arena, and returns the exit code.

<!-- cookbook:begin decl_main -->
```ts
export const main = (): number => {
  console.log("hello from Nish");
  return 0;
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"hello from Nish\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [16 x i8] }* @.str.0 to i8*))
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end decl_main -->

### Linkage: `export`, and `--no-strict-exports`

A function without `export` gets `internal` linkage, so LLVM may inline it,
specialise it for its call sites, or drop it; only an exported function is a
C-ABI symbol. This is the default, so the snippet below is compiled with no
flags at all.

<!-- cookbook:begin decl_strict_exports -->
```ts
export const double = (n: number): number => helper(n) * 2;

const helper = (n: number): number => n + 1;
```

```llvm
define noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = call i32 @helper(i32 %n)
  %1 = mul nsw i32 %0, 2
  ret i32 %1
}

define internal noundef i32 @helper(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl_strict_exports -->

`--no-strict-exports` puts every function back on the C ABI, which is what a
driver that calls a non-exported function needs. The same source:

<!-- cookbook:begin decl_no_strict_exports -->
Compiled with `--no-strict-exports`.

```ts
export const double = (n: number): number => helper(n) * 2;

const helper = (n: number): number => n + 1;
```

```llvm
define noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = call i32 @helper(i32 %n)
  %1 = mul nsw i32 %0, 2
  ret i32 %1
}

define noundef i32 @helper(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl_no_strict_exports -->

### Modules: the exporter

<!-- cookbook:begin mod_math -->
```ts
export const square = (n: number): number => n * n;
```

```llvm
define noundef i32 @square(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, %n
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

export const main = (): number => square(7);
```

```llvm
declare noundef i32 @square(i32 noundef) #0
declare void @nish_free_arena() #2

define noundef i32 @nish_main() #0 {
entry:
  %0 = call i32 @square(i32 7)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
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
const abs = (x: number): number => {
  if (x < 0) {
    return -x;
  }
  return x;
};

const pick = (flag: boolean, a: number, b: number): number => {
  let r = 0;
  if (flag) {
    r = a;
  } else {
    r = b;
  }
  return r;
};
```

```llvm
define internal noundef i32 @abs(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sub nsw i32 0, %x
  ret i32 %1

if.end:
  ret i32 %x
}

define internal noundef i32 @pick(i1 noundef zeroext %flag, i32 noundef %a, i32 noundef %b) #0 {
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
const countDigits = (n: number): number => {
  let digits = 0;
  let rest = n;
  while (rest > 0) {
    rest = rest / 10;
    digits = digits + 1;
  }
  return digits;
};
```

```llvm
declare void @nish_panic_div(i1 noundef zeroext) #1

define internal noundef i32 @countDigits(i32 noundef %n) #0 {
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
  call void @nish_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = sdiv i32 %2, 10
  store i32 %8, i32* %rest.addr, align 4
  %9 = load i32, i32* %digits.addr, align 4
  %10 = add nsw i32 %9, 1
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
const sumDigits = (n: number): number => {
  let sum = 0;
  let rest = n;
  do {
    sum += rest % 10;
    rest = rest / 10;
  } while (rest > 0);
  return sum;
};
```

```llvm
declare void @nish_panic_div(i1 noundef zeroext) #1

define internal noundef i32 @sumDigits(i32 noundef %n) #0 {
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
  call void @nish_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = srem i32 %1, 10
  %8 = add nsw i32 %0, %7
  store i32 %8, i32* %sum.addr, align 4
  %9 = load i32, i32* %rest.addr, align 4
  %10 = icmp eq i32 10, 0
  %11 = icmp eq i32 %9, -2147483648
  %12 = icmp eq i32 10, -1
  %13 = and i1 %11, %12
  %14 = or i1 %10, %13
  br i1 %14, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %10)
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
const sumTo = (n: number): number => {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += i;
  }
  return sum;
};
```

```llvm
define internal noundef i32 @sumTo(i32 noundef %n) #0 {
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
  %4 = add nsw i32 %2, %3
  store i32 %4, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
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
which is the whole of Nish's fallthrough. A label that names a module
constant is folded before the table is written, so `KIND_CALL` is a `4` here.

<!-- cookbook:begin stmt_switch -->
```ts
const KIND_CALL: i32 = 4;

const classify = (kind: number): number => {
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
};
```

```llvm
define internal noundef i32 @classify(i32 noundef %kind) #0 {
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
const sumOdd = (n: number): number => {
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
};
```

```llvm
declare void @nish_panic_div(i1 noundef zeroext) #1

define internal noundef i32 @sumOdd(i32 noundef %n) #0 {
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
  call void @nish_panic_div(i1 zeroext %3)
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
  %14 = add nsw i32 %12, %13
  store i32 %14, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
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

### `Result<T, E>`

The whole of WP16 in one listing. `Ok` / `Err` bump a monomorphised
`%struct.nish_result.i32.str` out of the arena and store the discriminant and
one payload; `orReturn()` loads the discriminant, branches, and on the error
arm builds this function's own `Err` and returns it, so the rest of the body
continues in `res.ok`; `isErr()` is that same load, and the payload reads are
`getelementptr` + `load` in the block the branch guards. Nothing here unwinds:
every function is still `nounwind`.

<!-- cookbook:begin stmt_result -->
```ts
const half = (n: number): Result<number, string> => {
  if (n % 2 !== 0) {
    return Err("odd");
  }
  return Ok(n / 2);
};

const quarter = (n: number): Result<number, string> => {
  const h = half(n).orReturn();
  return half(h);
};

const describe = (n: number): string => {
  const outcome = quarter(n);
  if (outcome.isErr()) {
    return outcome.error;
  }
  return `${outcome.value}`;
};
```

```llvm
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_div(i1 noundef zeroext) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @half(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str*
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %10, align 8
  ret %struct.nish_result.i32.str* %8

if.end:
  %11 = icmp eq i32 2, 0
  %12 = icmp eq i32 %n, -2147483648
  %13 = icmp eq i32 2, -1
  %14 = and i1 %12, %13
  %15 = or i1 %11, %14
  br i1 %15, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %11)
  unreachable

div.ok.1:
  %16 = sdiv i32 %n, 2
  %17 = call i8* @nish_alloc_struct(i64 16)
  %18 = bitcast i8* %17 to %struct.nish_result.i32.str*
  %19 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %18, i32 0, i32 0
  store i1 true, i1* %19, align 1
  %20 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %18, i32 0, i32 1
  store i32 %16, i32* %20, align 4
  ret %struct.nish_result.i32.str* %18
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @quarter(i32 noundef %n) #0 {
entry:
  %h.addr = alloca i32, align 4
  %0 = call %struct.nish_result.i32.str* @half(i32 %n)
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %0, i32 0, i32 0
  %2 = load i1, i1* %1, align 1
  br i1 %2, label %res.ok, label %res.propagate

res.propagate:
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %0, i32 0, i32 2
  %4 = load i8*, i8** %3, align 8
  %5 = call i8* @nish_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.nish_result.i32.str*
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 0
  store i1 false, i1* %7, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %6, i32 0, i32 2
  store i8* %4, i8** %8, align 8
  ret %struct.nish_result.i32.str* %6

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %0, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  store i32 %10, i32* %h.addr, align 4
  %11 = load i32, i32* %h.addr, align 4
  %12 = call %struct.nish_result.i32.str* @half(i32 %11)
  ret %struct.nish_result.i32.str* %12
}

define internal noundef nonnull align 8 i8* @describe(i32 noundef %n) #0 {
entry:
  %outcome.addr = alloca %struct.nish_result.i32.str*, align 8
  %0 = call %struct.nish_result.i32.str* @quarter(i32 %n)
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %outcome.addr, align 8
  %1 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %outcome.addr, align 8
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  %4 = xor i1 %3, true
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %outcome.addr, align 8
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 2
  %7 = load i8*, i8** %6, align 8
  ret i8* %7

if.end:
  %8 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %outcome.addr, align 8
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  %11 = call i8* @nish_str_from_i32(i32 %10)
  ret i8* %11
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end stmt_result -->

### `Result<T, E>` returned in a register

The same three functions with `number` as the error arm instead of `string`
(WP17). Both payloads are four bytes, so `Result<number, number>` travels in
registers rather than as a pointer into the arena: `@half` has no
`nish_alloc_struct`, no arena global and no `%struct.` value at all, and
`return Ok(n / 2)` is one `insertvalue` and a `ret`.

Which registers depends on who can name the function. All three here are
`internal`, so they use the private ABI of [wp15-performance.md](wp15-performance.md)
§7b: `{ i1, i32, i32 }`, the discriminant and one slot per arm, the arm that is
not live left `undef` — which is what keeps the dead arm's payload out of the
live arm's arithmetic once these calls are inlined. An **exported** function
packs the same value into one `i64` instead (the discriminant in bits 0-31, the
live payload in bits 32-63), because that is the shape a C or wasm host reads;
`tests/cases/res_export` is the golden for it, and `--no-strict-exports` puts
every function back on the word.

`@quarter` shows the other two halves of the lowering. What `half` answers is
unpacked into `%nish_result.i32.i32.obj` — an entry-block alloca the caller
owns, which is what `orReturn()` then loads the discriminant from — and its
`res.propagate` arm builds the error straight into the return registers rather
than building an `Err`. `@describe` is the caller's view: one alloca, one
unpack, then the WP16 `getelementptr` + `load` the discriminant test guards,
unchanged.

<!-- cookbook:begin stmt_result_by_value -->
```ts
const half = (n: number): Result<number, number> => {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
};

const quarter = (n: number): Result<number, number> => {
  const h = half(n).orReturn();
  return half(h);
};

const describe = (n: number): number => {
  const outcome = quarter(n);
  if (outcome.isErr()) {
    return -outcome.error;
  }
  return outcome.value;
};
```

```llvm
%struct.nish_result.i32.i32 = type { i1, i32, i32 }

declare void @nish_panic_div(i1 noundef zeroext) #1

define internal { i1, i32, i32 } @half(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %n, 2
  ret { i1, i32, i32 } %7

if.end:
  %8 = icmp eq i32 2, 0
  %9 = icmp eq i32 %n, -2147483648
  %10 = icmp eq i32 2, -1
  %11 = and i1 %9, %10
  %12 = or i1 %8, %11
  br i1 %12, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %8)
  unreachable

div.ok.1:
  %13 = sdiv i32 %n, 2
  %14 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %13, 1
  ret { i1, i32, i32 } %14
}

define internal { i1, i32, i32 } @quarter(i32 noundef %n) #0 {
entry:
  %h.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32, i32 } @half(i32 %n)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.propagate

res.propagate:
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %10, 2
  ret { i1, i32, i32 } %11

res.ok:
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = call { i1, i32, i32 } @half(i32 %14)
  %16 = extractvalue { i1, i32, i32 } %15, 0
  %17 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %16, i1* %17, align 1
  %18 = extractvalue { i1, i32, i32 } %15, 1
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %18, i32* %19, align 4
  %20 = extractvalue { i1, i32, i32 } %15, 2
  %21 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %20, i32* %21, align 4
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %23 = load i1, i1* %22, align 1
  %24 = insertvalue { i1, i32, i32 } undef, i1 %23, 0
  %25 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  %26 = load i32, i32* %25, align 4
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %28 = load i32, i32* %27, align 4
  %29 = insertvalue { i1, i32, i32 } %24, i32 %28, 1
  %30 = insertvalue { i1, i32, i32 } %29, i32 %26, 2
  ret { i1, i32, i32 } %30
}

define internal noundef i32 @describe(i32 noundef %n) #0 {
entry:
  %outcome.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32, i32 } @quarter(i32 %n)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %outcome.addr, align 8
  %7 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %outcome.addr, align 8
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  %10 = xor i1 %9, true
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %outcome.addr, align 8
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %11, i32 0, i32 2
  %13 = load i32, i32* %12, align 4
  %14 = sub nsw i32 0, %13
  ret i32 %14

if.end:
  %15 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %outcome.addr, align 8
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4
  ret i32 %17
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
```
<!-- cookbook:end stmt_result_by_value -->

### `process.exit(code)`

A `noreturn` call plus `unreachable`; it is a terminator, so `finish` needs
no `return`. Every function that can reach it loses `willreturn`.

<!-- cookbook:begin stmt_process_exit -->
```ts
const finish = (code: number): number => {
  console.log("exiting");
  process.exit(code);
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"exiting\00" }, align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_exit(i32 noundef) #2

define internal noundef i32 @finish(i32 noundef %code) #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  call void @nish_exit(i32 %code)
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
const total = (xs: number[]): number => {
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  return sum;
};
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %sum.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = add nsw i32 %9, %10
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

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end stmt_for_of -->

## Expressions

### Ternary

<!-- cookbook:begin expr_ternary -->
```ts
const max = (a: number, b: number): number => (a > b ? a : b);
```

```llvm
define internal noundef i32 @max(i32 noundef %a, i32 noundef %b) #0 {
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
const inRange = (x: number, lo: number, hi: number): boolean => x >= lo && x < hi;

const zeroOrSmallQuotient = (x: number): boolean => x === 0 || 100 / x < 50;
```

```llvm
declare void @nish_panic_div(i1 noundef zeroext) #2

define internal noundef zeroext i1 @inRange(i32 noundef %x, i32 noundef %lo, i32 noundef %hi) #0 {
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

define internal noundef zeroext i1 @zeroOrSmallQuotient(i32 noundef %x) #1 {
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
  call void @nish_panic_div(i1 zeroext %1)
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
const step = (): number => {
  let x = 10;
  x += 5;
  x *= 2;
  const a = x++;
  const b = --x;
  return a + b;
};
```

```llvm
define internal noundef i32 @step() #0 {
entry:
  %x.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  store i32 10, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = add nsw i32 %0, 5
  store i32 %1, i32* %x.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = mul nsw i32 %2, 2
  store i32 %3, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %x.addr, align 4
  store i32 %4, i32* %a.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = sub nsw i32 %6, 1
  store i32 %7, i32* %x.addr, align 4
  store i32 %7, i32* %b.addr, align 4
  %8 = load i32, i32* %a.addr, align 4
  %9 = load i32, i32* %b.addr, align 4
  %10 = add nsw i32 %8, %9
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
const mix = (a: i32, b: i32): i32 => (a & b) | (a ^ b);

const invert = (a: i32): i32 => ~a;

const pack = (hi: i32, lo: i32): i32 => (hi << 16) | (lo & 65535);
```

```llvm
define internal noundef i32 @mix(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = and i32 %a, %b
  %1 = xor i32 %a, %b
  %2 = or i32 %0, %1
  ret i32 %2
}

define internal noundef i32 @invert(i32 noundef %a) #0 {
entry:
  %0 = xor i32 %a, -1
  ret i32 %0
}

define internal noundef i32 @pack(i32 noundef %hi, i32 noundef %lo) #0 {
entry:
  %0 = shl i32 %hi, 16
  %1 = and i32 %lo, 65535
  %2 = or i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr_bitwise -->

### A field or an element as the compound target

`f.bits |= mask` and `bytes[i] &= 255` are the same load-apply-store as
`x |= mask` on a local, with the target's address computed once and shared by
the load and the store: one `getelementptr` for the field, and for the element
one bounds check followed by one `getelementptr`. The target expression is
therefore evaluated exactly once, so `bytes[next()] &= 255` calls `next()` a
single time. The shift-count mask is the local's, too — `f.bits <<= n` masks
`n` to 31 before the `shl`.

<!-- cookbook:begin expr_compound_target -->
```ts
class Flags {
  bits: i32 = 0;
}

const set = (f: Flags, mask: i32): void => {
  f.bits |= mask;
};

const clamp = (bytes: i32[], i: i32): void => {
  bytes[i] &= 255;
};

const shiftField = (f: Flags, n: i32): void => {
  f.bits <<= n;
};
```

```llvm
%struct.Flags = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @set(%struct.Flags* noundef nonnull align 8 dereferenceable(4) nocapture %f, i32 noundef %mask) #0 {
entry:
  %0 = getelementptr inbounds %struct.Flags, %struct.Flags* %f, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = or i32 %1, %mask
  store i32 %2, i32* %0, align 4
  ret void
}

define internal void @clamp(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes, i32 noundef %i) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3
  %9 = and i32 %8, 255
  store i32 %9, i32* %7, align 4, !alias.scope !4, !noalias !3
  ret void
}

define internal void @shiftField(%struct.Flags* noundef nonnull align 8 dereferenceable(4) nocapture %f, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Flags, %struct.Flags* %f, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = and i32 %n, 31
  %3 = shl i32 %1, %2
  store i32 %3, i32* %0, align 4
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end expr_compound_target -->

### Shifts, and the count mask

`<<` is `shl`, `>>` is `ashr` (sign-filling) and `>>>` is `lshr`
(zero-filling). The count is masked to the operand width — 31 for `i32`, 63
for `i64` — because LLVM makes a wider shift poison while JavaScript wraps the
count; Nish follows JavaScript. A constant count is masked at compile time
and no `and` appears (`a >> 3` below); a variable one costs the `and`.

<!-- cookbook:begin expr_shifts -->
```ts
const constantCount = (a: i32): i32 => a >> 3;

const variableCount = (a: i32, n: i32): i32 => a << n;

const fills = (a: i32, n: i32): i32 => (a >> n) + (a >>> n);

const wide = (a: i64, n: i64): i64 => a << n;
```

```llvm
define internal noundef i32 @constantCount(i32 noundef %a) #0 {
entry:
  %0 = ashr i32 %a, 3
  ret i32 %0
}

define internal noundef i32 @variableCount(i32 noundef %a, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = shl i32 %a, %0
  ret i32 %1
}

define internal noundef i32 @fills(i32 noundef %a, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = ashr i32 %a, %0
  %2 = and i32 %n, 31
  %3 = lshr i32 %a, %2
  %4 = add nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i64 @wide(i64 noundef %a, i64 noundef %n) #0 {
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
`noreturn` `nish_panic_div` (`attempt to divide by zero` when its `i1`
argument is true, `attempt to divide with overflow` otherwise) and exits 1;
`div.ok` holds the plain `sdiv`. Because the panic path exists the function
is neither `willreturn` nor `readnone`. LLVM folds the check away for a
constant divisor at `-O1`. `f64` division is a bare `fdiv`.

<!-- cookbook:begin expr_div_checked -->
```ts
const div = (a: number, b: number): number => a / b;
```

```llvm
declare void @nish_panic_div(i1 noundef zeroext) #1

define internal noundef i32 @div(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  %1 = icmp eq i32 %a, -2147483648
  %2 = icmp eq i32 %b, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
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
const divide = (a: u32, b: u32): u32 => a / b;

const below = (a: u32, b: u32): boolean => a < b;

const halve = (a: u32): u32 => a >> 1;

const widen = (a: u32): u64 => toU64(a);

const reinterpret = (a: i32): u32 => toU32(a);
```

```llvm
declare void @nish_panic_div(i1 noundef zeroext) #2

define internal noundef i32 @divide(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  br i1 %0, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %1 = udiv i32 %a, %b
  ret i32 %1
}

define internal noundef zeroext i1 @below(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = icmp ult i32 %a, %b
  ret i1 %0
}

define internal noundef i32 @halve(i32 noundef %a) #1 {
entry:
  %0 = lshr i32 %a, 1
  ret i32 %0
}

define internal noundef i64 @widen(i32 noundef %a) #1 {
entry:
  %0 = zext i32 %a to i64
  ret i64 %0
}

define internal noundef i32 @reinterpret(i32 noundef %a) #1 {
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
const blend = (a: f32, b: f32): f32 => (a + b) / b;

const narrow = (x: f64): f32 => toF32(x);

const widen = (x: f32): f64 => toF64(x);

const truncate = (x: f32): i32 => toI32(x);

const tenth = (): f32 => 0.1;
```

```llvm
declare i32 @llvm.fptosi.sat.i32.f32(float) #0

define internal noundef float @blend(float noundef %a, float noundef %b) #0 {
entry:
  %0 = fadd float %a, %b
  %1 = fdiv float %0, %b
  ret float %1
}

define internal noundef float @narrow(double noundef %x) #0 {
entry:
  %0 = fptrunc double %x to float
  ret float %0
}

define internal noundef double @widen(float noundef %x) #0 {
entry:
  %0 = fpext float %x to double
  ret double %0
}

define internal noundef i32 @truncate(float noundef %x) #0 {
entry:
  %0 = call i32 @llvm.fptosi.sat.i32.f32(float %x)
  ret i32 %0
}

define internal noundef float @tenth() #0 {
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
const greeting = (): string => "hello, world";

const same = (): string => "hello, world";
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"hello, world\00" }, align 8

define internal noundef nonnull align 8 i8* @greeting() #0 {
entry:
  ret i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*)
}

define internal noundef nonnull align 8 i8* @same() #0 {
entry:
  ret i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*)
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end str_literal -->

### `+`, `===`, `.length`

`+` calls `nish_str_concat` (allocates: effect `write`), `===` calls
`nish_str_eq` (reads: caller becomes `readonly`), `.length` is a direct
`load i64` of the header (no call).

<!-- cookbook:begin str_ops -->
```ts
const join = (a: string, b: string): string => a + b;

const same = (a: string, b: string): boolean => a === b;

const len = (s: string): number => s.length;
```

```llvm
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2

define internal noundef nonnull align 8 i8* @join(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call i8* @nish_str_concat(i8* %a, i8* %b)
  ret i8* %0
}

define internal noundef zeroext i1 @same(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #1 {
entry:
  %0 = call zeroext i1 @nish_str_eq(i8* %a, i8* %b)
  ret i1 %0
}

define internal noundef i32 @len(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
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
one `nish_str_new`: one allocation, one `memcpy`. `startsWith` and `endsWith`
are a single `nish_str_at`, which reads through `nocapture readonly`
parameters.

Under `opt -O2` the clamp of a literal `0` folds away entirely and `head`
becomes `max(0, min(n, len))` and the call.

<!-- cookbook:begin str_bytes -->
```ts
const firstByte = (s: string): number => s.charCodeAt(0);

const head = (s: string, n: number): string => s.substring(0, n);

const has = (s: string, sub: string): boolean => s.startsWith(sub) || s.endsWith(sub);
```

```llvm
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4

define internal noundef i32 @firstByte(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds i8, i8* %s, i64 8
  %4 = getelementptr inbounds i8, i8* %3, i64 0
  %5 = load i8, i8* %4, align 1
  %6 = zext i8 %5 to i32
  ret i32 %6
}

define internal noundef nonnull align 8 i8* @head(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %n) #1 {
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
  %12 = call i8* @nish_str_new(i8* %11, i64 %9)
  ret i8* %12
}

define internal noundef zeroext i1 @has(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub) #0 {
entry:
  %0 = call zeroext i1 @nish_str_at(i8* %s, i64 0, i8* %sub)
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = bitcast i8* %sub to i64*
  %4 = load i64, i64* %3, align 8
  %5 = sub i64 %2, %4
  %6 = call zeroext i1 @nish_str_at(i8* %s, i64 %5, i8* %sub)
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

### The fast slice

`slice` is `substring` with the clamp taken out (WP15 §4). Where `substring`
puts both ends in range with six `llvm.smin` / `llvm.smax` calls, `slice`
requires `0 <= start <= end <= len` and branches to a cold
`nish_panic_slice` block when that does not hold, so the body is two
`icmp ule`, one `sub`, one `getelementptr` and one `nish_str_new`. Two
unsigned compares are the whole test because a negative offset sign-extends
to a value above any byte length. With no `end`, `end` *is* `len` and only
the ordering compare is emitted, which is `rest` below.

The check is the part a clamp can never be: provable. `proven` slices constant
offsets out of a literal, and `opt -O2` deletes its compare, its branch and its
panic block outright — the same optimiser cannot delete a clamp, because the
clamp is not a check but part of the answer. That is why the two live side by
side rather than one replacing the other, and it is worth 1.18x on a scan that
slices every word out of a 300 KB source.

<!-- cookbook:begin str_slice -->
```ts
const head = (s: string, n: number): string => s.slice(0, n);

const rest = (s: string, n: number): string => s.slice(n);

const proven = (): string => "hello,world".slice(0, 5);
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello,world\00" }, align 8

declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define internal noundef nonnull align 8 i8* @head(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %n) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %n to i64
  %3 = icmp ule i64 0, %2
  %4 = icmp ule i64 %2, %1
  %5 = and i1 %3, %4
  br i1 %5, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 0, i64 %2, i64 %1)
  unreachable

slice.ok:
  %6 = sub i64 %2, 0
  %7 = getelementptr inbounds i8, i8* %s, i64 8
  %8 = getelementptr inbounds i8, i8* %7, i64 0
  %9 = call i8* @nish_str_new(i8* %8, i64 %6)
  ret i8* %9
}

define internal noundef nonnull align 8 i8* @rest(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %n) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %n to i64
  %3 = icmp ule i64 %2, %1
  br i1 %3, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %2, i64 %1, i64 %1)
  unreachable

slice.ok:
  %4 = sub i64 %1, %2
  %5 = getelementptr inbounds i8, i8* %s, i64 8
  %6 = getelementptr inbounds i8, i8* %5, i64 %2
  %7 = call i8* @nish_str_new(i8* %6, i64 %4)
  ret i8* %7
}

define internal noundef nonnull align 8 i8* @proven() #0 {
entry:
  %0 = bitcast i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ule i64 0, 5
  %3 = icmp ule i64 5, %1
  %4 = and i1 %2, %3
  br i1 %4, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 0, i64 5, i64 %1)
  unreachable

slice.ok:
  %5 = sub i64 5, 0
  %6 = getelementptr inbounds i8, i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*), i64 8
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  %8 = call i8* @nish_str_new(i8* %7, i64 %5)
  ret i8* %8
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end str_slice -->

### Template literals

Constant parts are interned, holes are converted (`nish_str_from_i32`, a
`select` for booleans, identity for strings), and everything is chained
through `nish_str_concat`.

<!-- cookbook:begin str_template -->
```ts
const describe = (n: number, ok: boolean, name: string): string => `${name}: n=${n}, ok=${ok}`;
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c": n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c", ok=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noundef nonnull align 8 i8* @describe(i32 noundef %n, i1 noundef zeroext %ok, i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %0 = call i8* @nish_str_concat(i8* %name, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* %0, i8* %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %4 = select i1 %ok, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %5 = call i8* @nish_str_concat(i8* %3, i8* %4)
  ret i8* %5
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end str_template -->

### `console.log`

<!-- cookbook:begin str_console_log -->
```ts
const report = (): void => {
  console.log("text");
  console.log(7);
  console.log(false);
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"text\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @report() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish_print(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %0 = call i8* @nish_str_from_i32(i32 7)
  call void @nish_print(i8* %0)
  %1 = select i1 false, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end str_console_log -->

## Arrays

### `a[i]` read and write, with the bounds check

Unsigned compare against `len`; the failing branch calls the `noreturn cold`
`nish_panic_index`. `a` is `readonly` in `get` (never stored through) and only
`nocapture` in `set`.

<!-- cookbook:begin arr_index -->
```ts
const get = (a: number[], i: number): number => a[i];

const set = (a: number[], i: number, v: number): void => {
  a[i] = v;
};
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #1

define internal noundef i32 @get(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3
  ret i32 %8
}

define internal void @set(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %a, i32 noundef %i, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  store i32 %v, i32* %7, align 4, !alias.scope !4, !noalias !3
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end arr_index -->

### `--unchecked-indexing`

The compare, the branch and the panic block disappear; `get` regains
`willreturn` and becomes `readonly`. Out-of-range is then undefined
behaviour.

<!-- cookbook:begin arr_unchecked -->
Compiled with `--unchecked-indexing`.

```ts
const get = (a: number[], i: number): number => a[i];
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

define internal noundef i32 @get(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3
  ret i32 %5
}

attributes #0 = { nounwind willreturn readonly }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end arr_unchecked -->

### Literals and `push`

`[]` stores `len = cap = 0` and a null `data`; `push` grows through
`nish_array_grow` only when `len == cap`; `[1, 2]` allocates the header (24
bytes) and the data (`n * sizeof(T)`).

<!-- cookbook:begin arr_literal_push -->
```ts
const squares = (n: number): number[] => {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i * i);
  }
  return xs;
};

const pair = (): number[] => [1, 2];
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @squares(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = mul nsw i32 %8, %9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 %10, i32* %19, align 4, !alias.scope !4, !noalias !3
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !3, !noalias !4
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %24
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @pair() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3
  ret %struct.nish_array* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end arr_literal_push -->

### `join` and `indexOf`

`join` is two loops and one allocation: `join.sum` adds the parts' lengths to
the separators' total, `nish_alloc_struct` takes the whole string at once, and
`join.copy` walks a cursor with one `llvm.memcpy` per separator and per part.
The separator before the first part is skipped by selecting a *length* of
zero rather than by branching, so the copy body stays one block. `indexOf`
scans with the `===` of the element type — `nish_str_eq` here, an `icmp eq` for
a number.

<!-- cookbook:begin arr_join -->
```ts
const report = (parts: string[]): string => parts.join(", ");

const firstAt = (names: string[], name: string): number => names.indexOf(name);
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 i8* @report(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %parts) #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*) to i64*
  %3 = load i64, i64* %2, align 8
  %4 = sub i64 %1, 1
  %5 = mul i64 %3, %4
  %6 = icmp eq i64 %1, 0
  %7 = select i1 %6, i64 0, i64 %5
  store i64 %7, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %8 = load i64, i64* %join.at, align 8
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %join.sum.body, label %join.copy

join.sum.body:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %8
  %14 = load i8*, i8** %13, align 8, !alias.scope !4, !noalias !3
  %15 = load i64, i64* %join.total, align 8
  %16 = bitcast i8* %14 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = add i64 %15, %17
  store i64 %18, i64* %join.total, align 8
  %19 = add i64 %8, 1
  store i64 %19, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %20 = load i64, i64* %join.total, align 8
  %21 = add i64 %20, 9
  %22 = call i8* @nish_alloc_struct(i64 %21)
  %23 = bitcast i8* %22 to i64*
  store i64 %20, i64* %23, align 8
  %24 = getelementptr inbounds i8, i8* %22, i64 8
  store i8* %24, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %25 = load i64, i64* %join.at, align 8
  %26 = icmp ult i64 %25, %1
  br i1 %26, label %join.part, label %join.end

join.part:
  %27 = load i8*, i8** %join.p, align 8
  %28 = icmp eq i64 %25, 0
  %29 = select i1 %28, i64 0, i64 %3
  %30 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %27, i8* %30, i64 %29, i1 false)
  %31 = getelementptr inbounds i8, i8* %27, i64 %29
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 %25
  %36 = load i8*, i8** %35, align 8, !alias.scope !4, !noalias !3
  %37 = bitcast i8* %36 to i64*
  %38 = load i64, i64* %37, align 8
  %39 = getelementptr inbounds i8, i8* %36, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %31, i8* %39, i64 %38, i1 false)
  %40 = getelementptr inbounds i8, i8* %31, i64 %38
  store i8* %40, i8** %join.p, align 8
  %41 = add i64 %25, 1
  store i64 %41, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %42 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %42, align 1
  ret i8* %22
}

define internal noundef i32 @firstAt(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %names, i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %idx.at = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  store i64 0, i64* %idx.at, align 8
  br label %idx.scan

idx.scan:
  %2 = load i64, i64* %idx.at, align 8
  %3 = icmp ult i64 %2, %1
  br i1 %3, label %idx.test, label %idx.miss

idx.test:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %2
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3
  %9 = call zeroext i1 @nish_str_eq(i8* %8, i8* %name)
  br i1 %9, label %idx.found, label %idx.next

idx.next:
  %10 = add i64 %2, 1
  store i64 %10, i64* %idx.at, align 8
  br label %idx.scan

idx.miss:
  br label %idx.found

idx.found:
  %11 = phi i64 [ %2, %idx.test ], [ -1, %idx.miss ]
  %12 = trunc i64 %11 to i32
  ret i32 %12
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end arr_join -->

### `new Array<T>(n)` and `.length`

`new Array<number>(n)` allocates and zero-fills with `llvm.memset`;
`.length` is one `load` of the header.

<!-- cookbook:begin arr_new -->
```ts
const zeros = (n: number): number[] => new Array<number>(n);

const len = (xs: number[]): number => xs.length;
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @zeros(i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = mul i64 %0, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
  ret %struct.nish_array* %2
}

define internal noundef i32 @len(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end arr_new -->

### `readonly T[]`

The zero-cost claim, as a diff you can read: `sum` takes a `readonly number[]`
and `sumMutable` the same array without the modifier, and the two bodies are
the same instructions with the same attributes. `readonly` is a promise the
checker keeps — it refuses the stores, the `push` and the `pop` — so by the
time the emitter runs there is nothing left of it to lower. The `readonly
nocapture` on both parameters is the whole-program fixpoint's, earned the way
it always was; on `sum` the signature guarantees it as well, which is what lets
`--emit-header` write `const nish_array *` without proving anything.

<!-- cookbook:begin arr_readonly -->
```ts
const sum = (xs: readonly number[]): number => {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};

const sumMutable = (xs: number[]): number => {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = add nsw i32 %9, %10
  store i32 %11, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load i32, i32* %total.addr, align 4
  ret i32 %14
}

define internal noundef i32 @sumMutable(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %total.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = add nsw i32 %9, %10
  store i32 %11, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load i32, i32* %total.addr, align 4
  ret i32 %14
}

attributes #0 = { nounwind willreturn readonly }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end arr_readonly -->


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

const origin = (): number => {
  const p = new Point(3, 4);
  p.x = 0;
  return p.manhattan();
};
```

```llvm
%struct.Point = type { i32, i32 }

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = add nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @origin() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  call void @Point.constructor(%struct.Point* %Point.obj, i32 3, i32 4)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %0 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %0, i32 0, i32 0
  store i32 0, i32* %1, align 4, !tbaa !4
  %2 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %3 = call i32 @Point.manhattan(%struct.Point* %2)
  ret i32 %3
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
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

const make = (): Defaults => new Defaults();
```

```llvm
%struct.Defaults = type { i32, i1, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"anon\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Defaults* @make() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Defaults*
  %2 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 0
  store i32 42, i32* %2, align 4, !tbaa !6
  %3 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 1
  store i1 true, i1* %3, align 1, !tbaa !7
  %4 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %1, i32 0, i32 2
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %4, align 8, !tbaa !8
  ret %struct.Defaults* %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"i1", !1, i64 0}
!4 = !{!"ptr", !1, i64 0}
!5 = !{!"Defaults", !2, i64 0, !3, i64 4, !4, i64 8}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !3, i64 4}
!8 = !{!5, !4, i64 8}
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

const swap = (p: Pair): Pair => ({ first: p.second, second: p.first });

const asPair = (o: Ordered): Pair => o;
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Ordered = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal void @Ordered.constructor(%struct.Ordered* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Ordered, %struct.Ordered* %this, i32 0, i32 0
  store i32 %a, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Ordered, %struct.Ordered* %this, i32 0, i32 1
  store i32 %b, i32* %1, align 4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Pair* @swap(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
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

define internal noundef nonnull align 8 dereferenceable(8) %struct.Pair* @asPair(%struct.Ordered* noundef nonnull align 8 dereferenceable(8) %o) #1 {
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

### Widening: `implements` as a prefix

`%struct.Square` starts with `%struct.Shape`'s fields, so a `Square` becomes a
`Shape` with one `bitcast` — the argument of `originDistance` here, and the
elements of a `Shape[]` elsewhere. It is the only widening the language has:
there is no inheritance, so a class is never a prefix of another class. A
`Shape` operation reads and writes the `Square`'s own bytes at the same
offsets, the class keeps its own methods, and nothing converts back.

<!-- cookbook:begin cls_prefix -->
```ts
interface Shape {
  x: number;
  y: number;
}

class Square implements Shape {
  x: number;
  y: number;
  side: number;

  constructor(x: number, y: number, side: number) {
    this.x = x;
    this.y = y;
    this.side = side;
  }

  area(): number {
    return this.side * this.side;
  }
}

const originDistance = (s: Shape): number => s.x + s.y;

const describe = (sq: Square): number => originDistance(sq) + sq.area();
```

```llvm
%struct.Shape = type { i32, i32 }
%struct.Square = type { i32, i32, i32 }

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(12) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 2
  store i32 %side, i32* %2, align 4
  ret void
}

define internal noundef i32 @Square.area(%struct.Square* noundef nonnull readonly align 8 dereferenceable(12) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 2
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4
  %4 = mul nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @originDistance(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = add nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @describe(%struct.Square* noundef nonnull readonly align 8 dereferenceable(12) nocapture %sq) #1 {
entry:
  %0 = bitcast %struct.Square* %sq to %struct.Shape*
  %1 = call i32 @originDistance(%struct.Shape* %0)
  %2 = call i32 @Square.area(%struct.Square* %sq)
  %3 = add nsw i32 %1, %2
  ret i32 %3
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
```
<!-- cookbook:end cls_prefix -->

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
const swapped = (a: number, b: number): number => {
  const p: Pair = { first: b, second: a };
  return p.first * 10 + p.second;
};

// A constructed object that never escapes: an alloca, the constructor writes through it.
const nearest = (x: number): number => {
  const p = new Point(x, 4);
  return p.manhattan();
};
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Point = type { i32, i32 }

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = add nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #2 {
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
  %5 = mul nsw i32 %4, 10
  %6 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = add nsw i32 %5, %8
  ret i32 %9
}

define internal noundef i32 @nearest(i32 noundef %x) #0 {
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
```
<!-- cookbook:end mem_stack_object -->

### The same module with `--no-stack-alloc`

Every object is bumped from the arena by the inlined allocator, and because
each one still dies with its function, both functions get an automatic
arena scope: `nish_arena_mark` after the allocas, `nish_arena_release` before
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
const swapped = (a: number, b: number): number => {
  const p: Pair = { first: b, second: a };
  return p.first * 10 + p.second;
};

// A constructed object that never escapes: an alloca, the constructor writes through it.
const nearest = (x: number): number => {
  const p = new Point(x, 4);
  return p.manhattan();
};
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Point = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @Point.manhattan(%struct.Point* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = add nsw i32 %1, %3
  ret i32 %4
}

define internal noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 0
  store i32 %b, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %1, i32 0, i32 1
  store i32 %a, i32* %3, align 4
  store %struct.Pair* %1, %struct.Pair** %p.addr, align 8
  %4 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %5 = getelementptr inbounds %struct.Pair, %struct.Pair* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = mul nsw i32 %6, 10
  %8 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %9 = getelementptr inbounds %struct.Pair, %struct.Pair* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  %11 = add nsw i32 %7, %10
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %11
}

define internal noundef i32 @nearest(i32 noundef %x) #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 %x, i32 4)
  store %struct.Point* %1, %struct.Point** %p.addr, align 8
  %2 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %3 = call i32 @Point.manhattan(%struct.Point* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
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
const greet = (name: string): void => {
  console.log("hello, " + name + "!");
};

// The template is returned, so the caller owns it: no scope here.
const label = (name: string): string => `<${name}>`;
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"hello, \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define internal void @greet(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* %name)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef nonnull align 8 i8* @label(i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %0 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %name)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  ret i8* %1
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end mem_arena_scope -->

### Reclaiming a returned temporary at the call site

The scope above stops where it is most wanted. `join` builds a string and
returns it, so it can release nothing — the value has to outlive the call — and
its 32 intermediates would stay in the arena for the life of the program. The
*caller* is in a better position: a call hands back exactly one value, so
whatever else the callee bumped is unreachable the moment it returns. Each call
to `join` and to `piece` is therefore bracketed by `nish_arena_mark` and
`nish_arena_keep(mark, s)`, which moves the returned string down onto the mark
and releases everything underneath it. The mark is taken *after* the arguments,
so nothing the caller allocated is inside the bracket.

`fill` is the counter-example: it stores the string it built into an object its
caller still holds, so `allocEscapes` is true and its call carries no bracket.
`piece` is written with a concise body, which is the same `return` as far as
this analysis is concerned — the bracket around the call to it is what proves
it (`tests/cases/fn_arrow_concise`, WP22 §8a). The rule, its proof and what it
measured are in [wp6-memory.md](wp6-memory.md) §2a and
[wp9-optimisation.md](wp9-optimisation.md#the-call-site-reclaim).

<!-- cookbook:begin mem_reclaim -->
```ts
// A string builder cannot reclaim its own temporaries: the string it returns
// has to outlive it, so `join` gets no arena scope and every intermediate it
// made would live for the whole program. Its *caller* can reclaim them,
// because a call hands back exactly one value — so the call is bracketed by
// `nish_arena_mark` and `nish_arena_keep`, which moves the returned string
// down onto the mark and releases everything underneath it.
const piece = (i: number): string => `${i},`;

const join = (n: number): string => {
  let s = "";
  for (let i = 0; i < n; i++) {
    s = s + piece(i);
  }
  return s;
};

class Box {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

// `fill` hands the string it built to an object its caller still holds, so
// what it allocated is not garbage and the call below carries no bracket.
const fill = (b: Box, i: number): string => {
  const s = `v${i}`;
  b.text = s;
  return s;
};

const report = (b: Box, n: number): string => join(n) + fill(b, n);
```

```llvm
%struct.Box = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noundef nonnull align 8 i8* @piece(i32 noundef %i) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  ret i8* %1
}

define internal noundef nonnull align 8 i8* @join(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i8*, i8** %s.addr, align 8
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @piece(i32 %3)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %2, i8* %6)
  store i8* %7, i8** %s.addr, align 8
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i8*, i8** %s.addr, align 8
  ret i8* %10
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* %text, i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @fill(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %b, i32 noundef %i) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %0)
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  store i8* %2, i8** %3, align 8, !tbaa !4
  %4 = load i8*, i8** %s.addr, align 8
  ret i8* %4
}

define internal noundef nonnull align 8 i8* @report(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %b, i32 noundef %n) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @join(i32 %n)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i8* @fill(%struct.Box* %b, i32 %n)
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  ret i8* %4
}

attributes #0 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
```
<!-- cookbook:end mem_reclaim -->

### `Arena.mark` / `release` / `used` / `reset`

The explicit builtins lower to one runtime call each. `measure` calls
`Arena.release` itself, so the compiler never wraps it in an automatic
scope (its own mark would be invalidated by the user's release); the
8000-byte `new Array<number>(2000)` is over the 4096-byte stack cap, so it
is an arena allocation that the release reclaims.

<!-- cookbook:begin mem_arena_builtins -->
```ts
const measure = (): i64 => {
  const m = Arena.mark();
  const xs = new Array<number>(2000); // 8000 bytes: over the 4096-byte stack cap, so arena
  const used = Arena.used();
  Arena.release(m);
  return used + toI64(xs.length);
};

const recycle = (): void => {
  Arena.reset();
};
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_reset_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i64 @measure() #0 {
entry:
  %m.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %used.addr = alloca i64, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %m.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 2000, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 2000, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = mul i64 2000, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  %8 = call i64 @nish_arena_used()
  store i64 %8, i64* %used.addr, align 8
  %9 = load i64, i64* %m.addr, align 8
  call void @nish_arena_release(i64 %9)
  %10 = load i64, i64* %used.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4
  %14 = trunc i64 %13 to i32
  %15 = sext i32 %14 to i64
  %16 = add nsw i64 %10, %15
  ret i64 %16
}

define internal void @recycle() #0 {
entry:
  call void @nish_reset_arena()
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end mem_arena_builtins -->

### `T | null` and narrowing

A nullable value is the same pointer type as `T`; `null` is the constant
`null` and the tests are `icmp eq` / `icmp ne` against it. Narrowing costs
nothing at run time: inside the guarded region the checker simply reads the
variable as `T`. Nullable parameters and returns lose `nonnull` and
`dereferenceable` but keep `align 8`, `readonly`, and `nocapture` where the
usual rules allow them. A type may be parenthesised, and `(T | null)[]` is
where it matters: `T | null[]` groups the other way, so the parentheses are
what make the *element* nullable rather than the array.

<!-- cookbook:begin mem_nullable -->
```ts
class Node {
  value: number;
  next: Node | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

const valueOr = (n: Node | null, fallback: number): number => (n !== null ? n.value : fallback);

const sum = (head: Node | null): number => {
  let total = 0;
  let cur: Node | null = head;
  while (cur !== null) {
    total += cur.value;
    cur = cur.next;
  }
  return total;
};

// `(Node | null)[]`, which is where a type needs its parentheses: `Node |
// null[]` would group the other way. The element loads as a nullable and
// narrows like any local once it is bound to one.
const firstValue = (slots: (Node | null)[]): number => {
  const head = slots[0];
  return head !== null ? head.value : 0;
};
```

```llvm
%struct.Node = type { i32, %struct.Node* }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* null, %struct.Node** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %1, align 4, !tbaa !6
  ret void
}

define internal noundef i32 @valueOr(%struct.Node* noundef readonly align 8 nocapture %n, i32 noundef %fallback) #1 {
entry:
  %0 = icmp ne %struct.Node* %n, null
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !6
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ %fallback, %cond.false ]
  ret i32 %3
}

define internal noundef i32 @sum(%struct.Node* noundef align 8 %head) #2 {
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
  %5 = load i32, i32* %4, align 4, !tbaa !6
  %6 = add nsw i32 %2, %5
  store i32 %6, i32* %total.addr, align 4
  %7 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %8 = getelementptr inbounds %struct.Node, %struct.Node* %7, i32 0, i32 1
  %9 = load %struct.Node*, %struct.Node** %8, align 8, !tbaa !5
  store %struct.Node* %9, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %10 = load i32, i32* %total.addr, align 4
  ret i32 %10
}

define internal noundef i32 @firstValue(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots) #3 {
entry:
  %head.addr = alloca %struct.Node*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !10, !noalias !11
  %5 = bitcast i8* %4 to %struct.Node**
  %6 = getelementptr inbounds %struct.Node*, %struct.Node** %5, i64 0
  %7 = load %struct.Node*, %struct.Node** %6, align 8, !alias.scope !11, !noalias !10
  store %struct.Node* %7, %struct.Node** %head.addr, align 8
  %8 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %9 = icmp ne %struct.Node* %8, null
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  %10 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %11 = getelementptr inbounds %struct.Node, %struct.Node* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !6
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %13 = phi i32 [ %12, %cond.true ], [ 0, %cond.false ]
  ret i32 %13
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind }
attributes #4 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Node", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
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
const hypot = (a: number, b: number): number => Math.sqrt(a * a + b * b);

const roundHalfUp = (x: number): number => Math.round(x);

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
```

```llvm
declare double @llvm.sqrt.f64(double) #0
declare double @llvm.floor.f64(double) #0
declare double @llvm.minnum.f64(double, double) #0
declare double @llvm.maxnum.f64(double, double) #0

define internal noundef double @hypot(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fmul double %a, %a
  %1 = fmul double %b, %b
  %2 = fadd double %0, %1
  %3 = call double @llvm.sqrt.f64(double %2)
  ret double %3
}

define internal noundef double @roundHalfUp(double noundef %x) #0 {
entry:
  %0 = call double @llvm.floor.f64(double %x)
  %1 = fsub double %x, %0
  %2 = fcmp oge double %1, 0x3FE0000000000000
  %3 = fadd double %0, 0x3FF0000000000000
  %4 = select i1 %2, double %3, double %0
  ret double %4
}

define internal noundef double @clamp01(double noundef %x) #0 {
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
const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);

const magnitude = (x: number): number => Math.abs(x);

const tau = (): f64 => Math.PI * 2;
```

```llvm
declare i32 @llvm.abs.i32(i32, i1) #0
declare i32 @llvm.smin.i32(i32, i32) #0
declare i32 @llvm.smax.i32(i32, i32) #0

define internal noundef i32 @clamp(i32 noundef %x, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %0 = call i32 @llvm.smax.i32(i32 %x, i32 %lo)
  %1 = call i32 @llvm.smin.i32(i32 %0, i32 %hi)
  ret i32 %1
}

define internal noundef i32 @magnitude(i32 noundef %x) #0 {
entry:
  %0 = call i32 @llvm.abs.i32(i32 %x, i1 false)
  ret i32 %0
}

define internal noundef double @tau() #0 {
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
const widen = (n: number): i64 => toI64(n);

const narrow = (x: f64): number => toI32(x);

const toDouble = (n: number): f64 => toF64(n);
```

```llvm
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

define internal noundef i64 @widen(i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  ret i64 %0
}

define internal noundef i32 @narrow(double noundef %x) #0 {
entry:
  %0 = call i32 @llvm.fptosi.sat.i32.f64(double %x)
  ret i32 %0
}

define internal noundef double @toDouble(i32 noundef %n) #0 {
entry:
  %0 = sitofp i32 %n to double
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin_conversions -->

### `Math.random`

`nish_random` mutates global state (effect `write`), so `coin` is not pure.

<!-- cookbook:begin builtin_random -->
```ts
const coin = (): boolean => Math.random() < 0.5;
```

```llvm
declare noundef double @nish_random() #0

define internal noundef zeroext i1 @coin() #0 {
entry:
  %0 = call double @nish_random()
  %1 = fcmp olt double %0, 0x3FE0000000000000
  ret i1 %1
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end builtin_random -->

### Streams, `readFileSyncOrNull` and `panic`

`console.error` and the newline-free writes are one `nish_write(s, fd,
newline)`; `console.log` keeps its own one-argument `nish_print`. `panic` needs
no runtime function of its own — the message goes through `nish_write` and the
`noreturn` `nish_exit` closes the block, which is what lets `load` end without
a `ret` on that path. `readFileSyncOrNull` returns a pointer that may be
`null`, so the checker makes the caller narrow it before it can be read.

<!-- cookbook:begin builtin_streams -->
```ts
const report = (problem: string): void => {
  console.error(problem);
  write("progress: ");
  writeError(problem);
};

const load = (path: string): number => {
  const text = readFileSyncOrNull(path);
  if (text === null) {
    panic(`cannot read ${path}`);
  } else {
    return text.length;
  }
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"progress: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"cannot read \00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_exit(i32 noundef) #2
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #0

define internal void @report(i8* noundef nonnull noalias readonly align 8 nocapture %problem) #0 {
entry:
  call void @nish_write(i8* %problem, i32 2, i1 true)
  call void @nish_write(i8* bitcast ({ i64, [11 x i8] }* @.str.0 to i8*), i32 1, i1 false)
  call void @nish_write(i8* %problem, i32 2, i1 false)
  ret void
}

define internal noundef i32 @load(i8* noundef nonnull noalias readonly align 8 nocapture %path) #1 {
entry:
  %text.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_read_file_or_null(i8* %path)
  store i8* %0, i8** %text.addr, align 8
  %1 = load i8*, i8** %text.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.1 to i8*), i8* %path)
  call void @nish_write(i8* %3, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.else:
  %4 = load i8*, i8** %text.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { noreturn nounwind }
```
<!-- cookbook:end builtin_streams -->

### File I/O

<!-- cookbook:begin builtin_files -->
```ts
export const main = (): number => {
  writeFileSync("out.txt", "hello\n");
  appendFileSync("out.txt", "world\n");
  const text = readFileSync("out.txt");
  console.log(text.length);
  return 0;
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"out.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"hello\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"world\0A\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %text.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish_write_file(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  call void @nish_append_file(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*))
  %0 = call i8* @nish_read_file(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %text.addr, align 8
  %1 = load i8*, i8** %text.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end builtin_files -->

### Directories and subprocesses

`mkdirSync` answers a `boolean` and `spawnSync` an exit status, so the failure
is a value the program branches on rather than an exit inside the runtime.
Note what the escape analysis makes of the vector: `argv` is handed to
`nish_spawn`, which keeps pointers into it, so the literal stays in the arena
and `nish_main` gets no arena scope and no `willreturn`.

<!-- cookbook:begin builtin_process -->
```ts
export const main = (): number => {
  if (!mkdirSync("build/out")) {
    panic("cannot create build/out");
  }
  const argv: string[] = ["bash", "scripts/build.sh", "app.ll"];
  return spawnSync(argv);
};
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"build/out\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"cannot create build/out\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"bash\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"scripts/build.sh\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"app.ll\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %argv.addr = alloca %struct.nish_array*, align 8
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*))
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [24 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !3, !noalias !4
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
  %8 = bitcast i8* %6 to i8**
  %9 = getelementptr inbounds i8*, i8** %8, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds i8*, i8** %8, i64 1
  store i8* bitcast ({ i64, [17 x i8] }* @.str.3 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds i8*, i8** %8, i64 2
  store i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3
  store %struct.nish_array* %3, %struct.nish_array** %argv.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %argv.addr, align 8
  %13 = call i32 @nish_spawn(%struct.nish_array* %12)
  ret i32 %13
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end builtin_process -->

### What machine this is

`process.platform` and `process.arch` are one call each into the runtime,
which answers the address of a string in its own constant data — no
allocation, no load, and `readnone` on both declarations, so a function built
from them alone stays pure and two reads of one property fold into one.
`isDirectorySync` is the `stat` beside them: the question `-o <dir>` asks, as a
`boolean`, which is why the snippet below can ask it before it asks for the
directory to be made. `--target host` maps the same pair of strings to a triple
(`hostTriple` in `src/codegen/target.ts` and in `self/target.ts`).

<!-- cookbook:begin builtin_host -->
```ts
export const main = (): number => {
  const out = "build/out";
  if (!isDirectorySync(out) && !mkdirSync(out)) {
    panic(`cannot create ${out}`);
  }
  console.log(`${process.platform} ${process.arch}`);
  return 0;
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"build/out\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"cannot create \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_exit(i32 noundef) #2
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_is_dir(i8* noundef nonnull readonly align 8 nocapture) #1
declare noundef nonnull align 8 i8* @nish_platform() #3
declare noundef nonnull align 8 i8* @nish_arch() #3

define noundef i32 @nish_main() #0 {
entry:
  %out.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  %0 = load i8*, i8** %out.addr, align 8
  %1 = call zeroext i1 @nish_is_dir(i8* %0)
  %2 = xor i1 %1, true
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = load i8*, i8** %out.addr, align 8
  %4 = call zeroext i1 @nish_mkdir(i8* %3)
  %5 = xor i1 %4, true
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = load i8*, i8** %out.addr, align 8
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.1 to i8*), i8* %7)
  call void @nish_write(i8* %8, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = call i8* @nish_platform()
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %11 = call i8* @nish_arch()
  %12 = call i8* @nish_str_concat(i8* %10, i8* %11)
  call void @nish_print(i8* %12)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin_host -->

### Listing, redirecting, and timing

The three calls a test driver needs, and the shape they share: each is one call
to a runtime symbol, with no wrapper and no marshalling. `readdirSync` answers
the array header or null, which the `T | null` narrowing reads directly — and the
`panic` here is what narrows it, because a call that cannot fall through narrows
the same way an early `return` does. `spawnSyncTo` passes the vector and the two
paths straight through; the empty string for stderr is an ordinary constant, so
"inherit that stream" costs no branch on this side of the call. `monotonicNanos`
takes nothing and answers an `i64`.

Read the `declare` lines as carefully as the body. `@nish_readdir` is `noalias`
(a fresh array per call) but not `nonnull` (it may answer null) and it is
`willreturn` (one pass per entry, and a directory has finitely many).
`@nish_spawn_to` is neither `willreturn` — the child may never exit — nor
`nocapture` in its vector, because the runtime keeps pointers into it. And
`@nish_monotonic_nanos` is `willreturn` but **not** `readnone`, which is the
load-bearing one: two `readnone` reads of a clock fold into one and every
interval measured with them is exactly zero.

<!-- cookbook:begin builtin_driver -->
```ts
export const main = (): number => {
  const cases = readdirSync("tests/cases");
  if (cases === null) {
    panic("cannot list tests/cases");
  }
  const started = monotonicNanos();
  const status = spawnSyncTo(["sh", "-c", "echo hello"], "build/out.txt", "");
  console.log(`${cases.length} cases, status ${status}, ${monotonicNanos() - started} ns`);
  return 0;
};
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"tests/cases\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"cannot list tests/cases\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"echo hello\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"build/out.txt\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c" cases, status \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" ns\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare i64 @nish_monotonic_nanos() #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %cases.addr = alloca %struct.nish_array*, align 8
  %started.addr = alloca i64, align 8
  %status.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish_readdir(i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*))
  store %struct.nish_array* %0, %struct.nish_array** %cases.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %cases.addr, align 8
  %2 = icmp eq %struct.nish_array* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [24 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %3 = call i64 @nish_monotonic_nanos()
  store i64 %3, i64* %started.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 3, i64* %6, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast i8* %8 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds i8*, i8** %10, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*), i8** %12, align 8, !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds i8*, i8** %10, i64 2
  store i8* bitcast ({ i64, [11 x i8] }* @.str.4 to i8*), i8** %13, align 8, !alias.scope !4, !noalias !3
  %14 = call i32 @nish_spawn_to(%struct.nish_array* %5, i8* bitcast ({ i64, [14 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.6 to i8*))
  store i32 %14, i32* %status.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %cases.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4
  %18 = trunc i64 %17 to i32
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [16 x i8] }* @.str.7 to i8*))
  %21 = load i32, i32* %status.addr, align 4
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %20, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*))
  %25 = call i64 @nish_monotonic_nanos()
  %26 = load i64, i64* %started.addr, align 8
  %27 = sub nsw i64 %25, %26
  %28 = call i8* @nish_str_from_i64(i64 %27)
  %29 = call i8* @nish_str_concat(i8* %24, i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*))
  call void @nish_print(i8* %30)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
```
<!-- cookbook:end builtin_driver -->

### Reading the environment

`getenv` is the only environment read the language has, and it is a call rather
than `process.env.CC` because member access on a key chosen at runtime is what
Phase 0 refuses. The lowering is one call whose result may be null, so the IR
below is the same shape `readFileSyncOrNull` produces: an `i8*` and an `icmp eq
... null` that the `T | null` narrowing reads directly, with no tag and no
unwrapping. The declaration is `noalias` — every call answers a fresh arena
copy of the value, unlike `nish_platform`, which hands back the same constant
every time — and it is not `readnone`: it allocates, and the environment is not
memory LLVM is tracking, so two reads either side of a `spawnSync` must not
fold into one.

The `cc === null ? "clang" : cc` below is how a default is written, and why the
builtin takes no second argument: the fallback is an ordinary ternary over a
nullable, so `getenv` does not need a spelling of its own for it.

<!-- cookbook:begin builtin_env -->
```ts
export const main = (): number => {
  const cc = getenv("CC");
  const compiler = cc === null ? "clang" : cc;
  console.log(`building with ${compiler}`);
  return 0;
};
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"CC\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"clang\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"building with \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %cc.addr = alloca i8*, align 8
  %compiler.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_getenv(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %cc.addr, align 8
  %1 = load i8*, i8** %cc.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = load i8*, i8** %cc.addr, align 8
  br label %cond.end

cond.end:
  %4 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), %cond.true ], [ %3, %cond.false ]
  store i8* %4, i8** %compiler.addr, align 8
  %5 = load i8*, i8** %compiler.addr, align 8
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.2 to i8*), i8* %5)
  call void @nish_print(i8* %6)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end builtin_env -->

## Optimisation flags

### Integer overflow: `nsw` by default, `--wrapping` to opt out

Every user-level **signed** integer `add`, `sub`, and `mul` (binary operators,
unary minus, `op=`, `++`/`--`) carries `nsw`: signed overflow is undefined
behaviour, as in C, and LLVM may widen induction variables and fold
`(a + 1) - 1`. Division and remainder have no `nsw` form, the compiler's own
index and length arithmetic is never flagged, and an **unsigned** type is never
flagged at all — `u8`..`u64` are defined as wrapping, which is what hashing and
bit-packing are written against. This is the default, so the snippet below is
compiled with no flags.

<!-- cookbook:begin opt_nsw -->
```ts
const poly = (x: number, y: number): number => x * x - 3 * y + -x;
```

```llvm
define internal noundef i32 @poly(i32 noundef %x, i32 noundef %y) #0 {
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

`--wrapping` turns the flag off for the whole compilation and gives back
two's-complement wrapping, so `2147483647 + 1` is `-2147483648`. It is what a
hash, a linear congruential generator or a wrap-around counter needs; the same
source, one flag, and no `nsw` anywhere:

<!-- cookbook:begin opt_wrapping -->
Compiled with `--wrapping`.

```ts
const poly = (x: number, y: number): number => x * x - 3 * y + -x;
```

```llvm
define internal noundef i32 @poly(i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = mul i32 %x, %x
  %1 = mul i32 3, %y
  %2 = sub i32 %0, %1
  %3 = sub i32 0, %x
  %4 = add i32 %2, %3
  ret i32 %4
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end opt_wrapping -->

A module constant follows the same rule, because a fold has to agree with the
instruction it replaces: `const OVER: i32 = 2147483647 + 1` is
`` attempt to compute with overflow in a constant `` by default, and
`-2147483648` under `--wrapping`.

### `--target`

The module carries `target datalayout` and `target triple` (the strings
clang 18 emits for that triple), so `opt -O2 -S` and `llc` see the real
pointer size, alignments, and vector width without `-mtriple`. Without the
flag the module is target-neutral and clang fills both in at link time.
`--target host` picks the running machine's triple.

<!-- cookbook:begin opt_target -->
Compiled with `--target x86_64-unknown-linux-gnu`.

```ts
const add = (a: number, b: number): number => a + b;
```

```llvm
target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"
target triple = "x86_64-unknown-linux-gnu"

define internal noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add nsw i32 %a, %b
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
const identity = (s: string): string => s;
```

```llvm
%struct.nish_arena = type { i8*, i64, i64, i8* }
%struct.nish_array = type { i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8
@nish_argv = external global %struct.nish_array*, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_reset_arena() #2
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_arena_used() #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @nish_str_len(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare noundef double @nish_random() #2
declare void @nish_exit(i32 noundef) #4
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @nish_is_dir(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8) #5
declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare i64 @nish_monotonic_nanos() #2
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef nonnull align 8 i8* @nish_platform() #0
declare noundef nonnull align 8 i8* @nish_arch() #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 %struct.nish_array* @nish_alloc_array(i64 noundef, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #6
declare void @nish_panic_div(i1 noundef zeroext) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 i8* @identity(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  ret i8* %s
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end runtime_prelude -->
