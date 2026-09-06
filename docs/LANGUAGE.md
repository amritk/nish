# The StaticTS language

This is the normative reference for StaticTS, the subset of TypeScript that
`statictsc` compiles to LLVM IR. It describes what the compiler accepts today,
what each construct means, and how every rejection is worded. The design
notes (`docs/wp*.md`) explain *why*; this page says *what*.

Conventions:

- Every rule cites a test case in parentheses, e.g. `(tests/cases/cf_if)`,
  meaning `tests/cases/cf_if.ts` (with its `.ll` golden, `.out` native output,
  or `.err` expected message). A `tests/link/<name>` citation is a whole-program
  link test. Rules marked *(CLI only)* were verified by compiling a snippet
  with `node dist/index.js` and have no dedicated test case yet.
- Error messages are quoted as the fragment `tests/run.js` matches; the full
  line is `<file>:<line>:<col>: error: <message>` followed by a caret excerpt
  ([wp10-ci.md](wp10-ci.md#diagnostic-format)).
- "i32 mode" is the default; "f64 mode" is `--number-mode f64`. Everything
  else is mode-independent unless stated.
- The exact IR for each construct is in [IR_COOKBOOK.md](IR_COOKBOOK.md).

Contents: [Lexical rules](#lexical-rules) · [Types](#types) ·
[Nullable types](#nullable-types) · [Declarations](#declarations) ·
[Statements](#statements) · [Expressions](#expressions) ·
[Builtins](#builtins) · [Semantics decisions](#semantics-decisions) ·
[Memory model](#memory-model) ·
[Forbidden constructs](#forbidden-constructs-phase-0-validator) ·
[Rejected by the checker](#rejected-by-the-checker) ·
[Known inconsistencies](#known-inconsistencies)

## Lexical rules

StaticTS source is TypeScript syntax, parsed by the official TypeScript
parser (`ts.createSourceFile`), so tokens, comments, and ASI behave exactly as
in TypeScript. Syntax errors are reported as `syntax error:` in the same
`file:line:col` shape (`tests/run.js`, WP10 block).

- **Encoding.** Source is UTF-8. String contents are stored as UTF-8 bytes
  (`tests/cases/str_escape`).
- **Numeric literals.** Decimal, hexadecimal (`0x10`), binary (`0b1`),
  octal (`0o17`), exponent (`1e3`), and separators (`1_000`) are accepted
  *(CLI only)*. A literal's type comes from its context (see
  [Numeric literals](#numeric-literals)); by default it is `number`. In i32
  mode a literal must have an integral value: `1.5` is rejected with
  `Non-integer literal` (`tests/cases/reject_float_in_i32`); `1.0`, `1e3`
  are integral and accepted *(CLI only)*. A literal above `2147483647` is
  rejected with ``Literal `...` does not fit in i32`` *(CLI only)*; the
  directly negated literal `-2147483648` is accepted and is `INT_MIN`
  (`tests/cases/int_min_literal`).
- **String literals.** `"..."`, `'...'`, and `` `...` `` without holes are
  all plain string literals; `` `...${x}...` `` is a template literal
  (`tests/cases/str_literal`, `str_template`). TypeScript escapes (`\n`,
  `\"`, `\\`, `\u...`) are decoded by the parser and re-encoded as UTF-8
  (`tests/cases/str_escape`).
- **Boolean literals** `true`, `false` (`tests/cases/cf_logical`).
- **`null`** is a value only where a `T | null` type is expected (see
  [Nullable types](#nullable-types)); with no contextual type it is
  `` `null` needs a contextual `T | null` type `` *(CLI only)*.
  **`undefined`** is forbidden (`` `undefined` is forbidden in StaticTS; use `null` with a `T | null` type ``,
  `tests/cases/reject_undefined_value`).
- **Bigint** literals (`10n`) and regex literals are forbidden
  (`tests/cases/reject_bigint_literal`, `reject_regex`).
- **Reserved prefix.** Function, class, and interface names starting with
  `sts_` are reserved for the runtime: `` Function names starting with `sts_` are reserved for the runtime ``
  *(CLI only; `src/checker/declarations.ts`)*.
- **Identifiers** that may never appear as values: `eval`, `Function`,
  `Proxy`, `Reflect`, `Symbol`, `globalThis`, `arguments`, `undefined`
  (see [Forbidden constructs](#forbidden-constructs-phase-0-validator)).

## Types

Every StaticTS type maps 1:1 onto one LLVM first-class type. There is no
boxing, no runtime type tag, no structural subtyping (except
`implements`, below), and no implicit conversion of any kind: two values are
compatible only when their types are identical (`src/types.ts`, `sameType`).

| StaticTS | LLVM | Size / align | C ABI (`--emit-header`) | Notes |
| --- | --- | --- | --- | --- |
| `number` (i32 mode), `i32` | `i32` | 4 / 4 | `int32_t` | Wrapping two's-complement arithmetic. |
| `number` (f64 mode), `f64` | `double` | 8 / 8 | `double` | IEEE-754; `f64` is always available, in both modes. |
| `i64` | `i64` | 8 / 8 | `int64_t` | Never the lowering of `number`; wrapping arithmetic; literals only by context. |
| `u8` | `i8` | 1 / 1 | `uint8_t` | [Unsigned integers](#unsigned-integers): the same LLVM type as a signed byte, with unsigned operations. Wrapping arithmetic. |
| `u16` | `i16` | 2 / 2 | `uint16_t` | As `u8`. |
| `u32` | `i32` | 4 / 4 | `uint32_t` | Shares `i32`'s LLVM type; `u32 + i32` is still a type error. |
| `u64` | `i64` | 8 / 8 | `uint64_t` | Shares `i64`'s LLVM type; crosses to JavaScript as a `bigint`, like `i64`. |
| `boolean` | `i1` | 1 / 1 | `bool` | `zeroext` at the ABI boundary. |
| `string` | `i8*` to `{ i64 len, i8 data[len], i8 0 }` | 8 / 8 (pointer) | `const sts_str *` in, `sts_str *` out | Immutable, 8-aligned, NUL-terminated (so `data` is a C string; sharing a pointer is always safe, nothing is ever copied); literals are module constants, everything else lives in the arena; `len` is the UTF-8 byte length. |
| `T[]`, `Array<T>` | `%struct.sts_array*` to `{ i64 len, i64 cap, i8* data }` | 8 / 8 (pointer); header 24 bytes | `const sts_array *` in (read-only), `sts_array *` in (written through) and out | One element type; `data` holds `cap` elements of `sizeof(T)`; bounds-checked. |
| `Int32Array`, `Float64Array`, `BigInt64Array` | the same as `i32[]`, `f64[]`, `i64[]` | as `T[]` | as `T[]` | Aliases, not distinct types (`sameType` holds); `new Int32Array(n)` is `new Array<i32>(n)`. They name the JS typed array a host passes ([wp8-interop.md](wp8-interop.md)). |
| `class C`, `interface I` | `%struct.C*` to `%struct.C = type { fields in declaration order }` | 8 / 8 (pointer); struct as clang lays out the same C struct | (not representable) | Arena- or stack-allocated ([Memory model](#memory-model)), no header, no vtable. |
| `T \| null` (`T` a class, interface, array, or string) | the same pointer type as `T`; `null` is the constant `null` | as `T` | (not representable) | Only `=== null` / `!== null`, assignment, and narrowing: [Nullable types](#nullable-types). |
| `void` | `void` | – | `void` | Return type only. |

Sources: `src/types.ts` (`llvmType`, `alignOf`), `src/interop/abi.ts`
(`cType`); `tests/cases/i64_basic`, `f64_mode`, `str_literal`, `arr_literal`,
`cls_point`; the ten-struct layout test `tests/layout/structs.ts` (offsets and
`sizeof` cross-checked against clang, [wp2-classes.md](wp2-classes.md#layout)).

Type rules:

- **Accepted type syntax**: `number`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`,
  `f64`, `boolean`,
  `string`, `void`, `T[]`, `Array<T>` (exactly one type argument:
  `` `Array` needs exactly one type argument ``), `Int32Array`,
  `Float64Array`, `BigInt64Array` (no type argument:
  `` `Float64Array` takes no type argument (it is an alias of `f64[]`) ``,
  `tests/cases/reject_arr_typed_view_type_annotation_arg`; a `Float64Array`
  is an `f64[]` wherever one is expected and vice versa,
  `tests/cases/arr_typed_views`, `reject_arr_typed_view_mismatch`), and the
  name of a class or interface declared or imported in the module. Anything else is
  `` Unsupported type `...` `` / `` Unsupported type reference `...` ``
  (`src/types.ts`; `tests/cases/reject_union_type`, `reject_function_type`).
  `T | null` (or `null | T`) is accepted when `T` is a class, interface,
  array, or string; a scalar is
  `` `i32 | null` is not supported: only class, interface, array, and string types can be nullable (a scalar has no null value) ``
  (`tests/cases/reject_nullable_scalar`).
- **No implicit conversion.** `const y: f64 = x` with `x: number` in i32
  mode is `Cannot initialize f64 variable ... with i32` *(CLI only)*;
  `x + n` with `x: i64`, `n: number` is rejected
  (`tests/cases/reject_i64_mixed`); convert explicitly with `toI32`,
  `toI64`, `toU8`, `toU16`, `toU32`, `toU64`, `toF64`
  (`tests/cases/conversions`, `u_conv_roundtrip`). Signedness is part of the
  type even when the LLVM type is shared, so `u32 + i32` is
  `` Operator `+` requires two operands of the same numeric type ... got u32 and i32 ``
  (`tests/cases/reject_u_mixed_signedness`), and so is `u8 * u32`
  (`tests/cases/reject_u_mixed_widths`).
- **Field and element types** may be any type except `void`
  (`Array elements cannot be void`, `... cannot have type void`).
  Arrays of arrays (`tests/cases/arr_nested`), arrays of strings
  (`tests/cases/arr_strings`), arrays of class instances and class fields
  of array type work *(CLI only)*.

### Numeric literals

A numeric literal has the mode's default type (`i32`, or `f64` in f64 mode)
unless its *immediate* context demands another numeric type, in which case it
takes that type (`src/checker/math.ts`, `contextualLiteralType`;
`tests/cases/i64_basic`, `math_i32`, `conversions`):

| Context | Example | Literal type |
| --- | --- | --- |
| annotated initializer | `let x: i64 = 5` | `i64` |
| `return` | `return 5` in a function returning `i64` | `i64` |
| argument to a user function | `square(5)` with `x: i64` | `i64` |
| other operand of a binary operator with a known type | `x * 2`, `2 * x`, `x < 5`, `x = 5` | the other operand's type |
| `Math.min` / `Math.max` | `Math.max(x, 0)` | the other operand's type |
| f64-only `Math.*`, `toF64` | `Math.sqrt(2)`, `toF64(3)` | `f64` |
| `process.exit` | `process.exit(1)` in f64 mode | `i32` |
| `Number` | `Number(2.5)` in i32 mode | `f64` |
| element of an array literal whose own context is a `T[]` | `const bytes: u8[] = [0, 255]` | `u8` |
| a class field's literal initializer | `b: u8 = 255` | `u8` |
| argument to a constructor | `new Pixel(255, 0, 0)` | the parameter's type |
| a field or element assignment target | `p.b = 255`, `bytes[i] = 255` | the field's / element's type |

`-5` and `(5)` count as the literal. "Known type" means an already-checked
left operand, a variable, a field or element of one of those, or a call to a
user function or to
`toI32/toI64/toU8/toU16/toU32/toU64/toF64`. Only the literal's *immediate* context counts: in i32
mode `const f: f64 = 0.1 + 0.2` is rejected because `0.1` is an operand of
`+` whose other operand has no known type yet; write `const a: f64 = 0.1;
const f = a + 0.2` *(CLI only)*. A literal in an integer context must be integral
(`` Non-integer literal `1.5` where i64 is expected ``,
`tests/cases/reject_i64_literal_float`); in an `i64` context it must also be
at most 2^53 in magnitude (`` exceeds 2^53 and cannot be written exactly ``
*(CLI only)*) because TypeScript's parser has already rounded larger
literals to a double. In an *unsigned* context it must also be non-negative
and fit the width: `const b: u8 = -1` is
`` Negative literal `-1` where u8 is expected (u8 is unsigned) ``
(`tests/cases/reject_u_negative_literal`) and `const b: u8 = 256` is
`` Literal `256` does not fit in u8 ``
(`tests/cases/reject_u_literal_too_wide`). The largest `u64` values are past
2^53 and cannot be written at all; build them arithmetically
(`toU64(0) - toU64(1)` is 2^64 - 1, `tests/cases/u_print`).

### Unsigned integers

`u8`, `u16`, `u32` and `u64` are unsigned integers with wrapping arithmetic.
LLVM has no unsigned types, so they lower to `i8`, `i16`, `i32` and `i64` and
the signedness lives entirely in the *operations*; representing an unsigned
value therefore costs nothing at all, and a `u8` field packs a struct as
tightly as a C `uint8_t` does.

| Operation | On `i32` / `i64` | On `u8` / `u16` / `u32` / `u64` |
| --- | --- | --- |
| `+ - *`, unary `-`, `++`/`--` | `add` `sub` `mul` | identical, and wrapping for both |
| `/ %` | `sdiv` / `srem` after a two-part divisor check | `udiv` / `urem` after a single compare ([Checked integer division](#checked-integer-division)) |
| `< <= > >=` | `icmp slt sle sgt sge` | `icmp ult ule ugt uge` |
| `>>` | `ashr` | `lshr` |
| `>>>` | `lshr` | `lshr` — the same instruction, so the two are synonyms |
| `=== !==` | `icmp eq` / `icmp ne` | identical (the bits decide) |
| widening conversion | `sext` | `zext` |
| narrowing conversion | `trunc` | `trunc` |
| to / from `f64` | `sitofp` / `llvm.fptosi.sat` | `uitofp` / `llvm.fptoui.sat` |
| `Math.abs` | `llvm.abs` | nothing: the value is already its own magnitude |
| `Math.min` / `Math.max` | `llvm.smin` / `llvm.smax` | `llvm.umin` / `llvm.umax` |
| `console.log(x)`, `` `${x}` `` | `sts_str_from_i32` / `_i64` | `zext` to i64, then `sts_str_from_u64` |
| `--nsw` (WP9) | `add nsw` … | `add nuw` … — an unsigned value passing 2^31 has not overflowed |

The consequences worth knowing:

- **A value above `INT_MAX` behaves.** `const big: u32 = 4000000000` compares,
  divides and prints as four billion, where the same bits in an `i32` are
  -294967296 (`tests/cases/u_compare_above_intmax`, `u_udiv_urem`, `u_print`;
  `tests/differential/corpus/u_div_cmp`).
- **Division is cheaper.** Unsigned division has no overflow case, so its
  check is one compare instead of three plus an `and` and an `or`
  (`tests/cases/u_div_one_check`).
- **Overflow wraps**, as it does for the signed types: `(255: u8) + 1` is `0`
  and `(0: u8) - 1` is `255` (`tests/cases/u_arith_wrap`,
  `tests/differential/corpus/u_wrap`). No `nuw` is emitted unless `--nsw` is
  given, exactly as no `nsw` is emitted for signed arithmetic.
- **Mixing is an error.** `u32` and `i32` are different types even though both
  are `i32` in the IR, and so are `u8` and `u32`; there is no implicit
  conversion anywhere in this language
  (`tests/cases/reject_u_mixed_signedness`, `reject_u_mixed_widths`).
- **`i32 >>> n` still yields the raw bits read as signed** — `-1 >>> 0` is
  `-1` here where JavaScript gives `4294967295` — because an `i32` is the only
  place the result could go. That is now something to avoid rather than
  something to live with: use `u32` and the answer is `4294967295`
  (`tests/cases/u_shift_logical`, `u_conv_roundtrip`;
  `tests/differential/corpus/u_convert_shift`).

### Shifts

`a >> b` and `a >>> b` take two operands of one *integer* type and produce
that type. There is no implicit conversion, so the shift amount has the same
type as the value (`` Operator `>>` requires two operands of the same integer
type, got u32 and i32 ``, `tests/cases/reject_u_shift_mixed`), and `f64` has
no shift at all.

`>>` is an arithmetic shift on a signed type (`ashr`, sign bit replicated) and
a logical one on an unsigned type (`lshr`, zeros in); `>>>` is always `lshr`,
so on an unsigned type the two operators are synonyms and code that is generic
over a width may spell either (`tests/cases/u_shift_logical`).

The amount must be less than the width, which is what `ashr`/`lshr` define
(LLVM makes a wider shift poison, as C makes it undefined). A *literal*
amount is checked at compile time — `` Shift amount 8 is not less than the
width of u8 (8 bits) `` (`tests/cases/reject_u_shift_too_wide`) — so the
common mistake is a compile error; a computed amount is the program's
responsibility, because masking it would cost an `and` on every shift for the
sake of a case that is always a bug. `<<`, `&`, `|`, `^` and `~` are still
not supported.

### Nullable types

`T | null` is available for `T` a class, interface, array, or string
(`tests/cases/mem_nullable`; [wp6-memory.md](wp6-memory.md#4-t-null)). It
is the same LLVM pointer type as `T` with the constant `null` as one more
value, so nothing is boxed; `null` takes its type from context.

- **Where `null` may appear**: an annotated initializer
  (`let p: Node | null = null`), a field initializer (`next: Node | null = null`),
  `return` in a function returning `T | null`, an argument, a field or
  element store, an object literal property, `push`, and a ternary arm
  (`c ? p : null` is `T | null`). A `T` is accepted wherever `T | null` is
  expected; the reverse is `` `null` is not a Node; declare the type as `Node | null` ``
  (`tests/cases/reject_null_to_nonnull`).
- **`new Array<T | null>(n)`** is allowed: the zero fill *is* `null`
  (`tests/cases/mem_nullable`).
- **Comparison**: `p === null`, `p !== null`, `null === p` are pointer
  compares (`icmp eq ... null`). Two nullable values cannot be compared with
  each other (`` Cannot compare two `string | null` values; compare each with `null` ``,
  `tests/cases/reject_null_compare_two`), and neither can a nullable and a
  plain `T` *(CLI only)*: narrow first.
- **Narrowing** (`src/checker/nullable.ts`): inside the region a condition
  guards, a nullable *variable* (a local or parameter, never a property
  path) reads as `T`:

  | Form | Where `p` is `T` |
  | --- | --- |
  | `if (p !== null) A else B` | in `A`; and after the `if` when `B` cannot fall through |
  | `if (p === null) A else B` | in `B`; and after the `if` when `A` cannot fall through (`return`, `throw`, `break`, `continue`, `process.exit`) |
  | `while (p !== null) A`, `for (...; p !== null; ...) A` | in `A`, on every iteration |
  | `p !== null && e`, `p === null \|\| e` | in `e` |
  | `p !== null ? a : b` | in `a` (and in `b` for `=== null`) |
  | `!cond`, `(cond)`, `a && b`, `a \|\| b` | composed as expected |

  A narrowing ends at any assignment to the variable (`cur = cur.next` reads
  the narrowed `cur` on the right and then drops it) and before a loop whose
  body, condition, or update assigns the variable, because the second
  iteration sees the assigned value (`tests/cases/reject_null_narrowing_assigned`;
  `reject_null_narrowing_leaks` for a use after the guarded block).
  Constants and parameters keep their narrowing for the whole region.
  Property paths are not narrowed: `if (n.next !== null) n.next.v` is
  rejected; copy into a local first *(CLI only)*.
- **Access** to a field, method, element, or `.length` on an un-narrowed
  nullable is `` Cannot read property `value` of `Node | null`; check for null first ``
  (`tests/cases/reject_null_field_access`).
- **Attributes**: a nullable parameter or return loses `nonnull` and
  `dereferenceable`; `align 8`, `readonly` and `nocapture` follow the usual
  rules ([ARCHITECTURE.md](ARCHITECTURE.md#attribute-soundness-rules)).

## Declarations

### Program structure

A module (one `.ts` file) may contain, at the top level, only `function`,
`class`, and `interface` declarations, `import` statements, and `export`
modifiers on those declarations. Any other top-level statement, including
`let`/`const`, `enum`, and `type` aliases, is rejected with
`Only top-level function declarations are supported in Phase 1 (found <Kind>)`
(`tests/cases/reject_top_level_stmt`; `enum`/`type` *(CLI only)*). Modules
have no top-level code, so there is no initialisation order to worry about.

### Functions

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

- Every parameter and the return type must be annotated
  (`` Parameter `x` needs a type annotation ``; `explicit return type`,
  `tests/cases/reject_missing_return_type`).
- Functions may call each other in any order; signatures are collected
  before bodies are checked (`tests/cases/locals`, `cf_fib`).
- Calls take exactly the declared number of arguments (`expects 1 argument`,
  `tests/cases/reject_arity`), each of exactly the declared type
  (`` Argument 1 of `area`: expected Shape, got Rect ``,
  `tests/cases/reject_cls_not_implements`).
- Parameters are immutable: `p = 1`, `p++`, `p += 1` are
  `` Cannot assign to `p` because it is a parameter ``
  (`tests/cases/reject_assign_param`, `reject_cf_incdec_param`).
- Parameters and the body's top-level block share one scope: `let x` in
  the body of `f(x)` is `` Duplicate declaration of `x` `` *(CLI only)*.
- Rejected forms: generics (`tests/cases/reject_generic_function`),
  generators (`reject_generator`), `async` (`reject_async_function`),
  destructured / rest / optional / default parameters
  (`Destructured parameters are not supported`,
  `Rest parameters are not supported`,
  `Optional/default parameters are not supported`), overloads
  (`` Duplicate function `f` `` *(CLI only)*), `declare function`,
  function expressions and arrow functions
  (`Unsupported expression in Phase 1: ArrowFunction` *(CLI only)*),
  and nested function declarations (`Unsupported statement in Phase 1:
  FunctionDeclaration`).
- A non-`void` function must return on every path
  (`` Function `f` must return a value of type i32 on every path ``,
  `tests/cases/reject_missing_return`, `reject_cf_missing_return_loop`); see
  [Termination](#termination-definite-return-and-unreachable-code).

### `export` and `import`

- `export` is accepted on `function`, `class`, and `interface` declarations
  (`tests/cases/export_fn`, `tests/link/class_export`). `export const`,
  `export default`, `export { ... }`, `export * from`, and `export =` are
  rejected (`Only functions can be exported`,
  `tests/cases/reject_export_const`; `` `export default` is not supported ``,
  `reject_export_default`).
- The only import form is a named import from a relative specifier:
  `import { square, cube as pow3 } from "./math"` (`tests/link/two_file`).
  The specifier must start with `./` or `../`
  (`Only relative import specifiers are supported`,
  `tests/cases/reject_bare_import`); `.ts` is optional and `./x.js` maps to
  `./x.ts`; paths resolve relative to the importing file. Default imports
  (`Default imports are not supported`, `reject_default_import`), namespace
  imports (`Namespace imports`, `reject_namespace_import`), side-effect
  imports (`Side-effect imports`, `reject_side_effect_import`), and
  type-only imports are rejected. A missing file is
  `` Cannot find module `./does_not_exist` `` (`reject_missing_module`).
- Functions may be renamed on import (`as`); classes and interfaces may not,
  because the type name is part of the ABI (`%struct.Point`,
  `@Point.constructor`): `` Classes cannot be renamed on import ``
  (`tests/link/class_import_rename`).
- Importing a name the module declares but does not export, or does not
  declare at all, is an error with distinct messages
  (`tests/link/not_exported`, `tests/link/unknown_export`); importing the
  same local name twice, or a name also declared locally, is an error
  (`tests/link/duplicate_import`).
- Import cycles are allowed (`tests/link/cycle`); a shared dependency is
  compiled once (`tests/link/diamond`).
- **Linkage.** Every function is an external C-ABI symbol by default, so two
  modules may not define the same function name, exported or not
  (`tests/link/duplicate_export`). With `--strict-exports`, non-exported
  functions get `internal` linkage (`tests/cases/export_strict`,
  `tests/link/strict`) and may coexist across modules.

### `main`

```ts
export function main(): number {   // or `: void`; `: i32` in f64 mode
  console.log("hello");
  return 0;                          // the process exit code
}
```

- Only the entry module (the first file on the command line) may declare
  `export function main` (`Only the entry module may declare`,
  `tests/link/main_in_import`); `--link` requires it (`tests/link/no_main`).
- It takes no parameters (`` `main` cannot take parameters ``,
  `tests/cases/reject_main_params`; the command line is
  [`process.argv`](#process)) and
  returns `void` (exit code 0, `tests/cases/entry_main_void`) or an
  `i32`-lowered `number` (`tests/cases/entry_main`, `tests/link/two_file`).
  In f64 mode declare `main(): i32`; `main(): number` is rejected with
  `` `main` must return void or an i32 number ... under --number-mode f64 declare `main(): i32` ``
  *(CLI only)*.
- The user's function is emitted as `@sts_main`; the compiler adds a C
  `@main(i32 %argc, i8** %argv)` wrapper that builds `process.argv` when the
  program reads it (`call void @sts_argv_init(i32 %argc, i8** %argv)`,
  `tests/cases/argv_echo`, `tests/link/argv_import`), calls it, frees the
  arena, and returns the code. A non-exported `function main` is an ordinary
  function named `@main` (for C drivers such as `tests/driver.c`).

### Classes

```ts
class Point {
  x: number;
  y: number;
  label: string = "p";          // literal initializer

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}
```

- **Fields** need a type annotation (`` Field `x` of class `Point` needs a type annotation ``,
  `tests/cases/reject_cls_field_no_type`). An initializer must be a literal
  (a number, a negated number, a string, or a boolean) of the field's type
  (`initializers must be literals` *(CLI only)*; `tests/cases/cls_initializers`).
  Layout is declaration order with natural alignment and padding, exactly
  as clang lays out the same C struct (`tests/layout/structs.ts`).
- **Constructor**: at most one, with a body, no return type annotation, and
  no parameter properties (`Parameter properties (`constructor(public x: number)`) are not supported`).
  `new C(args)` takes exactly the constructor's arity
  (`` `new Point` expects 2 argument(s), got 1 ``, `tests/cases/reject_cls_ctor_arity`).
  A class without a constructor may be `new`ed with zero arguments and gets
  its initializers stored inline (`tests/cases/cls_initializers`).
- **Definite assignment** (`tests/cases/reject_cls_uninitialised`,
  `reject_cls_uninitialised_no_ctor`, `reject_cls_read_before_assign`):
  after the constructor returns every field holds a value. The check is
  syntactic, top to bottom: `this.f = e;` statements (and chains) mark `f`;
  an `if` marks what both arms mark; assignments inside loops, nested
  expressions, ternaries or calls do not count; every `return` must see
  every field assigned; reading `this.f`, calling `this.m()`, or using
  `this` as a value before every field is assigned is an error. A class
  with no constructor must initialise every field
  (`` has no initializer and no constructor assigns it ``).
- **Methods** need a body and an explicit return type; they are ordinary
  functions `@Class.method` with `this` first. `this` is valid only inside
  a method or constructor (`` `this` is only valid inside a method or constructor ``,
  `tests/cases/reject_cls_this_outside`) and may be aliased or passed on
  (`const self = this` *(CLI only)*; `tests/cases/cls_this_method_call`).
  Methods may call each other and free functions, recursively.
- **Field access**: `p.x` reads, `p.x = v` and `p.x op= v` write
  (`tests/cases/cls_field_write`, `cls_compound_field`); `++`/`--` on
  fields is not supported (`Only simple variables can be assigned`).
  Unknown fields: `` Unknown field `z` on class `Point` ``
  (`tests/cases/reject_cls_unknown_field`, `reject_cls_assign_unknown_field`).
- **`readonly`** fields may be assigned only as `this.f = v` in their own
  class's constructor (`tests/cases/cls_readonly_ok`;
  `` Cannot assign to readonly field `value` of `Id` outside its constructor ``,
  `reject_cls_readonly_write`). `public`, `private`, `protected` are
  accepted and ignored.
- **Equality**: `===` / `!==` on two values of the same class compare
  identity (pointer equality) (`tests/cases/cls_this_method_call`, `Account.same`);
  `<` and friends are rejected (`tests/cases/reject_cls_ordering`). Both
  operands must have the same declared type: comparing a `Base` with a
  `Derived` is `` Operator `===` requires two operands of the same type, got Base and Derived ``
  *(CLI only)*; assign the `Derived` to a `Base` variable first.
- **Inheritance**: `class D extends B` for a class `B` declared in the same
  module (`tests/cases/cls_extends_basic`, `cls_extends_chain`).
  - *Layout*: `D` is `B`'s fields followed by `D`'s own, in order, at
    natural alignment (`%struct.D = type { <B fields>, <D fields> }`), so a
    `D` pointer is a valid `B` pointer; a chain of any depth flattens the
    same way, and `implements` on a derived class checks the flattened
    field list (`tests/layout/structs.ts`, classes `K`, `L`, `M`).
  - *Upcast*: a `D` converts to `B`, or to any ancestor, wherever a `B` is
    expected (initializer, assignment, argument, return, field store, `B[]`
    literal element, `xs[i] = d` and `xs.push(d)` on a `B[]`, `B | null`)
    by one `bitcast` (`tests/cases/cls_extends_upcast`). Nothing converts
    back: there is no downcast, no `as`, no `instanceof`
    (`reject_cls_downcast`: `Return type mismatch: function returns Derived but expression is Base`).
  - *Fields*: inherited fields are read and written through the derived
    value as its own (`d.x`, `this.x`); a derived class cannot redeclare an
    inherited field (`` Field `count` of class `Derived` is already declared in base class `Base` ``,
    `reject_cls_shadow_field`) nor assign an inherited `readonly` field, even
    in its constructor (`reject_cls_readonly_inherited`).
  - *Constructors*: a derived constructor starts with `super(args)`, checked
    against the nearest ancestor constructor and lowered to a call of it with
    `this` bitcast. It must be the first statement
    (`` `super(...)` must be the first statement of the constructor of `Derived` ``,
    `reject_cls_super_not_first`), it is required when that constructor takes
    parameters (`` Constructor of `Derived` must start with `super(...)` ``,
    `reject_cls_super_missing`), and `this` / `super` may not appear in its
    arguments (`` `this` cannot be used before `super(...)` ``,
    `reject_cls_this_before_super`). When no ancestor constructor takes
    parameters the call may be omitted and runs implicitly before the body
    (an extension: TypeScript itself demands the call). A class without a
    constructor inherits the nearest ancestor's: `new D(args)` runs it after
    storing `D`'s initializers. Definite assignment covers only the fields
    `D` declares; the inherited ones count as assigned once `super(...)` ran.
  - *Methods and static dispatch*: `d.m()` resolves at compile time to the
    `m` of `d`'s **declared** type, or of its nearest ancestor that declares
    one, and calls it with `this` bitcast to that class. A derived class may
    override a method with an identical signature
    (`` overrides `Base.scale` with a different signature ``,
    `reject_cls_override_signature`), but the method chosen depends on the
    declared type of the receiver, not the runtime class: with `class Square
    extends Shape` overriding `area`, `sq.area()` is `Square.area` while
    `areaOf(s: Shape)` and `const s: Shape = sq; s.area()` call `Shape.area`
    on the same object, and `Shape.report()` calling `this.area()` always
    reaches `Shape.area` (`tests/cases/cls_extends_override`). There is no
    vtable and no virtual dispatch; this is the one place StaticTS knowingly
    differs from JavaScript. `super.m(args)` inside a derived class calls the
    base implementation; `super` has no other use (`` `super.x` is not supported ``,
    `reject_cls_super_field`; `reject_cls_super_outside`, `reject_cls_super_in_method`).
  - *Rejected*: extending an interface (`` cannot extend interface `Named`; use `implements Named` ``,
    `reject_cls_extends_interface`), an unknown name (`reject_cls_extends_unknown`),
    an imported class (`tests/link/extends_imported_base`), itself
    (`reject_cls_extends_self`) or a cycle (`reject_cls_extends_cycle`); an
    exported class extending a non-exported one (`reject_cls_extends_nonexported`);
    `super(...)` with the wrong arguments (`reject_cls_super_args`).
- **Rejected**: `static` (`tests/cases/reject_cls_static`),
  getters/setters (`Getters and setters are not supported`), optional fields
  (`cannot be optional`), index signatures, `!` assertions, `abstract`,
  `declare class`, generics (`tests/cases/reject_generic_class`), decorators
  (`reject_decorator`), computed member names (`reject_computed_property`),
  overloaded constructors, multiple `extends`.

### Interfaces and object literals

```ts
interface Pair { first: number; second: number; }

function swap(p: Pair): Pair {
  return { first: p.second, second: p.first };
}
```

- An interface is a struct type with the same layout rules as a class, with
  fields only: methods are `Interface ... cannot declare methods`, `extends`
  is `Interface inheritance (`extends`) is not supported`, and `new` on an
  interface is `` Cannot `new` interface `Pair` `` (`tests/cases/reject_cls_new_interface`).
- An **object literal** allocates in the arena and stores every property in
  source order. It must set every field exactly once (`` is missing field `second` ``,
  `tests/cases/reject_cls_literal_missing`; `` `Pair` has no field `third` ``,
  `reject_cls_literal_extra`), with plain identifier keys and `key: value`
  or shorthand members. It takes its type from the context: a variable
  annotation, the enclosing function's return type, the parameter it is
  passed to, the field or variable it is assigned to, or the field of an
  enclosing literal; otherwise
  `Object literal needs a contextual class or interface type`
  (`tests/cases/reject_cls_literal_no_context`, `cls_interface_literal`,
  `cls_nested`).
- `readonly` on an interface field forbids every assignment (`i.a = 2` is
  `` Cannot assign to readonly field `a` of `I` `` *(CLI only)*); literals
  still set it.
- **`class C implements I`** requires `C` to declare exactly `I`'s fields
  in the same order with identical types
  (`` Class `Square` does not implement `Shape`: field 1 is ... ``,
  `tests/cases/reject_cls_implements_mismatch`). A `C` then converts to `I`
  wherever an `I` is expected (initializer, return, argument, assignment,
  field store, ternary arm, `I[]` element) by one `bitcast`; a class with
  identical fields that does not list `I` is not assignable
  (`tests/cases/cls_implements`, `reject_cls_not_implements`). A derived
  class (`class D extends B implements I`) is checked on its flattened
  fields, and a class inherits its base's `implements`: a `D` converts to
  every interface `B` implements, since `B`'s fields are its prefix
  (`tests/cases/cls_extends_chain`).

## Statements

### Blocks and scope

Every block (`{ ... }`, loop body, branch) opens a scope. A name may shadow
an outer one in a nested block *(CLI only)*, but redeclaring a name in the
same scope is `` Duplicate declaration of `y` `` *(CLI only)*. A `let` in a
`for` initializer belongs to the loop (`tests/cases/cf_for`). A branch or
loop body that is a single statement rather than a block is accepted
*(CLI only)*.

### `let` / `const`

- Every declaration needs an initializer (`` Variable `x` must be initialized ``
  *(CLI only)*) and takes its type from it; an annotation must match the
  initializer exactly (`Cannot initialize ... with ...`).
- Declaring a `void`-typed variable is `Cannot declare a variable of type void`
  *(CLI only)*. Destructuring is not supported. `var` is forbidden
  (`tests/cases/reject_var_keyword`, `reject_var_in_for`).
- `const` freezes the binding, not the contents: `xs[0] = 1` and
  `xs.push(1)` on a `const xs` are fine, `xs = []` is not
  (`tests/cases/arr_index_read_write`; `` Cannot assign to `x` because it is a const ``,
  `reject_assign_const`, `reject_cf_compound_const`).
- Locals live in an `alloca` slot; `opt -mem2reg` promotes them
  (`tests/cases/locals`).

### Expression statements

Any expression may be a statement; its value is discarded *(CLI only)*.
`console.log(...)`, `process.exit(...)`, `writeFileSync(...)` and
`appendFileSync(...)` return `void` and may appear *only* as statements
(`can only be used as a statement`, `tests/cases/reject_console_log_as_value`).

### `return`

The expression's type must equal the declared return type
(`Return type mismatch: function returns ... but expression is ...`); a bare
`return` is valid only in a `void` function
(`Expected a return value of type ...`) (`tests/cases/entry_main_void`).

### `if` / `else`

The condition must be `boolean`: there is no truthiness
(`Condition must be boolean, got i32 (StaticTS has no truthiness)`,
`tests/cases/reject_cf_nonbool_cond`). `else if` chains are nested `if`s
(`tests/cases/cf_if`, `cf_if_else_chain`).

### `while`, `do ... while`, `for`

- Conditions must be `boolean` (`tests/cases/cf_while`, `cf_do_while`,
  `cf_for`).
- `for (init; cond; update)`: every clause is optional; the initializer is
  a `let`/`const` list or an expression (`tests/cases/cf_break_continue`
  for `for (;;)`; expression initializer *(CLI only)*).
- Loop variables are ordinary mutable locals; there is no restriction on
  assigning them (`tests/cases/cf_collatz`).
- A loop whose condition is absent or the literal `true` and whose body has
  no `break` for it never falls through (see Termination); every other loop
  may run zero times (`tests/cases/cf_while`, `firstPowerOver`).

### `for (const x of a)`

- `a` must be an array (`` `for...of` requires an array, got string ``,
  `tests/cases/reject_arr_forof_non_array`); `x` gets the element type and
  must not be annotated or initialised; exactly one variable; `let x` makes
  it assignable, `const x` does not (`tests/cases/reject_arr_forof_const_assign`).
  `for await` is not supported.
- `a` is evaluated once; `a.length` is re-read every iteration, so a `push`
  inside the body extends the iteration, as JavaScript's array iterator does
  (`tests/cases/arr_for_of`). `break` and `continue` work
  (`tests/cases/arr_for_of`).

### `break` / `continue`

Unlabelled only (`Labelled `break` is not supported`; labeled statements are
forbidden outright, `tests/cases/reject_labeled_statement`), and only inside
a loop (`` `break` outside of a loop ``, `tests/cases/reject_cf_break_outside`;
`` `continue` outside of a loop ``, `reject_cf_continue_outside`).
`tests/cases/cf_break_continue`.

### `throw`

`throw e` evaluates `e` (any non-`void` type; `Cannot throw a void expression`)
and aborts the process via `llvm.trap`: there is no unwinding, no `catch`,
and the value is discarded (`tests/cases/cf_throw`; `throw "message"`
*(CLI only)*). `try`/`catch`/`finally` is forbidden
(`tests/cases/reject_try_catch`).

### `process.exit(code)` as a statement

Terminates the process with `code` (an `i32`) and, for control-flow
purposes, the current path: a non-`void` function may end with it
(`tests/cases/process_exit`), and code after it is
`Unreachable code after process.exit` (`tests/cases/reject_exit_unreachable`).

### Termination, definite return, and unreachable code

A statement *terminates* when control cannot fall out of it: `return`,
`break`, `continue`, `throw`, `process.exit(...)`; an `if` whose branches
both terminate; a loop with no condition or the condition `true` and no
`break` aimed at it. Any other loop may run zero times and does not
terminate. Rules (`src/checker/control-flow.ts`, `statements.ts`):

- A non-`void` function's body must terminate
  (`must return a value of type i32 on every path`,
  `tests/cases/reject_missing_return`, `reject_cf_missing_return_loop`;
  `if (true) { return 1; }` alone is not enough *(CLI only)*).
- A statement after a terminating one is `Unreachable code after <what>`,
  where `<what>` is `return`, `break`, `continue`, `throw`, `process.exit`,
  `` an `if` whose branches all return ``, or `an infinite loop`
  (`tests/cases/reject_unreachable`, `reject_cf_unreachable_after_break`,
  `reject_exit_unreachable`; `throw` and `if` forms *(CLI only)*).

### Rejected statements

`switch` (`Unsupported statement in Phase 1: SwitchStatement` *(CLI only)*),
`with` (`tests/cases/reject_with_statement`), `try` (`reject_try_catch`),
`debugger` (`reject_debugger`), labeled statements (`reject_labeled_statement`),
`var` (`reject_var_keyword`), `for...in`, nested `function`, `enum`, `type`,
`namespace` (`reject_namespace`), `declare global` (`reject_declare_global`).

## Expressions

Evaluation is left to right, operands before operators, as in JavaScript;
the specific orders for compound assignment and element assignment are
under [Semantics decisions](#semantics-decisions).

### Operators

| Operator | Operand types | Result | Lowering | Test |
| --- | --- | --- | --- | --- |
| `+ - * / %` | two numbers of one type (`i32`, `i64`, `u8`, `u16`, `u32`, `u64`, or `f64`) | that type | `add sub mul` / `fadd fsub fmul fdiv frem`; no `nsw`/`nuw` unless `--nsw`; integer `sdiv` / `srem` (`udiv` / `urem` on an unsigned type) are preceded by a divisor check that branches to `sts_panic_div` ([Checked integer division](#checked-integer-division)) | `add`, `locals`, `i64_basic`, `f64_mode`, `div_checked`, `u_arith_wrap`, `u_udiv_urem`; `reject_type_mismatch`, `reject_u_mixed_signedness` |
| `+` | two `string` | `string` | `sts_str_concat` | `str_concat`; `reject_str_plus_number` (`no implicit string conversion`) |
| unary `-` | `i32`, `i64`, `f64` | same | `sub i32 0, x` / `sub i64 0, x` / `fneg double x` | `cf_if` (`-x`), `i64_basic`; `f64` *(CLI only)* |
| unary `!` | `boolean` | `boolean` | `xor i1 x, true` | `cf_logical`; `!s` on a string is `` Unsupported unary operator `!` on string `` *(CLI only)* |
| `< <= > >=` | two numbers of one type (`i32`, `i64`, the unsigned widths, or `f64`); nothing else | `boolean` | `icmp slt ...` signed, `icmp ult ...` unsigned, `fcmp olt ...` | `cf_if`, `f64_mode`, `u_compare_above_intmax`; booleans (`reject_bool_ordering`), strings (`reject_str_lt`, `reject_str_lt_str`), and structs (`reject_cls_ordering`) are `` Operator `<` requires two numeric operands, got boolean and boolean `` |
| `>> >>>` | two operands of one integer type | that type | `>>`: `ashr` signed, `lshr` unsigned; `>>>`: always `lshr`, so the two are synonyms on an unsigned type. A literal amount at or beyond the width is a compile error ([Shifts](#shifts)) | `u_shift_logical`; `reject_u_shift_mixed`, `reject_u_shift_too_wide` |
| `=== !==` | any two values of the same type except `void`; a `T \| null` only against the literal `null` | `boolean` | integers and booleans: `icmp eq` / `icmp ne`; `f64`: `fcmp oeq` / `fcmp une` (so `x !== x` is true for NaN); strings: `sts_str_eq` (content); arrays and objects: `icmp eq` on the pointer (identity); `p === null`: `icmp eq` against `null` | `str_eq`, `cls_this_method_call`, `conversions`, `mem_nullable`; arrays *(CLI only)*; `reject_null_compare_two` |
| `== !=` | – | – | forbidden | `reject_loose_equality`, `reject_loose_inequality` |
| `&& \|\|` | two `boolean` | `boolean` | short-circuit: `br` + `phi` | `cf_logical`; `reject_cf_logical_numbers` (`requires boolean operands`) |
| `c ? a : b` | `c: boolean`; `a`, `b` same non-`void` type | that type | `br` + `phi` | `cf_ternary`; `reject_cf_ternary_mismatch` |
| `x = e` | mutable local, field, or element; `e` of the target's type | the target's type | `store` | `locals`, `cls_field_write`, `arr_index_read_write` |
| `x op= e` (`+= -= *= /= %=`) | numeric mutable local, numeric field, or numeric element; same type | the target's type | load, op, store | `cf_compound_assign`, `cls_compound_field`, `arr_index_read_write`; `reject_cf_compound_const` |
| `++x --x x++ x--` | numeric mutable local only | the new / old value | load, `add 1`, store | `cf_incdec`; `reject_cf_incdec_param` |
| `,` | – | – | forbidden | `reject_comma_expression` |
| `?? ?. in instanceof typeof delete void` | – | – | forbidden by the validator | `reject_nullish`, `reject_optional_chain`, `reject_in_operator`, `reject_instanceof`, `reject_typeof_operator`, `reject_delete`, `reject_void_expression` |
| `** & \| ^ << ~ +x` | – | – | not supported | `Unsupported binary operator` / `Unsupported unary operator` *(CLI only)* |

### Checked integer division

`a / b` and `a % b` on `i32` or `i64` follow Rust, not C: the divisor is
checked first, and a zero divisor or `MIN / -1` (`-2147483648 / -1`,
`-9223372036854775808 / -1`, and the same for `%`) prints
`attempt to divide by zero` or `attempt to divide with overflow` to stderr
and exits with status 1 (`tests/cases/div_checked`, `div_zero_panic`,
`div_overflow_panic`; `tests/differential/corpus/int_div_zero`,
`int_div_overflow`). Otherwise the result is the truncating `sdiv` / `srem`:
`-7 / 2` is `-3`, `-7 % 3` is `-1`, `-2147483648 / 1` is `-2147483648`. The
check is two compares and a branch to a cold `div.fail` block that calls the
`noreturn` `sts_panic_div`; because that path exists, a function containing
an integer division is neither `willreturn` nor `readnone`, exactly like one
containing a checked `a[i]`. The rule applies to `/`, `%`, `/=`, and `%=` on
locals, fields, and elements, with constant divisors too (LLVM folds the
check away at `-O1`). Floating-point division is never checked: `x / 0` on
`f64` is `Infinity` and `0 / 0` is `NaN`.

**Unsigned division is checked more cheaply.** `udiv` and `urem` have no
overflow case at all — there is no unsigned value whose negation leaves the
range, so `MIN / -1` has no counterpart — and the check collapses to a
*single* compare against zero, with no `and` and no `or`.
`tests/cases/u_div_one_check` pins the signed and the unsigned sequence side
by side:

```llvm
; u32 a / b                          ; i32 a / b
%0 = icmp eq i32 %b, 0               %0 = icmp eq i32 %b, 0
br i1 %0, ...                        %1 = icmp eq i32 %a, -2147483648
                                     %2 = icmp eq i32 %b, -1
                                     %3 = and i1 %1, %2
                                     %4 = or i1 %0, %3
                                     br i1 %4, ...
```

A zero divisor still prints `attempt to divide by zero` and exits 1, and the
function still loses `willreturn` because the panic is `noreturn`; `attempt to
divide with overflow` is simply unreachable on an unsigned type.

### Calls

- `f(args)` calls a top-level function or an imported one; the callee must
  be a plain identifier (`Only direct calls to named functions are supported`),
  known (`` Unknown function `String` `` *(CLI only)*), and called with
  matching arity and types (see [Functions](#functions)).
- `obj.method(args)` calls a class method with `obj` as `this`
  (`tests/cases/cls_this_method_call`); `this.method(args)` inside a method
  likewise.
- `xs.push(v)` is the only array method (`tests/cases/arr_push`;
  `` Unknown method `pop` on i32[] (supported: push) ``); strings have no
  methods (`` Unknown method `toUpperCase` on string `` *(CLI only)*).
- Builtins are called by dotted name (`console.log`, `Math.sqrt`,
  `process.exit`) or bare name (`toI32`, `parseInt`, `Number`,
  `readFileSync`); a user function with the same bare name shadows the
  builtin. Unknown dotted builtins are `` Unknown builtin `Math.foo` ``
  (`tests/cases/reject_unknown_builtin`).

### `new`

- `new C(args)` for a class: allocates `sizeof(C)` bytes in the arena, or
  on the stack when the object provably does not escape
  ([Memory model](#memory-model)), and runs the constructor (or the inline
  initializers) (`tests/cases/cls_point`, `mem_stack_struct`).
- `new Array<T>(n)`: `n` zero-filled elements; `T` must be a scalar or a
  `U | null` (whose zero fill is `null`); type argument and length required
  (`tests/cases/arr_new_zeroed`, `mem_nullable`;
  `reject_arr_new_string`: `` would zero-fill with null string values ``).
- `new Int32Array(n)`, `new Float64Array(n)`, `new BigInt64Array(n)`: the
  same as `new Array<i32>(n)`, `new Array<f64>(n)`, `new Array<i64>(n)`, with
  the same lowering (`tests/cases/arr_typed_views`); a type argument is
  `` `new Int32Array` takes no type argument ``
  (`reject_arr_typed_view_typearg`).
- Anything else is `` Unsupported `new X` `` / `` Unknown class `X` ``;
  `new Function` and `new Proxy` are forbidden (`reject_new_function`,
  `reject_proxy`).

### Member access

- `s.length` on a string: the UTF-8 byte length as a `number`
  (`tests/cases/str_length`; `reject_length_on_number`, `reject_unknown_property`).
- `a.length` on an array: read-only (`tests/cases/arr_length`;
  `` Cannot assign to `length` of i32[] ``, `reject_arr_length_assign`).
- `p.f` on a class or interface value (`tests/cases/cls_point`).
- `Math.PI`, `Math.E` (`tests/cases/math_i32`); `process.argv` (see
  [`process`](#process)); `Arena.*` (see [`Arena`](#arena)). Any other bare
  identifier before a dot is `` Unknown identifier `os` `` *(CLI only)*.
- Member access on a `T | null` value requires narrowing first
  ([Nullable types](#nullable-types)); `?.` is forbidden
  (`tests/cases/reject_optional_chain`).

### Element access

`a[i]` requires an array `a` (`Cannot index a value of type i32`,
`tests/cases/reject_arr_index_non_array`) and a numeric `i`
(`Array index must be a number, got string`, `reject_arr_string_index`).
The index is sign-extended from `i32` (or truncated toward zero from
`double` in f64 mode) to `i64` and checked against `len` with an unsigned
compare, so negative indices fail too (`tests/cases/arr_bounds_panic`,
`arr_index_read_write`, `arr_f64`). String-keyed access is forbidden by the
validator (`reject_string_key_access`, `reject_non_numeric_index`), and so
is an index outside the "numeric-shaped" forms listed under
[Forbidden constructs](#forbidden-constructs-phase-0-validator): `a[k++]`
and `a[--k]` are `Element access requires a numeric index` *(CLI only)*.

### Array literals

`[a, b, c]` allocates a header and `n` elements; every element must have
one type (`Array literal elements must all have the same type`,
`tests/cases/reject_arr_mixed_literal`). `[]` needs a contextual `T[]` type
(annotation, return type, assignment target, `push` argument, enclosing
literal, or parameter) (`Empty array literal needs a type annotation`,
`reject_arr_empty_literal`; `tests/cases/arr_push`, `arr_literal`). Holes and
spread are not supported.

### Template literals

`` `text ${e} text` `` accepts holes of type `string`, `number`, `i64`,
`f64`, or `boolean` (`Template literal hole must be string, number, or boolean`);
each hole is converted and the parts are concatenated left to right
(`tests/cases/str_template`, `i64_basic`). `` `${s}` `` with a single string
hole is `s` itself (`tests/cases/str_param_passthrough`).

### `this` and object literals

See [Classes](#classes) and [Interfaces](#interfaces-and-object-literals).

## Builtins

No `import` is needed; builtins are resolved by name. Effects (`none`,
`read`, `write`) are what the call does to the purity of the enclosing
function ([ARCHITECTURE.md](ARCHITECTURE.md#attribute-soundness-rules)).

### `console`

| Signature | Semantics | Effect | Test |
| --- | --- | --- | --- |
| `console.log(x: string \| number \| i64 \| f64 \| boolean): void` | Writes `x` and a newline to stdout with one `write(2)`; statement position only; exactly one argument | write | `str_console_log`, `i64_basic`; `reject_console_log_noargs`, `reject_console_log_two_args`, `reject_console_log_as_value`; arrays and objects are rejected (`` `console.log` accepts string, number, or boolean, got i32[] `` *(CLI only)*) |

Numbers print as JavaScript's `String(x)`: exact decimal for `i32`/`i64`,
shortest round-trip digits for `f64` (`0.1`, `1e+21`, `1e-7`, `NaN`,
`Infinity`, `-0` as `0`) (`tests/runtime_test.c`, `tests/cases/str_f64_mode`,
`math_intrinsics`). Booleans print `true`/`false`.

### `Math`

| Signature | Semantics | Effect | Test |
| --- | --- | --- | --- |
| `Math.sqrt/floor/ceil/trunc/sin/cos/exp/log(x: f64): f64` | LLVM intrinsics (`llvm.sqrt.f64`, ...) | none | `math_intrinsics`; `reject_math_i32` (`` requires an f64 argument, got i32 (use --number-mode f64 or toF64(x)) ``) |
| `Math.pow(x: f64, y: f64): f64` | `llvm.pow.f64` plus a `select` for the cases where ECMAScript and C99 differ: `pow(x, NaN)` and `pow(±1, ±Infinity)` are `NaN` (C gives `1`); `pow(x, ±0)` is `1`, `pow(NaN, 0)` is `1`, and every other special case agrees with C | none | `math_intrinsics`; `tests/differential/corpus/f64_pow_spec` |
| `Math.round(x: f64): f64` | JavaScript's round-half-up (`floor` + compare + `select`): `2.5` -> `3`, `-2.5` -> `-2`, `0.49999999999999994` -> `0` | none | `math_intrinsics` |
| `Math.abs(x: T): T` for any numeric `T` | `llvm.abs.*` (wrapping for `INT_MIN`) / `llvm.fabs.f64`; on an unsigned type, no instruction at all (the value is its own magnitude) | none | `math_i32`, `math_intrinsics`; `i64` and the unsigned widths *(CLI only)* |
| `Math.min(a: T, b: T): T`, `Math.max(a: T, b: T): T` | exactly two operands of one numeric type; signed integers: `llvm.smin/smax`; unsigned: `llvm.umin/umax`; `f64`: `llvm.minnum/maxnum` | none | `math_i32`, `math_intrinsics`; `reject_math_min_arity` (`` `Math.min` expects exactly 2 arguments, got 1 ``) |
| `Math.random(): f64` | xorshift64\* in the runtime (`sts_random`), 53 random bits in `[0, 1)`, seeded from time and pid | write | `math_random` |
| `Math.PI: f64`, `Math.E: f64` | constants, also in i32 mode | none | `math_i32`, `math_intrinsics` |

The f64-only functions reject `i32`/`i64` arguments; `number` in i32 mode is
an `i32`, so write `Math.sqrt(toF64(n))` or use f64 mode. A numeric literal
argument is typed `f64` by context (`Math.sqrt(2)` works in both modes).

### Numeric conversions

| Signature | Semantics | Test |
| --- | --- | --- |
| `toI32(x): i32` | narrower or equal width: `trunc` (wraps); wider signed source: `sext`, wider unsigned source: `zext`; `f64`: saturating `llvm.fptosi.sat` (NaN -> 0, out of range clamps); `i32`: identity | `conversions`, `u_conv_roundtrip`; `reject_toi32_string` |
| `toI64(x): i64` | signed source: `sign-extend`; unsigned source: `zext`; `f64`: saturating; `i64`: identity | `conversions`, `u_conv_widths` |
| `toU8`, `toU16`, `toU32`, `toU64` | widening: `zext` from an unsigned source, `sext` from a signed one (so `toU64(-1: i32)` is 2^64 - 1, as `-1i32 as u64` is in Rust); narrowing: `trunc`; `f64`: saturating `llvm.fptoui.sat`, whose clamp is `0 .. 2^bits-1`, so a negative double is `0` | `u_conv_widths`, `u_conv_f64`, `u_conv_roundtrip`; `reject_u_conversion_arg` |
| any integer -> an integer of the **same width** and other signedness | **no instruction at all**: signedness is not part of the LLVM type and the bits do not move (`toU32(i)` on an `i32`, `toI64(q)` on a `u64`) | `u_conv_same_width` |
| `toF64(x): f64` | signed integers: `sitofp`; unsigned integers: `uitofp`; `f64`: identity | `conversions`, `u_conv_f64` |
| `Number(x: string \| i32 \| i64 \| f64 \| boolean): f64` | a string is parsed with JavaScript's `Number(s)` rules (below); `i32`/`i64`: `sitofp`; `boolean`: `uitofp` (`true` is `1`); `f64`: identity. A numeric literal argument is typed `f64` (`Number(2.5)` works in i32 mode) | `parse_numbers`; `reject_number_array` (`` `Number` expects a string, number, or boolean, got i32[] ``) |
| `parseInt(s: string): i32` | base 10 only: ASCII whitespace, an optional sign, then digits (`strtoll`); stops at the first other character. **Deviations from JavaScript:** no `NaN` in an `i32`, so no digits give `0` (`parseInt("abc")`, `parseInt("")`); values beyond the `i32` range saturate exactly like `toI32` (`parseInt("99999999999")` is `2147483647`); a `0x` prefix is not hexadecimal (`parseInt("0x10")` is `0`). Always `i32`, also under `--number-mode f64` (use `Number` there) | `parse_numbers`; `reject_parseint_number` (`` `parseInt` expects a string, got i32 ``) |
| `parseFloat(s: string): f64` | ASCII whitespace, then the longest decimal literal (`[sign] digits [. digits] [e [sign] digits]`, `. digits`, or `[sign] Infinity`), correctly rounded by `strtod`; `NaN` when there is none (`parseFloat("abc")`, `""`, `"."`); `parseFloat("3.14xyz")` is `3.14`, `"1e"` is `1`. **Deviation:** a `0x` prefix is read as hexadecimal like `strtod` (`parseFloat("0x1A")` is `26`; JavaScript stops at the `x` and gives `0`) | `parse_numbers` |

The string parsers accept only ASCII whitespace (` \t\n\v\f\r`), not the
Unicode spaces JavaScript also trims. `Number(s)` trims it on both sides and
then requires the whole string to be one literal: `Number("")` and
`Number("   ")` are `0`, `Number("  7.5  ")` is `7.5`, `Number("12px")`,
`Number("1e")`, `Number("Infinityx")`, `Number("nan")` and `Number("inf")`
are `NaN`, `Number("0x1A")` is `26` (as in JavaScript; hex floats such as
`0x1p3` are also accepted by `strtod`, which JavaScript rejects), and the
`0b`/`0o` prefixes are `NaN` (JavaScript reads them). All three lower to
`sts_parse_number(s, mode)` in the runtime (mode 0 `parseFloat`, 1 `Number`,
2 `parseInt`, the last followed by `llvm.fptosi.sat.i32.f64`); their effect
is write (`strtod`/`strtoll` may set `errno`), so a function that parses is
never `readonly` ([wp7-runtime.md](wp7-runtime.md#string-to-number)).

### `process`

| Signature | Semantics | Effect | Test |
| --- | --- | --- | --- |
| `process.exit(code: i32): void` | `sts_exit` -> libc `exit(code)` (stdio buffers of linked C code are flushed; the arena is abandoned); statement position; a terminator | write, `noreturn` | `process_exit`, `reject_exit_unreachable` |
| `process.argv: string[]` | the command line: `process.argv[0]` is the program path (C's `argv[0]`, one index earlier than Node, whose `argv[0]` is the `node` binary and `argv[1]` the script) and the rest are the arguments as UTF-8 byte strings; read-only | read | `argv_echo` (run with `argv_echo.argv`), `link/argv_import`; `reject_argv_assign`, `reject_argv_push` (`` `process.argv` is read-only ``) |

`process.argv` is an ordinary `string[]` value (`length`, `a[i]`, `for...of`,
passing it to functions, aliasing it with `const args = process.argv`) that
the `@main` wrapper builds once with `sts_argv_init(argc, argv)` before the
program runs; every module of the program may read it, and each read is one
`load` of the runtime global `@sts_argv` (a memory read: the function is at
most `readonly`). The array lives outside the arena, so `Arena.reset()`
never invalidates it. Storing into it (`process.argv[i] = s`, `op=`,
`++`/`--`, `push`) is rejected. A program without `export function main`, as
for a wasm or N-API library, has nothing to build it from and rejects every
use with `` `process.argv` requires a `main` entry point `` (`reject_argv_no_main`,
`tests/link/argv_no_main`). Under the `wasi` build profile the WASI host
supplies the arguments (`examples/wasi-host.mjs`).

### File I/O

| Signature | Semantics | Effect | Test |
| --- | --- | --- | --- |
| `readFileSync(path: string): string` | whole file as one arena string; failure prints `statictsc: cannot read <path>` to stderr and exits 1 | write | `io_files`; `reject_readfile_number` (`` `readFileSync` expects string, got i32 ``) |
| `writeFileSync(path: string, data: string): void` | create/truncate (`0644`) and write; statement position | write | `io_files` |
| `appendFileSync(path: string, data: string): void` | create/append and write; statement position | write | `io_files` |

Paths are relative to the working directory. These are globals, not
`import { readFileSync } from "fs"` (bare imports are rejected).

### Arrays and strings as receivers

| Member | Semantics | Test |
| --- | --- | --- |
| `a.length` | `number`; read-only | `arr_length`, `reject_arr_length_assign` |
| `a.push(v: T): number` | appends; grows capacity by doubling (4 from 0) through `sts_array_grow`; returns the new length | `arr_push`; `reject_arr_push_type` (`Cannot push string onto i32[]`) |
| `s.length` | `number`, the UTF-8 byte length | `str_length` |

There are no other array or string methods (`pop`, `slice`, `indexOf`,
`map`, `toUpperCase`, `charAt`, ...) and no `toString` (template literals
and `console.log` convert numbers); string-to-number parsing is the bare
`Number(s)` / `parseInt(s)` / `parseFloat(s)` under
[Numeric conversions](#numeric-conversions).

### `Arena`

Explicit control of the arena the runtime allocates from
(`tests/cases/mem_arena_builtins`; [wp6-memory.md](wp6-memory.md#3-explicit-control)).
The automatic placement described under [Memory model](#memory-model) makes
these unnecessary for most programs; they exist for code that manages
batches itself. All four are available in both number modes.

| Signature | Semantics | Effect | Test |
| --- | --- | --- | --- |
| `Arena.mark(): i64` | the current bump address (`sts_arena_mark`; `0` while the arena is empty) | write | `mem_arena_builtins` |
| `Arena.release(m: i64): void` | free everything allocated since `m` (`sts_arena_release`); statement position; an integer literal argument is typed `i64` by context; `m == 0` behaves like `Arena.reset()`; a stale mark is ignored | write | `mem_arena_builtins`; `reject_arena_release_type` (`` `Arena.release` expects i64, got i32 ``) |
| `Arena.reset(): void` | recycle everything in O(1), keeping the newest chunk (`sts_reset_arena`); statement position | write | `mem_arena_builtins`; `` `Arena.reset` returns void and can only be used as a statement `` *(CLI only)* |
| `Arena.used(): i64` | bytes bumped in the current chunk (`sts_arena_used`); the number the memory tests watch | write | `mem_arena_builtins`, `mem_scope_dynamic_array` |

`mark` and `used` only read the arena, but they are recorded as writes so
that a caller is never hoisted across an allocation. **Safety rule**:
releasing or resetting while any object, array, or string allocated after
the mark is still referenced is undefined behaviour (the memory is reused by
the next allocation). A function that calls `Arena.release` or `Arena.reset`
itself, or through a callee, never gets an automatic arena scope, so the
compiler's own marks are never invalidated by user resets.

## Semantics decisions

- **Integers wrap.** `i32`, `i64` and the unsigned widths do two's-complement
  wrapping arithmetic (no `nsw`, no `nuw`), like Rust release builds:
  `2147483647 + 1` is `-2147483648` and `(255: u8) + 1` is `0`
  (`tests/cases/i64_basic`, `int_min_literal`, `u_arith_wrap`;
  `wp1-control-flow.md`). `Math.abs(-2147483648)` wraps to itself. With
  `--nsw`, every user-level integer `add`/`sub`/`mul` (binary operators, unary
  minus, `op=` on locals, fields, and elements, `++`/`--`) carries a no-wrap
  flag and overflow becomes undefined behaviour, as in C: `nsw` on a signed
  type and `nuw` on an unsigned one, because a `u32` passing 2^31 has not
  overflowed and `nsw` there would poison an ordinary result. Division,
  remainder, shifts, and the compiler's own index, length, and allocator
  arithmetic are never flagged (`tests/cases/opt_nsw`;
  [wp9-optimisation.md](wp9-optimisation.md#--nsw)).
- **Integer division is checked**: `sdiv`/`srem` truncating toward zero
  (`-7 / 2` is `-3`, `-7 % 2` is `-1`; `tests/cases/cf_collatz`,
  `cf_do_while`), preceded by a divisor check that exits with status 1 on a
  zero divisor (`attempt to divide by zero`) or `MIN / -1`
  (`attempt to divide with overflow`), like Rust and unlike JavaScript's
  `0` (`tests/cases/div_checked`, `div_zero_panic`, `div_overflow_panic`;
  [Checked integer division](#checked-integer-division)).
- **`Math.pow`** follows ECMAScript where C99 `pow` differs
  (`pow(x, NaN)`, `pow(±1, ±Infinity)` are `NaN`; see the `Math` table).
- **`f64`** follows IEEE-754: `x / 0` is `Infinity`, `x !== x` detects NaN
  (`fcmp une`), `%` is `frem` (`tests/cases/f64_mode`, `conversions`).
- **Strings** are immutable UTF-8 byte sequences; `.length` is the byte
  length (`"héllo".length` is `6`, not JavaScript's `5`); `===` compares
  content; there is no implicit conversion (`"a" + 1` is an error; write
  `` `a${1}` ``); no ordering (`<`) is defined (`tests/cases/str_length`,
  `str_eq`, `reject_str_plus_number`, `reject_str_lt_str`).
- **Number formatting** matches `String(x)` in JavaScript (see `console`).
- **`Math.round`** rounds half toward +infinity like JavaScript;
  `Math.round(-0.3)` is `+0` here and `-0` in JavaScript (both print `0`).
  **`Math.min`/`Math.max`** on `f64` use `minnum`/`maxnum`: with one NaN
  operand they return the other operand (JavaScript returns NaN) and
  `min(0, -0)` may return either zero. Both take exactly two arguments.
- **`toI32`/`toI64` from `f64` saturate** (NaN -> 0, `toI32(5e10)` ->
  `2147483647`) like a Rust `as` cast, not JavaScript's modulo-2^32
  `ToInt32`. Integer-to-integer conversions wrap (`toI32(5000000000)` ->
  `705032704`) (`tests/cases/conversions`).
- **No exceptions.** Functions are `nounwind`; `throw` traps
  (`tests/cases/cf_throw`); runtime failures (bounds check, integer
  division, file errors, out of memory) print a message to stderr and exit
  with status 1 (`tests/cases/arr_bounds_panic`:
  `index out of range: <i> >= <len>`; `div_zero_panic`:
  `attempt to divide by zero`).
- **Bounds checks** on every `a[i]` read and write, unsigned, so `-1` fails
  (`tests/cases/arr_bounds_panic`); `--unchecked-indexing` removes them
  (`tests/cases/arr_unchecked`), after which out-of-range is undefined
  behaviour.
- **`new Array<T>(n)` zero-fills** (`0` / `false`), no holes; pointer element
  types are rejected because a zeroed pointer would be null
  (`tests/cases/arr_new_zeroed`, `reject_arr_new_string`).
- **Typed-array names are aliases, not views.** `Int32Array` is `i32[]` with
  every array operation, `push` included; there is no separate buffer type,
  no `subarray`, and no `Uint8Array` / `Float32Array` (`boolean[]` has no
  flat JS view because an `i1` must be 0 or 1). At a host boundary the
  alias names the JS typed array that crosses ([wp8-interop.md](wp8-interop.md)).
- **Evaluation order** follows JavaScript: `x op= e` reads `x` before
  evaluating `e` (`tests/cases/cf_compound_assign`); `a[i] = v` evaluates
  `a`, `i`, `v`, then checks and stores; `a[i] op= v` evaluates `a`, `i`,
  checks, loads, evaluates `v`, stores (`tests/cases/arr_index_read_write`);
  `p.f op= v` reads the field before `v` (`tests/cases/cls_compound_field`);
  array literal elements are evaluated before the allocation
  (`tests/cases/arr_literal`); `push`'s argument is evaluated before the
  length is read (`tests/cases/arr_push`).
- **Arrays and objects are references**: `===` is identity; `const b = a;
  b.push(2)` is visible through `a` *(CLI only)*; assignment never copies.
- **Method dispatch is static.** `x.m()` calls the `m` of `x`'s declared
  type (or its nearest ancestor that declares one), decided at compile time;
  an override in a derived class is reached only through a receiver whose
  declared type is that class. There is no vtable, so `Base.report()`
  calling `this.area()` always runs `Base.area` even on a derived object
  (`tests/cases/cls_extends_override`; see [Classes](#classes)).
- **Memory** is one global bump arena plus the stack, decided at compile
  time (see [Memory model](#memory-model)); nothing is freed individually;
  `main`'s wrapper releases everything on exit. Objects, arrays, and strings
  are never null unless typed `T | null`.
- **Parameters are immutable** and used as SSA values; locals use
  `alloca`/`load`/`store` and are promoted by `mem2reg`.
- **Every function is an external C symbol** unless `--strict-exports`.

### Memory model

There is no garbage collector. Every object, array, and runtime string is
placed by one of three mechanisms, all decided at compile time
([wp6-memory.md](wp6-memory.md)); none changes what a program computes, only
where its memory lives and when it is reused.

1. **Stack allocation.** A `new C(...)`, object literal, array literal, or
   `new Array<T>(<non-negative integer literal>)` whose value provably does
   not outlive its function becomes an `alloca` in the entry block
   (`tests/cases/mem_stack_struct`, `mem_stack_array_literal`). "Provably"
   means the value only ever flows into uses that consume it on the spot
   (operands, conditions, field and element access, `.length`, `for...of`,
   arguments to callees that do not capture the parameter, runtime
   builtins) or into `const`-like locals that are never reassigned; it
   stays in the arena when it is returned, stored into a field or element,
   pushed, assigned to another variable (`let q = p` included), held by a
   reassigned `let`, or passed to a callee that captures it
   (`tests/cases/mem_stack_escape`). A site inside a loop gets one slot,
   reused every iteration (`tests/cases/mem_stack_loop`). Stack arrays are
   capped at 4096 bytes of data; a later `push` moves the elements to the
   arena and the header stays valid. `--no-stack-alloc` turns this off.
2. **Automatic arena scopes.** A function whose arena temporaries all die
   with it (a dynamic `new Array<T>(n)`, `push` growth on its own array, a
   string concatenation or template, a number printed by `console.log`, a
   callee's returned allocation), that neither returns nor leaks an
   allocation, has no callee that leaks one, and never calls `Arena.reset` /
   `Arena.release`, calls `sts_arena_mark` on entry and `sts_arena_release`
   before every `ret` (`tests/cases/mem_scope_dynamic_array`,
   `mem_scope_string_temp`: 100000 calls leave `Arena.used()` unchanged).
   Scopes are per function, not per loop iteration.
3. **Explicit control** with the [`Arena`](#arena) builtins, and
   `sts_reset_arena()` / `sts_arena_mark()` / `sts_arena_release()` for a C
   or Node host ([wp8-interop.md](wp8-interop.md)).

Everything else is bumped from the arena by the inlined fast path, and the
arena is released when `main` returns. Objects stored into fields or arrays
never move to the stack, and a returned object is always arena memory owned
by the caller.

### Target and overflow flags

- **`--target <triple>`** / **`--target host`** writes `target datalayout`
  and `target triple` (the strings clang 18 emits for that triple) into every
  module: `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`,
  `x86_64-apple-darwin`, `aarch64-apple-darwin`, `wasm32-unknown-unknown`,
  `wasm32-wasi`, plus common aliases (`x86_64-linux`, `arm64-apple-darwin`,
  `wasm32`, ...); anything else, and `host` on an unsupported machine, is a
  usage error (exit 2) listing the supported triples
  (`tests/cases/opt_target_triple`). The default emits neither line, so
  clang supplies them at link time; the flag matters when running `opt` or
  `llc` by hand, which otherwise assume a generic layout and never vectorise
  ([wp9-optimisation.md](wp9-optimisation.md#--target-triple-and---target-host)).
- **`--nsw`**: see *Integers wrap* above (`tests/cases/opt_nsw`).
- **`--unchecked-indexing`**: see *Bounds checks* above.
- **`--no-stack-alloc`**: see *Memory model* above.

### Diagnostics and debugging flags

- **Errors are collected, not thrown on the first.** Phase 0 reports every
  forbidden construct in a file; pass 1 recovers per declaration (a rejected
  class, interface, import or function signature is skipped); pass 2 recovers
  per statement (the enclosing function is marked poisoned and the next
  statement is checked). A phase that found anything stops the pipeline
  before the next one, so pass 2 never sees a broken signature and the
  emitter never sees a poisoned function. Errors print in source order
  (files in load order), at most 20 before `...and N more errors`, followed
  by an `N errors` line; a lone error prints exactly as before
  (`tests/cases/reject_multi_error`, `reject_multi_forbidden`,
  `reject_multi_decl`). A `let x: T = <rejected>` still declares `x` as `T`
  so later uses do not cascade.
- **`--json`** prints every error as one JSON object per line on stdout,
  `{"file","line","column","endLine","endColumn","severity":"error","message"}`
  (1-based, end exclusive; syntax errors carry a `syntax error: ` prefix in
  `message`; `code` is reserved), nothing else on stdout and nothing on
  stderr, with the same exit code. A clean compile prints nothing.
- **`--emit-ast`** prints the syntax tree of every module after Phase 0 as an
  indented `<SyntaxKind> <line:col>-<line:col>` tree (identifier and literal
  text appended) and writes no IR (`tests/cases/dump_ast`).
- **`--emit-checked`** checks the program and prints the side tables the
  emitter would consume: per module its structs (fields with index and byte
  offset, size, align, constructor and methods), imports, and functions
  (resolved signature, LLVM symbol, attribute facts, pointer-parameter facts,
  locals with types, callees) (`tests/cases/dump_checked`).
- **`-g`** emits DWARF metadata: a `DICompileUnit` (`DW_LANG_C99`) and
  `DIFile` per module, a `DISubprogram` per function, a `DILocation` on every
  instruction (each statement's and expression's start; the function's own
  line for the prologue), `llvm.dbg.value` for parameters and
  `llvm.dbg.declare` for `let`/`const` slots. `number` is `int`, `i64`
  `long`, `f64` `double`, `boolean` `bool`, `string` `char*`, a class or
  interface a pointer to a `DICompositeType` with the checker's layout, `T[]`
  a pointer to `{ long len; long cap; T* data; }`. Without `-g` the IR is
  byte-identical. `--link -g` passes `-g` to `scripts/build.sh`, which
  compiles `runtime.c` with `-g` and skips the strip step of every profile
  (`tests/cases/dbg_locals`; the `-g` block of `tests/run.js` checks the
  linked binary's line table with `llvm-dwarfdump`).

## Forbidden constructs (Phase 0 validator)

`src/validator.ts` walks the whole syntax tree before the checker and rejects
everything below on the first hit, regardless of where it appears (even in
dead code or nested type arguments). Each row gives the exact message
fragment `tests/run.js` matches and the case that proves it.

### Types

| Construct | Message | Test |
| --- | --- | --- |
| `any` anywhere, including nested type arguments | `` `any` is forbidden in StaticTS `` | `reject_any_param`, `reject_any_nested` |
| `unknown` | `` `unknown` is forbidden in StaticTS `` | `reject_unknown_param`, `reject_unknown_nested` |
| `symbol` type | `` `symbol` type is forbidden in StaticTS (no symbol type) `` | `reject_symbol_type` |
| `bigint` type | `` `bigint` type is forbidden in StaticTS (use number, i32, or f64) `` | `reject_bigint_type` |
| `undefined` type | `` `undefined` is forbidden in StaticTS; use `null` with a `T \| null` type `` | `reject_union_undefined` (via the union rule) |
| union types other than `T \| null` / `null \| T` | `` Union types other than `T \| null` are forbidden in StaticTS (values have one fixed layout) `` | `reject_union_type`, `reject_union_undefined` |
| `Function`, `Symbol`, `Proxy` as type names | `` `Function` type is forbidden in StaticTS (no dynamic function values) `` (and analogous) | `reject_function_type` |
| `import("x").T` | `` Dynamic `import()` is forbidden in StaticTS (modules are resolved at compile time) `` | `reject_dynamic_import` |
| `x as any`, `<any>x` | `` Type assertion to `any` is forbidden in StaticTS `` | `reject_as_any` |
| `x as unknown`, `<unknown>x` | `` Type assertion to `unknown` is forbidden in StaticTS `` | `reject_as_unknown` |

### Declarations

| Construct | Message | Test |
| --- | --- | --- |
| type parameters on functions, methods, arrows, classes, interfaces, type aliases | `` Generic type parameters are forbidden in StaticTS (no monomorphisation yet) `` | `reject_generic_function`, `reject_generic_class` |
| generators (`function*`) | `` Generators are forbidden in StaticTS (no coroutine runtime) `` | `reject_generator` |
| `async` functions, methods, arrows | `` `async` functions are forbidden in StaticTS (no event loop or promises) `` | `reject_async_function` |
| `var` | `` `var` is forbidden; use `let` or `const` `` | `reject_var_keyword`, `reject_var_in_for` |
| enum members that are not numeric literals | `` Enum members must be numeric literals in StaticTS (enums lower to plain integers) `` | `reject_enum_string`, `reject_enum_computed` (numeric enums then fail in the checker as top-level statements) |
| `namespace` / `module` blocks | `` `namespace` and `module` blocks are forbidden in StaticTS (use ES module files) `` | `reject_namespace` |
| `declare global` | `` `declare global` is forbidden in StaticTS (no global object to augment) `` | `reject_declare_global` |
| decorators | `` Decorators are forbidden in StaticTS (no runtime metadata or class rewriting) `` | `reject_decorator` |
| computed property names | `` Computed property names are forbidden in StaticTS (object layout is fixed at compile time) `` | `reject_computed_property` |

### Statements

| Construct | Message | Test |
| --- | --- | --- |
| `with` | `` `with` is forbidden in StaticTS (no dynamic scope) `` | `reject_with_statement` |
| `try` / `catch` / `finally` | `` `try`/`catch`/`finally` is forbidden in StaticTS (no unwinding; `throw` aborts) `` | `reject_try_catch` |
| `debugger` | `` `debugger` is forbidden in StaticTS (no debugger hook) `` | `reject_debugger` |
| labeled statements | `` Labeled statements are forbidden in StaticTS (use structured loops) `` | `reject_labeled_statement` |

### Expressions

| Construct | Message | Test |
| --- | --- | --- |
| `eval(...)`, `eval` as a value | `` `eval` is forbidden in StaticTS (no interpreter at runtime) `` | `reject_eval` |
| `Function(...)` | `` `Function` constructor is forbidden in StaticTS (no interpreter at runtime) `` | (validator; no case) |
| `new Function(...)` | `` `new Function` is forbidden in StaticTS (no interpreter at runtime) `` | `reject_new_function` |
| `Function` as a value | `` `Function` is forbidden in StaticTS (no interpreter at runtime) `` | (validator; no case) |
| `new Proxy(...)` | `` `new Proxy` is forbidden in StaticTS (no dynamic property interception) `` | `reject_proxy` |
| `Proxy` as a value | `` `Proxy` is forbidden in StaticTS (no dynamic property interception) `` | (validator; no case) |
| `Reflect` | `` `Reflect` is forbidden in StaticTS (no runtime reflection) `` | `reject_reflect` |
| `Symbol(...)`, `Symbol` as a value | `` `Symbol` is forbidden in StaticTS (no symbol type) `` | `reject_symbol_value` |
| `globalThis` | `` `globalThis` is forbidden in StaticTS (no global object) `` | `reject_globalthis` |
| `arguments` | `` `arguments` is forbidden in StaticTS (functions have fixed arity) `` | `reject_arguments` |
| `undefined` as a value | `` `undefined` is forbidden in StaticTS; use `null` with a `T \| null` type `` | `reject_undefined_value` |
| `void expr` | `` `void` expressions are forbidden in StaticTS (no `undefined` value) `` | `reject_void_expression` |
| `==`, `!=` | `Loose equality is forbidden; use === / !==` | `reject_loose_equality`, `reject_loose_inequality` |
| `in` | `` `in` operator is forbidden in StaticTS (no dynamic property lookup) `` | `reject_in_operator` |
| `a?.b`, `a?.[i]`, `f?.()` | `` Optional chaining `?.` is forbidden in StaticTS (narrow with `!== null` instead) `` | `reject_optional_chain` |
| `a ?? b` | `` Nullish coalescing `??` is forbidden in StaticTS (narrow with `!== null` instead) `` | `reject_nullish` |
| `instanceof` | `` `instanceof` is forbidden in StaticTS (no prototype chain) `` | `reject_instanceof` |
| comma expressions | `Comma expressions are forbidden in StaticTS (write separate statements)` | `reject_comma_expression` |
| `typeof x` | `` `typeof` is forbidden in StaticTS (no runtime type tags) `` | `reject_typeof_operator` |
| `delete x.y` | `` `delete` is forbidden in StaticTS (object layout is fixed) `` | `reject_delete` |
| `await` | `` `await` is forbidden in StaticTS (no event loop or promises) `` | `reject_await` |
| `yield` | `` `yield` is forbidden in StaticTS (no coroutine runtime) `` | (validator; generators are rejected first, `reject_generator`) |
| regex literals | `Regular expression literals are forbidden in StaticTS (no regex engine in the runtime)` | `reject_regex` |
| `bigint` literals (`10n`) | `` `bigint` literals are forbidden in StaticTS (use number, i32, or f64) `` | `reject_bigint_literal` |
| object spread `{ ...a }` | `Object spread is forbidden in StaticTS (object layout is fixed at compile time)` | `reject_object_spread` |
| `{ __proto__: x }` | `` `__proto__` is forbidden in StaticTS (no prototype chain) `` | `reject_proto_literal` |
| `x.__proto__` | `` `__proto__` access is forbidden in StaticTS (no prototype chain) `` | `reject_proto_access` |
| `x.prototype` | `` `.prototype` access is forbidden in StaticTS (no prototype chain) `` | `reject_prototype_access` |
| `Object.assign/create/defineProperty/defineProperties/setPrototypeOf/getPrototypeOf` | `` `Object.assign` is forbidden in StaticTS (object layout is fixed at compile time) `` (and analogous) | `reject_object_assign`, `reject_object_define_property`, `reject_object_set_prototype` |
| `o["x"]`, `` o[`x`] `` | `` String-keyed element access is forbidden in StaticTS; use `obj.name` (no dynamic property lookup) `` | `reject_string_key_access` |
| `o[true]`, `o[{}]`, ... (non-numeric-shaped key) | `Element access requires a numeric index in StaticTS (no dynamic property lookup)` | `reject_non_numeric_index` |
| dynamic `import(...)` | `` Dynamic `import()` is forbidden in StaticTS (modules are resolved at compile time) `` | `reject_dynamic_import` |

"Numeric-shaped" index keys pass the validator (identifiers, numeric
literals, parentheses, unary `+`/`-`, `+ - * / %` over those, calls,
property and element access); the checker then requires a numeric type.

## Rejected by the checker

Everything the validator lets through but the checker cannot compile. The
messages are exact for the cases cited; other rows quote
`src/checker/*.ts` and `src/types.ts`.

| Situation | Message | Test |
| --- | --- | --- |
| top-level statement other than function/class/interface/import | `Only top-level function declarations are supported in Phase 1 (found <Kind>)` | `reject_top_level_stmt` |
| missing return type | `` Function `f` needs an explicit return type annotation `` | `reject_missing_return_type` |
| unknown identifier | `` Unknown identifier `x` `` | `reject_unknown_ident` |
| wrong arity | `` `f` expects 1 argument(s), got 2 `` | `reject_arity` |
| mixed operand types | `` Operator `+` requires two operands of the same numeric type, got i32 and boolean `` | `reject_type_mismatch`, `reject_i64_mixed` |
| string `+` number | `` ... got string and i32 (no implicit string conversion; use a template literal) `` | `reject_str_plus_number` |
| ordering on booleans / strings / structs | `` Operator `<` requires two numeric operands, got string and i32 `` | `reject_bool_ordering`, `reject_str_lt`, `reject_str_lt_str`, `reject_cls_ordering` |
| `T \| null` misuse | see [Nullable types](#nullable-types) | `reject_nullable_scalar`, `reject_null_to_nonnull`, `reject_null_field_access`, `reject_null_compare_two`, `reject_null_narrowing_leaks`, `reject_null_narrowing_assigned` |
| `Arena.release` with a non-`i64` argument | `` `Arena.release` expects i64, got i32 `` | `reject_arena_release_type` |
| non-integer literal in i32 mode | `` Non-integer literal `1.5` in i32 number mode (use --number-mode f64) `` | `reject_float_in_i32` |
| non-boolean condition | `Condition must be boolean, got i32 (StaticTS has no truthiness)` | `reject_cf_nonbool_cond` |
| `&&`/`\|\|` on numbers | `` Operator `&&` requires boolean operands, got i32 and i32 `` | `reject_cf_logical_numbers` |
| ternary arm mismatch | `Ternary branches must have the same type, got i32 and boolean` | `reject_cf_ternary_mismatch` |
| assignment to `const` / parameter | `` Cannot assign to `x` because it is a const `` / `... a parameter` | `reject_assign_const`, `reject_assign_param`, `reject_cf_compound_const`, `reject_cf_incdec_param` |
| missing return | `` Function `f` must return a value of type i32 on every path `` | `reject_missing_return`, `reject_cf_missing_return_loop` |
| unreachable code | `Unreachable code after return` / `break` / `process.exit` / ... | `reject_unreachable`, `reject_cf_unreachable_after_break`, `reject_exit_unreachable` |
| `break`/`continue` outside a loop | `` `break` outside of a loop `` | `reject_cf_break_outside`, `reject_cf_continue_outside` |
| `console.log` misuse | `` `console.log` expects exactly 1 argument, got 0 `` / `returns void and can only be used as a statement` | `reject_console_log_noargs`, `reject_console_log_two_args`, `reject_console_log_as_value` |
| unknown property / method / builtin | `` Unknown property `foo` on string `` / `` Unknown property `length` on i32 `` / `` Unknown builtin `Math.foo` (supported: ...) `` | `reject_unknown_property`, `reject_length_on_number`, `reject_unknown_builtin` |
| `Math.*` on an integer | `` `Math.sqrt` requires an f64 argument, got i32 (use --number-mode f64 or toF64(x)) `` | `reject_math_i32` |
| conversion of a non-number | `` `toI32` expects a number (i32, i64, or f64), got string `` | `reject_toi32_string` |
| I/O with the wrong type | `` `readFileSync` expects string, got i32 `` | `reject_readfile_number` |
| array errors | see [Arrays](#array-literals), [Element access](#element-access), [`for...of`](#for-const-x-of-a) | `reject_arr_*` |
| class and interface errors | see [Classes](#classes), [Interfaces](#interfaces-and-object-literals) | `reject_cls_*` |
| inheritance errors: `extends` on an interface, unknown or imported base, cycles, redeclared field, changed override signature, `super` misuse, downcast | `` Class `User` cannot extend interface `Named`; use `implements Named` `` / `` Inheritance cycle: class `Pong` extends `Ping`, which already extends `Pong` `` / `` `super(...)` must be the first statement of the constructor of `Derived` `` / ... (see [Classes](#classes)) | `reject_cls_extends_*`, `reject_cls_super_*`, `reject_cls_override_signature`, `reject_cls_shadow_field`, `reject_cls_this_before_super`, `reject_cls_readonly_inherited`, `reject_cls_downcast`, `tests/link/extends_imported_base` |
| module errors | see [`export` and `import`](#export-and-import), [`main`](#main) | `reject_bare_import`, `reject_default_import`, `reject_namespace_import`, `reject_side_effect_import`, `reject_missing_module`, `reject_export_*`, `reject_main_params`, `tests/link/*` |
| unsupported syntax the validator allows | `Unsupported statement in Phase 1: <Kind>` / `Unsupported expression in Phase 1: <Kind>` / `` Unsupported binary operator `**` `` / `` Unsupported unary operator `~` `` / `` Unsupported type `...` `` | *(CLI only)* |

## Known inconsistencies

Behaviour observed with the current compiler that disagrees with the design
notes, the runtime header, or JavaScript beyond the documented semantics
decisions. Listed here so the reference stays truthful; each is a candidate
fix, not a feature. (Found by the first audit and fixed since, so no longer
listed: inverted boolean ordering, silently accepted `?.`, the rejected
`-2147483648` literal, undefined `x / 0` and `INT_MIN / -1`, and
`Math.pow(1, NaN)`.)

All four discrepancies found by the documentation audit (the `main`
parameter message, the `%.17g` comment in `statictsc.h`, the exclusive
`i64` literal bound, and the generic message for comparing `T | null` with
`T`) are fixed; `2^53` is accepted as an `i64` literal and the nullable
comparison names the nullable side.
