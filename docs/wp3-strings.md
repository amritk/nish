# WP3: Strings

What the compiler does with `string` values: the memory layout, every
construct with its TypeScript and the exact LLVM IR, the decisions that were
made, and what was deliberately left for later. Test cases live in
`tests/cases/str_*.ts` (goldens in the matching `.ll`, native output in
`.out`) and `tests/cases/reject_*.ts` for the rejected forms.

## Layout (ABI)

A `string` is an `i8*` that points at a header:

```
{ i64 len, i8 data[len], i8 0 }     8-byte aligned, immutable
```

`runtime/runtime.c` (`sts_str`) and every `sts_str_*` declaration in
`src/codegen/runtime.ts` expect the pointer to the *header*, never to the
data. The trailing NUL keeps strings passable to C. Literals are module
constants with this exact layout; strings built at run time come from the
arena. Because strings are immutable, a pointer can be shared freely and no
copy is ever made.

Attribute consequences (see `src/codegen/attributes.ts`): string parameters
are `nonnull noalias readonly align 8`, plus `nocapture` when they are never
returned and never passed to a *user* function (every runtime string
function is declared `nocapture`, so passing a parameter to `sts_print` or
`sts_str_concat` keeps the attribute).

## Decisions

- **`.length` is the UTF-8 byte length.** Strings are UTF-8 (`Buffer.from(text,
  "utf8")` at compile time), so `"héllo".length` is `6`, not JavaScript's
  `5`. This keeps `.length` a single `load` with no decoding; a code-point or
  UTF-16 length would need a runtime scan. Documented in
  `docs/MASTER_PLAN.md` §3.4.
- **No implicit string conversion.** `"a" + 1` is a compile error. Write
  `` `a${1}` `` instead. `+` is concatenation only when *both* operands are
  strings.
- **`<`, `<=`, `>`, `>=` on strings stay rejected.** No collation semantics
  have been chosen.
- **`console.log(x)` takes exactly one `string | number | boolean`**, has
  type `void`, and may only appear as an expression statement.
- **Number formatting.** `number` holes and `console.log(number)` use
  `sts_str_from_i32` (exact) or `sts_str_from_f64`, which currently prints
  with `%.17g`. That is round-trip safe but not JavaScript's shortest
  representation (`0.1` prints as `0.10000000000000001`). Shortest round-trip
  formatting is deferred to WP7.
- **Booleans** convert without a runtime call: a `select` between the interned
  literals `"true"` and `"false"`.

## Constructs

### String literal

```ts
function greeting(): string {
  return "hello, world";
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"hello, world\00" }, align 8

define noundef nonnull align 8 i8* @greeting() #0 {
entry:
  ret i8* bitcast ({ i64, [13 x i8] }* @.str.0 to i8*)
}

attributes #0 = { nounwind willreturn readnone }
```

The constant is `{ i64 len, [len+1 x i8] }` and the value is the constant
expression `bitcast ({...}* @.str.N to i8*)`, so a literal costs no
instruction and no allocation. Returning the address of a constant touches
no memory, so the function stays `readnone`. `NoSubstitutionTemplateLiteral`
(`` `text` ``) lowers identically.

Identical literals in one module share one constant (`str_dedup.ts`):

```ts
function first(): string { return "same"; }
function second(): string { return "same"; }
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"same\00" }, align 8

define noundef nonnull align 8 i8* @first() #0 {
entry:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)
}

define noundef nonnull align 8 i8* @second() #0 {
entry:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)
}
```

### Escaping

Bytes are UTF-8. Printable ASCII other than `"` and `\` is written as is;
everything else is `\XX` (upper-case hex), exactly as LLVM's own printer
does (`str_escape.ts`):

```ts
console.log("quote:\" backslash:\\ end");
console.log("héllo → 日本");
console.log("line1\nline2");
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"quote:\22 backslash:\5C end\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"h\C3\A9llo \E2\86\92 \E6\97\A5\E6\9C\AC\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"line1\0Aline2\00" }, align 8
```

### Concatenation `a + b`

```ts
function join(a: string, b: string): string {
  return a + b;
}

function test(): number {
  const s = join("foo", "bar") + "!";
  console.log(s);
  return 0;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"foo\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"bar\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8

declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1

define noundef nonnull align 8 i8* @join(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call i8* @sts_str_concat(i8* %a, i8* %b)
  ret i8* %0
}

define noundef i32 @test() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @join(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %1 = call i8* @sts_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  call void @sts_print(i8* %2)
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```

`sts_str_concat` allocates in the arena (effect `write`), so `join` is
neither `readnone` nor `readonly`. Its parameters keep `nocapture` because
the runtime is declared `nocapture` and nothing else sees them.

### Equality `===` / `!==`

```ts
function same(a: string, b: string): boolean { return a === b; }
function differ(a: string, b: string): boolean { return a !== b; }
```

```llvm
declare zeroext i1 @sts_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2

define noundef zeroext i1 @same(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call zeroext i1 @sts_str_eq(i8* %a, i8* %b)
  ret i1 %0
}

define noundef zeroext i1 @differ(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call zeroext i1 @sts_str_eq(i8* %a, i8* %b)
  %1 = xor i1 %0, true
  ret i1 %1
}

attributes #0 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn memory(argmem: read) }
```

Comparison is by content (`sts_str_eq` short-circuits on pointer equality).
It only reads, so callers become `readonly`.

### `s.length`

```ts
function len(s: string): number {
  return s.length;
}
```

```llvm
define noundef i32 @len(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

attributes #0 = { nounwind willreturn readonly }
```

No runtime call: the header is loaded directly. In `--number-mode f64` the
`trunc` becomes `sitofp i64 %1 to double`. Reading through the pointer is a
memory access, so the function is `readonly` rather than `readnone`
(`FunctionFacts.readsMemory`).

### Template literals

```ts
function describe(n: number, ok: boolean, name: string): string {
  return `${name}: n=${n}, ok=${ok}!`;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c": n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c", ok=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8

declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1

define noundef nonnull align 8 i8* @describe(i32 noundef %n, i1 noundef zeroext %ok, i8* noundef nonnull noalias readonly align 8 nocapture %name) #0 {
entry:
  %0 = call i8* @sts_str_concat(i8* %name, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = call i8* @sts_str_from_i32(i32 %n)
  %2 = call i8* @sts_str_concat(i8* %0, i8* %1)
  %3 = call i8* @sts_str_concat(i8* %2, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %4 = select i1 %ok, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %5 = call i8* @sts_str_concat(i8* %3, i8* %4)
  %6 = call i8* @sts_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  ret i8* %6
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
```

Constant parts are interned literals (empty parts are dropped), holes are
converted to strings (`sts_str_from_i32` / `sts_str_from_f64`, `select` for
booleans, identity for strings), and the parts are joined left to right with
`sts_str_concat`. Chaining was chosen over an `sts_str_concat_n` runtime
addition to keep `runtime.c` unchanged; each intermediate is a cheap arena
bump, and templates with many holes are rare in hot loops.

A template whose only part is a string-typed hole (`` `${s}` ``) lowers to
`s` itself. Escape analysis sees through it (`unwrapStringPassthrough`), so
`return \`${s}\`` correctly drops `nocapture` from `s`
(`str_param_passthrough.ts`).

### `console.log`

```ts
function test(): number {
  console.log("text");
  console.log(7);
  console.log(false);
  return 0;
}
```

```llvm
@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"text\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1

define noundef i32 @test() #0 {
entry:
  call void @sts_print(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %0 = call i8* @sts_str_from_i32(i32 7)
  call void @sts_print(i8* %0)
  %1 = select i1 false, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %1)
  ret i32 0
}
```

`sts_print` is one `write(2)` of the bytes plus one of `"\n"`; no stdio.

Calls whose callee is a dotted name (`console.log`, later `Math.sqrt`) are
dispatched through the `builtinCalls` table in `src/checker/strings.ts` and
`builtinCallEmitters` in `src/codegen/emit/strings.ts`, keyed by the dotted
name. Adding a builtin means adding one entry to each.

## Rejected forms

| Source | Message |
| --- | --- |
| `s < n`, `a < b` on strings | `` Operator `<` requires two operands of the same primitive type `` |
| `"a" + 1` | `` Operator `+` requires two operands of the same numeric type or two strings ... (no implicit string conversion; use a template literal) `` |
| `console.log()` / `console.log(a, b)` | `` `console.log` expects exactly 1 argument, got N `` |
| `const x = console.log("a")` | `` `console.log` returns void and can only be used as a statement `` |
| `n.length` on a number | `` Unknown property `length` on i32 `` |
| `s.foo` | `` Unknown property `foo` on string `` |
| `Math.sqrt(x)` (until WP7) | `` Unknown builtin `Math.sqrt` `` |

## Purity facts

`collectStringFacts` in `src/codegen/emit/strings.ts` tells the attribute
analysis exactly which runtime symbols a construct lowers to, so the effect
fixpoint in `attributes.ts` sees them through `RUNTIME_BY_NAME`:

| Construct | Facts |
| --- | --- |
| literal | none (`readnone` preserved) |
| `a + b` | calls `sts_str_concat` (write) |
| `a === b`, `a !== b` | calls `sts_str_eq` (read) |
| `s.length` | `readsMemory` (read) |
| template | `sts_str_concat` when more than one part; `sts_str_from_i32/f64` per numeric hole |
| `console.log(x)` | `sts_print` (write) plus the conversion for `x` |

## Runtime budget

`runtime/runtime.c` is unchanged by this package: 4,039 bytes of source,
1,118 bytes of `.text` at `-Oz` (budget: 8 KB / 4 KB).
