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
| `!tbaa` | What the access *is*, not where it points: a field named by its class, LLVM type and byte offset. Lets LLVM keep a store to `bi.vx` from blocking a load of `bj.mass` through a different pointer. Only on classes that implement no interface. An array element slot that holds a value is tagged `element <type>`, which no field shares, so an element store does not block a reload of the field that holds the array. An array header's `len`, `cap` and `data` are tagged `array header`, a struct node no class path reaches, so a field store does not block a reload of a header. |
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
| `nsw` (flag on `add`/`sub`/`mul`) | On a user-level **signed** integer add/sub/mul the bounds walk has *proven* fits, restating the proof so LLVM may widen and fold on it. Every other signed `+`, `-`, `*`, negation, `++`, `--` and `op=` is checked instead — `llvm.s{add,sub,mul}.with.overflow` and a branch to `nish_panic_overflow` ([Semantics decisions](LANGUAGE.md#semantics-decisions)). `wrappingAdd`/`wrappingSub`/`wrappingMul` from `nish:unsafe` are the plain instructions, neither flagged nor checked; the deprecated `--wrapping` makes the entry package's operators plain too. Never on an unsigned type (those are defined to wrap) and never on the compiler's own index and length arithmetic. |

`--plain` drops every attribute and alignment hint and produces the bare
form shown under [Functions](#functions).

## Functions

### A function

A function is an arrow bound to a module-level `const`
([Declarations](LANGUAGE.md#declarations)), and a **concise body** (`=> a + b`)
is the single `return` it means. Parameters are SSA values (`%a`, `%b`); the
module is target-neutral (no `target triple`). `add` is not `export`ed, so it is
`internal` — that is the default
([Linkage](#linkage-export-and---no-strict-exports)) — and its `+` is checked,
the other default: nothing bounds `a` and `b`, so the sum goes through
`llvm.sadd.with.overflow` and a cold branch to `nish_panic_overflow`, which is
`noreturn`, so the function is `nounwind` but not `willreturn`
([Integer overflow](#integer-overflow-checked-by-default-nsw-where-proven)).

<!-- cookbook:begin fn-add -->
```ts
const add = (a: number, b: number): number => a + b
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn-add -->

### The same function with the `function` keyword

The declaration form is a spelling, not a lowering
([wp22-arrow-functions.md](wp22-arrow-functions.md)): the emitter reads the
checked signature and never the syntax that produced it, so the legacy
`function` spelling and the arrow above compile to the same module, instruction
for instruction — attribute group included. `function` is still accepted, and
this listing is now the only one in the cookbook that uses it: `decl-ffi` was
the last of the others, and what it has left is `declare function`, which is a
different thing (§9).

<!-- cookbook:begin fn-add-function -->
```ts
function add(a: number, b: number): number {
  return a + b
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn-add-function -->

### The same function without semicolons

A semicolon is optional wherever TypeScript would insert one: at a line break,
before a `}` and at the end of the file ([Lexical rules](LANGUAGE.md#lexical-rules)).
The parser drops a `;` whether it was written or inserted, so nothing after it
can tell the two apart, and this is `fn-add`'s module byte for byte.

<!-- cookbook:begin fn-add-no-semicolons -->
```ts
const add = (a: number, b: number): number => a + b
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn-add-no-semicolons -->

### The same function with `--plain`

<!-- cookbook:begin fn-add-plain -->
Compiled with `--plain`.

```ts
const add = (a: number, b: number): number => a + b
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef)
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32)

define internal i32 @add(i32 %a, i32 %b) {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}
```
<!-- cookbook:end fn-add-plain -->

### `--number-mode f64`

`number` becomes `double`; float constants are printed as IEEE-754 hex because
LLVM rejects decimal literals that do not round-trip exactly.

<!-- cookbook:begin fn-f64 -->
Compiled with `--number-mode f64`.

```ts
const halve = (x: number): number => x / 2.5
```

```llvm
define internal noundef double @halve(double noundef %x) #0 {
entry:
  %0 = fdiv double %x, 0x4004000000000000
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end fn-f64 -->

### A generic function

Every instantiation is a function of its own, named by appending `$` and each
type argument's mangled type to the template's name. `identity` is written once
and compiled twice; neither `define` has anything generic left in it, and
`identity$i32` is the IR of `const identityI32 = (x: i32): i32 => x` with the
symbol renamed. `identity$str` keeps its parameter's pointer attributes but not
`nocapture`, because returning the pointer is an escape.

The module boundary changes nothing about the IR and everything about where it
is written: a template exported and called from another module is monomorphised
where it is *declared*, so the `define`s below stay in this module and the
caller gets a `declare` carrying these exact attributes. One instantiation is
one definition for the whole program however many modules ask for it
(`tests/link/generic_import`, `generic_two_importers`), and the symbol carries
the declaring package's prefix (`tests/link/package_generic_import`). A
two-module program cannot be a snippet here, which is why those three are the
cases that pin it.

<!-- cookbook:begin gen-function -->
```ts
const identity = <T>(x: T): T => x

export const main = (): i32 => {
  console.log(identity(7))
  console.log(identity("hi"))
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @identity$i32(i32 7)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i8* @identity$str(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @identity$i32(i32 noundef %x) #1 {
entry:
  ret i32 %x
}

define internal noundef nonnull align 8 i8* @identity$str(i8* noundef nonnull noalias readonly align 8 %x) #1 {
entry:
  ret i8* %x
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
```
<!-- cookbook:end gen-function -->

### Inference, and per-instantiation facts

A type argument is read off the argument's type: `T[]` against `i32[]` binds
`T := i32`, and nothing is written at the call site. The two instantiations of
`eq` are the reason the attribute fixpoint is keyed by symbol rather than by
declaration — comparing two integers reads no memory, comparing two strings
calls into the runtime, so one source line gets `readnone` in one instantiation
and `readonly` in the other.

<!-- cookbook:begin gen-infer -->
```ts
const firstOf = <T>(xs: T[]): T => xs[0]

const eq = <T>(a: T, b: T): boolean => a === b

export const main = (): i32 => {
  console.log(firstOf([4, 5, 6]))
  console.log(eq(1, 1))
  console.log(eq("a", "b"))
  return 0
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

define noundef i32 @nish_main() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 4, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 5, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 6, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = call i32 @firstOf$i32(%struct.nish_array* %arr.hdr)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = call i1 @eq$i32(i32 1, i32 1)
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %11)
  %12 = call i1 @eq$str(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %13)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @firstOf$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %7
}

define internal noundef zeroext i1 @eq$i32(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = icmp eq i32 %a, %b
  ret i1 %0
}

define internal noundef zeroext i1 @eq$str(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #2 {
entry:
  %0 = call zeroext i1 @nish_str_eq(i8* %a, i8* %b)
  ret i1 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end gen-infer -->

### A generic class

An instantiated generic class is an *ordinary struct*, which is what makes the
whole feature affordable: `Box<i32>` is `%struct.Box$i32` with `Box`'s fields at
`T = i32`, its methods are `@Box$i32.get` and `@Box$i32.constructor`, and the
layout, the `dereferenceable` on `%this`, the attribute groups and the TBAA
nodes are all computed from the instantiation rather than from the template.
Compare the two below: the `i32` box is four bytes and the `string` box is
eight, and the string constructor's `%v` loses `nocapture` because it is stored
into a field — which is exactly what a hand-written `BoxStr` would do.

An imported `Box<T>` is the same picture across two files: `%struct.Box$i32`
and its members are emitted by the module that declares `Box`, and a module
that holds one gets the `%struct` line and a `declare` per member, exactly as
it does for an imported declared class.

<!-- cookbook:begin gen-class -->
```ts
class Box<T> {
  value: T

  constructor(v: T) {
    this.value = v
  }

  get(): T {
    return this.value
  }
}

export const main = (): i32 => {
  const n = new Box<i32>(7)
  const s = new Box<string>("hi")
  console.log(s.get())
  return n.get()
}
```

```llvm
%struct.Box$i32 = type { i32 }
%struct.Box$str = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  %s.addr = alloca %struct.Box$str*, align 8
  %Box$str.obj = alloca %struct.Box$str, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 7)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %n.addr, align 8
  call void @Box$str.constructor(%struct.Box$str* %Box$str.obj, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  store %struct.Box$str* %Box$str.obj, %struct.Box$str** %s.addr, align 8
  %0 = load %struct.Box$str*, %struct.Box$str** %s.addr, align 8
  %1 = call i8* @Box$str.get(%struct.Box$str* %0)
  call void @nish_print(i8* %1)
  %2 = load %struct.Box$i32*, %struct.Box$i32** %n.addr, align 8
  %3 = call i32 @Box$i32.get(%struct.Box$i32* %2)
  ret i32 %3
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Box$i32.get(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  ret i32 %1
}

define internal void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %v, i8** %0, align 8, !tbaa !7
  ret void
}

define internal noundef nonnull align 8 i8* @Box$str.get(%struct.Box$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !7
  ret i8* %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box$i32", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Box$str", !5, i64 0}
!7 = !{!6, !5, i64 0}
```
<!-- cookbook:end gen-class -->

### A constrained type parameter

`<T extends Shape>` lets a template read `Shape`'s members through a `T`, and
changes nothing about how it is lowered. `areaOf` is still one `define` per
type argument, and each one reads its *own* struct: `areaOf$$Circle` loads
field 0 of `%struct.Circle`, `areaOf$$Square` field 0 of `%struct.Square`.
Because both classes `implements Shape`, `area` is their first field, so the
index is the one `Shape` would have given — there is no `bitcast` to
`%struct.Shape`, no vtable and no dictionary, and each function is the one a
hand-written `areaOfCircle` would be. The constraint is a checker rule: it
decides which members a `T` may name (only `Shape`'s, so `shape.radius` is
refused even at `T = Circle`) and which type arguments a call may imply (a
class that does not `implements Shape` is refused at the call).

<!-- cookbook:begin gen-constraint -->
```ts
interface Shape {
  area: i32
}

class Circle implements Shape {
  area: i32
  radius: i32

  constructor(radius: i32) {
    this.area = 3 * radius * radius
    this.radius = radius
  }
}

class Square implements Shape {
  area: i32

  constructor(side: i32) {
    this.area = side * side
  }
}

const areaOf = <T extends Shape>(shape: T): i32 => shape.area

export const main = (): i32 => areaOf(new Circle(2)) + areaOf(new Square(3))
```

```llvm
%struct.Shape = type { i32 }
%struct.Circle = type { i32, i32 }
%struct.Square = type { i32 }

declare void @nish_free_arena() #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %radius) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %radius)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 %radius)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 %4, i32* %6, align 4
  %7 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %radius, i32* %7, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %side, i32 %side)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 %1, i32* %3, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %Circle.obj = alloca %struct.Circle, align 8
  %Square.obj = alloca %struct.Square, align 8
  call void @Circle.constructor(%struct.Circle* %Circle.obj, i32 2)
  %0 = call i32 @areaOf$$Circle(%struct.Circle* %Circle.obj)
  call void @Square.constructor(%struct.Square* %Square.obj, i32 3)
  %1 = call i32 @areaOf$$Square(%struct.Square* %Square.obj)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @areaOf$$Circle(%struct.Circle* noundef nonnull readonly align 8 dereferenceable(8) nocapture %shape) #1 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %shape, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define internal noundef i32 @areaOf$$Square(%struct.Square* noundef nonnull readonly align 8 dereferenceable(4) nocapture %shape) #1 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %shape, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
```
<!-- cookbook:end gen-constraint -->

### A generic method

A method may declare type parameters of its own, and each (receiver struct,
method type-argument tuple) is one `define`, named after the receiver's method
symbol with the method's arguments appended: `Chooser.pick` at `i32` and at
`string` is `@Chooser.pick$i32` and `@Chooser.pick$str`, and `Box<i32>.keep` at
`string` is `@Box$i32.keep$str`. Each is the method somebody would have written
for that type — `this` first, the same body, its own attributes — and a second
call at a tuple already asked for adds nothing. Inside `keep` both the class's
`T` and the method's `U` are bound (docs/wp18-generics.md §15.8).

<!-- cookbook:begin gen-method -->
```ts
class Chooser {
  flip: boolean = false

  pick<T>(a: T, b: T): T {
    return this.flip ? b : a
  }
}

class Box<T> {
  value: T

  constructor(value: T) {
    this.value = value
  }

  keep<U>(other: U): T {
    return this.value
  }
}

export const main = (): i32 => {
  const c = new Chooser()
  const word: string = c.pick("left", "right")
  console.log(word)
  return c.pick(1, 2) + new Box<i32>(7).keep("seven")
}
```

```llvm
%struct.Chooser = type { i1 }
%struct.Box$i32 = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"left\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"right\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"seven\00" }, align 8

declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @nish_main() #0 {
entry:
  %c.addr = alloca %struct.Chooser*, align 8
  %Chooser.obj = alloca %struct.Chooser, align 8
  %word.addr = alloca i8*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  %0 = getelementptr inbounds %struct.Chooser, %struct.Chooser* %Chooser.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !4
  store %struct.Chooser* %Chooser.obj, %struct.Chooser** %c.addr, align 8
  %1 = load %struct.Chooser*, %struct.Chooser** %c.addr, align 8
  %2 = call i8* @Chooser.pick$str(%struct.Chooser* %1, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  store i8* %2, i8** %word.addr, align 8
  %3 = load i8*, i8** %word.addr, align 8
  call void @nish_print(i8* %3)
  %4 = load %struct.Chooser*, %struct.Chooser** %c.addr, align 8
  %5 = call i32 @Chooser.pick$i32(%struct.Chooser* %4, i32 1, i32 2)
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 7)
  %6 = call i32 @Box$i32.keep$str(%struct.Box$i32* %Box$i32.obj, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %8

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !7
  ret void
}

define internal noundef nonnull align 8 i8* @Chooser.pick$str(%struct.Chooser* noundef nonnull readonly align 8 dereferenceable(1) nocapture %this, i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 %b) #2 {
entry:
  %0 = getelementptr inbounds %struct.Chooser, %struct.Chooser* %this, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !4
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ %b, %cond.true ], [ %a, %cond.false ]
  ret i8* %2
}

define internal noundef i32 @Chooser.pick$i32(%struct.Chooser* noundef nonnull readonly align 8 dereferenceable(1) nocapture %this, i32 noundef %a, i32 noundef %b) #2 {
entry:
  %0 = getelementptr inbounds %struct.Chooser, %struct.Chooser* %this, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !4
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %b, %cond.true ], [ %a, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @Box$i32.keep$str(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i8* noundef nonnull noalias readonly align 8 nocapture %other) #2 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !7
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"Chooser", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"i32", !1, i64 0}
!6 = !{!"Box$i32", !5, i64 0}
!7 = !{!6, !5, i64 0}
```
<!-- cookbook:end gen-method -->

### A function parameter

A parameter annotated with a function type takes a callee the checker can
name at the call — a top-level function, or an arrow written there — and the
callee is part of the instantiation's key, after the type arguments. So
`apply(square, x)` and `apply(cube, x)` are two `define`s,
`@apply$fn.6.square` and `@apply$fn.4.cube`, each with a direct call to its
callee and no parameter for `f` at all: there is no function pointer and no
indirect call, and each gets the attributes of its own callee
(docs/wp23-language-surface.md §6).

<!-- cookbook:begin fnarg-named -->
```ts
// A function-typed parameter makes `apply` a template over its callee: one
// `define` per function argument, each calling its callee directly.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x) + 1

const square = (x: i32): i32 => x * x
const cube = (x: i32): i32 => x * x * x

export const both = (x: i32): i32 => apply(square, x) + apply(cube, x)
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %x)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @cube(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %x)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 %x)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @both(i32 noundef %x) #0 {
entry:
  %0 = call i32 @apply$fn.6.square(i32 %x)
  %1 = call i32 @apply$fn.4.cube(i32 %x)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @apply$fn.6.square(i32 noundef %x) #0 {
entry:
  %0 = call i32 @square(i32 %x)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @apply$fn.4.cube(i32 noundef %x) #0 {
entry:
  %0 = call i32 @cube(i32 %x)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end fnarg-named -->

### An arrow argument, lifted

An arrow written as the argument becomes a function of its own, named after
the one it is written in with a `$` no declaration can spell
(`@halves$arrow0`), and it can see only its parameters and the module's
top-level names. Its parameter takes `T` from the array, and its concise body
binds `U`, so the instantiation is `map<i32, f64, (n) => ...>`,
`@map$i32$f64$fn.13.halves$arrow0`.

<!-- cookbook:begin fnarg-arrow -->
```ts
// An arrow argument is lifted into a function of its own, and `U` is bound
// from its body: `map<i32, f64, (n) => ...>`.
const map = <T, U>(xs: T[], f: (x: T) => U): U[] => {
  const out: U[] = []
  for (const x of xs) {
    out.push(f(x))
  }
  return out
}

export const halves = (xs: i32[]): f64[] => map(xs, (n) => toF64(n) / 2.0)
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3

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

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @halves(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = call %struct.nish_array* @map$i32$f64$fn.13.halves$arrow0(%struct.nish_array* %xs)
  ret %struct.nish_array* %0
}

define internal noundef double @halves$arrow0(i32 noundef %n) #1 {
entry:
  %0 = sitofp i32 %n to double
  %1 = fdiv double %0, 0x4000000000000000
  ret double %1
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @map$i32$f64$fn.13.halves$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %5 = load i64, i64* %forof.idx, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %forof.body, label %forof.end

forof.body:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %5
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %13, i32* %x.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = load i32, i32* %x.addr, align 4
  %16 = call double @halves$arrow0(i32 %15)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 8)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to double*
  %25 = getelementptr inbounds double, double* %24, i64 %18
  store double %16, double* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  br label %forof.inc

forof.inc:
  %28 = load i64, i64* %forof.idx, align 8
  %29 = add i64 %28, 1
  store i64 %29, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %30
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element double", !6, i64 0}
!16 = !{!15, !15, i64 0}
```
<!-- cookbook:end fnarg-arrow -->

### `nish/threads`: a map and a reduce over the partitioner

`parallelMapInto` and `parallelReduce` are templates in `std/threads.ts`, so the
importing module sees two instantiations called like any other, each with the
function it was given in its symbol (`@nish.parallelMapInto$f64$f64$fn.6.square`).
Importing the module implies `--threads`, so a module that allocates declares
`@nish_arena` `thread_local`; this one allocates nothing. The parallel part is in `threads.ll`: the instance's body
is `std/threads.ts`'s own, except that its call to the chunk loop becomes a
test against the grain, a direct call when the range is within it, and
otherwise a context block on the stack and a call to the partitioner,

```llvm
  %13 = icmp sle i32 %12, 1398101
  br i1 %13, label %par.seq, label %par.region

par.seq:
  call void @nish.mapRange$f64$f64$fn.6.square(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  br label %par.done

par.region:
  ; ... src and dst stored into %par.ctx ...
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$f64$f64$fn.6.square$chunk, i8* %16, i64 %17, i64 1398101)
  br label %par.done
```

and `@...$chunk(lo, hi, ctx)` loads them back and calls the chunk loop,
`@nish.mapRange$f64$f64$fn.6.square`, over `[lo, hi)`. The grain, 1,398,101,
is 2^22 over `square`'s estimated cost of 3 (docs/LANGUAGE.md, "Data
parallelism"). A reduce divides its blocks rather than its elements, with a
grain of one block. The whole of both
modules is `tests/link/par_map`'s golden (docs/LANGUAGE.md, "Data
parallelism").

<!-- cookbook:begin par-map -->
```ts
import { parallelMapInto, parallelReduce } from "nish/threads"

const square = (x: f64): f64 => x * x

export const sumOfSquares = (xs: f64[], scratch: f64[]): f64 => {
  parallelMapInto(xs, scratch, square)
  return parallelReduce(scratch, (a, b) => a + b, 0.0)
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare void @nish.parallelMapInto$f64$f64$fn.6.square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef double @nish.parallelReduce$f64$fn.19.sumOfSquares$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), double noundef) #1

define hidden noundef double @square(double noundef %x) #0 {
entry:
  %0 = fmul double %x, %x
  ret double %0
}

define noundef double @sumOfSquares(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %scratch) #1 {
entry:
  call void @nish.parallelMapInto$f64$f64$fn.6.square(%struct.nish_array* %xs, %struct.nish_array* %scratch)
  %0 = call double @nish.parallelReduce$f64$fn.19.sumOfSquares$arrow0(%struct.nish_array* %scratch, double 0x0000000000000000)
  ret double %0
}

define hidden noundef double @sumOfSquares$arrow0(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fadd double %a, %b
  ret double %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
```
<!-- cookbook:end par-map -->

### `nish/threads`: a body that allocates

A parallel body may build a string on the way to its result. `label` assigns
its string to a `let`, which is what keeps the ordinary WP6 scope off it; as a
parallel body it gets one anyway, so each call marks the arena of whichever
thread runs it and releases it before returning, and a map holds one element's
string at a time. The call compiles with performance warning NL9012.

<!-- cookbook:begin par-alloc -->
```ts
import { parallelMapInto } from "nish/threads"

const label = (x: i32): i32 => {
  let s = "small"
  if (x > 9) {
    s = `big ${x}`
  }
  return s.length
}

export const labelAll = (xs: i32[], out: i32[]): void => {
  parallelMapInto(xs, out, label)
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"small\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"big \00" }, align 8

declare void @nish.parallelMapInto$i32$i32$fn.5.label(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define hidden noundef i32 @label(i32 noundef %x) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = icmp sgt i32 %x, 9
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_from_i32(i32 %x)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* %1)
  store i8* %2, i8** %s.addr, align 8
  br label %if.end

if.end:
  %3 = load i8*, i8** %s.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %6
}

define void @labelAll(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %out) #0 {
entry:
  call void @nish.parallelMapInto$i32$i32$fn.5.label(%struct.nish_array* %xs, %struct.nish_array* %out)
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end par-alloc -->

### `nish/threads`: a scope of tasks

`using s = scope()` opens a scope and `s.spawn(entry, arg, dst, at)` files a
task on it; the block's every exit is a call to `nish_scope_join`, which runs
the tasks — the first on this thread, each other on a thread of its own — and,
once all have finished, stores each answer. Below, the join comes right after
the two spawns, at the block's end and before `out` is read; in a function
with an arena scope it comes before the release, so the scope's memory
outlives every task that reads it. Each spawn is an
instance of `ThreadScope.spawn` in `nish/threads`'s own module, where the
call `runTask(entry, arg, dst, at)` becomes a payload and a filing:

```llvm
%task.payload = alloca { i32, %struct.nish_array*, i32, i32 }, align 8
; ... arg, dst and at stored into its first three fields ...
call void @nish_scope_spawn(i8* %scope, void (i8*)* @<spawn>$run, void (i8*)* @<spawn>$finish, i8* %payload, i64 <size>)
```

`@<spawn>$run(p)` calls `entry(arg)` into the payload's last field on the
task's thread, and `@<spawn>$finish(p)` calls the checked `storeResult(dst, at,
r)` on the thread that opened the scope, after the join. The whole of both
modules is `tests/link/thread_scope_basic`'s golden (docs/LANGUAGE.md, "Scoped
tasks").

<!-- cookbook:begin thread-scope -->
```ts
import { scope } from "nish/threads"

const square = (n: i32): i32 => n * n

const cube = (n: i32): i32 => n * n * n

export const powers = (n: i32): i32 => {
  const out: i32[] = [0, 0]
  {
    using s = scope()
    s.spawn(square, n, out, 0)
    s.spawn(cube, n, out, 1)
  }
  return out[0] + out[1]
}
```

```llvm
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.square(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.4.cube(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define hidden noundef i32 @square(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 %n)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @cube(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 %n)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 %n)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @powers(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.square(%struct.ThreadScope* %12, i32 %n, %struct.nish_array* %13, i32 0)
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.4.cube(%struct.ThreadScope* %14, i32 %n, %struct.nish_array* %15, i32 1)
  call void @nish_scope_join(i8* %11)
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 0, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ult i64 1, %27
  br i1 %28, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %27)
  unreachable

bounds.ok.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 1
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end thread-scope -->

### `nish/text`: `indexOfAny` on the runtime kernel

`indexOfAny` is ordinary Nish in `std/text.ts`: its checks on the set, its
clamp of `from`, and one call to the private walker `indexOfAnyFrom`, a loop
over `charCodeAt` that is what runs under Node. In the module that is
`nish/text` — the package is part of the test (`src/kernels.ts`) — that one
call becomes the runtime kernel. The `i32` `from` widens to the kernel's `i64`
and the answer narrows back, which loses nothing: a match is below the text's
length and a miss is -1. The tail of `@nish.indexOfAny`, after the clamp:

```llvm
if.end.3:
  %29 = load i32, i32* %start.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = call i64 @nish_str_index_of_any(i8* %text, i8* %bytes, i64 %30)
  %32 = trunc i64 %31 to i32
  ret i32 %32
}
```

and the kernel's declaration. It reads its two strings through `nocapture
readonly` pointers; the one store it makes, the first call's choice of path
into a static of `runtime-simd.c`'s own, is memory no Nish code can name, which
is what `inaccessiblemem` says:

```llvm
declare i64 @nish_str_index_of_any(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #7

attributes #7 = { nounwind willreturn memory(argmem: read, inaccessiblemem: readwrite) }
```

`@nish.indexOfAnyFrom` is still defined, `internal` and called by nothing, and
`opt` deletes it. The importing module sees `indexOfAny` as any other import.
The whole of `text.ll` is `tests/link/std_text_index_of_any`'s golden; the same
`std/text.ts` compiled as a root keeps `call i32 @indexOfAnyFrom(` and declares
no kernel (`tests/run.js`, "kernels:").

### `Map` and `Set`: one probe, copied into the module

`Map` and `Set` are generic classes in `std/collections.ts`, loaded because the
module names one, and that module writes no `.ll` of its own: every function
of it this module reaches is defined here, `internal`, after the module's own
code (docs/wp32-map.md §4.1). `s.has(x)` is a call to `Set$i32.has`, which asks
`probeTable$i32` for the packed probe result. The key's hash is lowered in
place — here `fmix32`, then 0 moved to 1 — and the loop reads `entryHashes`
and `entryKeys` only after the bucket word's top eight bits match the hash's,
comparing the stored hash before the key (§2). `hashKey` and `sameKey` are
never called: they are intrinsics `src/emit-map.ts` lowers per key type. So is
`storedKey`, where `insertAt` pushes the key: a float key is pushed as
`fadd <key>, 0.0`, which stores a -0 as +0 as JavaScript does, and every other
key is pushed as it is, with no instruction added
(`tests/cases/map_key_negzero`).

<!-- cookbook:begin map-has -->
```ts
export const seen = (s: Set<i32>, x: i32): boolean => s.has(x)
```

```llvm
%struct.Set$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8

declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1

define noundef zeroext i1 @seen(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %s, i32 noundef %x) #0 {
entry:
  %0 = call i1 @nish.Set$i32.has(%struct.Set$i32* %s, i32 %x)
  ret i1 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal noundef i64 @nish.Set$i32.probe(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !5
  %2 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !6
  %4 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !7
  %6 = getelementptr inbounds %struct.Set$i32, %struct.Set$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !8
  %8 = call i64 @nish.probeTable$i32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i32 %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Set$i32.has(%struct.Set$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %key) #0 {
entry:
  %0 = call i64 @nish.Set$i32.probe(%struct.Set$i32* %this, i32 %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef i64 @nish.probeTable$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i32 noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = lshr i32 %key, 16
  %1 = xor i32 %key, %0
  %2 = mul i32 %1, -2048144789
  %3 = lshr i32 %2, 13
  %4 = xor i32 %2, %3
  %5 = mul i32 %4, -1028477387
  %6 = lshr i32 %5, 16
  %7 = xor i32 %5, %6
  %8 = icmp eq i32 %7, 0
  %9 = select i1 %8, i32 1, i32 %7
  store i32 %9, i32* %h.addr, align 4
  %10 = load i32, i32* %h.addr, align 4
  %11 = lshr i32 %10, 24
  store i32 %11, i32* %fingerprint.addr, align 4
  %12 = load i32, i32* %h.addr, align 4
  %13 = call i32 @nish.homeBucket(i32 %12, i32 %mask)
  store i32 %13, i32* %bucket.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  br label %while.cond

while.cond:
  %26 = load i32, i32* %bucket.addr, align 4
  %27 = icmp sge i32 %26, 0
  br i1 %27, label %land.rhs, label %land.end

land.rhs:
  %28 = load i32, i32* %bucket.addr, align 4
  %29 = trunc i64 %15 to i32
  %30 = icmp slt i32 %28, %29
  br label %land.end

land.end:
  %31 = phi i1 [ false, %while.cond ], [ %30, %land.rhs ]
  br i1 %31, label %while.body, label %while.end

while.body:
  %32 = load i32, i32* %bucket.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %17 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %33
  %36 = load i32, i32* %35, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  store i32 %36, i32* %word.addr, align 4
  %37 = load i32, i32* %word.addr, align 4
  %38 = icmp eq i32 %37, 0
  br i1 %38, label %if.then, label %if.end

if.then:
  %39 = load i32, i32* %bucket.addr, align 4
  %40 = load i32, i32* %h.addr, align 4
  %41 = tail call i64 @nish.absentAt(i32 %39, i32 %40)
  ret i64 %41

if.end:
  %42 = load i32, i32* %word.addr, align 4
  %43 = lshr i32 %42, 24
  %44 = load i32, i32* %fingerprint.addr, align 4
  %45 = icmp eq i32 %43, %44
  br i1 %45, label %if.then.1, label %if.end.1

if.then.1:
  %46 = load i32, i32* %word.addr, align 4
  %47 = and i32 %46, 16777215
  %48 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %49, i32* %at.addr, align 4
  %51 = load i32, i32* %at.addr, align 4
  %52 = icmp sge i32 %51, 0
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = load i32, i32* %at.addr, align 4
  %54 = trunc i64 %19 to i32
  %55 = icmp slt i32 %53, %54
  br label %land.end.4

land.end.4:
  %56 = phi i1 [ false, %ovf.ok ], [ %55, %land.rhs.4 ]
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = load i32, i32* %at.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = bitcast i8* %21 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %58
  %61 = load i32, i32* %60, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %62 = load i32, i32* %h.addr, align 4
  %63 = icmp eq i32 %61, %62
  br label %land.end.3

land.end.3:
  %64 = phi i1 [ false, %land.end.4 ], [ %63, %land.rhs.3 ]
  br i1 %64, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %65 = load i32, i32* %at.addr, align 4
  %66 = trunc i64 %23 to i32
  %67 = icmp slt i32 %65, %66
  br label %land.end.2

land.end.2:
  %68 = phi i1 [ false, %land.end.3 ], [ %67, %land.rhs.2 ]
  br i1 %68, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %69 = load i32, i32* %at.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %25 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 %70
  %73 = load i32, i32* %72, align 4, !alias.scope !13, !noalias !12, !tbaa !20
  %74 = icmp eq i32 %73, %key
  br label %land.end.1

land.end.1:
  %75 = phi i1 [ false, %land.end.2 ], [ %74, %land.rhs.1 ]
  br i1 %75, label %if.then.2, label %if.end.2

if.then.2:
  %76 = load i32, i32* %bucket.addr, align 4
  %77 = load i32, i32* %at.addr, align 4
  %78 = tail call i64 @nish.foundAt(i32 %76, i32 %77)
  ret i64 %78

if.end.2:
  br label %if.end.1

if.end.1:
  %79 = load i32, i32* %bucket.addr, align 4
  %80 = add nsw i32 %79, 1
  %81 = and i32 %80, %mask
  store i32 %81, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Set$i32", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32, !2, i64 40}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 16}
!7 = !{!4, !3, i64 32}
!8 = !{!4, !3, i64 24}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !15, i64 16}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
```
<!-- cookbook:end map-has -->

### `m.get(k)`: a found bit and a value, never a struct

`get` answers `V | undefined`, and that pair is two SSA values rather than a
type in memory (docs/wp32-map.md §3.2). `get` is one call of the instance's
`probe`: its packed answer compared with 0 is the found bit, and `valueAt` of
the index in its low half is called only on the edge where the bit is set.
`m.get(w) ?? 0` branches to the value or the default and joins them with a
`phi`; the default is not evaluated when the key is there. In `bump` the `set`
asks about `w` again, so it writes through that same probe rather than making
its own ([the next section but one](#fused-lookups-one-probe-for-a-key-asked-about-twice)). A `const` bound to
`get` holds a `phi` of the value and zero, and `n === undefined` is the found
bit negated, so the narrowed read of `n` after the early return is that `phi`,
with nothing stored and nothing probed a second time.

<!-- cookbook:begin map-get -->
```ts
export const bump = (m: Map<string, i32>, w: string): void => {
  m.set(w, (m.get(w) ?? 0) + 1)
}

export const known = (m: Map<string, i32>, w: string): i32 => {
  const n = m.get(w)
  if (n === undefined) {
    return -1
  }
  return n
}
```

```llvm
%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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

define void @bump(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %m, i8* noundef nonnull noalias readonly align 8 %w) #0 {
entry:
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %m, i8* %w)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %nullish.value, label %nullish.default

nullish.value:
  %2 = trunc i64 %0 to i32
  %3 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %m, i32 %2)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi i32 [ %3, %nullish.value ], [ 0, %nullish.default ]
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  br i1 %1, label %set.found, label %set.insert

set.found:
  %8 = trunc i64 %0 to i32
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %m, i32 %8, i32 %6)
  br label %set.end

set.insert:
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %m, i64 %0, i8* %w, i32 %6)
  br label %set.end

set.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @known(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %m, i8* noundef nonnull noalias readonly align 8 %w) #0 {
entry:
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %m, i8* %w)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %get.found, label %get.end

get.found:
  %2 = trunc i64 %0 to i32
  %3 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %m, i32 %2)
  br label %get.end

get.end:
  %4 = phi i32 [ %3, %get.found ], [ 0, %entry ]
  %5 = xor i1 %1, true
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  ret i32 %4
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = or i32 %1, %3
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = trunc i64 %3 to i32
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %5 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void

if.end:
  %23 = load i32, i32* %bucket.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = and i32 %24, %mask
  store i32 %25, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %used
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %7 = load i32, i32* %n.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = sext i32 %9 to i64
  %12 = icmp ule i64 %11, 2147483647
  br i1 %12, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  ret %struct.nish_array* %14

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !18
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !19
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !20
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !21
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !22
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !22
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %15
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !22
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !22
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !21
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !23
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !24
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !21
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !22
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %value, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !20
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !23
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !23
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !27
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !27
  %71 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !21
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !18
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !18
  %91 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !19
  %93 = load i32, i32* %bucket.addr, align 4
  %94 = load i32, i32* %h.addr, align 4
  %95 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !24
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !18
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !23
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !23
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !21
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !20
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !22
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !20
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !20
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !18
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !19
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !20
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = trunc i64 %20 to i32
  %35 = icmp slt i32 %33, %34
  br label %land.end

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ]
  br i1 %36, label %while.body, label %while.end

while.body:
  %37 = load i32, i32* %bucket.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %22 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %41, i32* %word.addr, align 4
  %42 = load i32, i32* %word.addr, align 4
  %43 = icmp eq i32 %42, 0
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load i32, i32* %bucket.addr, align 4
  %45 = load i32, i32* %h.addr, align 4
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45)
  ret i64 %46

if.end:
  %47 = load i32, i32* %word.addr, align 4
  %48 = lshr i32 %47, 24
  %49 = load i32, i32* %fingerprint.addr, align 4
  %50 = icmp eq i32 %48, %49
  br i1 %50, label %if.then.1, label %if.end.1

if.then.1:
  %51 = load i32, i32* %word.addr, align 4
  %52 = and i32 %51, 16777215
  %53 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %52, i32 1)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %54, i32* %at.addr, align 4
  %56 = load i32, i32* %at.addr, align 4
  %57 = icmp sge i32 %56, 0
  br i1 %57, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %58 = load i32, i32* %at.addr, align 4
  %59 = trunc i64 %24 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %ovf.ok ], [ %60, %land.rhs.4 ]
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %26 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %67 = load i32, i32* %h.addr, align 4
  %68 = icmp eq i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = trunc i64 %28 to i32
  %72 = icmp slt i32 %70, %71
  br label %land.end.2

land.end.2:
  %73 = phi i1 [ false, %land.end.3 ], [ %72, %land.rhs.2 ]
  br i1 %73, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %74 = load i32, i32* %at.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %30 to i8**
  %77 = getelementptr inbounds i8*, i8** %76, i64 %75
  %78 = load i8*, i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %79 = call zeroext i1 @nish_str_eq(i8* %78, i8* %key)
  br label %land.end.1

land.end.1:
  %80 = phi i1 [ false, %land.end.2 ], [ %79, %land.rhs.1 ]
  br i1 %80, label %if.then.2, label %if.end.2

if.then.2:
  %81 = load i32, i32* %bucket.addr, align 4
  %82 = load i32, i32* %at.addr, align 4
  %83 = tail call i64 @nish.foundAt(i32 %81, i32 %82)
  ret i64 %83

if.end.2:
  br label %if.end.1

if.end.1:
  %84 = load i32, i32* %bucket.addr, align 4
  %85 = add nsw i32 %84, 1
  %86 = and i32 %85, %mask
  store i32 %86, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Map$str$i32", !15, i64 0, !16, i64 8, !15, i64 16, !15, i64 20, !16, i64 24, !16, i64 32, !16, i64 40, !15, i64 48}
!18 = !{!17, !16, i64 8}
!19 = !{!17, !15, i64 16}
!20 = !{!17, !16, i64 40}
!21 = !{!17, !16, i64 24}
!22 = !{!17, !16, i64 32}
!23 = !{!17, !15, i64 20}
!24 = !{!17, !15, i64 48}
!25 = !{!"element ptr", !6, i64 0}
!26 = !{!25, !25, i64 0}
!27 = !{!17, !15, i64 0}
```
<!-- cookbook:end map-get -->

### `Map` and `Set` iteration

`for (const v of m.values())` is a walk of the table's entries in index order,
lowered to four of the table's own methods, each copied into the module like
the rest of it (docs/wp32-map.md §6.2). `walkOpen` counts the walk where the
loop is entered, and `walkNext` answers the first live entry at or after an
index, or -1. It reads the entry count on every call, so a key set during the
walk is visited, and it skips a dead entry, so a key deleted before the walk
reaches it is not. `valueAt` (`keyAt` for `keys()` and for a `Set`) reads the
variable at the top of each pass. `walkClose` ends the walk on every edge out:
`walk.end`, which the fall-through and `break` both reach, and here the early
`return`, which closes it before the scope release. While the count is above
zero a rebuild doubles instead of compacting, so no entry moves under the
cursor. That is two stores a loop, in `walkOpen` and `walkClose`, and none an
entry.

<!-- cookbook:begin map-iter -->
```ts
export const total = (m: Map<i32, i32>): i32 => {
  let sum: i32 = 0
  for (const v of m.values()) {
    if (v < 0) {
      return -1
    }
    sum += v
  }
  return sum
}
```

```llvm
%struct.Map$i32$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8

declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #5

define noundef i32 @total(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %m) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %walk.idx = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  call void @nish.Map$i32$i32.walkOpen(%struct.Map$i32$i32* %m)
  %0 = call i32 @nish.Map$i32$i32.walkNext(%struct.Map$i32$i32* %m, i32 0)
  store i32 %0, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %1 = load i32, i32* %walk.idx, align 4
  %2 = icmp sge i32 %1, 0
  br i1 %2, label %walk.body, label %walk.end

walk.body:
  %3 = call i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* %m, i32 %1)
  store i32 %3, i32* %v.addr, align 4
  %4 = load i32, i32* %v.addr, align 4
  %5 = icmp slt i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish.Map$i32$i32.walkClose(%struct.Map$i32$i32* %m)
  ret i32 -1

if.end:
  %6 = load i32, i32* %sum.addr, align 4
  %7 = load i32, i32* %v.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %9, i32* %sum.addr, align 4
  br label %walk.inc

walk.inc:
  %11 = add i32 %1, 1
  %12 = call i32 @nish.Map$i32$i32.walkNext(%struct.Map$i32$i32* %m, i32 %11)
  store i32 %12, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$i32$i32.walkClose(%struct.Map$i32$i32* %m)
  %13 = load i32, i32* %sum.addr, align 4
  ret i32 %13

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp slt i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ]
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %i.addr, align 4
  ret i32 %16

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal void @nish.Map$i32$i32.walkOpen(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !17
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !17
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.Map$i32$i32.walkNext(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !18
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$i32$i32.walkClose(%struct.Map$i32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !17
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 7
  store i32 %3, i32* %5, align 4, !tbaa !17
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @nish.Map$i32$i32.valueAt(%struct.Map$i32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !19
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$i32$i32, %struct.Map$i32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !19
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %15
}

attributes #0 = { nounwind }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"i32", !6, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Map$i32$i32", !14, i64 0, !15, i64 8, !14, i64 16, !14, i64 20, !15, i64 24, !15, i64 32, !15, i64 40, !14, i64 48}
!17 = !{!16, !14, i64 48}
!18 = !{!16, !15, i64 40}
!19 = !{!16, !15, i64 32}
```
<!-- cookbook:end map-iter -->

### Fused lookups: one probe for a key asked about twice

`counts.set(w, (counts.get(w) ?? 0) + 1)` asks the table about `w` twice, and
is one probe (docs/wp32-map.md §9.1). The `set` makes the probe first and keeps
its packed answer; the `get` inside the value reads that answer instead of
probing, so its value is `valueAt` on the found edge and its default runs on
the other, exactly as an unfused `get` would; and the write branches on the
same found bit, to `setValueAt` of the entry the probe found (`set.found`) or
`insertAt` the empty bucket it stopped at, passing the packed answer so the
hash is not computed again (`set.insert`). A guard is fused the same way: in
`firstTime`, `!seen.has(w)` is the probe, and the `add` first in its branch is
`insertAt` through it with no branch of its own, since the guard has already
decided the key is missing. Nothing between the probe and the write may call,
allocate or assign, so no bucket can move in between; a pattern that breaks
that rule is the separate calls, one probe each. The instance's `set`, `has`
and `add` are not called here, so they are not copied into the module.

<!-- cookbook:begin map-fused -->
```ts
export const count = (counts: Map<string, i32>, w: string): void => {
  counts.set(w, (counts.get(w) ?? 0) + 1)
}

export const firstTime = (seen: Set<string>, w: string): boolean => {
  if (!seen.has(w)) {
    seen.add(w)
    return true
  }
  return false
}
```

```llvm
%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$str = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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

define void @count(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %counts, i8* noundef nonnull noalias readonly align 8 %w) #0 {
entry:
  %0 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %counts, i8* %w)
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %nullish.value, label %nullish.default

nullish.value:
  %2 = trunc i64 %0 to i32
  %3 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %counts, i32 %2)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %4 = phi i32 [ %3, %nullish.value ], [ 0, %nullish.default ]
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  br i1 %1, label %set.found, label %set.insert

set.found:
  %8 = trunc i64 %0 to i32
  call void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* %counts, i32 %8, i32 %6)
  br label %set.end

set.insert:
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %counts, i64 %0, i8* %w, i32 %6)
  br label %set.end

set.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef zeroext i1 @firstTime(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) %seen, i8* noundef nonnull noalias readonly align 8 %w) #0 {
entry:
  %0 = call i64 @nish.Set$str.probe(%struct.Set$str* %seen, i8* %w)
  %1 = icmp sge i64 %0, 0
  %2 = xor i1 %1, true
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish.Set$str.insertAt(%struct.Set$str* %seen, i64 %0, i8* %w)
  ret i1 true

if.end:
  ret i1 false
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = or i32 %1, %3
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = trunc i64 %3 to i32
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %5 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void

if.end:
  %23 = load i32, i32* %bucket.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = and i32 %24, %mask
  store i32 %25, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %used
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %7 = load i32, i32* %n.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = sext i32 %9 to i64
  %12 = icmp ule i64 %11, 2147483647
  br i1 %12, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  ret %struct.nish_array* %14

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !18
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !19
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !20
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !21
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !22
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !22
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %15
}

define internal void @nish.Map$str$i32.setValueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !22
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !22
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !21
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !23
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !24
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !21
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !22
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %value, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !20
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !23
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !23
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !27
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !27
  %71 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !21
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !18
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !18
  %91 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !19
  %93 = load i32, i32* %bucket.addr, align 4
  %94 = load i32, i32* %h.addr, align 4
  %95 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !24
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !18
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !23
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !23
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !21
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !20
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !22
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !20
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !20
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !18
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !19
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !20
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.Set$str.probe(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !29
  %2 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !30
  %4 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !31
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !32
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal void @nish.Set$str.insertAt(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !32
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !33
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %16 = load i32, i32* %15, align 4, !tbaa !34
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !32
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !31
  %34 = load i32, i32* %h.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %34, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = trunc i64 %44 to i32
  %46 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %47 = load i32, i32* %46, align 4, !tbaa !33
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 1)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok

ovf.ok:
  %51 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 %49, i32* %51, align 4, !tbaa !33
  %52 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  %53 = load i32, i32* %52, align 4, !tbaa !35
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 1)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %57 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store i32 %55, i32* %57, align 4, !tbaa !35
  %58 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %59 = load %struct.nish_array*, %struct.nish_array** %58, align 8, !tbaa !32
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = trunc i64 %61 to i32
  store i32 %62, i32* %used.addr, align 4
  %63 = load i32, i32* %used.addr, align 4
  %64 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %63, i32 4)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %67 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !29
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %70 = load i64, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = trunc i64 %70 to i32
  %72 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %71, i32 3)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %75 = icmp sgt i32 %65, %73
  br i1 %75, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  br label %if.end.2

if.else:
  %76 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %77 = load %struct.nish_array*, %struct.nish_array** %76, align 8, !tbaa !29
  %78 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %79 = load i32, i32* %78, align 4, !tbaa !30
  %80 = load i32, i32* %bucket.addr, align 4
  %81 = load i32, i32* %h.addr, align 4
  %82 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %77, i32 %79, i32 %80, i32 %81, i32 %82)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.1 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Set$str.rebuild(%struct.Set$str* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !32
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 6
  %6 = load i32, i32* %5, align 4, !tbaa !34
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !29
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !33
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !33
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !32
  %26 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !31
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !31
  call void @nish.compactHashes(%struct.nish_array* %29)
  br label %if.end

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %31 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !29
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = sub nsw i32 %35, 1
  %37 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  store i32 %36, i32* %37, align 4, !tbaa !30
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !31
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40)
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = trunc i64 %20 to i32
  %35 = icmp slt i32 %33, %34
  br label %land.end

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ]
  br i1 %36, label %while.body, label %while.end

while.body:
  %37 = load i32, i32* %bucket.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %22 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %41, i32* %word.addr, align 4
  %42 = load i32, i32* %word.addr, align 4
  %43 = icmp eq i32 %42, 0
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load i32, i32* %bucket.addr, align 4
  %45 = load i32, i32* %h.addr, align 4
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45)
  ret i64 %46

if.end:
  %47 = load i32, i32* %word.addr, align 4
  %48 = lshr i32 %47, 24
  %49 = load i32, i32* %fingerprint.addr, align 4
  %50 = icmp eq i32 %48, %49
  br i1 %50, label %if.then.1, label %if.end.1

if.then.1:
  %51 = load i32, i32* %word.addr, align 4
  %52 = and i32 %51, 16777215
  %53 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %52, i32 1)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %54, i32* %at.addr, align 4
  %56 = load i32, i32* %at.addr, align 4
  %57 = icmp sge i32 %56, 0
  br i1 %57, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %58 = load i32, i32* %at.addr, align 4
  %59 = trunc i64 %24 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %ovf.ok ], [ %60, %land.rhs.4 ]
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %26 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %67 = load i32, i32* %h.addr, align 4
  %68 = icmp eq i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = trunc i64 %28 to i32
  %72 = icmp slt i32 %70, %71
  br label %land.end.2

land.end.2:
  %73 = phi i1 [ false, %land.end.3 ], [ %72, %land.rhs.2 ]
  br i1 %73, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %74 = load i32, i32* %at.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %30 to i8**
  %77 = getelementptr inbounds i8*, i8** %76, i64 %75
  %78 = load i8*, i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %79 = call zeroext i1 @nish_str_eq(i8* %78, i8* %key)
  br label %land.end.1

land.end.1:
  %80 = phi i1 [ false, %land.end.2 ], [ %79, %land.rhs.1 ]
  br i1 %80, label %if.then.2, label %if.end.2

if.then.2:
  %81 = load i32, i32* %bucket.addr, align 4
  %82 = load i32, i32* %at.addr, align 4
  %83 = tail call i64 @nish.foundAt(i32 %81, i32 %82)
  ret i64 %83

if.end.2:
  br label %if.end.1

if.end.1:
  %84 = load i32, i32* %bucket.addr, align 4
  %85 = add nsw i32 %84, 1
  %86 = and i32 %85, %mask
  store i32 %86, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38
  %41 = load i8*, i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !26
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Map$str$i32", !15, i64 0, !16, i64 8, !15, i64 16, !15, i64 20, !16, i64 24, !16, i64 32, !16, i64 40, !15, i64 48}
!18 = !{!17, !16, i64 8}
!19 = !{!17, !15, i64 16}
!20 = !{!17, !16, i64 40}
!21 = !{!17, !16, i64 24}
!22 = !{!17, !16, i64 32}
!23 = !{!17, !15, i64 20}
!24 = !{!17, !15, i64 48}
!25 = !{!"element ptr", !6, i64 0}
!26 = !{!25, !25, i64 0}
!27 = !{!17, !15, i64 0}
!28 = !{!"Set$str", !15, i64 0, !16, i64 8, !15, i64 16, !15, i64 20, !16, i64 24, !16, i64 32, !15, i64 40}
!29 = !{!28, !16, i64 8}
!30 = !{!28, !15, i64 16}
!31 = !{!28, !16, i64 32}
!32 = !{!28, !16, i64 24}
!33 = !{!28, !15, i64 20}
!34 = !{!28, !15, i64 40}
!35 = !{!28, !15, i64 0}
```
<!-- cookbook:end map-fused -->

### `nish/map`: `getOrInsert` and `reserve`

The two calls of `nish/map` (docs/wp32-map.md §9.2) are lowered where they are
called, and `std/map.ts`, whose bodies are what runs under Node, writes no
`.ll`: the module holds only the table's own pieces. `getOrInsert(ids, w, v)`
is one probe of `w`, then `valueAt` of the entry found (`get.found`) or
`insertAt` of `v` through the bucket the probe stopped at (`get.insert`), and
a `phi` of the two; `v`, here `ids.size`, is evaluated before the probe, as
an argument is. `reserve(ids, n)` is one call of the table's `reserveSlots`,
which doubles the bucket table until `n` entries fit under the load bound and
re-files it from the stored hashes, moving no entry.

<!-- cookbook:begin map-fused-extras -->
```ts
import { getOrInsert, reserve } from "nish/map"

export const idOf = (ids: Map<string, i32>, w: string): i32 => getOrInsert(ids, w, ids.size)

export const presize = (ids: Map<string, i32>, n: i32): void => {
  reserve(ids, n)
}
```

```llvm
%struct.Map$str$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #4
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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

define noundef i32 @idOf(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) %ids, i8* noundef nonnull noalias readonly align 8 %w) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %ids, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !5
  %2 = call i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* %ids, i8* %w)
  %3 = icmp sge i64 %2, 0
  br i1 %3, label %get.found, label %get.insert

get.found:
  %4 = trunc i64 %2 to i32
  %5 = call i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* %ids, i32 %4)
  br label %get.end

get.insert:
  call void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* %ids, i64 %2, i8* %w, i32 %1)
  br label %get.end

get.end:
  %6 = phi i32 [ %5, %get.found ], [ %1, %get.insert ]
  ret i32 %6
}

define void @presize(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %ids, i32 noundef %n) #0 {
entry:
  call void @nish.Map$str$i32.reserveSlots(%struct.Map$str$i32* %ids, i32 %n)
  ret void
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #0 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %index, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = or i32 %1, %3
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sext i32 -1 to i64
  %1 = sext i32 %bucket to i64
  %2 = shl i64 %1, 32
  %3 = zext i32 %h to i64
  %4 = or i64 %2, %3
  %5 = sub nsw i64 %0, %4
  ret i64 %5
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = trunc i64 %3 to i32
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %5 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  ret void

if.end:
  %23 = load i32, i32* %bucket.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = and i32 %24, %mask
  store i32 %25, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %live, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = icmp slt i32 %4, %used
  br i1 %6, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %7 = load i32, i32* %n.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 2)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = sext i32 %9 to i64
  %12 = icmp ule i64 %11, 2147483647
  br i1 %12, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %11, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %11, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %17 = mul i64 %11, 4
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !10, !noalias !9
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  ret %struct.nish_array* %14

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %6
  store i32 %10, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end

if.else:
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %used, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16)
  br label %if.end

if.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i64 @nish.Map$str$i32.probe(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !19
  %2 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !20
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !21
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !22
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef i32 @nish.Map$str$i32.valueAt(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !23
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !23
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  ret i32 %15
}

define internal void @nish.Map$str$i32.insertAt(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = load i64, i64* %packed.addr, align 8
  %2 = ashr i64 %1, 32
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %bucket.addr, align 4
  %4 = load i64, i64* %packed.addr, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %h.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !22
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %10 = trunc i64 %9 to i32
  %11 = icmp sge i32 %10, 16777215
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !24
  %14 = icmp sge i32 %13, 16777215
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %16 = load i32, i32* %15, align 4, !tbaa !25
  %17 = icmp sgt i32 %16, 0
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %if.then ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  store i32 -1, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !22
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %key, i8** %29, align 8, !alias.scope !10, !noalias !9, !tbaa !27
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %31 = trunc i64 %30 to i32
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !23
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %33, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %value, i32* %42, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !21
  %47 = load i32, i32* %h.addr, align 4
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  store i32 %47, i32* %56, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %60 = load i32, i32* %59, align 4, !tbaa !24
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 1)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  %64 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  store i32 %62, i32* %64, align 4, !tbaa !24
  %65 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  %66 = load i32, i32* %65, align 4, !tbaa !5
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 1)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %70 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i32 %68, i32* %70, align 4, !tbaa !5
  %71 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !22
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %used.addr, align 4
  %76 = load i32, i32* %used.addr, align 4
  %77 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %76, i32 4)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !19
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %84 = trunc i64 %83 to i32
  %85 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %84, i32 3)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %88 = icmp sgt i32 %78, %86
  br i1 %88, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* %this)
  br label %if.end.2

if.else:
  %89 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !19
  %91 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  %92 = load i32, i32* %91, align 4, !tbaa !20
  %93 = load i32, i32* %bucket.addr, align 4
  %94 = load i32, i32* %h.addr, align 4
  %95 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %90, i32 %92, i32 %93, i32 %94, i32 %95)
  br label %if.end.2

if.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.2 ], [ 0, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 2, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.Map$str$i32.rebuild(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !25
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !19
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !24
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !24
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !22
  %26 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !21
  call void @nish.compactEntries$str(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !23
  %30 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !21
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !21
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !19
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !20
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !21
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Map$str$i32.reserveSlots(%struct.Map$str$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i32 noundef %n) #0 {
entry:
  %want.addr = alloca i32, align 4
  %have.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = icmp sgt i32 %n, 0
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %2 = icmp sge i32 %n, 16777215
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ 16777215, %cond.true ], [ %n, %cond.false ]
  store i32 %3, i32* %want.addr, align 4
  %4 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !19
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %have.addr, align 4
  %9 = load i32, i32* %have.addr, align 4
  store i32 %9, i32* %size.addr, align 4
  br label %while.cond

while.cond:
  %10 = load i32, i32* %want.addr, align 4
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 4)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = load i32, i32* %size.addr, align 4
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %14, i32 3)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %18 = icmp sgt i32 %12, %16
  br i1 %18, label %while.body, label %while.end

while.body:
  %19 = load i32, i32* %size.addr, align 4
  %20 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %19, i32 2)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %21, i32* %size.addr, align 4
  br label %while.cond

while.end:
  %23 = load i32, i32* %size.addr, align 4
  %24 = load i32, i32* %have.addr, align 4
  %25 = icmp sgt i32 %23, %24
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  %26 = load i32, i32* %size.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = icmp ule i64 %27, 2147483647
  br i1 %28, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %29 = call i8* @nish_alloc_struct(i64 24)
  %30 = bitcast i8* %29 to %struct.nish_array*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  store i64 %27, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 1
  store i64 %27, i64* %32, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %33 = mul i64 %27, 4
  %34 = call i8* @nish_alloc_struct(i64 %33)
  call void @llvm.memset.p0i8.i64(i8* align 8 %34, i8 0, i64 %33, i1 false), !alias.scope !10, !noalias !9
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  store i8* %34, i8** %35, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  store %struct.nish_array* %30, %struct.nish_array** %slots.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store %struct.nish_array* %36, %struct.nish_array** %37, align 8, !tbaa !19
  %38 = load i32, i32* %size.addr, align 4
  %39 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %38, i32 1)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %42 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 2
  store i32 %40, i32* %42, align 4, !tbaa !20
  %43 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %44 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 6
  %45 = load %struct.nish_array*, %struct.nish_array** %44, align 8, !tbaa !21
  call void @nish.refile(%struct.nish_array* %43, %struct.nish_array* %45)
  br label %if.end.1

if.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %while.cond ], [ 2, %ovf.ok ], [ 2, %while.body ], [ 1, %len.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = trunc i64 %20 to i32
  %35 = icmp slt i32 %33, %34
  br label %land.end

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ]
  br i1 %36, label %while.body, label %while.end

while.body:
  %37 = load i32, i32* %bucket.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %22 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %41, i32* %word.addr, align 4
  %42 = load i32, i32* %word.addr, align 4
  %43 = icmp eq i32 %42, 0
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load i32, i32* %bucket.addr, align 4
  %45 = load i32, i32* %h.addr, align 4
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45)
  ret i64 %46

if.end:
  %47 = load i32, i32* %word.addr, align 4
  %48 = lshr i32 %47, 24
  %49 = load i32, i32* %fingerprint.addr, align 4
  %50 = icmp eq i32 %48, %49
  br i1 %50, label %if.then.1, label %if.end.1

if.then.1:
  %51 = load i32, i32* %word.addr, align 4
  %52 = and i32 %51, 16777215
  %53 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %52, i32 1)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %54, i32* %at.addr, align 4
  %56 = load i32, i32* %at.addr, align 4
  %57 = icmp sge i32 %56, 0
  br i1 %57, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %58 = load i32, i32* %at.addr, align 4
  %59 = trunc i64 %24 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %ovf.ok ], [ %60, %land.rhs.4 ]
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %26 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %67 = load i32, i32* %h.addr, align 4
  %68 = icmp eq i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = trunc i64 %28 to i32
  %72 = icmp slt i32 %70, %71
  br label %land.end.2

land.end.2:
  %73 = phi i1 [ false, %land.end.3 ], [ %72, %land.rhs.2 ]
  br i1 %73, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %74 = load i32, i32* %at.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %30 to i8**
  %77 = getelementptr inbounds i8*, i8** %76, i64 %75
  %78 = load i8*, i8** %77, align 8, !alias.scope !10, !noalias !9, !tbaa !27
  %79 = call zeroext i1 @nish_str_eq(i8* %78, i8* %key)
  br label %land.end.1

land.end.1:
  %80 = phi i1 [ false, %land.end.2 ], [ %79, %land.rhs.1 ]
  br i1 %80, label %if.then.2, label %if.end.2

if.then.2:
  %81 = load i32, i32* %bucket.addr, align 4
  %82 = load i32, i32* %at.addr, align 4
  %83 = tail call i64 @nish.foundAt(i32 %81, i32 %82)
  ret i64 %83

if.end.2:
  br label %if.end.1

if.end.1:
  %84 = load i32, i32* %bucket.addr, align 4
  %85 = add nsw i32 %84, 1
  %86 = and i32 %85, %mask
  store i32 %86, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38
  %41 = load i8*, i8** %40, align 8, !alias.scope !10, !noalias !9, !tbaa !27
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !10, !noalias !9, !tbaa !27
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !10, !noalias !9, !tbaa !27
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind willreturn }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Map$str$i32", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !2, i64 48}
!5 = !{!4, !2, i64 0}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{!4, !3, i64 8}
!20 = !{!4, !2, i64 16}
!21 = !{!4, !3, i64 40}
!22 = !{!4, !3, i64 24}
!23 = !{!4, !3, i64 32}
!24 = !{!4, !2, i64 20}
!25 = !{!4, !2, i64 48}
!26 = !{!"element ptr", !1, i64 0}
!27 = !{!26, !26, i64 0}
```
<!-- cookbook:end map-fused-extras -->

## Types

### `i64` and the explicit conversions

`i64` arithmetic overflows like `i32` — a checked panic by default unless
proven to fit ([Semantics decisions](LANGUAGE.md#semantics-decisions)),
wrapping through the `nish:unsafe` `wrapping*` calls (or the deprecated
`--wrapping`); `toI32` on an `i64` is a `trunc`, which wraps either way.

<!-- cookbook:begin types-i64 -->
```ts
const square = (x: i64): i64 => x * x

const low = (x: i64): number => toI32(x % 1000)
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #1

define internal noundef i64 @square(i64 noundef %x) #0 {
entry:
  %0 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %x, i64 %x)
  %1 = extractvalue { i64, i1 } %0, 0
  %2 = extractvalue { i64, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @low(i64 noundef %x) #1 {
entry:
  %0 = srem i64 %x, 1000
  %1 = trunc i64 %0 to i32
  ret i32 %1
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end types-i64 -->

### `boolean`

`boolean` is `i1`, `zeroext` at the ABI boundary; `!` is `xor i1 %x, true`;
`&&` short-circuits through its own block and a `phi`.

<!-- cookbook:begin types-bool -->
```ts
const xor = (a: boolean, b: boolean): boolean => a !== b

const neither = (a: boolean, b: boolean): boolean => !a && !b
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
<!-- cookbook:end types-bool -->

### Numeric literals and contextual typing

`3000000000` takes `i64` from the annotation, `2` takes `f64` from the other
operand, and every `f64` constant is IEEE-754 hex.

<!-- cookbook:begin expr-literals -->
```ts
const literals = (): f64 => {
  const big: i64 = 3000000000
  const ratio: f64 = 0.1
  const scaled = ratio * 2
  return scaled + toF64(big)
}
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
<!-- cookbook:end expr-literals -->

### Ranged integers: `integer<Lo, Hi>`

A ranged value is an `i32` in the IR, in memory and at the ABI, so `getByte`'s
parameter is a plain `i32 %i` and reading it costs nothing. What a range costs
is its *entry*: the value `firstByte` passes and the sum `brighten` returns are
each compared once, `sub` by the lower bound (left out when it is zero) and
`icmp ult` against the width of the range, the shape of the index check, with
the failure in a cold `rng.fail` block that ends the way `panic` does. A
literal inside the range, and a value of a range inside this one, enter with
no check at all. The index into `buf` is still checked: the range says `i` is
below 256, but nothing says `buf` has 256 elements.

<!-- cookbook:begin type-ranged -->
```ts
const getByte = (buf: u8[], i: integer<0, 255>): u8 => buf[i]

const brighten = (level: integer<-128, 127>): integer<-128, 127> => level + 1

const firstByte = (buf: u8[], n: i32): u8 => getByte(buf, n)
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [48 x i8] } { i64 47, [48 x i8] c"value out of range: expected integer<-128, 127>\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"value out of range: expected integer<0, 255>\00" }, align 8

declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_exit(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i8 @getByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8 %8
}

define internal noundef i32 @brighten(i32 noundef %level) #0 {
entry:
  %0 = add nsw i32 %level, 1
  %1 = sub i32 %0, -128
  %2 = icmp ult i32 %1, 256
  br i1 %2, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [48 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  ret i32 %0
}

define internal noundef i8 @firstByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %n) #0 {
entry:
  %0 = icmp ult i32 %n, 256
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %1 = call i8 @getByte(%struct.nish_array* %buf, i32 %n)
  ret i8 %1
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end type-ranged -->

A range is also a fact the bounds proof reads (WP31 §8). `lookup`'s index
needs `0 <= i < table.length`: the type gives `0 <= i < 256` and the length
guard gives `table.length >= 256`, so there is no `bounds.fail` block. In
`sumTable` the loop condition places `i` in `[0, 255]` where it enters the
parameter, so there is no `rng.fail` block either, and with no panic left
either function can reach, both are `willreturn`.

<!-- cookbook:begin type-ranged-proven -->
```ts
const lookup = (table: i32[], i: integer<0, 255>): i32 => {
  if (table.length < 256) {
    return 0
  }
  return table[i]
}

const sumTable = (table: i32[]): i32 => {
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum = sum + lookup(table, i)
  }
  return sum
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @lookup(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp slt i32 %2, 256
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %4 = sext i32 %i to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %4
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %9
}

define internal noundef i32 @sumTable(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table) #1 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 256
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %sum.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i32 @lookup(%struct.nish_array* %table, i32 %3)
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i32, i32* %sum.addr, align 4
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end type-ranged-proven -->

An exported function can be called by a host with any `int32_t`, so it checks
its ranged parameters itself (WP31 §9): the `rng.fail` block is in `pick`'s
prologue, before anything else it does, and `weekly` passes `n` with no check
of its own. A function `--strict-exports` makes `internal` keeps the check at
each call site instead, as `firstByte` does above, because there every caller
is in view. The prologue can end the process, so `pick` loses `willreturn`.

<!-- cookbook:begin type-ranged-export -->
```ts
export const pick = (base: i32, day: integer<1, 7>): i32 => base * 10 + day

export const weekly = (n: i32): i32 => pick(n, n)
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<1, 7>\00" }, align 8

declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_exit(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define noundef i32 @pick(i32 noundef %base, i32 noundef %day) #0 {
entry:
  %0 = sub i32 %day, 1
  %1 = icmp ult i32 %0, 7
  br i1 %1, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %base, i32 10)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %day)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %6

ovf.fail:
  %ovf.op = phi i32 [ 2, %rng.ok ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @weekly(i32 noundef %n) #0 {
entry:
  %0 = tail call i32 @pick(i32 %n, i32 %n)
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
```
<!-- cookbook:end type-ranged-export -->

## Declarations

### Locals

`let` and `const` get an `alloca` hoisted into `entry` (`%x.addr`); reads are
`load`s, writes are `store`s. `opt -mem2reg` (part of `-O1`) promotes them to
registers, so this costs nothing.

<!-- cookbook:begin decl-locals -->
```ts
const polynomial = (x: number, k: number): number => {
  let acc: number = x * x * 3
  acc = acc + k * 2
  const bias = 7
  return acc - bias
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @polynomial(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %acc.addr = alloca i32, align 4
  %bias.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %x)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 3)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %4, i32* %acc.addr, align 4
  %6 = load i32, i32* %acc.addr, align 4
  %7 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %k, i32 2)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %8)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %11, i32* %acc.addr, align 4
  store i32 7, i32* %bias.addr, align 4
  %13 = load i32, i32* %acc.addr, align 4
  %14 = load i32, i32* %bias.addr, align 4
  %15 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %13, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %16

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %ovf.ok ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 1, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl-locals -->

### Module constants

A top-level `const` is not a global: it emits no symbol and no initialiser.
The checker folds it, and every use site carries the value — `AREA` reaches
`nish_str_from_i32` as the literal `64`, and `ret i32 64` is the whole of
`return AREA`. The template literal around it is still built at run time:
folding stops at the constant, and `${...}` is not itself a constant
expression.

<!-- cookbook:begin decl-const -->
```ts
const WIDTH: i32 = 8
const AREA: i32 = WIDTH * WIDTH
const LABEL: string = "area = "

export const main = (): number => {
  console.log(`${LABEL}${AREA}`)
  return AREA
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"area = \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 64)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 64
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end decl-const -->

### Type aliases

A `type` alias is a second name for a type that already exists, so it emits
nothing: `Byte` is `u8`, `Bytes` is `u8[]`, `Label` is `string`, and the IR
below is the IR of the same program with the aliases written out. There is no
listing for "the alias", because there is nothing for it to be.

<!-- cookbook:begin decl-type-alias -->
```ts
type Byte = u8
type Bytes = Byte[]
type Label = string

const widen = (b: Byte): i32 => toI32(b)

export const main = (): number => {
  const data: Bytes = [toU8(2), toU8(3)]
  const label: Label = "sum = "
  console.log(`${label}${widen(data[0]) + widen(data[1])}`)
  return 0
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"sum = \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

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
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast [2 x i8]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 %0, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 %1, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %data.addr, align 8
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %label.addr, align 8
  %9 = load i8*, i8** %label.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 0
  %15 = load i8, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = call i32 @widen(i8 %15)
  %17 = load %struct.nish_array*, %struct.nish_array** %data.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 1
  %22 = load i8, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = call i32 @widen(i8 %22)
  %24 = add nsw i32 %16, %23
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %9, i8* %25)
  call void @nish_print(i8* %26)
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

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end decl-type-alias -->

**An imported alias lowers exactly as this one does.** `import { Conn } from
"./conn"` makes `Conn` a second spelling of the type `conn.ts` wrote on its
right-hand side, so a `Conn` parameter is that type's parameter and neither
module gains a symbol for the alias: `tests/link/alias_export_ir` and
`alias_export_ir_local` are one program with its types imported through
aliases and with them written out, and both modules' `.ll` goldens are
byte-identical files.

### `declare function`: calling C

A `declare function` is a C function this program **calls but does not define**
(WP27 S1). It lowers to an LLVM `declare` and a plain `call`, and the whole of
what is interesting is the attributes — specifically their absence.

The declaration carries none, because nothing about a body this compiler cannot
see is provable. What that costs is visible on the *callers*: `pureDouble` keeps
`willreturn readnone`, `main` calls C and keeps only `nounwind`. The impurity
travels the call graph like any other, so a function three hops above a foreign
call loses `readnone` too.

`nounwind` stays on the caller by decision rather than by proof: a C++ callee
could unwind, and a language with no `throw` and no landing pad can do nothing
with that admission, so unwinding out of a foreign call is undefined here — the
position clang already takes compiling C (`docs/wp27-ffi.md` §2).

The boundary is scalars only, and that is what makes it sound rather than merely
small: with no pointer among the arguments or the result, there is nothing for
escape analysis to be wrong about (`tests/cases/ffi_scalar`, and the four
`reject_ffi_*` cases).

The listing is also where the two senses of the word `function` sit side by
side. `declare function abs` is an *ambient* declaration and defines nothing, so
it is not a competing spelling for what `pureDouble` and `main` do and stays
exactly as it is written; the two definitions beside it are arrows bound to a
`const`, which is how Nish declares a function
([wp22-arrow-functions.md](wp22-arrow-functions.md) §1 and §9). An arrow
spelling for the ambient one would need a function type, and Phase 0 forbids
those.

<!-- cookbook:begin decl-ffi -->
```ts
declare function abs(n: i32): i32

const pureDouble = (n: i32): i32 => n * 2

export const main = (): i32 => abs(-7) + pureDouble(3)
```

```llvm
declare i32 @abs(i32)
declare void @nish_free_arena() #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @pureDouble(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %0 = call i32 @abs(i32 -7)
  %1 = call i32 @pureDouble(i32 3)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
```
<!-- cookbook:end decl-ffi -->

### `CPtr`: the pointer a C function hands back

`CPtr` is an address C owns (WP27 S2). It is `i8*` and eight bytes wide, and
that is the whole of what this compiler knows about it: not arena memory, not a
`%struct`, not a `nish_str`. So it gets none of the facts a pointer this
compiler laid out would — no `dereferenceable`, no `align`, no `nonnull` — and
it may not be dereferenced, indexed, or added to.

`null` arrives **only from a foreign call**: a `declare function` may *return*
`CPtr | null` and may not *take* one, so a pointer is narrowed with `!== null`
before it goes back to C. The narrowed `if.end` block below is what that rule
buys — `free` is reached with a value the program has proved is not null.

The arena is untouched by any of it, and that is the soundness argument rather
than a happy accident: no pointer this compiler allocated crosses the boundary
in either direction, so there is nothing for C to have captured when the scope
releases.

<!-- cookbook:begin decl-ffi-pointer -->
```ts
declare function calloc(count: u64, size: u64): CPtr | null
declare function free(block: CPtr): void

export const main = (): i32 => {
  const block = calloc(4, 16)
  if (block === null) {
    return 1
  }
  free(block)
  return 0
}
```

```llvm
declare i8* @calloc(i64, i64)
declare void @free(i8*)
declare void @nish_free_arena() #1

define noundef i32 @nish_main() #0 {
entry:
  %block.addr = alloca i8*, align 8
  %0 = call i8* @calloc(i64 4, i64 16)
  store i8* %0, i8** %block.addr, align 8
  %1 = load i8*, i8** %block.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %3 = load i8*, i8** %block.addr, align 8
  call void @free(i8* %3)
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
```
<!-- cookbook:end decl-ffi-pointer -->

### Numeric `enum`

An enum is a **distinct type with `i32` representation**, so the type system
keeps `Kind` apart from every other integer and the IR keeps nothing at all:
`Kind.While` is the constant `2`, a `Kind` parameter is an `i32` parameter, and
the `switch` is the jump table an integer discriminant has always produced.
There is no symbol, no table and no `%struct` for the enum, which is why the
same program written with `i32` module constants compiles to a byte-identical
module (`tests/cases/enum_ir` and `enum_expanded`).

<!-- cookbook:begin decl-enum -->
```ts
enum Kind {
  If = 1,
  While = 2,
  Return = 3,
}

const weight = (k: Kind): i32 => {
  switch (k) {
    case Kind.If:
      return 10
    case Kind.While:
      return 20
    default:
      return 30
  }
}

export const main = (): number => {
  const k: Kind = Kind.While
  console.log(`weight = ${weight(k)}`)
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"weight = \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @weight(i32 noundef %k) #0 {
entry:
  switch i32 %k, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  ret i32 10

sw.case.1:
  ret i32 20

sw.default:
  ret i32 30
}

define noundef i32 @nish_main() #1 {
entry:
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2, i32* %k.addr, align 4
  %0 = load i32, i32* %k.addr, align 4
  %1 = call i32 @weight(i32 %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i8* %2)
  call void @nish_print(i8* %3)
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
```
<!-- cookbook:end decl-enum -->

**An imported enum lowers exactly as this one does.** `import { Kind } from
"./kinds"` binds the exporter's enum, so a member folds to the exporter's
integer, a `Kind` parameter is an `i32` parameter, and neither module gains a
symbol for it: `tests/link/enum_export_ir` and `enum_export_ir_local` are one
program with the enum imported and with it declared in `main.ts`, and both
modules' `.ll` goldens are byte-identical files.

### `export const main` and the entry wrapper

The user's `main` becomes `@nish_main`; the compiler adds a C-ABI `@main` that
calls it, releases the arena, and returns the exit code.

<!-- cookbook:begin decl-main -->
```ts
export const main = (): number => {
  console.log("hello from Nish")
  return 0
}
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
<!-- cookbook:end decl-main -->

### A shebang line, and `nish run`

A `#!` line at the very start of a file is skipped by the lexer, so the IR is
the entry wrapper above and nothing else. The line is for the kernel: with it,
`chmod +x tool.ts && ./tool.ts a b` runs the program through `nish run`, which
compiles it and links it into a cache the first time. A later run of the same
program starts the cached binary.

<!-- cookbook:begin decl-shebang -->
```ts
#!/usr/bin/env -S nish run
export const main = (): number => {
  console.log("hello from a script")
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"hello from a script\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [20 x i8] }* @.str.0 to i8*))
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
<!-- cookbook:end decl-shebang -->

### Linkage: `export`, and `--no-strict-exports`

A function without `export` gets `internal` linkage, so LLVM may inline it,
specialise it for its call sites, or drop it; only an exported function is a
C-ABI symbol. This is the default, so the snippet below is compiled with no
flags at all.

<!-- cookbook:begin decl-strict-exports -->
```ts
export const double = (n: number): number => helper(n) * 2

const helper = (n: number): number => n + 1
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = call i32 @helper(i32 %n)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 2)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @helper(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl-strict-exports -->

`--no-strict-exports` puts every function back on the C ABI, which is what a
driver that calls a non-exported function needs. The same source:

<!-- cookbook:begin decl-no-strict-exports -->
Compiled with `--no-strict-exports`.

```ts
export const double = (n: number): number => helper(n) * 2

const helper = (n: number): number => n + 1
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = call i32 @helper(i32 %n)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 2)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @helper(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end decl-no-strict-exports -->

### Modules: the exporter

<!-- cookbook:begin mod-math -->
```ts
export const square = (n: number): number => n * n
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define noundef i32 @square(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 %n)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end mod-math -->

### Modules: the importer

The importer `declare`s `square` with exactly the attributes the exporter's
`define` carries; the attribute-group numbers are per module, the contents are
identical.

<!-- cookbook:begin mod-main -->
```ts
import { square } from "./mod-math"

export const main = (): number => square(7)
```

```llvm
declare noundef i32 @square(i32 noundef) #0
declare void @nish_free_arena() #1

define noundef i32 @nish_main() #0 {
entry:
  %0 = tail call i32 @square(i32 7)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end mod-main -->

### Modules: a package imported by name

`import { scale } from "cookbook-pkg"` resolves through `node_modules` and the
`nish` export condition, and what it resolves to is the package's **source**
(WP21 S2, [wp21-packages.md](wp21-packages.md) §2). The package is compiled into
this program like any other module, so the only thing the IR shows of it is the
prefix on its symbols: a dependency's functions are `<package>.<name>`, and the
root package — the program being compiled — keeps the bare names it always had.

<!-- cookbook:begin mod-package -->
```ts
import { scale } from "cookbook-pkg"

export const main = (): number => scale(7)
```

```llvm
declare noundef i32 @cookbook_pkg.scale(i32 noundef) #0
declare void @nish_free_arena() #1

define noundef i32 @nish_main() #0 {
entry:
  %0 = tail call i32 @cookbook_pkg.scale(i32 7)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end mod-package -->

## Statements

### `if` / `else`

Blocks are named `if.then`, `if.else`, `if.end` (`.N` suffixes when reused).
A branch that already ended in `ret` gets no `br`.

<!-- cookbook:begin stmt-if -->
```ts
const abs = (x: number): number => {
  if (x < 0) {
    return -x
  }
  return x
}

const pick = (flag: boolean, a: number, b: number): number => {
  let r = 0
  if (flag) {
    r = a
  } else {
    r = b
  }
  return r
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1

define internal noundef i32 @abs(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %x)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  ret i32 %x

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

define internal noundef i32 @pick(i1 noundef zeroext %flag, i32 noundef %a, i32 noundef %b) #1 {
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end stmt-if -->

### `while`

Loop-carried variables stay in allocas (no `phi`); `mem2reg` rebuilds the SSA
form. A loop that is not a counted `for` drops `willreturn`.

<!-- cookbook:begin stmt-while -->
```ts
const countDigits = (n: number): number => {
  let digits = 0
  let rest = n
  while (rest > 0) {
    rest = rest / 10
    digits = digits + 1
  }
  return digits
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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
  %3 = sdiv i32 %2, 10
  store i32 %3, i32* %rest.addr, align 4
  %4 = load i32, i32* %digits.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %digits.addr, align 4
  br label %while.cond

while.end:
  %8 = load i32, i32* %digits.addr, align 4
  ret i32 %8

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt-while -->

### `do ... while`

<!-- cookbook:begin stmt-do -->
```ts
const sumDigits = (n: number): number => {
  let sum = 0
  let rest = n
  do {
    sum += rest % 10
    rest = rest / 10
  } while (rest > 0)
  return sum
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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
  %2 = srem i32 %1, 10
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %sum.addr, align 4
  %6 = load i32, i32* %rest.addr, align 4
  %7 = sdiv i32 %6, 10
  store i32 %7, i32* %rest.addr, align 4
  br label %do.cond

do.cond:
  %8 = load i32, i32* %rest.addr, align 4
  %9 = icmp sgt i32 %8, 0
  br i1 %9, label %do.body, label %do.end

do.end:
  %10 = load i32, i32* %sum.addr, align 4
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt-do -->

### `for`

A counted loop (`i < n; i++` with `i` and `n` untouched in the body) keeps
`willreturn`. `continue` jumps to `for.inc`.

<!-- cookbook:begin stmt-for -->
```ts
const sumTo = (n: number): number => {
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += i
  }
  return sum
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i32, i32* %sum.addr, align 4
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt-for -->

### `switch`

One `switch` instruction: a constant-to-label table and a default edge, which
the backend turns into a jump table once the labels are dense enough. Empty
clauses have no block of their own — `case 1:` points at the body of `case 2:`,
which is the whole of Nish's fallthrough. A label that names a module
constant is folded before the table is written, so `KIND_CALL` is a `4` here.

<!-- cookbook:begin stmt-switch -->
```ts
const KIND_CALL: i32 = 4

const classify = (kind: number): number => {
  switch (kind) {
    case 0:
      return 10
    case 1:
    case 2:
      return 20
    case KIND_CALL:
      return 30
    default:
      return 40
  }
}
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
<!-- cookbook:end stmt-switch -->

### `break` / `continue`

`break` is `br label %for.end`; `continue` is `br label %for.inc`. Both end
the block they are in, so `if.then` gets no second branch. The `break` here
also disqualifies nothing: the loop is still counted, so `willreturn` stays.

<!-- cookbook:begin stmt-break-continue -->
```ts
const sumOdd = (n: number): number => {
  let s = 0
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      continue
    }
    if (s > 1000) {
      break
    }
    s += i
  }
  return s
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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
  %3 = srem i32 %2, 2
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  br label %for.inc

if.end:
  %5 = load i32, i32* %s.addr, align 4
  %6 = icmp sgt i32 %5, 1000
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.end

if.end.1:
  %7 = load i32, i32* %s.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %14 = load i32, i32* %s.addr, align 4
  ret i32 %14

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt-break-continue -->

### `Result<T, E>`

The whole of WP16 in one listing. `Ok` / `Err` bump a monomorphised
`%struct.nish_result.i32.str` out of the arena and store the discriminant and
one payload; `orReturn()` loads the discriminant, branches, and on the error
arm builds this function's own `Err` and returns it, so the rest of the body
continues in `res.ok`; `isErr()` is that same load, and the payload reads are
`getelementptr` + `load` in the block the branch guards. Nothing here unwinds:
every function is still `nounwind`.

<!-- cookbook:begin stmt-result -->
```ts
const half = (n: number): Result<number, string> => {
  if (n % 2 !== 0) {
    return Err("odd")
  }
  return Ok(n / 2)
}

const quarter = (n: number): Result<number, string> => {
  const h = half(n).orReturn()
  return half(h)
}

const describe = (n: number): string => {
  const outcome = quarter(n)
  if (outcome.isErr()) {
    return outcome.error
  }
  return `${outcome.value}`
}
```

```llvm
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

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

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @half(i32 noundef %n) #0 {
entry:
  %0 = srem i32 %n, 2
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.nish_result.i32.str*
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %3, i32 0, i32 0
  store i1 false, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %3, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %5, align 8
  ret %struct.nish_result.i32.str* %3

if.end:
  %6 = sdiv i32 %n, 2
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str*
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  store i1 true, i1* %9, align 1
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 1
  store i32 %6, i32* %10, align 4
  ret %struct.nish_result.i32.str* %8
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
  %12 = tail call %struct.nish_result.i32.str* @half(i32 %11)
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

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end stmt-result -->

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

<!-- cookbook:begin stmt-result-by-value -->
```ts
const half = (n: number): Result<number, number> => {
  if (n % 2 !== 0) {
    return Err(n)
  }
  return Ok(n / 2)
}

const quarter = (n: number): Result<number, number> => {
  const h = half(n).orReturn()
  return half(h)
}

const describe = (n: number): number => {
  const outcome = quarter(n)
  if (outcome.isErr()) {
    return -outcome.error
  }
  return outcome.value
}
```

```llvm
%struct.nish_result.i32.i32 = type { i1, i32, i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

define internal { i1, i32, i32 } @half(i32 noundef %n) #0 {
entry:
  %0 = srem i32 %n, 2
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %n, 2
  ret { i1, i32, i32 } %2

if.end:
  %3 = sdiv i32 %n, 2
  %4 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %3, 1
  ret { i1, i32, i32 } %4
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

define internal noundef i32 @describe(i32 noundef %n) #1 {
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
  %14 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %15

if.end:
  %17 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %outcome.addr, align 8
  %18 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
```
<!-- cookbook:end stmt-result-by-value -->

### `process.exit(code)`

A `noreturn` call plus `unreachable`; it is a terminator, so `finish` needs
no `return`. Every function that can reach it loses `willreturn`.

<!-- cookbook:begin stmt-process-exit -->
```ts
const finish = (code: number): number => {
  console.log("exiting")
  process.exit(code)
}
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
<!-- cookbook:end stmt-process-exit -->

### `for (const x of a)`

An index loop over the header's `len`, re-read every iteration; no bounds
check is needed because the loop condition is the check.

<!-- cookbook:begin stmt-for-of -->
```ts
const total = (xs: number[]): number => {
  let sum = 0
  for (const x of xs) {
    sum += x
  }
  return sum
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %sum.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %sum.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end stmt-for-of -->

## Expressions

### Ternary

<!-- cookbook:begin expr-ternary -->
```ts
const max = (a: number, b: number): number => (a > b ? a : b)
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
<!-- cookbook:end expr-ternary -->

### Short-circuit `&&` / `||`

The right operand lives in its own block (`land.rhs`, `lor.rhs`), so
`zeroOrSmallQuotient(0)` never divides by zero.

<!-- cookbook:begin expr-logical -->
```ts
const inRange = (x: number, lo: number, hi: number): boolean => x >= lo && x < hi

const zeroOrSmallQuotient = (x: number): boolean => x === 0 || 100 / x < 50
```

```llvm
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

define internal noundef zeroext i1 @zeroOrSmallQuotient(i32 noundef %x) #0 {
entry:
  %0 = icmp eq i32 %x, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = sdiv i32 100, %x
  %2 = icmp slt i32 %1, 50
  br label %lor.end

lor.end:
  %3 = phi i1 [ true, %entry ], [ %2, %lor.rhs ]
  ret i1 %3
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr-logical -->

### Compound assignment, `++` / `--`

Load, apply, store; postfix yields the old value, prefix the new one.

<!-- cookbook:begin expr-compound -->
```ts
const step = (): number => {
  let x = 10
  x += 5
  x *= 2
  const a = x++
  const b = --x
  return a + b
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

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
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %2, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %x.addr, align 4
  %6 = load i32, i32* %x.addr, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %8, i32* %x.addr, align 4
  store i32 %6, i32* %a.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %10, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %12, i32* %x.addr, align 4
  store i32 %12, i32* %b.addr, align 4
  %14 = load i32, i32* %a.addr, align 4
  %15 = load i32, i32* %b.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %17

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ], [ 1, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr-compound -->

### Bitwise `& | ^` and `~`

One instruction each, and no panic path: unlike `/` these leave the function
`readnone` and `willreturn`. `~a` is `xor a, -1`, because LLVM has no `not`.

<!-- cookbook:begin expr-bitwise -->
```ts
const mix = (a: i32, b: i32): i32 => (a & b) | (a ^ b)

const invert = (a: i32): i32 => ~a

const pack = (hi: i32, lo: i32): i32 => (hi << 16) | (lo & 65535)
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
<!-- cookbook:end expr-bitwise -->

### A field or an element as the compound target

`f.bits |= mask` and `bytes[i] &= 255` are the same load-apply-store as
`x |= mask` on a local, with the target's address computed once and shared by
the load and the store: one `getelementptr` for the field, and for the element
one bounds check followed by one `getelementptr`. The target expression is
therefore evaluated exactly once, so `bytes[next()] &= 255` calls `next()` a
single time. The shift-count mask is the local's, too — `f.bits <<= n` masks
`n` to 31 before the `shl`.

<!-- cookbook:begin expr-compound-target -->
```ts
class Flags {
  bits: i32 = 0
}

const set = (f: Flags, mask: i32): void => {
  f.bits |= mask
}

const clamp = (bytes: i32[], i: i32): void => {
  bytes[i] &= 255
}

const shiftField = (f: Flags, n: i32): void => {
  f.bits <<= n
}
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
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = and i32 %8, 255
  store i32 %9, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
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
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end expr-compound-target -->

### Shifts, and the count mask

`<<` is `shl`, `>>` is `ashr` (sign-filling) and `>>>` is `lshr`
(zero-filling). The count is masked to the operand width — 31 for `i32`, 63
for `i64` — because LLVM makes a wider shift poison while JavaScript wraps the
count; Nish follows JavaScript. A constant count is masked at compile time
and no `and` appears (`a >> 3` below); a variable one costs the `and`.

<!-- cookbook:begin expr-shifts -->
```ts
const constantCount = (a: i32): i32 => a >> 3

const variableCount = (a: i32, n: i32): i32 => a << n

const fills = (a: i32, n: i32): i32 => (a >> n) + (a >>> n)

const wide = (a: i64, n: i64): i64 => a << n
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

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

define internal noundef i32 @fills(i32 noundef %a, i32 noundef %n) #1 {
entry:
  %0 = and i32 %n, 31
  %1 = ashr i32 %a, %0
  %2 = and i32 %n, 31
  %3 = lshr i32 %a, %2
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i64 @wide(i64 noundef %a, i64 noundef %n) #0 {
entry:
  %0 = and i64 %n, 63
  %1 = shl i64 %a, %0
  ret i64 %1
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end expr-shifts -->

### Checked integer division

`/` and `%` on `i32` / `i64` test the divisor before dividing: a zero
divisor or `MIN / -1` branches to the cold `div.fail` block, which calls the
`noreturn` `nish_panic_div` (`attempt to divide by zero` when its `i1`
argument is true, `attempt to divide with overflow` otherwise) and exits 1;
`div.ok` holds the plain `sdiv`. Because the panic path exists the function
is neither `willreturn` nor `readnone`. A divisor the bounds walk proves to
be neither 0 nor -1 — a constant, a declared range that leaves both out, or a
guard such as `if (d !== 0 && d !== -1)` — gets the bare `sdiv` and no
`div.fail` at all ([A module with no panic site](#a-module-with-no-panic-site---deny-panics)).
`f64` division is a bare `fdiv`.

<!-- cookbook:begin expr-div-checked -->
```ts
const div = (a: number, b: number): number => a / b
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
<!-- cookbook:end expr-div-checked -->

### Checked signed arithmetic

`+`, `-`, `*`, unary `-` and the steps on `i32` / `i64` are checked the way
division is: `llvm.s{add,sub,mul}.with.overflow` computes the result and a
flag, and the flag branches to the function's one `ovf.fail` block, which
calls the `noreturn` `nish_panic_overflow` with the operator (0 add,
1 subtract, 2 multiply, 3 negate; a `phi` picks it when a function has more
than one kind) and exits 1 with `attempt to multiply with overflow`. One
block per function, however many checks branch to it, so a small function
stays small enough to inline; under `-g` it is one block per source location
instead, so that each call carries the `!dbg` of the check that failed. The panic is declared `extern_weak`, so a
freestanding wasm module that links no runtime still traps on overflow
rather than failing to link. Under `--wrapping` both are plain `mul` and
`add`.

<!-- cookbook:begin expr-overflow-checked -->
```ts
const area = (w: number, h: number): number => w * h + 1
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @area(i32 noundef %w, i32 noundef %h) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %w, i32 %h)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end expr-overflow-checked -->

### A proven step: `add nsw`

Where `src/bounds.ts` proves the result fits, the instruction is the plain
one with `nsw`, and the flag is a fact rather than an assumption. `i < xs.length`
puts `i` below `INT_MAX`, so `i++` cannot overflow and is `add nsw` — which is
also what lets LLVM widen the loop's induction variable. The running sum `s`
has no bound and keeps its check.

<!-- cookbook:begin expr-overflow-proven -->
```ts
const total = (xs: number[]): number => {
  let s = 0
  for (let i = 0; i < xs.length; i++) {
    s = s + i
  }
  return s
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = trunc i64 %1 to i32
  %4 = icmp slt i32 %2, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %s.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %8, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %10 = load i32, i32* %i.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %12 = load i32, i32* %s.addr, align 4
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
```
<!-- cookbook:end expr-overflow-proven -->

### A module with no panic site: `--deny-panics`

Under `--deny-panics`, or for a module the root `package.json` lists in
`"nish".noPanic`, every check that could still panic is a compile error
(docs/LANGUAGE.md, "The no-panic scope"), so a module that compiles has none
left in its IR: no `nish_panic_*` call, no `div.fail` or `pop.empty` block, no
panic tail. Each check came off because a proof removed it, not because a flag
did. `ratio`'s divisor is guarded against 0 and -1, so the `sdiv` stands alone;
`half` divides by constants, which need no guard; `last` pops behind
`xs.length > 0`, the length fact the bounds proof already keeps, so the length
is decremented with no `pop.empty` branch. The listing is the golden
`tests/cases/deny_panics_clean.ll`, which `npm test` holds this section to.

An `uncheckedGet` or `uncheckedSet` from `nish:unsafe` is allowed in the scope:
it lowers to the bare GEP and load or store, so it has no panic path to
refuse, and its import is the module's opt-in to an index out of range being
undefined behaviour. `--emit-panics` lists it as an `unchecked` site with
`"allowed": true` (`tests/cases/deny_panics_unsafe`).

<!-- golden:begin deny_panics_clean -->
```ts
const ratio = (a: i32, d: i32): i32 => {
  if (d !== 0 && d !== -1) {
    return a / d;
  }
  return 0;
};

const half = (a: i32): i32 => a / 2 + a % 10;

const last = (xs: i32[]): i32 => {
  if (xs.length > 0) {
    return xs.pop();
  }
  return 0;
};

const last = (xs: i32[]): i32 => {
  if (xs.length > 0) {
    return xs.pop();
  }
  return 0;
};
```

```llvm
define internal noundef i32 @ratio(i32 noundef %a, i32 noundef %d) #1 {
entry:
  %0 = icmp ne i32 %d, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp ne i32 %d, -1
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = sdiv i32 %a, %d
  ret i32 %3

if.end:
  ret i32 0
}

define internal noundef i32 @half(i32 noundef %a) #1 {
entry:
  %0 = sdiv i32 %a, 2
  %1 = srem i32 %a, 10
  %2 = add nsw i32 %0, %1
  ret i32 %2
}

define internal noundef i32 @last(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = sub i64 %5, 1
  store i64 %6, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %11

if.end:
  ret i32 0
}
```
<!-- golden:end deny_panics_clean -->

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

<!-- cookbook:begin expr-unsigned -->
```ts
const divide = (a: u32, b: u32): u32 => a / b

const below = (a: u32, b: u32): boolean => a < b

const halve = (a: u32): u32 => a >> 1

const widen = (a: u32): u64 => toU64(a)

const reinterpret = (a: i32): u32 => toU32(a)
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
<!-- cookbook:end expr-unsigned -->

### `f32`

`f32` is LLVM's `float`: the same instructions as `f64`, one width down.
`fptrunc` narrows from a double and `fpext` widens back, and a float-to-integer
conversion uses the saturating intrinsic with an `.f32` source suffix.

The constant is the part worth reading closely. LLVM writes a `float` constant
with the **64-bit** hex of the double it equals, and requires that double to be
exactly representable as a float — so `0.1` as an `f32` is
`0x3FB99999A0000000`, the double nearest to `(float) 0.1`, and not the `f64`
spelling `0x3FB999999999999A`.

<!-- cookbook:begin expr-f32 -->
```ts
const blend = (a: f32, b: f32): f32 => (a + b) / b

const narrow = (x: f64): f32 => toF32(x)

const widen = (x: f32): f64 => toF64(x)

const truncate = (x: f32): i32 => toI32(x)

const tenth = (): f32 => 0.1
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
<!-- cookbook:end expr-f32 -->

## Strings

### Literals

A literal is `{ i64 len, [len+1 x i8] }` constant data referenced through a
constant `bitcast`; identical literals share one constant; no allocation, so
the functions stay `readnone`.

<!-- cookbook:begin str-literal -->
```ts
const greeting = (): string => "hello, world"

const same = (): string => "hello, world"
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
<!-- cookbook:end str-literal -->

### `+`, `===`, `.length`

`+` calls `nish_str_concat` (allocates: effect `write`), `===` calls
`nish_str_eq` (reads: caller becomes `readonly`), `.length` is a direct
`load i64` of the header (no call).

<!-- cookbook:begin str-ops -->
```ts
const join = (a: string, b: string): string => a + b

const same = (a: string, b: string): boolean => a === b

const len = (s: string): number => s.length
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn memory(argmem: read) }
```
<!-- cookbook:end str-ops -->

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

<!-- cookbook:begin str-bytes -->
```ts
const firstByte = (s: string): number => s.charCodeAt(0)

const head = (s: string, n: number): string => s.substring(0, n)

const has = (s: string, sub: string): boolean => s.startsWith(sub) || s.endsWith(sub)
```

```llvm
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare i64 @llvm.smin.i64(i64, i64) #5
declare i64 @llvm.smax.i64(i64, i64) #5

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
  %2 = sext i32 %n to i64
  %3 = call i64 @llvm.smin.i64(i64 %2, i64 %1)
  %4 = call i64 @llvm.smax.i64(i64 %3, i64 0)
  %5 = call i64 @llvm.smin.i64(i64 0, i64 %4)
  %6 = call i64 @llvm.smax.i64(i64 0, i64 %4)
  %7 = sub i64 %6, %5
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %5
  %10 = call i8* @nish_str_new(i8* %9, i64 %7)
  ret i8* %10
}

define internal noundef zeroext i1 @has(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub) #2 {
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
```
<!-- cookbook:end str-bytes -->

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

<!-- cookbook:begin str-slice -->
```ts
const head = (s: string, n: number): string => s.slice(0, n)

const rest = (s: string, n: number): string => s.slice(n)

const proven = (): string => "hello,world".slice(0, 5)
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
<!-- cookbook:end str-slice -->

### Searching from an offset

`s.indexOf(sub, from)` is one call to `nish_str_index_of_from` and allocates
nothing, so a scanner can find every match without cutting the string up:
`count` below walks each occurrence by starting the next search past the last
one. The start is clamped into `[0, len]` before the call, with the same
`llvm.smin` / `llvm.smax` pair as `substring`'s bound (an unsigned start takes
`llvm.umin` alone), and the runtime runs the search `s.indexOf(sub)` runs —
`memchr` for a candidate first byte, `memcmp` to confirm it — from there; the
one-argument form is that function from `0`. A literal `0` is in range for
every string, so `count`'s first search is the call with no clamp at all.

<!-- cookbook:begin str-index-of-from -->
```ts
const next = (s: string, sub: string, from: number): number => s.indexOf(sub, from)

const count = (s: string, sub: string): number => {
  let n = 0
  let at = s.indexOf(sub, 0)
  while (at >= 0) {
    n = n + 1
    at = s.indexOf(sub, at + sub.length)
  }
  return n
}
```

```llvm
declare i64 @nish_str_index_of_from(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noundef i32 @next(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub, i32 noundef %from) #0 {
entry:
  %0 = sext i32 %from to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = call i64 @llvm.smin.i64(i64 %0, i64 %2)
  %4 = call i64 @llvm.smax.i64(i64 %3, i64 0)
  %5 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 %4)
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

define internal noundef i32 @count(i8* noundef nonnull noalias readonly align 8 nocapture %s, i8* noundef nonnull noalias readonly align 8 nocapture %sub) #1 {
entry:
  %n.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  %0 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 0)
  %1 = trunc i64 %0 to i32
  store i32 %1, i32* %at.addr, align 4
  br label %while.cond

while.cond:
  %2 = load i32, i32* %at.addr, align 4
  %3 = icmp sge i32 %2, 0
  br i1 %3, label %while.body, label %while.end

while.body:
  %4 = load i32, i32* %n.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %n.addr, align 4
  %8 = load i32, i32* %at.addr, align 4
  %9 = bitcast i8* %sub to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %15 = sext i32 %13 to i64
  %16 = bitcast i8* %s to i64*
  %17 = load i64, i64* %16, align 8
  %18 = call i64 @llvm.smin.i64(i64 %15, i64 %17)
  %19 = call i64 @llvm.smax.i64(i64 %18, i64 0)
  %20 = call i64 @nish_str_index_of_from(i8* %s, i8* %sub, i64 %19)
  %21 = trunc i64 %20 to i32
  store i32 %21, i32* %at.addr, align 4
  br label %while.cond

while.end:
  %22 = load i32, i32* %n.addr, align 4
  ret i32 %22

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
```
<!-- cookbook:end str-index-of-from -->

### Template literals

Constant parts are interned, holes are converted (`nish_str_from_i32`, a
`select` for booleans, identity for strings), and everything is chained
through `nish_str_concat`.

<!-- cookbook:begin str-template -->
```ts
const describe = (n: number, ok: boolean, name: string): string => `${name}: n=${n}, ok=${ok}`
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c": n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c", ok=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end str-template -->

### `console.log`

<!-- cookbook:begin str-console-log -->
```ts
const report = (): void => {
  console.log("text")
  console.log(7)
  console.log(false)
}
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
<!-- cookbook:end str-console-log -->

## Arrays

### `a[i]` read and write, with the bounds check

Unsigned compare against `len`; the failing branch calls the `noreturn cold`
`nish_panic_index`. `a` is `readonly` in `get` (never stored through) and only
`nocapture` in `set`.

<!-- cookbook:begin arr-index -->
```ts
const get = (a: number[], i: number): number => a[i]

const set = (a: number[], i: number, v: number): void => {
  a[i] = v
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #1

define internal noundef i32 @get(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %8
}

define internal void @set(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %a, i32 noundef %i, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  store i32 %v, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end arr-index -->

The check is left out wherever the checker has proved the index in range
([Element access](LANGUAGE.md#element-access)), a guard ending in the builtin
`panic(…)` or `process.exit(…)` included: after
`if (i < 0 || i >= a.length) { panic("…") }`, `a[i]` is the `getelementptr`
and the load alone, with no `bounds.fail` block
(`tests/cases/bounds_panic_guard`, `bounds_exit_guard`; `bounds_guard_not_exit`
and the shadowed `bounds_guard_shadowed_exit` and `bounds_guard_shadowed_panic`
keep it).

### A byte element: the same lowering at width 1

`u8[]` is the array lowering with `sizeof(T)` equal to 1, and that is the whole
of it: the `getelementptr` strides by one byte, the `load` and `store` are `i8`
at `align 1`, and the bounds check is the one every other width gets. There is
no packing and no shifting, because a byte is already the unit `data` is a
block of.

Two things follow that matter outside the IR. A host can hand this array over
without marshalling — the bytes in `data` *are* the bytes a `Uint8Array` holds,
which is what lets `u8[]` cross the interop boundary as a view rather than a
copy per element ([wp30-bytes-interop.md](wp30-bytes-interop.md)). And the
parameter is a bare `i8` with no `zeroext`, so a narrow value's range is the
caller's obligation at a *scalar* boundary; at this one there is nothing to
restore, because the element never travels in a value type at all.

<!-- cookbook:begin arr-u8-elements -->
```ts
const get = (bytes: u8[], i: number): u8 => bytes[i]

const set = (bytes: u8[], i: number, v: u8): void => {
  bytes[i] = v
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #1

define internal noundef i8 @get(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8 %8
}

define internal void @set(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes, i32 noundef %i, i8 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  store i8 %v, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end arr-u8-elements -->

### A proven index: the check the checker removed

The same lowering with no compare, no branch and no panic block, and with the
safety unchanged — the checker proved the index in range rather than being told
to trust it (WP15 §2.1/§2.2, `src/bounds.ts`). The loop condition
proves `i`; the length guard proves the constant `0`. Neither function names
`nish_panic_index`, so both keep `willreturn`.

<!-- cookbook:begin arr-bounds-proven -->
```ts
const sum = (a: number[]): number => {
  let total = 0
  for (let i = 0; i < a.length; i = i + 1) {
    total = total + a[i]
  }
  return total
}

const first = (a: number[]): number => {
  if (a.length > 0) {
    return a[0]
  }
  return 0
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %total.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %18 = load i32, i32* %total.addr, align 4
  ret i32 %18

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @first(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %8

if.end:
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end arr-bounds-proven -->

### A proven index through a field: a property-path fact

The same proof with the array held in a class field (#106). `i < h.xs.length`
is a fact about the *path* `h.xs`, and `h.xs[i]` is judged against it the way
`xs[i]` is against `xs.length`, so the loop has no compare, no branch and no
panic block — and the header hoist (#104) reads `h.xs`, `len` and `data` once,
in `entry`. The loop is the one `const xs = h.xs` compiles to. A path fact ends
at any call, at any store to a field the path names (through any holder), at a
whole-record element store and at an assignment to the root, which is why this
loop has none of them.

<!-- cookbook:begin arr-bounds-path -->
```ts
class Holder {
  xs: i32[]
  constructor(xs: i32[]) {
    this.xs = xs
  }
}

const total = (h: Holder): i32 => {
  let s = 0
  let i = 0
  while (i < h.xs.length) {
    s = s + h.xs[i]
    i = i + 1
  }
  return s
}
```

```llvm
%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @total(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %3 to i32
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %while.body, label %while.end

while.body:
  %9 = load i32, i32* %s.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %5 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %s.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %20 = load i32, i32* %s.addr, align 4
  ret i32 %20

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 16}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
```
<!-- cookbook:end arr-bounds-path -->

### A passed check proves the repeat

A bounds check either panics or leaves `0 <= i < v.length` behind, because
`nish_panic_index` never returns, so the checker records that fact on the path
past the check and a second access with the same index on the same holder
carries no check. `swap` has four accesses and two checks: the emitter checks
`this.v[j]` (the value) before `this.v[i]` (the store), so the store is proven
by the `tmp` read above it, and `this.v[j] = tmp` by the read of `this.v[j]`.
The fact ends where a guard's would — at a call, a `push` or `pop`, a store to
a field the path names, or a reassignment of the index or the root — and a
store whose value calls anything teaches a path nothing, because its check
passed on the array the path named before the call.

<!-- cookbook:begin arr-repeat-check -->
```ts
// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.

class Perm {
  v: i32[]
  constructor(n: i32) {
    this.v = new Array<i32>(n)
  }

  swap(i: i32, j: i32): void {
    const tmp = this.v[i]
    this.v[i] = this.v[j]
    this.v[j] = tmp
  }
}
```

```llvm
%struct.Perm = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal void @Perm.constructor(%struct.Perm* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  store %struct.nish_array* %3, %struct.nish_array** %9, align 8, !tbaa !15
  ret void
}

define internal void @Perm.swap(%struct.Perm* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i, i32 noundef %j) #0 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %10, i32* %tmp.addr, align 4
  %11 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !15
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !15
  %16 = sext i32 %j to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %13
  store i32 %24, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %29 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !15
  %31 = sext i32 %j to i64
  %32 = load i32, i32* %tmp.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %31
  store i32 %32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Perm", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"element i32", !6, i64 0}
!17 = !{!16, !16, i64 0}
```
<!-- cookbook:end arr-repeat-check -->

### A hoisted `toI32(s.length)`: the proof in both number modes

Under `--number-mode f64` a `.length` is an `f64`, so the hoist a loop can
compare an `i32` cursor against is `const n: i32 = toI32(s.length)`. The
checker reads the builtin `toI32` of a length as that length (WP15 §2,
`src/bounds.ts` `lengthOfLocal`): the `sitofp` of the header and the
saturating `llvm.fptosi.sat.i32.f64` answer the length, or less for a string
past `2^31 - 1` bytes, and never a negative. So `i < n` proves
`s.charCodeAt(i)` as it does in i32 mode, and the read is a plain load with
no compare and no `nish_panic_index`. In i32 mode the same source hoists the
header's `trunc` alone. A user function named `toI32` is not the builtin and
proves nothing. Pinned by `tests/cases/perf_bounds_toi32` and
`perf_bounds_toi32_f64`, with `perf_bounds_toi32_loop` and
`perf_bounds_toi32_user` as the shapes that keep their check.

<!-- cookbook:begin str-bounds-toi32 -->
Compiled with `--number-mode f64`.

```ts
const countCode = (s: string, code: i32): i32 => {
  const n: i32 = toI32(s.length)
  let count: i32 = 0
  let i: i32 = 0
  while (i < n) {
    if (toI32(s.charCodeAt(i)) === code) {
      count += 1
    }
    i += 1
  }
  return count
}
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare i32 @llvm.fptosi.sat.i32.f64(double) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @countCode(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %code) #0 {
entry:
  %n.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = load i32, i32* %n.addr, align 4
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %while.body, label %while.end

while.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds i8, i8* %s, i64 8
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1
  %12 = uitofp i8 %11 to double
  %13 = call i32 @llvm.fptosi.sat.i32.f64(double %12)
  %14 = icmp eq i32 %13, %code
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load i32, i32* %count.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 1)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %count.addr, align 4
  br label %if.end

if.end:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %21 = load i32, i32* %count.addr, align 4
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end str-bounds-toi32 -->

### An array in a class field: the header hoisted into the preheader

A loop over an array held in a **class field** reads the header through a field
load, and the §2b alias domains do not reach it: the second read sits in a
bounds-checked block, where LLVM may not speculate it out. So the emitter does
the hoist itself, wherever the whole-program fact
`FunctionFacts.resizesArray` proves that nothing the loop reaches can `push`
or `pop` (WP15 §2c candidate 2, `src/attributes.ts`). The field load,
`len` and `data` are read once in the loop's preheader:

```llvm
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9   ; len, once
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9   ; data, once
  br label %while.cond

while.cond:
  %11 = trunc i64 %3 to i32                                       ; the condition's length
  %12 = icmp slt i32 %10, %11

while.body:
  %17 = icmp ult i64 %16, %3                                      ; the bounds check's: the same %3
```

**The second half is the point, not the first.** "No header load left in the
loop" is satisfiable while buying nothing — §2c reached that state by hand,
with metadata, and measured the program 5 ms *slower*, because a preheader load
per use still leaves two length values, two compares and two loop exits. What
the emitter guarantees here is **one length value feeding the loop condition and
the bounds check both**, by construction rather than by hoping GVN merges two
loads of one address.

Four things refuse the hoist, and each is the whole of a proof:

- a `push` or `pop` anywhere in the loop, or a call to a function the fixpoint
  says grows an array — those are what move `len`, `cap` and `data`;
- a store in the loop to a field named anywhere in the path (`h.xs = other`),
  since the hoisted value is a field load;
- a path rooted at a local the loop itself declares, or at a reassignable one,
  or through a nullable link that a guard *inside* the loop narrows.
- a store of a whole element into an array of inline records, which rewrites
  a record in place with no field name written (`recordStoreType` in
  `src/bounds.ts`, `arr_header_hoist_record_store`) — for a path with a link
  read off a holder declared as that record type, because nothing else can
  point into the slot (`recordReaches`, the rule the bounds proof shares). An
  array of classes holds pointers: `this.nodes[i] = this.spare` is a
  `store %struct.Node*` that rewrites no object, and the loop keeps its hoist
  (`arr_header_hoist_record_class`); and `g.src`, read off a class, keeps its
  hoist beside a record store into an unrelated array
  (`arr_header_hoist_record_class_root`).

The lowering is pinned by `tests/cases/arr_header_hoist.ts` and the checks
`tests/run.js` runs over it, which assert both halves by name.

**What this does not buy, and where that lives.** The loop above still carries
*two* bounds checks where the same loop written `const xs = h.xs` carries one,
because `src/bounds.ts` keys its length facts by variable and never by
a property path — a local cannot be written through an alias, a field can. So
`h.xs.length` proves nothing about `h.xs[i]`. That second check is a second
loop exit and it is what keeps the vectoriser away; closing it is that file's
work, not the emitter's.

### An element store beside the field that holds the array

Every element load and store of a slot that holds a value carries a `!tbaa`
tag of its own, `element <type>`, beside the scalar nodes the class fields
use. The field load of `this.v` is tagged `Perm`'s `ptr` at offset 0, the
element store `element i32`, and neither node is an ancestor of the other, so
LLVM knows `this.v[i] = x` cannot have written `this.v` — nor, through the
alias domains above, `this.v`'s header. After `opt -O3` the swap below loads
the field once and `data` once, where without the tag it reloads both after
the first element store. Its two checks are the ones the emitter keeps after
[the repeat proof above](#a-passed-check-proves-the-repeat).

The tag is never put on an inline record's slot, which is written whole by an
untagged `llvm.memcpy` and whose fields are read with no tag at all, so a
record element store still aliases every read of that record's fields. The
rule and why it is sound are in
[ARCHITECTURE.md](ARCHITECTURE.md#attribute-soundness-rules); `tests/run.js`
asserts the `opt -O3` result on `tests/cases/arr_field_reload.ts`, and
`arr_field_reload_records` is the inline-record case that must still reload.

<!-- cookbook:begin arr-field-element -->
```ts
// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.

// An element store beside the class field that holds the array.
export class Perm {
  v: i32[]

  constructor() {
    this.v = []
  }

  swap(i: i32, j: i32): void {
    const tmp = this.v[i]
    this.v[i] = this.v[j]
    this.v[j] = tmp
  }
}
```

```llvm
%struct.Perm = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define void @Perm.constructor(%struct.Perm* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !15
  ret void
}

define void @Perm.swap(%struct.Perm* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i, i32 noundef %j) #1 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %10, i32* %tmp.addr, align 4
  %11 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !15
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !15
  %16 = sext i32 %j to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %13
  store i32 %24, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %29 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !15
  %31 = sext i32 %j to i64
  %32 = load i32, i32* %tmp.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %31
  store i32 %32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Perm", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"element i32", !6, i64 0}
!17 = !{!16, !16, i64 0}
```
<!-- cookbook:end arr-field-element -->

### A field store beside an array's header

The header's own loads and stores carry a `!tbaa` tag too, from a subtree of
its own: an `array header` struct node whose `len`, `cap` and `data` hang off
two scalars no class field uses. A class-field store is tagged with its
class's struct path, which can never reach that node, so LLVM knows
`top.next = null` below cannot have written `this.tops`'s `len` or `data`.
After `opt -O3`, `drop` loads the header once and reads the slot it just
stored back as a value, where without the tag it reloads `data` and the slot
after the field store. AWFY Towers' `moveTopDisk` is the same shape twice,
and `tests/run.js` asserts that after `opt -O3` it loads `len` and `data`
once per move (`tests/cases/arr_header_tbaa.ts`), where it loaded each three
times before.

Every write of a header is either Nish IR that carries the same tag (`new
Array`, a literal, `push`, `pop`) or C behind a call (`nish_array_grow`, the
host entries), and the rule that makes that sound is in
[ARCHITECTURE.md](ARCHITECTURE.md#attribute-soundness-rules).

<!-- cookbook:begin arr-header-field -->
```ts
class Link {
  next: Link | null = null
}

export class Pile {
  tops: (Link | null)[]

  constructor() {
    this.tops = [null]
  }

  drop(): Link | null {
    const top = this.tops[0]
    if (top !== null) {
      this.tops[0] = top.next
      top.next = null
    }
    return this.tops[0]
  }
}
```

```llvm
%struct.Link = type { %struct.Link* }
%struct.Pile = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define void @Pile.constructor(%struct.Pile* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to %struct.Link**
  %7 = getelementptr inbounds %struct.Link*, %struct.Link** %6, i64 0
  store %struct.Link* null, %struct.Link** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds %struct.Pile, %struct.Pile* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %8, align 8, !tbaa !17
  ret void
}

define noundef align 8 %struct.Link* @Pile.drop(%struct.Pile* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %top.addr = alloca %struct.Link*, align 8
  %0 = getelementptr inbounds %struct.Pile, %struct.Pile* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to %struct.Link**
  %8 = getelementptr inbounds %struct.Link*, %struct.Link** %7, i64 0
  %9 = load %struct.Link*, %struct.Link** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.Link* %9, %struct.Link** %top.addr, align 8
  %10 = load %struct.Link*, %struct.Link** %top.addr, align 8
  %11 = icmp ne %struct.Link* %10, null
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = getelementptr inbounds %struct.Pile, %struct.Pile* %this, i32 0, i32 0
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !17
  %14 = load %struct.Link*, %struct.Link** %top.addr, align 8
  %15 = getelementptr inbounds %struct.Link, %struct.Link* %14, i32 0, i32 0
  %16 = load %struct.Link*, %struct.Link** %15, align 8, !tbaa !19
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to %struct.Link**
  %20 = getelementptr inbounds %struct.Link*, %struct.Link** %19, i64 0
  store %struct.Link* %16, %struct.Link** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = load %struct.Link*, %struct.Link** %top.addr, align 8
  %22 = getelementptr inbounds %struct.Link, %struct.Link* %21, i32 0, i32 0
  store %struct.Link* null, %struct.Link** %22, align 8, !tbaa !19
  br label %if.end

if.end:
  %23 = getelementptr inbounds %struct.Pile, %struct.Pile* %this, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !17
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to %struct.Link**
  %28 = getelementptr inbounds %struct.Link*, %struct.Link** %27, i64 0
  %29 = load %struct.Link*, %struct.Link** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.Link* %29
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Pile", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"Link", !15, i64 0}
!19 = !{!18, !15, i64 0}
```
<!-- cookbook:end arr-header-field -->

### An array field stored in its object

When the whole program shows that a class field only ever holds a fresh array
of a literal length and is only indexed or asked its `.length`, the header and
its slots live inside the object ([LANGUAGE.md](LANGUAGE.md#fixed-length-array-fields-are-stored-inline)).
`%struct.Rows` is then `{ %struct.nish_array, [8 x i1] }` rather than a
pointer, `new Rows()` points the header's `data` at the slots before the
constructor runs, and `this.free[r]` is the bounds check on `len` and a load
at a constant offset from `this`: no field pointer, and no `data`, to load
first. `reset` writes the slots in place, a `memset` where `new Array` would
have allocated. `take` is not `readonly` on `this`, because an element store
now writes the object's own bytes. `Rows` is not exported; an exported class
keeps the pointer layout in every build but a closed-world `--link`.

<!-- cookbook:begin cls-inline-array -->
```ts
class Rows {
  free: boolean[]

  constructor() {
    this.free = []
  }

  reset(): void {
    this.free = new Array<boolean>(8)
  }

  take(r: i32): boolean {
    const was = this.free[r]
    this.free[r] = false
    return was
  }
}

export const run = (): boolean => {
  const rows = new Rows()
  rows.reset()
  return rows.take(3)
}
```

```llvm
%struct.Rows = type { { %struct.nish_array, [8 x i1] } }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @Rows.constructor(%struct.Rows* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  ret void
}

define internal void @Rows.reset(%struct.Rows* noundef nonnull align 8 dereferenceable(32) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 1, i64 0
  %2 = bitcast i1* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 8, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  ret void
}

define internal noundef zeroext i1 @Rows.take(%struct.Rows* noundef nonnull align 8 dereferenceable(32) nocapture %this, i32 noundef %r) #1 {
entry:
  %was.addr = alloca i1, align 1
  %0 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %1 = sext i32 %r to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 1, i64 0
  %6 = bitcast i1* %5 to i8*
  %7 = bitcast i8* %6 to i1*
  %8 = getelementptr inbounds i1, i1* %7, i64 %1
  %9 = load i1, i1* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  store i1 %9, i1* %was.addr, align 1
  %10 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %11 = sext i32 %r to i64
  %12 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 1, i64 0
  %13 = bitcast i1* %12 to i8*
  %14 = bitcast i8* %13 to i1*
  %15 = getelementptr inbounds i1, i1* %14, i64 %11
  store i1 false, i1* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %16 = load i1, i1* %was.addr, align 1
  ret i1 %16
}

define noundef zeroext i1 @run() #1 {
entry:
  %rows.addr = alloca %struct.Rows*, align 8
  %Rows.obj = alloca %struct.Rows, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Rows, %struct.Rows* %Rows.obj, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 1
  store i64 8, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %3 = getelementptr inbounds %struct.Rows, %struct.Rows* %Rows.obj, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i1* %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  call void @Rows.constructor(%struct.Rows* %Rows.obj)
  store %struct.Rows* %Rows.obj, %struct.Rows** %rows.addr, align 8
  %6 = load %struct.Rows*, %struct.Rows** %rows.addr, align 8
  call void @Rows.reset(%struct.Rows* %6)
  %7 = load %struct.Rows*, %struct.Rows** %rows.addr, align 8
  %8 = call i1 @Rows.take(%struct.Rows* %7, i32 3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i1 %8
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!"element i1", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 8}
!14 = !{!9, !8, i64 16}
```
<!-- cookbook:end cls-inline-array -->

### `uncheckedGet` from `nish:unsafe`

`a[i]` and `uncheckedGet(a, i)` side by side: the same `sext`, header load,
GEP and element load, and `uncheckedGet` has no `len` load, no `icmp`, no
branch and no panic block. `unchecked` keeps `willreturn` and `checked` does
not, because only `checked` can reach the `noreturn` panic. Out-of-range is
undefined behaviour at that one site, which is the promise the import at the
top of the module makes visible
([LANGUAGE.md](LANGUAGE.md#nishunsafe-unchecked-access-and-defined-wrapping)).
`uncheckedSet(a, i, v)` is the store twin.

<!-- cookbook:begin unsafe-unchecked-get -->
```ts
import { uncheckedGet } from "nish:unsafe"

const checked = (a: i32[], i: i32): i32 => a[i]

const unchecked = (a: i32[], i: i32): i32 => uncheckedGet(a, i)

export const both = (a: i32[], i: i32): i32 => checked(a, i) + unchecked(a, i)
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @checked(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %8
}

define internal noundef i32 @unchecked(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %5
}

define noundef i32 @both(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = call i32 @checked(%struct.nish_array* %a, i32 %i)
  %1 = call i32 @unchecked(%struct.nish_array* %a, i32 %i)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end unsafe-unchecked-get -->

### `--unchecked-indexing` (deprecated)

The compare, the branch and the panic block disappear from every index of the
entry package's modules; `get` regains `willreturn` and becomes `readonly`.
Out-of-range is then undefined behaviour. Unlike the proof above, this is a
promise the *program* makes: an out-of-range index is undefined behaviour
rather than a panic. The flag prints NL9014 and never reaches a dependency or
a `nish/` module; `uncheckedGet` above says the same thing at one site.

<!-- cookbook:begin arr-unchecked -->
Compiled with `--unchecked-indexing`.

```ts
const get = (a: number[], i: number): number => a[i]
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

define internal noundef i32 @get(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %5
}

attributes #0 = { nounwind willreturn readonly }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !8, i64 16}
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
```
<!-- cookbook:end arr-unchecked -->

### Literals and `push`

`[]` stores `len = cap = 0` and a null `data`; `push` grows through
`nish_array_grow` only when `len == cap`; `[1, 2]` allocates the header (24
bytes) and the data (`n * sizeof(T)`).

<!-- cookbook:begin arr-literal-push -->
```ts
const squares = (n: number): number[] => {
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    xs.push(i * i)
  }
  return xs
}

const pair = (): number[] => [1, 2]
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
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
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %8, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  store i32 %11, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %26

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @pair() #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %1
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end arr-literal-push -->

### `join` and `indexOf`

`join` is two loops and one allocation: `join.sum` adds the parts' lengths to
the separators' total, `nish_alloc_struct` takes the whole string at once, and
`join.copy` walks a cursor with one `llvm.memcpy` per separator and per part.
The separator before the first part is skipped by selecting a *length* of
zero rather than by branching, so the copy body stays one block. `indexOf`
scans with the `===` of the element type — `nish_str_eq` here, an `icmp eq` for
a number.

<!-- cookbook:begin arr-join -->
```ts
const report = (parts: string[]): string => parts.join(", ")

const firstAt = (names: string[], name: string): number => names.indexOf(name)
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
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
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
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %8
  %14 = load i8*, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !13
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
  %21 = icmp ugt i64 %20, 2147483647
  %22 = add i64 %20, 9
  %23 = select i1 %21, i64 4611686018427387904, i64 %22
  %24 = call i8* @nish_alloc_struct(i64 %23)
  %25 = bitcast i8* %24 to i64*
  store i64 %20, i64* %25, align 8
  %26 = getelementptr inbounds i8, i8* %24, i64 8
  store i8* %26, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %27 = load i64, i64* %join.at, align 8
  %28 = icmp ult i64 %27, %1
  br i1 %28, label %join.part, label %join.end

join.part:
  %29 = load i8*, i8** %join.p, align 8
  %30 = icmp eq i64 %27, 0
  %31 = select i1 %30, i64 0, i64 %3
  %32 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %29, i8* %32, i64 %31, i1 false)
  %33 = getelementptr inbounds i8, i8* %29, i64 %31
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %27
  %38 = load i8*, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = getelementptr inbounds i8, i8* %38, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %33, i8* %41, i64 %40, i1 false)
  %42 = getelementptr inbounds i8, i8* %33, i64 %40
  store i8* %42, i8** %join.p, align 8
  %43 = add i64 %27, 1
  store i64 %43, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %44 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %44, align 1
  ret i8* %24
}

define internal noundef i32 @firstAt(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %names, i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %idx.at = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %idx.at, align 8
  br label %idx.scan

idx.scan:
  %2 = load i64, i64* %idx.at, align 8
  %3 = icmp ult i64 %2, %1
  br i1 %3, label %idx.test, label %idx.miss

idx.test:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %2
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !13
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
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end arr-join -->

### `set` and `fill`

`dst.set(src, at)` is one byte copy behind the range check `s.slice` makes:
`at <= at + src.length <= dst.length`, compared unsigned so a negative offset
fails the first compare, and a cold `set.fail` block that calls
`nish_panic_slice`. The copy is `llvm.memmove`, which is right whatever the two
buffers share; it is `llvm.memcpy` only where the checker proved them distinct
(`nodeDisjointCopy`), as it does for `out` and `head` below, two `const`s each
bound to a fresh literal. `copyInto` receives its arrays from a caller that may
pass one array twice, so its copy stays a `memmove`, and `src` is
`readonly nocapture`: the copy reads it and keeps nothing. Either copy carries
the element alias scope, because it touches element bytes and never a header.

`out.fill(v, start, end)` clamps each end as JavaScript does — a literal end is
never negative, so it takes only the `llvm.smin`, and `-1` counts back from the
length — and on a `u8[]` stores with one `llvm.memset`. A wider element is a
counted store loop, which `opt -O2` vectorises, or turns into a `memset` itself
when the value is a repeated byte.

<!-- cookbook:begin arr-bytes -->
```ts
// WP34 N2: `set` between two fresh `const` arrays is a `memcpy`; through a
// parameter it is a `memmove`. `fill` on a `u8[]` is a `memset`.
export const copyInto = (dst: u8[], src: u8[], at: number): void => {
  dst.set(src, at)
}

export const packet = (): u8[] => {
  const out: u8[] = [0, 0, 0, 0, 0, 0, 0, 0]
  const head: u8[] = [0x16, 0x03, 0x01]
  out.set(head, 0)
  out.fill(0xff, 3, -1)
  return out
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare i64 @llvm.smin.i64(i64, i64) #3
declare i64 @llvm.smax.i64(i64, i64) #3

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

define void @copyInto(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %at) #0 {
entry:
  %0 = sext i32 %at to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = add i64 %0, %2
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ule i64 %0, %3
  %7 = icmp ule i64 %3, %5
  %8 = and i1 %6, %7
  br i1 %8, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %0, i64 %3, i64 %5)
  unreachable

set.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %12, i8* %16, i64 %2, i1 false), !alias.scope !4, !noalias !3
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @packet() #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %head.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i8], align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 8, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 8, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 0, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 0, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 0, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 0, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8, i8* %6, i64 4
  store i8 0, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8, i8* %6, i64 5
  store i8 0, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i8, i8* %6, i64 6
  store i8 0, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i8, i8* %6, i64 7
  store i8 0, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast [3 x i8]* %arr.data to i8*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %17 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 0
  store i8 22, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds i8, i8* %19, i64 1
  store i8 3, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds i8, i8* %19, i64 2
  store i8 1, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %head.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %head.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = add i64 0, %26
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ule i64 0, %27
  %31 = icmp ule i64 %27, %29
  %32 = and i1 %30, %31
  br i1 %32, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 0, i64 %27, i64 %29)
  unreachable

set.ok:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 0
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast i8* %38 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %36, i8* %40, i64 %26, i1 false), !alias.scope !4, !noalias !3
  %41 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %42 = sext i32 -1 to i64
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = call i64 @llvm.smin.i64(i64 3, i64 %44)
  %46 = icmp slt i64 %42, 0
  %47 = add i64 %44, %42
  %48 = call i64 @llvm.smax.i64(i64 %47, i64 0)
  %49 = call i64 @llvm.smin.i64(i64 %42, i64 %44)
  %50 = select i1 %46, i64 %48, i64 %49
  %51 = sub i64 %50, %45
  %52 = call i64 @llvm.smax.i64(i64 %51, i64 0)
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast i8* %54 to i8*
  %56 = getelementptr inbounds i8, i8* %55, i64 %45
  call void @llvm.memset.p0i8.i64(i8* %56, i8 255, i64 %52, i1 false), !alias.scope !4, !noalias !3
  %57 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %57
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!9, !7, i64 8}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end arr-bytes -->

### `new Array<T>(n)` and `.length`

`new Array<number>(n)` allocates and zero-fills with `llvm.memset`;
`.length` is one `load` of the header.

<!-- cookbook:begin arr-new -->
```ts
const zeros = (n: number): number[] => new Array<number>(n)

const len = (xs: number[]): number => xs.length
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_exit(i32 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %3
}

define internal noundef i32 @len(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { noreturn nounwind }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
```
<!-- cookbook:end arr-new -->

### `readonly T[]`

The zero-cost claim, as a diff you can read: `sum` takes a `readonly number[]`
and `sumMutable` the same array without the modifier, and the two bodies are
the same instructions with the same attributes. `readonly` is a promise the
checker keeps — it refuses the stores, the `push` and the `pop` — so by the
time the emitter runs there is nothing left of it to lower. The `readonly
nocapture` on both parameters is the whole-program fixpoint's, earned the way
it always was; on `sum` the signature guarantees it as well, which is what lets
`--emit-header` write `const nish_array *` without proving anything.

<!-- cookbook:begin arr-readonly -->
```ts
const sum = (xs: readonly number[]): number => {
  let total = 0
  for (const x of xs) {
    total = total + x
  }
  return total
}

const sumMutable = (xs: number[]): number => {
  let total = 0
  for (const x of xs) {
    total = total + x
  }
  return total
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %total.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %total.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %total.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end arr-readonly -->

### Typed-array names refuse `push` and `pop`

WP33 R2. `Float64Array` and the other three names are the same type as `f64[]`
and friends, and a receiver spelled with one refuses `push` and `pop` as
TypeScript does
([LANGUAGE.md](LANGUAGE.md#typed-array-names-have-no-push-or-pop)). The rule is
the checker's alone, so there is no IR of its own to show: `append` below is
the `f64[]` push it always was, and `new Float64Array(2)` the zero-filled
`new Array<f64>(2)`. A value spelled `Float64Array` may still flow into a
binding or a parameter spelled `f64[]` and be grown there.

<!-- cookbook:begin arr-typed-names -->
```ts
// `t.push(v)` on the `Float64Array` itself is NL2415. The value is still an
// `f64[]`, so a parameter spelled `f64[]` grows it with the `f64[]` lowering.
const append = (xs: f64[], v: f64): void => {
  xs.push(v)
}

export const main = (): number => {
  const t = new Float64Array(2)
  append(t, 1.5)
  return t.length
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal void @append(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, double noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 8)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to double*
  %8 = getelementptr inbounds double, double* %7, i64 %1
  store double %v, double* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 2, 8
  %3 = bitcast [2 x double]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %t.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @append(%struct.nish_array* %5, double 0x3FF8000000000000)
  %6 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element double", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end arr-typed-names -->

### An array of records is contiguous

WP15 §2a. When the element type is an `interface` — a record, fields and
nothing else — the array's `data` block holds the records themselves, `N` of
them end to end at the stride clang gives the matching C array. `ps[i]` is one
`getelementptr %struct.Point, %struct.Point* %base, i64 %i` and *is* the
element: there is no pointer to load and nothing to chase, which is what puts
two adjacent points on one cache line.

The other side of the same coin is in the IR below: `push` lowers to a
`llvm.memcpy` of `sizeof(Point)` into the slot, because the array owns the
storage. That is also why the checker refuses to let a program hold `ps[i]`
across a `push` — `nish_array_grow` moves the block the pointer is in. An
array of a `class` is unchanged and still holds one pointer per slot; the rule
and its reason are in `docs/LANGUAGE.md`,
"Arrays of records are contiguous".

<!-- cookbook:begin arr-records -->
```ts
interface Point {
  x: f64
  y: f64
}

// The whole array is one block of `Point`s, so the loop walks it with a single
// `getelementptr %struct.Point, ..., i64 %i` per element: no pointer to load,
// no second block to chase into, and two adjacent points on one cache line.
const centroidX = (ps: readonly Point[]): f64 => {
  let total: f64 = 0.0
  for (const p of ps) {
    total = total + p.x
  }
  return total / toF64(ps.length)
}

// `push` copies the record into the slot, which is why holding `ps[i]` across
// one is a compile error: `nish_array_grow` moves the block the pointer is in.
export const spread = (n: i32): f64 => {
  const ps: Point[] = []
  let i = 0
  while (i < n) {
    ps.push({ x: toF64(i), y: toF64(i) * 0.5 })
    i = i + 1
  }
  return centroidX(ps)
}
```

```llvm
%struct.Point = type { double, double }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2

define internal noundef double @centroidX(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ps) #0 {
entry:
  %total.addr = alloca double, align 8
  %p.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  store double 0x0000000000000000, double* %total.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ps, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ps, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to %struct.Point*
  %7 = getelementptr inbounds %struct.Point, %struct.Point* %6, i64 %0
  store %struct.Point* %7, %struct.Point** %p.addr, align 8
  %8 = load double, double* %total.addr, align 8
  %9 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %10 = getelementptr inbounds %struct.Point, %struct.Point* %9, i32 0, i32 0
  %11 = load double, double* %10, align 8
  %12 = fadd double %8, %11
  store double %12, double* %total.addr, align 8
  br label %forof.inc

forof.inc:
  %13 = load i64, i64* %forof.idx, align 8
  %14 = add i64 %13, 1
  store i64 %14, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %15 = load double, double* %total.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ps, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = sitofp i32 %18 to double
  %20 = fdiv double %15, %19
  ret double %20
}

define noundef double @spread(i32 noundef %n) #1 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %Point.obj = alloca %struct.Point, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = sitofp i32 %6 to double
  %8 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store double %7, double* %8, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = sitofp i32 %9 to double
  %11 = fmul double %10, 0x3FE0000000000000
  %12 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store double %11, double* %12, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 16)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to %struct.Point*
  %21 = getelementptr inbounds %struct.Point, %struct.Point* %20, i64 %14
  %22 = bitcast %struct.Point* %21 to i8*
  %23 = bitcast %struct.Point* %Point.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %22, i8* align 8 %23, i64 16, i1 false), !alias.scope !4, !noalias !3
  %24 = add i64 %14, 1
  store i64 %24, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %28 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %29 = call double @centroidX(%struct.nish_array* %28)
  call void @nish_arena_release(i64 %arena.mark)
  ret double %29
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!9, !7, i64 8}
```
<!-- cookbook:end arr-records -->



## Classes and interfaces

### Class, `new`, constructor, method, field read and write

`%struct.Point = type { i32, i32 }`; `new` is the inline allocator plus a
`bitcast` and a constructor call; methods are `@Point.method` with `%this`
first; fields are `getelementptr inbounds` + `load`/`store`.

<!-- cookbook:begin cls-point -->
```ts
class Point {
  x: number
  y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  manhattan(): number {
    return this.x + this.y
  }
}

const origin = (): number => {
  const p = new Point(3, 4)
  p.x = 0
  return p.manhattan()
}
```

```llvm
%struct.Point = type { i32, i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

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
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @origin() #1 {
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
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
```
<!-- cookbook:end cls-point -->

### Field initializers without a constructor

`new Defaults()` stores the literals inline; there is no
`@Defaults.constructor` symbol.

<!-- cookbook:begin cls-initializers -->
```ts
class Defaults {
  n: number = 42
  flag: boolean = true
  name: string = "anon"
}

const make = (): Defaults => new Defaults()
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
<!-- cookbook:end cls-initializers -->

### Interfaces, object literals, `implements`

An object literal allocates and stores every field; a class that `implements`
an interface converts to it with one `bitcast` because the layouts are
identical.

<!-- cookbook:begin cls-interface -->
```ts
interface Pair {
  first: number
  second: number
}

class Ordered implements Pair {
  first: number
  second: number

  constructor(a: number, b: number) {
    this.first = a
    this.second = b
  }
}

const swap = (p: Pair): Pair => ({ first: p.second, second: p.first })

const asPair = (o: Ordered): Pair => o
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
<!-- cookbook:end cls-interface -->

### Widening: `implements` as a prefix

`%struct.Square` starts with `%struct.Shape`'s fields, so a `Square` becomes a
`Shape` with one `bitcast` — the argument of `originDistance` here, and the
elements of a `Shape[]` elsewhere. It is the only widening the language has:
there is no inheritance, so a class is never a prefix of another class. A
`Shape` operation reads and writes the `Square`'s own bytes at the same
offsets, the class keeps its own methods, and nothing converts back.

<!-- cookbook:begin cls-prefix -->
```ts
interface Shape {
  x: number
  y: number
}

class Square implements Shape {
  x: number
  y: number
  side: number

  constructor(x: number, y: number, side: number) {
    this.x = x
    this.y = y
    this.side = side
  }

  area(): number {
    return this.side * this.side
  }
}

const originDistance = (s: Shape): number => s.x + s.y

const describe = (sq: Square): number => originDistance(sq) + sq.area()
```

```llvm
%struct.Shape = type { i32, i32 }
%struct.Square = type { i32, i32, i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

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
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @originDistance(%struct.Shape* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Shape, %struct.Shape* %s, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @describe(%struct.Square* noundef nonnull readonly align 8 dereferenceable(12) nocapture %sq) #1 {
entry:
  %0 = bitcast %struct.Square* %sq to %struct.Shape*
  %1 = call i32 @originDistance(%struct.Shape* %0)
  %2 = call i32 @Square.area(%struct.Square* %sq)
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
```
<!-- cookbook:end cls-prefix -->

## Memory

### A stack-allocated object

An object (or object literal, or array literal) whose value provably never
outlives its function is an entry-block `alloca` instead of an arena bump
([LANGUAGE.md: Memory model](LANGUAGE.md#memory-model)). `swapped` only
reads and writes its own `%Pair.obj`, so it is `readnone`; `nearest` runs
the constructor on `%Point.obj` and inherits its `write` effect. Nothing in
the module touches the arena, so there is no arena prelude at all.

<!-- cookbook:begin mem-stack-object -->
```ts
interface Pair {
  first: number
  second: number
}

class Point {
  x: number
  y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  manhattan(): number {
    return this.x + this.y
  }
}

// An object literal that is only read: the function's own memory, so `readnone`.
const swapped = (a: number, b: number): number => {
  const p: Pair = { first: b, second: a }
  return p.first * 10 + p.second
}

// A constructed object that never escapes: an alloca, the constructor writes through it.
const nearest = (x: number): number => {
  const p = new Point(x, 4)
  return p.manhattan()
}
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Point = type { i32, i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

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
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #1 {
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
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 10)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %9 = getelementptr inbounds %struct.Pair, %struct.Pair* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %12

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @nearest(i32 noundef %x) #1 {
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
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
```
<!-- cookbook:end mem-stack-object -->

### The same module with `--no-stack-alloc`

Every object is bumped from the arena by the inlined allocator, and because
each one still dies with its function, both functions get an automatic
arena scope: `nish_arena_mark` after the allocas, `nish_arena_release` before
the `ret`. This is the IR every `new` produced before WP6.

<!-- cookbook:begin mem-stack-object-arena -->
Compiled with `--no-stack-alloc`.

```ts
interface Pair {
  first: number
  second: number
}

class Point {
  x: number
  y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  manhattan(): number {
    return this.x + this.y
  }
}

// An object literal that is only read: the function's own memory, so `readnone`.
const swapped = (a: number, b: number): number => {
  const p: Pair = { first: b, second: a }
  return p.first * 10 + p.second
}

// A constructed object that never escapes: an alloca, the constructor writes through it.
const nearest = (x: number): number => {
  const p = new Point(x, 4)
  return p.manhattan()
}
```

```llvm
%struct.Pair = type { i32, i32 }
%struct.Point = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @swapped(i32 noundef %a, i32 noundef %b) #1 {
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
  %7 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 10)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %11 = getelementptr inbounds %struct.Pair, %struct.Pair* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %14

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @nearest(i32 noundef %x) #1 {
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
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
```
<!-- cookbook:end mem-stack-object-arena -->

### An arena-scoped function

A string built by `+` is an arena temporary that cannot go on the stack. In
`greet` it dies with the call (it is only printed), so the function marks
the arena on entry and releases it before returning: called a million
times, `Arena.used()` stays flat. `label` returns its template, so the
caller owns that memory and `label` gets no scope.

<!-- cookbook:begin mem-arena-scope -->
```ts
// The concatenation is an arena temporary that dies with the call, so the
// function marks the arena on entry and releases it before returning.
const greet = (name: string): void => {
  console.log("hello, " + name + "!")
}

// The template is returned, so the caller owns it: no scope here.
const label = (name: string): string => `<${name}>`
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"hello, \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1

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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end mem-arena-scope -->

### A scope earned through callees

A function that allocates nothing itself gets the same bracket when a callee
leaves memory behind and nothing can keep it. `size` returns an `i32`, and
`n`, the only thing it was handed, has no room for a pointer, so every cell
`chain` builds is unreachable once `size` returns — however `chain` links them
together, which the WP6 rule alone cannot see past (`c.next = head` makes it
leak). A function with a pointer-shaped parameter qualifies only when the
escape analysis shows no allocation stored into memory anywhere in the call.
The rule and its proof are in [ARCHITECTURE.md](ARCHITECTURE.md), "Escape
analysis, stack allocation, and arena scopes" (`tests/cases/mem_callee_scope`,
`mem_callee_scope_tree`, and the `_escape`, `_return`, `_control` and
`_nested` negatives).

<!-- cookbook:begin mem-callee-scope -->
```ts
// `size` allocates nothing itself: `chain` builds the list and `size` keeps a
// number. `n` is the only thing it was handed and cannot hold a pointer, so
// the list cannot outlive the call, and `size` brackets itself with the arena
// scope. `chain` returns its list, so it gets none.
class Cell {
  v: i32
  next: Cell | null = null

  constructor(v: i32) {
    this.v = v
  }
}

const chain = (n: i32): Cell | null => {
  let head: Cell | null = null
  for (let i = 0; i < n; i++) {
    const c = new Cell(i)
    c.next = head
    head = c
  }
  return head
}

export const size = (n: i32): i32 => {
  let k = 0
  let p = chain(n)
  while (p !== null) {
    k = k + 1
    p = p.next
  }
  return k
}
```

```llvm
%struct.Cell = type { i32, %struct.Cell* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 1
  store %struct.Cell* null, %struct.Cell** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %v, i32* %1, align 4, !tbaa !6
  ret void
}

define internal noundef align 8 %struct.Cell* @chain(i32 noundef %n) #0 {
entry:
  %head.addr = alloca %struct.Cell*, align 8
  %i.addr = alloca i32, align 4
  %c.addr = alloca %struct.Cell*, align 8
  store %struct.Cell* null, %struct.Cell** %head.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.Cell*
  %4 = load i32, i32* %i.addr, align 4
  call void @Cell.constructor(%struct.Cell* %3, i32 %4)
  store %struct.Cell* %3, %struct.Cell** %c.addr, align 8
  %5 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %6 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  %7 = getelementptr inbounds %struct.Cell, %struct.Cell* %5, i32 0, i32 1
  store %struct.Cell* %6, %struct.Cell** %7, align 8, !tbaa !5
  %8 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  store %struct.Cell* %8, %struct.Cell** %head.addr, align 8
  br label %for.inc

for.inc:
  %9 = load i32, i32* %i.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %11 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  ret %struct.Cell* %11
}

define noundef i32 @size(i32 noundef %n) #1 {
entry:
  %k.addr = alloca i32, align 4
  %p.addr = alloca %struct.Cell*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %k.addr, align 4
  %0 = call %struct.Cell* @chain(i32 %n)
  store %struct.Cell* %0, %struct.Cell** %p.addr, align 8
  br label %while.cond

while.cond:
  %1 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %2 = icmp ne %struct.Cell* %1, null
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = load i32, i32* %k.addr, align 4
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %k.addr, align 4
  %7 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %8 = getelementptr inbounds %struct.Cell, %struct.Cell* %7, i32 0, i32 1
  %9 = load %struct.Cell*, %struct.Cell** %8, align 8, !tbaa !5
  store %struct.Cell* %9, %struct.Cell** %p.addr, align 8
  br label %while.cond

while.end:
  %10 = load i32, i32* %k.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
```
<!-- cookbook:end mem-callee-scope -->

### A scope around each pass of a loop

A loop whose pass drops everything it allocates is bracketed on its own, in a
function of any return type: the mark is read at the top of the body, and
every edge that leaves the pass rewinds to it — the back-edge, `continue`,
`break`, and a `return`. Nothing the pass allocates may be stored into memory,
kept in a local declared outside the loop, pushed onto an older array, or
returned. The rule and its proof are in [ARCHITECTURE.md](ARCHITECTURE.md),
"Escape analysis, stack allocation, and arena scopes"
(`tests/cases/mem_loop_scope`, `mem_loop_scope_control`, and the `_escape`,
`_forof` and `_interior` negatives).

<!-- cookbook:begin mem-loop-scope -->
```ts
// `summarise` returns a pointer, so it gets no scope of its own, and each
// list `build` returns is garbage once its length is read. Nothing the pass
// allocates reaches `total`, older memory, or the `return`, so every pass is
// bracketed: the mark is the arena's `buf` and `off`, and the release rewinds
// `off` unless the pass pushed a chunk.
class Box {
  n: i32

  constructor(n: i32) {
    this.n = n
  }
}

const build = (n: i32): i32[] => [n, n + 1, n + 2]

export const summarise = (rounds: i32): Box => {
  let total = 0
  for (let i = 0; i < rounds; i++) {
    total = total + build(i).length
  }
  return new Box(total)
}
```

```llvm
%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_arena_release(i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @build(i32 noundef %n) #1 {
entry:
  %0 = add nsw i32 %n, 1
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 2)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 3, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 3, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %8 = call i8* @nish_alloc_struct(i64 12)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %10 = bitcast i8* %8 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  store i32 %n, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %12 = getelementptr inbounds i32, i32* %10, i64 1
  store i32 %0, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %13 = getelementptr inbounds i32, i32* %10, i64 2
  store i32 %2, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  ret %struct.nish_array* %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef nonnull align 8 dereferenceable(4) %struct.Box* @summarise(i32 noundef %rounds) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %total.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call %struct.nish_array* @build(i32 %7)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = trunc i64 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %total.addr, align 4
  %15 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %16 = load i8*, i8** %15, align 8
  %17 = icmp eq i8* %16, %3
  br i1 %17, label %pass.rewind, label %pass.free

pass.rewind:
  %18 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %18, align 8
  br label %pass.done

pass.free:
  %19 = ptrtoint i8* %3 to i64
  %20 = add i64 %19, %5
  call void @nish_arena_release(i64 %20)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %23 = call i8* @nish_alloc_struct(i64 4)
  %24 = bitcast i8* %23 to %struct.Box*
  %25 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %24, i32 %25)
  ret %struct.Box* %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
```
<!-- cookbook:end mem-loop-scope -->

### A string pushed only to be joined

A function that builds its answer from parts — `parts.push(...)` in a loop,
then `parts.join(...)` — lets nothing out: a pushed string is reachable only
through `parts`, nothing reads `parts` but `push`, `join` and `length`, and
`join` copies every part into a fresh string. So the pushed value is held by a
local of the frame rather than stored into memory, the function's
`allocEscapes` stays false, and the loop that calls it keeps its per-pass
release (above) and the call-site `nish_arena_keep` (below). Any other use of
`parts`, or a `parts` that is not the function's own literal or `new Array`,
keeps the pushed value escaping
(`tests/cases/mem_join_parts_scope`, and the `_readback`, `_forof`,
`_passed` and `_alias` negatives).

<!-- cookbook:begin mem-join-parts -->
```ts
// `spell` builds its answer from parts. The strings it pushes are reachable
// only through `parts`, which nothing reads but `push`, `join` and `length`,
// and `join` copies them into a fresh string, so `spell` lets no allocation
// out. Its caller's loop therefore keeps its per-pass release, and the call
// is bracketed by `nish_arena_keep` besides.
const spell = (n: i32): string => {
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    parts.push(`<${i}>`)
  }
  return parts.join("-")
}

export const measure = (calls: i32): string => {
  let total = 0
  for (let i = 0; i < calls; i++) {
    total = total + spell(1 + (i % 9)).length
  }
  return `${total}`
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal noundef nonnull align 8 i8* @spell(i32 noundef %n) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %23 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*) to i64*
  %27 = load i64, i64* %26, align 8
  %28 = sub i64 %25, 1
  %29 = mul i64 %27, %28
  %30 = icmp eq i64 %25, 0
  %31 = select i1 %30, i64 0, i64 %29
  store i64 %31, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %32 = load i64, i64* %join.at, align 8
  %33 = icmp ult i64 %32, %25
  br i1 %33, label %join.sum.body, label %join.copy

join.sum.body:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %32
  %38 = load i8*, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %39 = load i64, i64* %join.total, align 8
  %40 = bitcast i8* %38 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = add i64 %39, %41
  store i64 %42, i64* %join.total, align 8
  %43 = add i64 %32, 1
  store i64 %43, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %44 = load i64, i64* %join.total, align 8
  %45 = icmp ugt i64 %44, 2147483647
  %46 = add i64 %44, 9
  %47 = select i1 %45, i64 4611686018427387904, i64 %46
  %48 = call i8* @nish_alloc_struct(i64 %47)
  %49 = bitcast i8* %48 to i64*
  store i64 %44, i64* %49, align 8
  %50 = getelementptr inbounds i8, i8* %48, i64 8
  store i8* %50, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %51 = load i64, i64* %join.at, align 8
  %52 = icmp ult i64 %51, %25
  br i1 %52, label %join.part, label %join.end

join.part:
  %53 = load i8*, i8** %join.p, align 8
  %54 = icmp eq i64 %51, 0
  %55 = select i1 %54, i64 0, i64 %27
  %56 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %53, i8* %56, i64 %55, i1 false)
  %57 = getelementptr inbounds i8, i8* %53, i64 %55
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = bitcast i8* %59 to i8**
  %61 = getelementptr inbounds i8*, i8** %60, i64 %51
  %62 = load i8*, i8** %61, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = bitcast i8* %62 to i64*
  %64 = load i64, i64* %63, align 8
  %65 = getelementptr inbounds i8, i8* %62, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %57, i8* %65, i64 %64, i1 false)
  %66 = getelementptr inbounds i8, i8* %57, i64 %64
  store i8* %66, i8** %join.p, align 8
  %67 = add i64 %51, 1
  store i64 %67, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %68 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %68, align 1
  ret i8* %48
}

define noundef nonnull align 8 i8* @measure(i32 noundef %calls) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %calls
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %total.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = srem i32 %7, 9
  %9 = add nsw i32 1, %8
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @spell(i32 %9)
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %total.addr, align 4
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %20 = load i8*, i8** %19, align 8
  %21 = icmp eq i8* %20, %3
  br i1 %21, label %pass.rewind, label %pass.free

pass.rewind:
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %22, align 8
  br label %pass.done

pass.free:
  %23 = ptrtoint i8* %3 to i64
  %24 = add i64 %23, %5
  call void @nish_arena_release(i64 %24)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load i32, i32* %total.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  ret i8* %28

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end mem-join-parts -->

### A value returned in a fresh array

A function that fills an array it allocated with strings it built and returns
it — `values[k] = v` or `values.push(v)`, then `return values` — lets nothing
out but the array: a stored value is reachable only through `values`, and
nothing reads `values` but stores, pushes, `length`, a test of an element
(`values[k] === null`) and the `return`. So the stored value is returned
with the array rather than stored into memory, the function's
`allocEscapes` stays false, and the loop that calls it keeps its per-pass
release. The caller follows what it reads out of the array as the call
itself, as it does a `readdirSync` listing. `fieldsOf`'s own loop stores
into an array older than its pass, so that loop takes no pass scope: only
`measure`'s does (`tests/cases/mem_return_array_scope`, and the `_callee`,
`_caller`, `_readdir` and `_nested` negatives).

<!-- cookbook:begin mem-return-array -->
```ts
// `fieldsOf` fills a fresh array with strings it built and returns it. Each
// string is reachable only through `values`, which nothing reads but a
// `=== null` test, `length` and the `return`, so the strings go to the caller
// with the array and `fieldsOf` lets nothing else out. The caller follows the
// elements it reads as the call itself, and nothing it reads outlives the
// pass, so its loop keeps its per-pass release.
const fieldsOf = (line: string, n: i32): (string | null)[] => {
  const values: (string | null)[] = new Array<string | null>(n)
  for (let k = 0; k < values.length; k++) {
    if (values[k] === null && k < line.length) {
      values[k] = line.substring(k, line.length)
    }
  }
  return values
}

export const measure = (calls: i32): string => {
  let total = 0
  for (let i = 0; i < calls; i++) {
    const last = fieldsOf(`line ${i}`, 3)[2]
    if (last !== null) {
      total = total + last.length
    }
  }
  return `${total}`
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"line \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare i64 @llvm.smin.i64(i64, i64) #5
declare i64 @llvm.smax.i64(i64, i64) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fieldsOf(i8* noundef nonnull noalias readonly align 8 nocapture %line, i32 noundef %n) #0 {
entry:
  %values.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 8
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %values.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %14 = load i32, i32* %k.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %k.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %13 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %18
  %21 = load i8*, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = icmp eq i8* %21, null
  br i1 %22, label %land.rhs, label %land.end

land.rhs:
  %23 = load i32, i32* %k.addr, align 4
  %24 = bitcast i8* %line to i64*
  %25 = load i64, i64* %24, align 8
  %26 = trunc i64 %25 to i32
  %27 = icmp slt i32 %23, %26
  br label %land.end

land.end:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs ]
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load i32, i32* %k.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = bitcast i8* %line to i64*
  %32 = load i64, i64* %31, align 8
  %33 = load i32, i32* %k.addr, align 4
  %34 = sext i32 %33 to i64
  %35 = bitcast i8* %line to i64*
  %36 = load i64, i64* %35, align 8
  %37 = trunc i64 %36 to i32
  %38 = sext i32 %37 to i64
  %39 = call i64 @llvm.smin.i64(i64 %38, i64 %32)
  %40 = call i64 @llvm.smax.i64(i64 %39, i64 0)
  %41 = call i64 @llvm.smin.i64(i64 %34, i64 %40)
  %42 = call i64 @llvm.smax.i64(i64 %34, i64 %40)
  %43 = sub i64 %42, %41
  %44 = getelementptr inbounds i8, i8* %line, i64 8
  %45 = getelementptr inbounds i8, i8* %44, i64 %41
  %46 = call i8* @nish_str_new(i8* %45, i64 %43)
  %47 = bitcast i8* %13 to i8**
  %48 = getelementptr inbounds i8*, i8** %47, i64 %30
  store i8* %46, i8** %48, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %k.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %51 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  ret %struct.nish_array* %51
}

define noundef nonnull align 8 i8* @measure(i32 noundef %calls) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %last.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %calls
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %7)
  %9 = call %struct.nish_array* @fieldsOf(i8* %8, i32 3)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 2, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %17, i8** %last.addr, align 8
  %18 = load i8*, i8** %last.addr, align 8
  %19 = icmp ne i8* %18, null
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load i32, i32* %total.addr, align 4
  %21 = load i8*, i8** %last.addr, align 8
  %22 = bitcast i8* %21 to i64*
  %23 = load i64, i64* %22, align 8
  %24 = trunc i64 %23 to i32
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %26, i32* %total.addr, align 4
  br label %if.end

if.end:
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %29 = load i8*, i8** %28, align 8
  %30 = icmp eq i8* %29, %3
  br i1 %30, label %pass.rewind, label %pass.free

pass.rewind:
  %31 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %31, align 8
  br label %pass.done

pass.free:
  %32 = ptrtoint i8* %3 to i64
  %33 = add i64 %32, %5
  call void @nish_arena_release(i64 %33)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %36 = load i32, i32* %total.addr, align 4
  %37 = call i8* @nish_str_from_i32(i32 %36)
  ret i8* %37

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end mem-return-array -->

### A tail call, and the release ahead of it

`sum` ends with its recursive call, so the call carries `tail`: the callee is
handed two scalars and can reach nothing of this frame, which is what lets the
frame be popped before the jump. The release has to move for the same reason —
left where it was, between the call and the `ret`, it would be work after the
call, and a million levels would cost a million frames and hold a million
`item N` strings. `joinTo` is the counter-example, and the one that looks most
like it should qualify: its accumulator *is* arena memory above the mark, so
releasing first would hand the callee bytes the next bump reuses, and a `tail`
on that call would be a claim about a pointer the callee does hold. The rule
and its proof are in [wp6-memory.md](wp6-memory.md) §2b
(`tests/cases/mem_scope_tail_call`, `mem_scope_tail_call_guards`, and
`tests/link/tail_call_depth` / `tail_call_depth_debug` for the depth it
buys).

<!-- cookbook:begin mem-tail-release -->
```ts
// A tail call whose arguments are all scalars is the last thing its function
// does, and carries `tail` to say so: the callee is handed no pointer, so it
// can reach nothing of this frame and the frame may be popped before the jump.
// The scope release has to move for the same reason — left between the call
// and the `ret` it would be work after the call — so `@nish_arena_release` is
// emitted after the arguments and before the call instead.
const sum = (n: number, acc: number): number => {
  if (n === 0) {
    return acc
  }
  const label = `item ${n}`
  return sum(n - 1, acc + label.length)
}

// No temporaries, so no scope and nothing to move: here the marker is the
// whole of it, and it is what makes a deep recursion fit at `--profile debug`,
// where nothing rewrites the recursion into a loop.
const steps = (n: number, acc: number): number => {
  if (n === 0) {
    return acc
  }
  return steps(n - 1, acc + 1)
}

// Here the accumulator is arena memory the release would reclaim out from
// under the callee — and a pointer into this frame is exactly what the marker
// would be denying — so this one keeps its release after the call and carries
// no `tail`.
const joinTo = (n: number, text: string): number => {
  if (n === 0) {
    return text.length
  }
  return joinTo(n - 1, text + `${n}`)
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"item \00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

define internal noundef i32 @sum(i32 noundef %n, i32 noundef %acc) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %acc

if.end:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %1)
  store i8* %2, i8** %label.addr, align 8
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = load i8*, i8** %label.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %acc, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  %13 = tail call i32 @sum(i32 %4, i32 %11)
  ret i32 %13

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.end ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @steps(i32 noundef %n, i32 noundef %acc) #0 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 %acc

if.end:
  %1 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %acc, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %7 = tail call i32 @steps(i32 %2, i32 %5)
  ret i32 %7

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.end ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @joinTo(i32 noundef %n, i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = bitcast i8* %text to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %3

if.end:
  %4 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = call i8* @nish_str_from_i32(i32 %n)
  %8 = call i8* @nish_str_concat(i8* %text, i8* %7)
  %9 = call i32 @joinTo(i32 %5, i8* %8)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
```
<!-- cookbook:end mem-tail-release -->

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

<!-- cookbook:begin mem-reclaim -->
```ts
// A string builder cannot reclaim its own temporaries: the string it returns
// has to outlive it, so `join` gets no arena scope and every intermediate it
// made would live for the whole program. Its *caller* can reclaim them,
// because a call hands back exactly one value — so the call is bracketed by
// `nish_arena_mark` and `nish_arena_keep`, which moves the returned string
// down onto the mark and releases everything underneath it.
const piece = (i: number): string => `${i},`

const join = (n: number): string => {
  let s = ""
  for (let i = 0; i < n; i++) {
    s = s + piece(i)
  }
  return s
}

class Box {
  text: string
  constructor(text: string) {
    this.text = text
  }
}

// `fill` hands the string it built to an object its caller still holds, so
// what it allocated is not garbage and the call below carries no bracket.
const fill = (b: Box, i: number): string => {
  const s = `v${i}`
  b.text = s
  return s
}

const report = (b: Box, n: number): string => join(n) + fill(b, n)
```

```llvm
%struct.Box = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #1 {
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
```
<!-- cookbook:end mem-reclaim -->

### `Arena.mark` / `release` / `used` / `reset`

`Arena.release` and `Arena.reset` are deprecated (NL7001): a release to a
mark something allocated after it still references is undefined behaviour the
compiler does not check, and [`using a = arena()`](#using-a--arena) below is
the checked bracket that replaces them. The listing stays because a program
written before it still compiles to this.

The explicit builtins lower to one runtime call each. `measure` calls
`Arena.release` itself, so the compiler never wraps it in an automatic
scope (its own mark would be invalidated by the user's release); the
8000-byte `new Array<number>(2000)` is over the 4096-byte stack cap, so it
is an arena allocation that the release reclaims.

<!-- cookbook:begin mem-arena-builtins -->
```ts
const measure = (): i64 => {
  const m = Arena.mark()
  const xs = new Array<number>(2000) // 8000 bytes: over the 4096-byte stack cap, so arena
  const used = Arena.used()
  Arena.release(m)
  return used + toI64(xs.length)
}

const recycle = (): void => {
  Arena.reset()
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_reset_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_arena_used() #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  store i64 2000, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 2000, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = mul i64 2000, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  %8 = call i64 @nish_arena_used()
  store i64 %8, i64* %used.addr, align 8
  %9 = load i64, i64* %m.addr, align 8
  call void @nish_arena_release(i64 %9)
  %10 = load i64, i64* %used.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = sext i32 %14 to i64
  %16 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %10, i64 %15)
  %17 = extractvalue { i64, i1 } %16, 0
  %18 = extractvalue { i64, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @recycle() #1 {
entry:
  call void @nish_reset_arena()
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
```
<!-- cookbook:end mem-arena-builtins -->

### `using a = arena()`

A block that declares `using a = arena()` calls `nish_arena_mark` where the
declaration stands, keeps the answer in the binding's slot, and calls
`nish_arena_release` of it on every edge that leaves the block: here the
`break` and the fall-through before the back-edge. The checker has already
refused any block whose allocations could outlive it
([LANGUAGE.md](LANGUAGE.md#using-a--arena)), so nothing the release frees is
read again. It composes with the scopes the compiler adds itself, innermost
first: the loop's pass is scoped too, so each edge releases the block and then
rewinds the pass, and the function's own scope releases before the `ret`.

<!-- cookbook:begin mem-using-arena -->
```ts
const longest = (rows: i32, keep: string): string => {
  let best = 0
  for (let i = 0; i < rows; i++) {
    using a = arena()
    const label = `row ${i}`
    if (label.length > 8) {
      break
    }
    best = label.length > best ? label.length : best
  }
  return best > 4 ? keep : "short"
}
```

```llvm
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"row \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"short\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef nonnull align 8 i8* @longest(i32 noundef %rows, i8* noundef nonnull noalias readonly align 8 %keep) #0 {
entry:
  %best.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %label.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %best.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rows
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = call i64 @nish_arena_mark()
  store i64 %6, i64* %a.addr, align 8
  %7 = load i64, i64* %a.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %9)
  store i8* %10, i8** %label.addr, align 8
  %11 = load i8*, i8** %label.addr, align 8
  %12 = bitcast i8* %11 to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  %15 = icmp sgt i32 %14, 8
  br i1 %15, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %7)
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %3
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %3 to i64
  %21 = add i64 %20, %5
  call void @nish_arena_release(i64 %21)
  br label %pass.done

pass.done:
  br label %for.end

if.end:
  %22 = load i8*, i8** %label.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = load i32, i32* %best.addr, align 4
  %27 = icmp sgt i32 %25, %26
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  %28 = load i8*, i8** %label.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = trunc i64 %30 to i32
  br label %cond.end

cond.false:
  %32 = load i32, i32* %best.addr, align 4
  br label %cond.end

cond.end:
  %33 = phi i32 [ %31, %cond.true ], [ %32, %cond.false ]
  store i32 %33, i32* %best.addr, align 4
  call void @nish_arena_release(i64 %7)
  %34 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %35 = load i8*, i8** %34, align 8
  %36 = icmp eq i8* %35, %3
  br i1 %36, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %37, align 8
  br label %pass.done.1

pass.free.1:
  %38 = ptrtoint i8* %3 to i64
  %39 = add i64 %38, %5
  call void @nish_arena_release(i64 %39)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = load i32, i32* %best.addr, align 4
  %43 = icmp sgt i32 %42, 4
  br i1 %43, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %44 = phi i8* [ %keep, %cond.true.1 ], [ bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), %cond.false.1 ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i8* %44
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end mem-using-arena -->

### `T | null` and narrowing

A nullable value is the same pointer type as `T`; `null` is the constant
`null` and the tests are `icmp eq` / `icmp ne` against it. Narrowing costs
nothing at run time: inside the guarded region the checker simply reads the
variable as `T`. Nullable parameters and returns lose `nonnull` and
`dereferenceable` but keep `align 8`, `readonly`, and `nocapture` where the
usual rules allow them. A type may be parenthesised, and `(T | null)[]` is
where it matters: `T | null[]` groups the other way, so the parentheses are
what make the *element* nullable rather than the array.

<!-- cookbook:begin mem-nullable -->
```ts
class Node {
  value: number
  next: Node | null = null

  constructor(value: number) {
    this.value = value
  }
}

const valueOr = (n: Node | null, fallback: number): number => (n !== null ? n.value : fallback)

const sum = (head: Node | null): number => {
  let total = 0
  let cur: Node | null = head
  while (cur !== null) {
    total += cur.value
    cur = cur.next
  }
  return total
}

// `(Node | null)[]`, which is where a type needs its parentheses: `Node |
// null[]` would group the other way. The element loads as a nullable and
// narrows like any local once it is bound to one.
const firstValue = (slots: (Node | null)[]): number => {
  const head = slots[0]
  return head !== null ? head.value : 0
}
```

```llvm
%struct.Node = type { i32, %struct.Node* }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %total.addr, align 4
  %9 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %10 = getelementptr inbounds %struct.Node, %struct.Node* %9, i32 0, i32 1
  %11 = load %struct.Node*, %struct.Node** %10, align 8, !tbaa !5
  store %struct.Node* %11, %struct.Node** %cur.addr, align 8
  br label %while.cond

while.end:
  %12 = load i32, i32* %total.addr, align 4
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @firstValue(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots) #2 {
entry:
  %head.addr = alloca %struct.Node*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %5 = bitcast i8* %4 to %struct.Node**
  %6 = getelementptr inbounds %struct.Node*, %struct.Node** %5, i64 0
  %7 = load %struct.Node*, %struct.Node** %6, align 8, !alias.scope !11, !noalias !10, !tbaa !18
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
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

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
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !13, i64 16}
!17 = !{!"element ptr", !1, i64 0}
!18 = !{!17, !17, i64 0}
```
<!-- cookbook:end mem-nullable -->

## Builtins

### `Math.*` on `f64`

`Math.sqrt` is `llvm.sqrt.f64`; `Math.round` is the floor/compare/select
sequence that matches JavaScript's round-half-up; `Math.min`/`max` are
`llvm.minnum`/`maxnum`. All intrinsics are `readnone willreturn`, so the
callers stay pure.

<!-- cookbook:begin builtin-math-f64 -->
Compiled with `--number-mode f64`.

```ts
const hypot = (a: number, b: number): number => Math.sqrt(a * a + b * b)

const roundHalfUp = (x: number): number => Math.round(x)

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1)
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
<!-- cookbook:end builtin-math-f64 -->

### `Math.abs` / `min` / `max` on integers, `Math.PI`

<!-- cookbook:begin builtin-math-i32 -->
```ts
const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi)

const magnitude = (x: number): number => Math.abs(x)

const tau = (): f64 => Math.PI * 2
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
<!-- cookbook:end builtin-math-i32 -->

### `Math.clz32`

One `llvm.ctlz.i32` with `i1 false`, so a zero answers 32, as JavaScript's
does. The answer is an `integer<0, 32>`, which is why `31 - Math.clz32(...)`
in `lowestBit`, the index of a word's lowest set bit, is a plain `sub` with no
overflow check beside it.

<!-- cookbook:begin builtin-math-clz32 -->
```ts
const leadingZeros = (x: i32): i32 => Math.clz32(x)

const lowestBit = (word: u32): i32 => 31 - Math.clz32(word & (0 - word))
```

```llvm
declare i32 @llvm.ctlz.i32(i32, i1) #0

define internal noundef i32 @leadingZeros(i32 noundef %x) #0 {
entry:
  %0 = call i32 @llvm.ctlz.i32(i32 %x, i1 false)
  ret i32 %0
}

define internal noundef i32 @lowestBit(i32 noundef %word) #0 {
entry:
  %0 = sub i32 0, %word
  %1 = and i32 %word, %0
  %2 = call i32 @llvm.ctlz.i32(i32 %1, i1 false)
  %3 = sub nsw i32 31, %2
  ret i32 %3
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin-math-clz32 -->

### `toI32` / `toI64` / `toF64`

`sext`, `sitofp`, and the saturating `llvm.fptosi.sat` for `f64` to integer.

<!-- cookbook:begin builtin-conversions -->
```ts
const widen = (n: number): i64 => toI64(n)

const narrow = (x: f64): number => toI32(x)

const toDouble = (n: number): f64 => toF64(n)
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
<!-- cookbook:end builtin-conversions -->

### `ctSelect` and `ctEq`

Constant time (WP34 N6). Both are bitwise instructions and one empty inline
`asm` each, which hands the mask back in the same register and costs nothing,
but is opaque to every pass: `opt -O2` cannot tell that the mask is all-ones or
zero, so it has no `select` to rebuild and `llc` no branch to lower one to. The
call carries `readnone nounwind`, which is true of an empty string, so the
function stays `readnone`. `tests/run.js` reads the `-O2` assembly for x86-64
and aarch64 ([LANGUAGE.md](LANGUAGE.md#constant-time-ctselect-and-cteq)).

<!-- cookbook:begin builtin-ct -->
```ts
// WP34 N6: a secret select and a secret compare. The mask goes through an empty
// `asm` that LLVM cannot see into, so no pass can rebuild a `select` from it.
export const pick = (mask: u32, a: u32, b: u32): u32 => ctSelect(mask, a, b)

export const same = (a: u64, b: u64): u64 => ctEq(a, b)
```

```llvm
define noundef i32 @pick(i32 noundef %mask, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call i32 asm "", "=r,0"(i32 %mask) readnone nounwind
  %1 = and i32 %a, %0
  %2 = xor i32 %0, -1
  %3 = and i32 %b, %2
  %4 = or i32 %1, %3
  ret i32 %4
}

define noundef i64 @same(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = xor i64 %a, %b
  %1 = sub i64 0, %0
  %2 = or i64 %0, %1
  %3 = lshr i64 %2, 63
  %4 = sub i64 %3, 1
  %5 = call i64 asm "", "=r,0"(i64 %4) readnone nounwind
  ret i64 %5
}

attributes #0 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin-ct -->

### `secureZero`

A secret cleared once it is used (#385). One call into `runtime/runtime.c`,
declared as `nish_random_fill` is but `willreturn`: the array is written
through, so the parameter is `nocapture` without `readonly`, and the
declaration has no memory attribute that would let LLVM call it a dead store
when nothing reads the array again, which is every time. Inside, `nish_wipe`
stores each byte through a `volatile` pointer and is `noinline`, so neither
`-O2` nor `-flto`, which can see its body, may drop the stores; the LTO probe in
`tests/runtime-test.c` shows a `memset` wipe in the same place dropped
([LANGUAGE.md](LANGUAGE.md#wiping-a-secret-securezero)).

<!-- cookbook:begin builtin-wipe -->
```ts
// #385: a key cleared once it is used. `secureZero` is one call into runtime.c,
// whose stores are `volatile`, so no pass drops them although nothing reads
// `key` again. The array is written through, so `nocapture` without `readonly`.
export const forget = (key: u8[]): void => {
  secureZero(key)
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_wipe(%struct.nish_array* noundef nonnull align 8 nocapture) #0

define void @forget(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %key) #0 {
entry:
  call void @nish_wipe(%struct.nish_array* %key)
  ret void
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end builtin-wipe -->

### `lstatOwnerModeSync`, `geteuid` and `isExecutableSync`

The owner checks (#386), what a driver asks before it trusts a directory or a
program it found on its own. Each is one call into `runtime/runtime-host.c`,
declared `nounwind willreturn` and ordered with every other write, as
`nish_stat_mtime` is: `lstat` and `access` read the file system, which is not
memory LLVM tracks, and a failure stores `errno`. The owner and the mode come
back packed in one `i64` from one `lstat`, so the two always describe the same
file ([LANGUAGE.md](LANGUAGE.md#who-owns-a-path-lstatownermodesync-geteuid-and-isexecutablesync)).

<!-- cookbook:begin builtin-owner -->
```ts
// #386: who owns a path, and whether it runs. Each is one call into
// runtime-host.c, ordered with the file system as `statMtimeSync` is. A root is
// trusted when this user owns it and no one else may write to it: the owner in
// the high 32 bits of one `lstat`, masked after the shift because a uid of 2^31
// or more fills the sign bit, and the group and other write bits, 0o022, clear
// in the low ones.
export const trusted = (root: string): boolean => {
  const om = lstatOwnerModeSync(root)
  return om !== -1 && ((om >> 32) & 0xffffffff) === geteuid() && (om & 18) === 0
}

export const runs = (program: string): boolean => isExecutableSync(program)
```

```llvm
declare i64 @nish_lstat_owner_mode(i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_euid() #0
declare zeroext i1 @nish_is_executable(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef zeroext i1 @trusted(i8* noundef nonnull noalias readonly align 8 nocapture %root) #0 {
entry:
  %om.addr = alloca i64, align 8
  %0 = call i64 @nish_lstat_owner_mode(i8* %root)
  store i64 %0, i64* %om.addr, align 8
  %1 = load i64, i64* %om.addr, align 8
  %2 = icmp ne i64 %1, -1
  br i1 %2, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %3 = load i64, i64* %om.addr, align 8
  %4 = ashr i64 %3, 32
  %5 = and i64 %4, 4294967295
  %6 = call i64 @nish_euid()
  %7 = icmp eq i64 %5, %6
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i64, i64* %om.addr, align 8
  %10 = and i64 %9, 18
  %11 = icmp eq i64 %10, 0
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  ret i1 %12
}

define noundef zeroext i1 @runs(i8* noundef nonnull noalias readonly align 8 nocapture %program) #0 {
entry:
  %0 = call zeroext i1 @nish_is_executable(i8* %program)
  ret i1 %0
}

attributes #0 = { nounwind willreturn }
```
<!-- cookbook:end builtin-owner -->

### `nish:secret`: `secret`, `expose` and `wipe`

A `Secret<u8[]>` is `std/secret.ts`'s generic class, laid out as any class is:
one pointer to the array. `secret`, `expose` and `wipe` are instances of that
module's templates, emitted `internal` into the module that uses them. `expose`
is a direct call of the function it was given, and `wipe` is one volatile
`llvm.memset` (`i1 true`) over the array's capacity, which no pass may remove
however dead the bytes are; its parameter is not `readonly`, because the empty
body the source gives it is not what runs
([LANGUAGE.md](LANGUAGE.md#secrets-nishsecret)).

<!-- cookbook:begin builtin-secret -->
```ts
// `nish:secret`: a key wrapped, read through `expose`, and wiped. The instance
// of `wipe` is one `llvm.memset` with its volatile flag set, over the array's
// whole capacity, and it is copied into this module rather than linked from
// `std/secret.ts`, which writes no `.ll` of its own.
import { Secret, expose, secret, wipe } from "nish:secret"

const width = (k: u8[]): i32 => toI32(k.length)

export const useKey = (n: i32): i32 => {
  const k: Secret<u8[]> = secret(new Array<u8>(n))
  const w: i32 = expose(k, width)
  wipe(k)
  return w
}
```

```llvm
%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define hidden noundef i32 @width(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define noundef i32 @useKey(i32 noundef %n) #1 {
entry:
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %w.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 %0)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %0, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %3)
  store %struct.Secret$arr.u8* %8, %struct.Secret$arr.u8** %k.addr, align 8
  %9 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %10 = call i32 @nish.expose$arr.u8$i32$fn.5.width(%struct.Secret$arr.u8* %9)
  store i32 %10, i32* %w.addr, align 4
  %11 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %11)
  %12 = load i32, i32* %w.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %12
}

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !15
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u8*
  call void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u8* %1
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.5.width(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = call i32 @width(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %3, i1 true)
  ret void
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { noreturn nounwind }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Secret$arr.u8", !13, i64 0}
!15 = !{!14, !13, i64 0}
```
<!-- cookbook:end builtin-secret -->

### `Date.now`, `crypto.getRandomValues`, `statMtimeSync`, `signalFd` and `readSignal`

The host (WP34 N3). Each is one call into `runtime/runtime-host.c`, declared
with the effect of what it does to the world rather than to memory: none of
them is `readnone`, so two clock reads or two `stat`s around a piece of work
never fold into one. The array `crypto.getRandomValues` fills is written
through, so the parameter it arrives in is `nocapture` without `readonly`, and
neither `nish_random_fill` nor `nish_read_signal` is `willreturn`: the first
waits for the kernel's entropy pool to be seeded, the second can wait forever
([LANGUAGE.md](LANGUAGE.md#the-host-the-wall-clock-entropy-file-times-and-signals)).

<!-- cookbook:begin builtin-host-facts -->
```ts
// WP34 N3: the four host facts. Each is one call into runtime-host.c; the array
// `getRandomValues` fills is written, so `key` is `nocapture` but not
// `readonly`, and neither the fill nor `readSignal` is `willreturn`: one waits
// for the kernel's pool to be seeded, the other for a signal.
export const stamp = (): f64 => Date.now()

export const rekey = (key: u8[]): void => {
  crypto.getRandomValues(key)
}

export const renewed = (path: string, since: f64): boolean => statMtimeSync(path) > since

export const nextSignal = (): i32 => readSignal(signalFd())
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare double @nish_date_now() #0
declare void @nish_random_fill(%struct.nish_array* noundef nonnull align 8 nocapture) #1
declare double @nish_stat_mtime(i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_signal_fd() #0
declare noundef i32 @nish_read_signal(i32 noundef) #1

define noundef double @stamp() #0 {
entry:
  %0 = call double @nish_date_now()
  ret double %0
}

define void @rekey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %key) #1 {
entry:
  call void @nish_random_fill(%struct.nish_array* %key)
  ret void
}

define noundef zeroext i1 @renewed(i8* noundef nonnull noalias readonly align 8 nocapture %path, double noundef %since) #0 {
entry:
  %0 = call double @nish_stat_mtime(i8* %path)
  %1 = fcmp ogt double %0, %since
  ret i1 %1
}

define noundef i32 @nextSignal() #1 {
entry:
  %0 = call i32 @nish_signal_fd()
  %1 = call i32 @nish_read_signal(i32 %0)
  ret i32 %1
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```
<!-- cookbook:end builtin-host-facts -->

### `nish:net`: `tcpListen`, `netRead` and `netWrite`

Sockets (WP34 N5). Each function is one call into `runtime/runtime-net.c`
answering an `i32`, a negative errno on failure, and every one is a write: it
changes the kernel's state of a socket, so no two calls fold into one. A buffer
travels as its array header. `netRead` and `netWrite` check `0 <= off <= off +
len <= buf.length` before the call with the `slice` check `dst.set` uses, which
is the `net.fail` block and its `noreturn` panic; `--unchecked-indexing`
removes both. The buffer `netRead` fills keeps `nocapture` and loses
`readonly`, and neither call is `willreturn`, because a blocking socket the
program inherited can wait
([LANGUAGE.md](LANGUAGE.md#nishnet-addresses-non-blocking-tcp-and-udp-and-the-readiness-loop)).

<!-- cookbook:begin builtin-net -->
```ts
// WP34 N5: `nish:net`. Each call is one call into runtime-net.c answering an
// `i32`; `netRead` checks its range in the IR first, through the slice panic,
// and the buffer it fills is `nocapture` but not `readonly`. `netWrite`'s is
// `readonly`. Neither is `willreturn`: a blocking socket the program inherited
// can wait.
import { netRead, netWrite, tcpListen } from "nish:net"

export const listen = (port: i32): i32 => tcpListen("::", port, 128)

export const echoOnce = (fd: i32, buf: u8[]): i32 => {
  const n = netRead(fd, buf, 0, buf.length)
  return n > 0 ? netWrite(fd, buf, 0, n) : n
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"::\00" }, align 8

declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #1
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define noundef i32 @listen(i32 noundef %port) #0 {
entry:
  %0 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i32 %port, i32 128)
  ret i32 %0
}

define noundef i32 @echoOnce(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = add i64 0, %3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ule i64 0, %4
  %8 = icmp ule i64 %4, %6
  %9 = and i1 %7, %8
  br i1 %9, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %4, i64 %6)
  unreachable

net.ok:
  %10 = call i32 @nish_net_read(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %3)
  store i32 %10, i32* %n.addr, align 4
  %11 = load i32, i32* %n.addr, align 4
  %12 = icmp sgt i32 %11, 0
  br i1 %12, label %cond.true, label %cond.false

cond.true:
  %13 = load i32, i32* %n.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = add i64 0, %14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %17 = load i64, i64* %16, align 8
  %18 = icmp ule i64 0, %15
  %19 = icmp ule i64 %15, %17
  %20 = and i1 %18, %19
  br i1 %20, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %15, i64 %17)
  unreachable

net.ok.1:
  %21 = call i32 @nish_net_write(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %14)
  br label %cond.end

cond.false:
  %22 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %23 = phi i32 [ %21, %net.ok.1 ], [ %22, %cond.false ]
  ret i32 %23
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
```
<!-- cookbook:end builtin-net -->

### `nish:net`: `udpBind`, `udpSendTo` and `udpRecvFrom`

UDP (WP34 N5), the same shape as TCP's calls: one call into
`runtime/runtime-net.c` each, answering an `i32`, and each a write. `udpBind`
creates, configures and binds a socket, none of which waits, so it keeps
`willreturn`; `udpSendTo` and `udpRecvFrom` are one `sendmsg` and one `recvmsg`,
which wait on a blocking socket, so they are `nounwind` alone. The range check
covers the buffer before the first offset, as `netRead`'s does, and `meta`, an
`i32[]`, travels as its header like every buffer. Echoing `meta[0]` back as the
segment size re-segments a GRO-coalesced receive on the way out, and `meta[1]`
reflects the ECN bits it arrived with
([LANGUAGE.md](LANGUAGE.md#udp)).

<!-- cookbook:begin builtin-net-udp -->
```ts
// WP34 N5: UDP in `nish:net`. `udpRecvFrom` checks its range in the IR first,
// through the slice panic, and every array it fills (the datagram, `from` and
// `meta`) is `nocapture` but not `readonly`; `udpSendTo`'s buffer and address
// are `readonly`. `udpBind` is `willreturn`, and neither of the other two is:
// a blocking socket the program inherited can wait.
import { udpBind, udpRecvFrom, udpSendTo } from "nish:net"

export const bind = (port: i32): i32 => udpBind("::", port, 2)

export const echoOnce = (fd: i32, buf: u8[], from: u8[], meta: i32[]): i32 => {
  const n = udpRecvFrom(fd, buf, 0, buf.length, from, meta)
  return n > 0 ? udpSendTo(fd, buf, 0, n, from, meta[0], meta[1]) : n
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"::\00" }, align 8

declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define noundef i32 @bind(i32 noundef %port) #0 {
entry:
  %0 = call i32 @nish_udp_bind(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i32 %port, i32 2)
  ret i32 %0
}

define noundef i32 @echoOnce(i32 noundef %fd, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %buf, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %from, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %meta) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = add i64 0, %3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ule i64 0, %4
  %8 = icmp ule i64 %4, %6
  %9 = and i1 %7, %8
  br i1 %9, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %4, i64 %6)
  unreachable

net.ok:
  %10 = call i32 @nish_udp_recv_from(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %3, %struct.nish_array* %from, %struct.nish_array* %meta)
  store i32 %10, i32* %n.addr, align 4
  %11 = load i32, i32* %n.addr, align 4
  %12 = icmp sgt i32 %11, 0
  br i1 %12, label %cond.true, label %cond.false

cond.true:
  %13 = load i32, i32* %n.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %meta, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %meta, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %meta, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = icmp ult i64 1, %24
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %24)
  unreachable

bounds.ok.1:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %meta, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 1
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %31 = add i64 0, %14
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %33 = load i64, i64* %32, align 8
  %34 = icmp ule i64 0, %31
  %35 = icmp ule i64 %31, %33
  %36 = and i1 %34, %35
  br i1 %36, label %net.ok.1, label %net.fail.1

net.fail.1:
  call void @nish_panic_slice(i64 0, i64 %31, i64 %33)
  unreachable

net.ok.1:
  %37 = call i32 @nish_udp_send_to(i32 %fd, %struct.nish_array* %buf, i64 0, i64 %14, %struct.nish_array* %from, i32 %22, i32 %30)
  br label %cond.end

cond.false:
  %38 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %39 = phi i32 [ %37, %net.ok.1 ], [ %38, %cond.false ]
  ret i32 %39
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end builtin-net-udp -->

### `nish:net`: `pollCreate`, `pollAdd` and `pollWait`

The readiness loop (WP34 N5), one call into `runtime/runtime-net.c` each,
answering an `i32` and each a write. `pollCreate`, `pollAdd`, `pollModify` and
`pollRemove` make a loop or change what it watches, and none of them waits, so
they keep `willreturn`. `pollWait` waits as long as its timeout says, forever
for a negative one, so it is `nounwind` alone, and the `ready` array it fills
with token and event pairs travels as its header and loses `readonly`. There is
no range check: the runtime fills at most `ready.length / 2` pairs and answers
`-22` for a `ready` shorter than 2
([LANGUAGE.md](LANGUAGE.md#the-readiness-loop)).

<!-- cookbook:begin builtin-net-loop -->
```ts
// WP34 N5: the readiness loop in `nish:net`. `pollCreate`, `pollAdd` and the
// rest that change what a loop watches never wait, so they keep `willreturn`;
// `pollWait` can wait forever and is `nounwind` alone. Its `ready` is an
// `i32[]` it fills, so it travels as its header, `nocapture` but not
// `readonly`.
import { pollAdd, pollCreate, pollWait } from "nish:net"

export const watch = (fd: i32, token: i32): i32 => {
  const loop = pollCreate()
  if (loop < 0) {
    return loop
  }
  return pollAdd(loop, fd, 1, token) === 0 ? loop : -1
}

export const firstReady = (loop: i32, ready: i32[]): i32 => (pollWait(loop, ready, 100) > 0 ? ready[0] : -1)
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare noundef i32 @nish_poll_create() #0
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @watch(i32 noundef %fd, i32 noundef %token) #0 {
entry:
  %loop.addr = alloca i32, align 4
  %0 = call i32 @nish_poll_create()
  store i32 %0, i32* %loop.addr, align 4
  %1 = load i32, i32* %loop.addr, align 4
  %2 = icmp slt i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i32, i32* %loop.addr, align 4
  ret i32 %3

if.end:
  %4 = load i32, i32* %loop.addr, align 4
  %5 = call i32 @nish_poll_add(i32 %4, i32 %fd, i32 1, i32 %token)
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %loop.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ %7, %cond.true ], [ -1, %cond.false ]
  ret i32 %8
}

define noundef i32 @firstReady(i32 noundef %loop, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ready) #1 {
entry:
  %0 = call i32 @nish_poll_wait(i32 %loop, %struct.nish_array* %ready, i32 100)
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ready, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ready, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ %9, %bounds.ok ], [ -1, %cond.false ]
  ret i32 %10
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
```
<!-- cookbook:end builtin-net-loop -->

### `Math.random`

`nish_random` mutates global state (effect `write`), so `coin` is not pure.

<!-- cookbook:begin builtin-random -->
```ts
const coin = (): boolean => Math.random() < 0.5
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
<!-- cookbook:end builtin-random -->

### Streams, `readFileSyncOrNull` and `panic`

`console.error` and the newline-free writes are one `nish_write(s, fd,
newline)`; `console.log` keeps its own one-argument `nish_print`. `panic` needs
no runtime function of its own — the message goes through `nish_write` and the
`noreturn` `nish_exit` closes the block, which is what lets `load` end without
a `ret` on that path. `readFileSyncOrNull` returns a pointer that may be
`null`, so the checker makes the caller narrow it before it can be read.

<!-- cookbook:begin builtin-streams -->
```ts
const report = (problem: string): void => {
  console.error(problem)
  write("progress: ")
  writeError(problem)
}

const load = (path: string): number => {
  const text = readFileSyncOrNull(path)
  if (text === null) {
    panic(`cannot read ${path}`)
  } else {
    return text.length
  }
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"progress: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"cannot read \00" }, align 8

declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_exit(i32 noundef) #2
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #1

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
<!-- cookbook:end builtin-streams -->

### File I/O

<!-- cookbook:begin builtin-files -->
```ts
export const main = (): number => {
  writeFileSync("out.txt", "hello\n")
  appendFileSync("out.txt", "world\n")
  const text = readFileSync("out.txt")
  console.log(text.length)
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"out.txt\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"hello\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"world\0A\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end builtin-files -->

### Directories and subprocesses

`mkdirSync` answers a `boolean` and `spawnSync` an exit status, so the failure
is a value the program branches on rather than an exit inside the runtime.
Note what the escape analysis makes of the vector: `argv` is handed to
`nish_spawn`, which keeps pointers into it, so the literal stays in the arena
and `nish_main` gets no arena scope and no `willreturn`.

<!-- cookbook:begin builtin-process -->
```ts
export const main = (): number => {
  if (!mkdirSync("build/out")) {
    panic("cannot create build/out")
  }
  const argv: string[] = ["bash", "scripts/build.sh", "app.ll"]
  return spawnSync(argv)
}
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
  store i64 3, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 3, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to i8**
  %9 = getelementptr inbounds i8*, i8** %8, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %8, i64 1
  store i8* bitcast ({ i64, [17 x i8] }* @.str.3 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8*, i8** %8, i64 2
  store i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end builtin-process -->

### What machine this is

`process.platform` and `process.arch` are one call each into the runtime,
which answers the address of a string in its own constant data — no
allocation, no load, and `readnone` on both declarations, so a function built
from them alone stays pure and two reads of one property fold into one.
`isDirectorySync` is the `stat` beside them: the question `-o <dir>` asks, as a
`boolean`, which is why the snippet below can ask it before it asks for the
directory to be made. `--target host` maps the same pair of strings to a triple
(`hostTriple` in `src/target.ts`).

<!-- cookbook:begin builtin-host -->
```ts
export const main = (): number => {
  const out = "build/out"
  if (!isDirectorySync(out) && !mkdirSync(out)) {
    panic(`cannot create ${out}`)
  }
  console.log(`${process.platform} ${process.arch}`)
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"build/out\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"cannot create \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
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
<!-- cookbook:end builtin-host -->

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

<!-- cookbook:begin builtin-driver -->
```ts
export const main = (): number => {
  const cases = readdirSync("tests/cases")
  if (cases === null) {
    panic("cannot list tests/cases")
  }
  const started = monotonicNanos()
  const status = spawnSyncTo(["sh", "-c", "echo hello"], "build/out.txt", "")
  console.log(`${cases.length} cases, status ${status}, ${monotonicNanos() - started} ns`)
  return 0
}
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
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare i64 @nish_monotonic_nanos() #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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
  store i64 3, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 3, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %8 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8*, i8** %10, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*), i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i8*, i8** %10, i64 2
  store i8* bitcast ({ i64, [11 x i8] }* @.str.4 to i8*), i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = call i32 @nish_spawn_to(%struct.nish_array* %5, i8* bitcast ({ i64, [14 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.6 to i8*))
  store i32 %14, i32* %status.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %cases.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [16 x i8] }* @.str.7 to i8*))
  %21 = load i32, i32* %status.addr, align 4
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %20, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*))
  %25 = call i64 @nish_monotonic_nanos()
  %26 = load i64, i64* %started.addr, align 8
  %27 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %25, i64 %26)
  %28 = extractvalue { i64, i1 } %27, 0
  %29 = extractvalue { i64, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok

ovf.ok:
  %30 = call i8* @nish_str_from_i64(i64 %28)
  %31 = call i8* @nish_str_concat(i8* %24, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*))
  call void @nish_print(i8* %32)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
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
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
```
<!-- cookbook:end builtin-driver -->

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

<!-- cookbook:begin builtin-env -->
```ts
export const main = (): number => {
  const cc = getenv("CC")
  const compiler = cc === null ? "clang" : cc
  console.log(`building with ${compiler}`)
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"CC\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"clang\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"building with \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #1

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

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
```
<!-- cookbook:end builtin-env -->

### Resolving a path

`realpathSync` is the only path resolution the language has, and the lowering
is the same shape as `getenv` above: one call answering an `i8*` that may be
null, which the `T | null` narrowing reads with an ordinary `icmp eq ... null`.
No tag, no unwrapping, and the `here === null ? "." : here` below is how a
default is written — which is why the builtin takes no second argument.

The declaration is `noalias` for `getenv`'s reason, that every call answers a
fresh arena copy rather than one constant, and it is not `readnone`: it
allocates, and the filesystem is not memory LLVM is tracking, so a resolution
must not fold across a `mkdirSync` that could create the very component being
resolved.

**What it is for.** A compiler finds `scripts/build.sh` and `std/` relative to
its own `argv[0]`, and `argv[0]` is a symbolic link whenever the binary reached
`$PATH` the ordinary way — `ln -s /opt/nish/bin/nish /usr/local/bin/nish`, or
npm, which links every command as `node_modules/.bin/<name>`. Without this the
directory `argv[0]` names is the link's rather than the package's
(`docs/wp19-stage0-retirement.md` §5a item 4).

<!-- cookbook:begin builtin-realpath -->
```ts
export const main = (): number => {
  const here = realpathSync(".")
  const root = here === null ? "." : here
  console.log(`resolved to ${root}`)
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"resolved to \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef align 8 i8* @nish_realpath(i8* noundef nonnull readonly align 8 nocapture) #1

define noundef i32 @nish_main() #0 {
entry:
  %here.addr = alloca i8*, align 8
  %root.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_realpath(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  store i8* %0, i8** %here.addr, align 8
  %1 = load i8*, i8** %here.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %3 = load i8*, i8** %here.addr, align 8
  br label %cond.end

cond.end:
  %4 = phi i8* [ bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), %cond.true ], [ %3, %cond.false ]
  store i8* %4, i8** %root.addr, align 8
  %5 = load i8*, i8** %root.addr, align 8
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.1 to i8*), i8* %5)
  call void @nish_print(i8* %6)
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
```
<!-- cookbook:end builtin-realpath -->

### `readFileBytesSync`

One call, `nish_read_file_bytes`, answers the array header or null, which is the
language's `u8[] | null` as it is. The runtime reads the file through the same
path as `readFileSyncOrNull` and hands the bytes it put in the arena to a fresh
header with `len == cap`, so nothing is copied twice and nothing assumes UTF-8.
The declaration is `noalias` without `nonnull`, like `nish_readdir`'s, and the
call is not `readnone`: it allocates, and the file is not memory LLVM tracks.

<!-- cookbook:begin builtin-read-bytes -->
```ts
export const keyLength = (path: string): number => {
  const der = readFileBytesSync(path)
  if (der === null) {
    return -1
  }
  return der.length
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias align 8 %struct.nish_array* @nish_read_file_bytes(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @keyLength(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %der.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish_read_file_bytes(i8* %path)
  store %struct.nish_array* %0, %struct.nish_array** %der.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %der.addr, align 8
  %2 = icmp eq %struct.nish_array* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1

if.end:
  %3 = load %struct.nish_array*, %struct.nish_array** %der.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %6
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
```
<!-- cookbook:end builtin-read-bytes -->

### Capabilities: a report, not a lowering

Every builtin carries one capability label (`docs/LANGUAGE.md` ->
Capabilities), and the attribute pass carries the labels up the call graph
with a witness chain for each — but nothing in the IR reads them. The listing
below is the same with `--emit-capabilities` and without it, and `tests/run.js`
compiles every `caps_*` case both ways to hold that. `load` is `readFileSync`
under another name, and `lineCount` and `main` reach it through one and two
calls; what the flag adds is this file, written beside the IR. Each function
also lists its `"panics"` — here the `io-exit` that `readFileSync` is, reached
through the same calls — the sites `--emit-panics` writes:

<!-- capabilities-report builtin-capabilities -->
```json
{
  "version": 1,
  "entry": "builtin-capabilities.ts",
  "deterministic": false,
  "capabilities": ["fs.read"],
  "packages": [
    {
      "name": "<root>",
      "capabilities": ["fs.read"],
      "modules": [
        {
          "path": "builtin-capabilities.ts",
          "capabilities": ["fs.read"],
          "functions": [
            {
              "name": "lineCount",
              "exported": true,
              "capabilities": ["fs.read"],
              "witnesses": {
                "fs.read": [
                  { "function": "lineCount", "at": "builtin-capabilities.ts:4:16", "calls": "load" },
                  { "function": "load", "at": "builtin-capabilities.ts:1:40", "calls": "readFileSync" }
                ]
              },
              "panics": [
                { "kind": "call", "at": "builtin-capabilities.ts:4:16", "callee": "load", "via": "io-exit" },
                { "kind": "overflow", "at": "builtin-capabilities.ts:6:36", "proven": true },
                { "kind": "index", "at": "builtin-capabilities.ts:7:9", "proven": true },
                { "kind": "overflow", "at": "builtin-capabilities.ts:8:15", "proven": false }
              ]
            },
            {
              "name": "main",
              "exported": true,
              "capabilities": ["fs.read"],
              "witnesses": {
                "fs.read": [
                  { "function": "main", "at": "builtin-capabilities.ts:15:15", "calls": "lineCount" },
                  { "function": "lineCount", "at": "builtin-capabilities.ts:4:16", "calls": "load" },
                  { "function": "load", "at": "builtin-capabilities.ts:1:40", "calls": "readFileSync" }
                ]
              },
              "panics": [
                { "kind": "oom", "at": "builtin-capabilities.ts:15:3", "allowed": true },
                { "kind": "call", "at": "builtin-capabilities.ts:15:15", "callee": "lineCount", "via": "io-exit" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

The chains are the shortest ones, ties broken by the earlier call in the
source, and every path is relative to the entry's directory, so the file is
byte-stable: `tests/run.js` compiles this snippet with the flag and compares
the block above with what it writes. `load` is not listed on its own, because
only what is exported is; it appears where a chain passes through it.

<!-- cookbook:begin builtin-capabilities -->
```ts
const load = (path: string): string => readFileSync(path)

export const lineCount = (path: string): i32 => {
  const text = load(path)
  let lines = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      lines = lines + 1
    }
  }
  return lines
}

export const main = (): number => {
  console.log(lineCount("settings.txt"))
  return 0
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"settings.txt\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef nonnull align 8 i8* @load(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %0 = call i8* @nish_read_file(i8* %path)
  ret i8* %0
}

define noundef i32 @lineCount(i8* noundef nonnull noalias readonly align 8 %path) #0 {
entry:
  %text.addr = alloca i8*, align 8
  %lines.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @load(i8* %path)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %text.addr, align 8
  store i32 0, i32* %lines.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i8*, i8** %text.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = icmp slt i32 %3, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i8*, i8** %text.addr, align 8
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds i8, i8* %9, i64 8
  %13 = getelementptr inbounds i8, i8* %12, i64 %11
  %14 = load i8, i8* %13, align 1
  %15 = zext i8 %14 to i32
  %16 = icmp eq i32 %15, 10
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = load i32, i32* %lines.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 1)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %lines.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %23 = load i32, i32* %lines.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @lineCount(i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
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
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
```
<!-- cookbook:end builtin-capabilities -->

### A capability policy: a refusal, not a lowering

`--allow` and `--deny`, and the root package's `"nish".capabilities`, judge
the capabilities above and change no byte of the IR (`docs/LANGUAGE.md` ->
Capabilities -> The capability policy). Compiled with `--allow fs.read` the
snippet above is the listing above, byte for byte; compiled with
`--deny fs.read` there is no listing at all, only this, spanned at `main`'s
first call of the witness chain (`main` is judged first, before the export
`lineCount`, which reaches `fs.read` too) and naming the rest of it the way the report
does:

<!-- capabilities-refusal builtin-capabilities -->
```text
docs/cookbook/builtin-capabilities.ts:15:15: error: `main` reaches `fs.read`, which the capability policy does not grant (`--deny fs.read`); the chain that reaches it: builtin-capabilities.ts:15:15 calls lineCount, builtin-capabilities.ts:4:16 calls load, builtin-capabilities.ts:1:40 calls readFileSync
  15 |   console.log(lineCount("settings.txt"))
     |               ^~~~~~~~~~~~~~~~~~~~~~~~~
```

`tests/run.js` compiles the snippet both ways and holds the block above to
what the compiler prints and the granted IR to the ungranted one.

### Builtin modules (`nish:`)

An import from `nish:fs` / `nish:process` / `nish:io` renames a builtin rather
than introducing one, so there is nothing here that the global spelling does
not also emit: no `declare` for the import, no symbol, no call through a
module. `writeFileSync` is `@nish_write_file` either way, and `argv` is the
same load of `@nish_argv`. What the import buys is at the name, not in the IR —
a user function called `write` collides with it instead of silently replacing
it (`docs/LANGUAGE.md` -> Builtin modules).

<!-- cookbook:begin builtin-nish-modules -->
```ts
import { readFileSync, writeFileSync } from "nish:fs"
import { argv } from "nish:process"
import { write } from "nish:io"

export const main = (): number => {
  writeFileSync("build/cookbook/out.txt", `${argv.length}\n`)
  write(readFileSync("build/cookbook/out.txt"))
  return 0
}
```

```llvm
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"build/cookbook/out.txt\00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\0A\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  call void @nish_write_file(i8* bitcast ({ i64, [23 x i8] }* @.str.0 to i8*), i8* %5)
  %6 = call i8* @nish_read_file(i8* bitcast ({ i64, [23 x i8] }* @.str.0 to i8*))
  call void @nish_write(i8* %6, i32 1, i1 false)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
```
<!-- cookbook:end builtin-nish-modules -->

## Optimisation flags

### Integer overflow: checked by default, `nsw` where proven

Every user-level **signed** integer `add`, `sub`, and `mul` (binary operators,
unary minus, `op=`, `++`/`--`) that the bounds walk has not proven to fit is
checked: `llvm.s{add,sub,mul}.with.overflow` computes the result and a flag,
and the flag branches to the function's cold `ovf.fail` block, which calls
`nish_panic_overflow` and exits 1 with `attempt to add with overflow`
([Semantics decisions](LANGUAGE.md#semantics-decisions)). One that is proven
to fit is the plain instruction with `nsw`, the flag restating the proof
([Checked signed arithmetic](#checked-signed-arithmetic)); the deprecated
`--wrapping` makes the entry package's operators plain, neither flagged nor
checked. Division and remainder have no `nsw` form, the compiler's own
index and length arithmetic is never flagged, and an **unsigned** type is never
flagged at all — `u8`..`u64` are defined as wrapping, which is what hashing and
bit-packing are written against. A negated integer *literal* is no instruction
at all: `-1`, `-(1)` and `-2147483648` are emitted as the constants they spell,
wrapped to the type's width, so `sub nsw i32 0, -2147483648` — poison, since
negating `INT_MIN` overflows — is never written
(`tests/cases/neg_literal_int_min_hex`, `neg_literal_i64_min`,
`neg_literal_unsigned`). This is the default, so the snippet below is compiled
with no flags; nothing bounds `x` and `y`, so all five operations are checked.

<!-- cookbook:begin opt-nsw -->
```ts
const poly = (x: number, y: number): number => x * x - 3 * y + -x
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @poly(i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 %x)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %y)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 %4)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %9 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %x)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %10)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %13

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %ovf.ok ], [ 1, %ovf.ok.1 ], [ 3, %ovf.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end opt-nsw -->

A wrap the program means is a call: `wrappingAdd`, `wrappingSub` and
`wrappingMul` from `nish:unsafe` are the same instruction with no flag,
whatever the command line says, so `wrappingAdd(2147483647, 1)` is
`-2147483648`. It is what a hash, a linear congruential generator or a
wrap-around counter needs. Beside it, the same step written with operators
is checked, and panics where the hash would have wrapped:

<!-- cookbook:begin unsafe-wrapping -->
```ts
import { wrappingAdd, wrappingMul } from "nish:unsafe"

const hashStep = (h: i32, c: i32): i32 => wrappingAdd(wrappingMul(h, 31), c)

const plainStep = (h: i32, c: i32): i32 => h * 31 + c

export const both = (h: i32, c: i32): i32 => hashStep(h, c) ^ plainStep(h, c)
```

```llvm
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

define internal noundef i32 @hashStep(i32 noundef %h, i32 noundef %c) #0 {
entry:
  %0 = mul i32 %h, 31
  %1 = add i32 %0, %c
  ret i32 %1
}

define internal noundef i32 @plainStep(i32 noundef %h, i32 noundef %c) #1 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %h, i32 31)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %c)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %4

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @both(i32 noundef %h, i32 noundef %c) #1 {
entry:
  %0 = call i32 @hashStep(i32 %h, i32 %c)
  %1 = call i32 @plainStep(i32 %h, i32 %c)
  %2 = xor i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
```
<!-- cookbook:end unsafe-wrapping -->

The deprecated `--wrapping` makes every operator of the entry package's
modules (never a dependency's or a `nish/` module's) the plain instruction,
neither flagged nor checked, and prints NL9015; the same source, one flag, and
no `nsw` or overflow check anywhere:

<!-- cookbook:begin opt-wrapping -->
Compiled with `--wrapping`.

```ts
const poly = (x: number, y: number): number => x * x - 3 * y + -x
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
<!-- cookbook:end opt-wrapping -->

A module constant follows the same rule, because a fold has to agree with the
instruction it replaces: `const OVER: i32 = 2147483647 + 1` is
`` attempt to compute with overflow in a constant `` by default, and
`-2147483648` under `--wrapping`; `const OVER: i32 = wrappingAdd(2147483647, 1)`
folds to `-2147483648` in every build.

### `--target`

The module carries `target datalayout` and `target triple` (the strings
clang 18 emits for that triple), so `opt -O2 -S` and `llc` see the real
pointer size, alignments, and vector width without `-mtriple`. Without the
flag the module is target-neutral and clang fills both in at link time.
`--target host` picks the running machine's triple.

<!-- cookbook:begin opt-target -->
Compiled with `--target x86_64-unknown-linux-gnu`.

```ts
const add = (a: number, b: number): number => a + b
```

```llvm
target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"
target triple = "x86_64-unknown-linux-gnu"

declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }
```
<!-- cookbook:end opt-target -->

## The runtime prelude

`--runtime-decls` forces every runtime declaration plus the inline arena
allocator into the module (normally only the symbols a module uses are
declared). This is the complete C ABI a compiled module can depend on; the
struct layouts must match `runtime/runtime.c` byte for byte.

<!-- cookbook:begin runtime-prelude -->
Compiled with `--runtime-decls`.

```ts
const identity = (s: string): string => s
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
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #4
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare i64 @nish_str_index_of_any(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #5
declare i64 @nish_str_index_of_from(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #4
declare i64 @nish_str_len(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare noundef double @nish_random() #2
declare void @nish_exit(i32 noundef) #6
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @nish_is_dir(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_spawn(%struct.nish_array* noundef nonnull align 8) #3
declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias align 8 %struct.nish_array* @nish_readdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare i64 @nish_monotonic_nanos() #2
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef align 8 i8* @nish_realpath(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias align 8 %struct.nish_array* @nish_read_file_bytes(i8* noundef nonnull readonly align 8 nocapture) #3
declare double @nish_date_now() #2
declare void @nish_random_fill(%struct.nish_array* noundef nonnull align 8 nocapture) #3
declare void @nish_wipe(%struct.nish_array* noundef nonnull align 8 nocapture) #2
declare double @nish_stat_mtime(i8* noundef nonnull readonly align 8 nocapture) #2
declare i64 @nish_lstat_owner_mode(i8* noundef nonnull readonly align 8 nocapture) #2
declare i64 @nish_euid() #2
declare zeroext i1 @nish_is_executable(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_signal_fd() #2
declare noundef i32 @nish_read_signal(i32 noundef) #3
declare noundef i32 @nish_net_address(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare noundef i32 @nish_net_local_port(i32 noundef) #2
declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_tcp_accept(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture) #3
declare noundef i32 @nish_net_read(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef) #3
declare noundef i32 @nish_net_write(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #3
declare noundef i32 @nish_net_shutdown(i32 noundef, i32 noundef) #2
declare noundef i32 @nish_net_close(i32 noundef) #3
declare noundef i32 @nish_tcp_connect(%struct.nish_array* noundef nonnull align 8 nocapture readonly) #2
declare noundef i32 @nish_connect_result(i32 noundef) #2
declare noundef i32 @nish_udp_bind(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_udp_send_to(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture readonly, i32 noundef, i32 noundef) #3
declare noundef i32 @nish_udp_recv_from(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef, i64 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #3
declare noundef i32 @nish_poll_create() #2
declare noundef i32 @nish_poll_add(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_poll_modify(i32 noundef, i32 noundef, i32 noundef, i32 noundef) #2
declare noundef i32 @nish_poll_remove(i32 noundef, i32 noundef) #2
declare noundef i32 @nish_poll_wait(i32 noundef, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #3
declare noundef nonnull align 8 i8* @nish_platform() #0
declare noundef nonnull align 8 i8* @nish_arch() #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 %struct.nish_array* @nish_alloc_array(i64 noundef, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #7
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #7
declare void @nish_panic_div(i1 noundef zeroext) #7
declare extern_weak void @nish_panic_overflow(i32 noundef) #7
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #3
declare void @nish_scope_spawn(i8* noundef nonnull, void (i8*)* noundef nonnull, void (i8*)* noundef nonnull, i8* noundef nonnull, i64 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #3
declare noundef i64 @nish_cpu_count() #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #8 {
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
attributes #3 = { nounwind }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind willreturn memory(argmem: read, inaccessiblemem: readwrite) }
attributes #6 = { noreturn nounwind }
attributes #7 = { nounwind noreturn cold }
attributes #8 = { alwaysinline nounwind willreturn allocsize(0) }
```
<!-- cookbook:end runtime-prelude -->
