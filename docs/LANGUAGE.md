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
[Declarations](#declarations) · [Statements](#statements) ·
[Expressions](#expressions) · [Builtins](#builtins) ·
[Semantics decisions](#semantics-decisions) ·
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
  rejected with ``Literal `...` does not fit in i32`` *(CLI only)*; note
  that `-2147483648` is also rejected because the check runs on the
  unsigned literal before negation (see
  [Known inconsistencies](#known-inconsistencies)).
- **String literals.** `"..."`, `'...'`, and `` `...` `` without holes are
  all plain string literals; `` `...${x}...` `` is a template literal
  (`tests/cases/str_literal`, `str_template`). TypeScript escapes (`\n`,
  `\"`, `\\`, `\u...`) are decoded by the parser and re-encoded as UTF-8
  (`tests/cases/str_escape`).
- **Boolean literals** `true`, `false` (`tests/cases/cf_logical`).
- **`null` and `undefined`** are not values today: `null` is rejected as
  `Unsupported expression in Phase 1: NullKeyword` *(CLI only)* and
  `undefined` with `` `undefined` is forbidden `` (`tests/cases/reject_undefined_value`).
  `T | null` is reserved for WP6.
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
| `boolean` | `i1` | 1 / 1 | `bool` | `zeroext` at the ABI boundary. |
| `string` | `i8*` to `{ i64 len, i8 data[len], i8 0 }` | 8 / 8 (pointer) | `const sts_str *` in, `sts_str *` out | Immutable, 8-aligned, NUL-terminated (so `data` is a C string; sharing a pointer is always safe, nothing is ever copied); literals are module constants, everything else lives in the arena; `len` is the UTF-8 byte length. |
| `T[]`, `Array<T>` | `%struct.sts_array*` to `{ i64 len, i64 cap, i8* data }` | 8 / 8 (pointer); header 24 bytes | (not representable) | One element type; `data` holds `cap` elements of `sizeof(T)`; bounds-checked. |
| `class C`, `interface I` | `%struct.C*` to `%struct.C = type { fields in declaration order }` | 8 / 8 (pointer); struct as clang lays out the same C struct | (not representable) | Arena-allocated, no header, no vtable. |
| `void` | `void` | – | `void` | Return type only. |

Sources: `src/types.ts` (`llvmType`, `alignOf`), `src/interop/abi.ts`
(`cType`); `tests/cases/i64_basic`, `f64_mode`, `str_literal`, `arr_literal`,
`cls_point`; the ten-struct layout test `tests/layout/structs.ts` (offsets and
`sizeof` cross-checked against clang, [wp2-classes.md](wp2-classes.md#layout)).

Type rules:

- **Accepted type syntax**: `number`, `i32`, `i64`, `f64`, `boolean`,
  `string`, `void`, `T[]`, `Array<T>` (exactly one type argument:
  `` `Array` needs exactly one type argument ``), and the name of a class or
  interface declared or imported in the module. Anything else is
  `` Unsupported type `...` `` / `` Unsupported type reference `...` ``
  (`src/types.ts`; `tests/cases/reject_union_type`, `reject_function_type`).
  `T | null` is accepted by the validator but not yet by the checker
  (WP6).
- **No implicit conversion.** `const y: f64 = x` with `x: number` in i32
  mode is `Cannot initialize f64 variable ... with i32` *(CLI only)*;
  `x + n` with `x: i64`, `n: number` is rejected
  (`tests/cases/reject_i64_mixed`); convert explicitly with `toI32`,
  `toI64`, `toF64` (`tests/cases/conversions`).
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

`-5` and `(5)` count as the literal. "Known type" means an already-checked
left operand, a variable, or a call to a user function or to
`toI32/toI64/toF64`. A literal in an integer context must be integral
(`` Non-integer literal `1.5` where i64 is expected ``,
`tests/cases/reject_i64_literal_float`); in an `i64` context it must also be
at most 2^53 in magnitude (`` exceeds 2^53 and cannot be written exactly ``
*(CLI only)*) because TypeScript's parser has already rounded larger
literals to a double.

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
  `tests/cases/reject_main_params`; `process.argv` does not exist yet) and
  returns `void` (exit code 0, `tests/cases/entry_main_void`) or an
  `i32`-lowered `number` (`tests/cases/entry_main`, `tests/link/two_file`).
  In f64 mode declare `main(): i32`; `main(): number` is rejected with
  `` `main` must return void or an i32 number ... under --number-mode f64 declare `main(): i32` ``
  *(CLI only)*.
- The user's function is emitted as `@sts_main`; the compiler adds a C
  `@main(i32 %argc, i8** %argv)` wrapper that calls it, frees the arena, and
  returns the code. A non-exported `function main` is an ordinary function
  named `@main` (for C drivers such as `tests/driver.c`).

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
  `<` and friends are rejected (`tests/cases/reject_cls_ordering`).
- **Rejected**: `extends` (`Class inheritance (`extends`) is not supported yet (WP2b)`,
  `tests/cases/reject_cls_extends`), `static` (`tests/cases/reject_cls_static`),
  getters/setters (`Getters and setters are not supported`), optional fields
  (`cannot be optional`), index signatures, `!` assertions, `abstract`,
  `declare class`, generics (`tests/cases/reject_generic_class`), decorators
  (`reject_decorator`), computed member names (`reject_computed_property`),
  overloaded constructors.

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
  field store, ternary arm) by one `bitcast`; a class with identical fields
  that does not list `I` is not assignable (`tests/cases/cls_implements`,
  `reject_cls_not_implements`).

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
| `+ - * / %` | two `i32`, two `i64`, or two `f64` (same type) | that type | `add sub mul sdiv srem` / `fadd fsub fmul fdiv frem`, no `nsw` | `add`, `locals`, `i64_basic`, `f64_mode`; `reject_type_mismatch` |
| `+` | two `string` | `string` | `sts_str_concat` | `str_concat`; `reject_str_plus_number` (`no implicit string conversion`) |
| unary `-` | `i32`, `i64`, `f64` | same | `sub i32 0, x` / `sub i64 0, x` / `fneg double x` | `cf_if` (`-x`), `i64_basic`; `f64` *(CLI only)* |
| unary `!` | `boolean` | `boolean` | `xor i1 x, true` | `cf_logical`; `!s` on a string is `` Unsupported unary operator `!` on string `` *(CLI only)* |
| `< <= > >=` | two numbers of one type, or two booleans | `boolean` | `icmp slt ...` / `fcmp olt ...` | `cf_if`, `f64_mode`; strings rejected (`reject_str_lt`, `reject_str_lt_str`); structs rejected (`reject_cls_ordering`); see [Known inconsistencies](#known-inconsistencies) for booleans |
| `=== !==` | any two values of the same type except `void` | `boolean` | integers and booleans: `icmp eq` / `icmp ne`; `f64`: `fcmp oeq` / `fcmp une` (so `x !== x` is true for NaN); strings: `sts_str_eq` (content); arrays and objects: `icmp eq` on the pointer (identity) | `str_eq`, `cls_this_method_call`, `conversions`; arrays *(CLI only)* |
| `== !=` | – | – | forbidden | `reject_loose_equality`, `reject_loose_inequality` |
| `&& \|\|` | two `boolean` | `boolean` | short-circuit: `br` + `phi` | `cf_logical`; `reject_cf_logical_numbers` (`requires boolean operands`) |
| `c ? a : b` | `c: boolean`; `a`, `b` same non-`void` type | that type | `br` + `phi` | `cf_ternary`; `reject_cf_ternary_mismatch` |
| `x = e` | mutable local, field, or element; `e` of the target's type | the target's type | `store` | `locals`, `cls_field_write`, `arr_index_read_write` |
| `x op= e` (`+= -= *= /= %=`) | numeric mutable local, numeric field, or numeric element; same type | the target's type | load, op, store | `cf_compound_assign`, `cls_compound_field`, `arr_index_read_write`; `reject_cf_compound_const` |
| `++x --x x++ x--` | numeric mutable local only | the new / old value | load, `add 1`, store | `cf_incdec`; `reject_cf_incdec_param` |
| `,` | – | – | forbidden | `reject_comma_expression` |
| `** & \| ^ << >> >>> ~ +x ?? in instanceof typeof delete void` | – | – | not supported / forbidden | `Unsupported binary operator` / `Unsupported unary operator` *(CLI only)*; `reject_in_operator`, `reject_instanceof`, `reject_typeof_operator`, `reject_delete`, `reject_void_expression` |

### Calls

- `f(args)` calls a top-level function or an imported one; the callee must
  be a plain identifier (`Only direct calls to named functions are supported`),
  known (`` Unknown function `Number` `` *(CLI only)*), and called with
  matching arity and types (see [Functions](#functions)).
- `obj.method(args)` calls a class method with `obj` as `this`
  (`tests/cases/cls_this_method_call`); `this.method(args)` inside a method
  likewise.
- `xs.push(v)` is the only array method (`tests/cases/arr_push`;
  `` Unknown method `pop` on i32[] (supported: push) ``); strings have no
  methods (`` Unknown method `toUpperCase` on string `` *(CLI only)*).
- Builtins are called by dotted name (`console.log`, `Math.sqrt`,
  `process.exit`) or bare name (`toI32`, `readFileSync`); a user function
  with the same bare name shadows the builtin. Unknown dotted builtins are
  `` Unknown builtin `Math.foo` `` (`tests/cases/reject_unknown_builtin`).

### `new`

- `new C(args)` for a class: allocates `sizeof(C)` bytes in the arena and
  runs the constructor (or the inline initializers) (`tests/cases/cls_point`).
- `new Array<T>(n)`: `n` zero-filled elements, scalar `T` only, type
  argument and length required (`tests/cases/arr_new_zeroed`;
  `reject_arr_new_string`: `` would zero-fill with null string values ``).
- Anything else is `` Unsupported `new X` `` / `` Unknown class `X` ``;
  `new Function` and `new Proxy` are forbidden (`reject_new_function`,
  `reject_proxy`).

### Member access

- `s.length` on a string: the UTF-8 byte length as a `number`
  (`tests/cases/str_length`; `reject_length_on_number`, `reject_unknown_property`).
- `a.length` on an array: read-only (`tests/cases/arr_length`;
  `` Cannot assign to `length` of i32[] ``, `reject_arr_length_assign`).
- `p.f` on a class or interface value (`tests/cases/cls_point`).
- `Math.PI`, `Math.E` (`tests/cases/math_i32`). Any other bare identifier
  before a dot is `` Unknown identifier `process` `` *(CLI only)*.
- Optional chaining `?.` is currently accepted and treated as `.` (see
  [Known inconsistencies](#known-inconsistencies)).

### Element access

`a[i]` requires an array `a` (`Cannot index a value of type i32`,
`tests/cases/reject_arr_index_non_array`) and a numeric `i`
(`Array index must be a number, got string`, `reject_arr_string_index`).
The index is sign-extended from `i32` (or truncated toward zero from
`double` in f64 mode) to `i64` and checked against `len` with an unsigned
compare, so negative indices fail too (`tests/cases/arr_bounds_panic`,
`arr_index_read_write`, `arr_f64`). String-keyed access is forbidden by the
validator (`reject_string_key_access`, `reject_non_numeric_index`).

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
| `Math.pow(x: f64, y: f64): f64` | `llvm.pow.f64` | none | `math_intrinsics` |
| `Math.round(x: f64): f64` | JavaScript's round-half-up (`floor` + compare + `select`): `2.5` -> `3`, `-2.5` -> `-2`, `0.49999999999999994` -> `0` | none | `math_intrinsics` |
| `Math.abs(x: T): T` for `T` in `i32`, `i64`, `f64` | `llvm.abs.*` (wrapping for `INT_MIN`) / `llvm.fabs.f64` | none | `math_i32`, `math_intrinsics`; `i64` *(CLI only)* |
| `Math.min(a: T, b: T): T`, `Math.max(a: T, b: T): T` | exactly two operands of one numeric type; integers: `llvm.smin/smax`; `f64`: `llvm.minnum/maxnum` | none | `math_i32`, `math_intrinsics`; `reject_math_min_arity` (`` `Math.min` expects exactly 2 arguments, got 1 ``) |
| `Math.random(): f64` | xorshift64\* in the runtime (`sts_random`), 53 random bits in `[0, 1)`, seeded from time and pid | write | `math_random` |
| `Math.PI: f64`, `Math.E: f64` | constants, also in i32 mode | none | `math_i32`, `math_intrinsics` |

The f64-only functions reject `i32`/`i64` arguments; `number` in i32 mode is
an `i32`, so write `Math.sqrt(toF64(n))` or use f64 mode. A numeric literal
argument is typed `f64` by context (`Math.sqrt(2)` works in both modes).

### Numeric conversions

| Signature | Semantics | Test |
| --- | --- | --- |
| `toI32(x: i32 \| i64 \| f64): i32` | `i64`: truncate (wraps); `f64`: saturating `llvm.fptosi.sat` (NaN -> 0, out of range clamps); `i32`: identity | `conversions`; `reject_toi32_string` |
| `toI64(x): i64` | `i32`: sign-extend; `f64`: saturating; `i64`: identity | `conversions` |
| `toF64(x): f64` | integers: `sitofp`; `f64`: identity | `conversions` |

### `process`

| Signature | Semantics | Effect | Test |
| --- | --- | --- | --- |
| `process.exit(code: i32): void` | `sts_exit` -> libc `exit(code)` (stdio buffers of linked C code are flushed; the arena is abandoned); statement position; a terminator | write, `noreturn` | `process_exit`, `reject_exit_unreachable` |

`process.argv` does not exist (`` Unknown identifier `process` `` *(CLI only)*).

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
`map`, `toUpperCase`, `charAt`, ...), no `Number(s)` / `parseInt(s)`
(`` Unknown function `parseInt` `` *(CLI only)*), and no `toString`.

### `Arena`

<!-- TODO(WP6): document the arena-scope API (`Arena.*` / `sts_arena_mark` / `sts_arena_release`), stack allocation of non-escaping objects, and `T | null` once WP6 lands. -->

Not available yet. Today every object, array, and runtime string lives in
one global arena that is released when `main` returns; a C or Node host may
call `sts_reset_arena()` between batches ([wp8-interop.md](wp8-interop.md)).

## Semantics decisions

- **Integers wrap.** `i32` and `i64` arithmetic is two's-complement wrapping
  (no `nsw`), like Rust release builds: `2147483647 + 1` is `-2147483648`
  (`tests/cases/i64_basic` shows the `i64` wrap; `wp1-control-flow.md`).
  `Math.abs(-2147483648)` wraps to itself.
- **Integer division** is `sdiv`/`srem` truncating toward zero: `-7 / 2` is
  `-3`, `-7 % 2` is `-1` (`tests/cases/cf_collatz`, `cf_do_while`).
  Division by zero, and `INT_MIN / -1`, are undefined behaviour in LLVM
  (in practice a hardware trap on x86-64); the compiler emits no check.
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
  (`tests/cases/cf_throw`); runtime failures (bounds check, file errors,
  out of memory) print a message to stderr and exit with status 1
  (`tests/cases/arr_bounds_panic`: `index out of range: <i> >= <len>`).
- **Bounds checks** on every `a[i]` read and write, unsigned, so `-1` fails
  (`tests/cases/arr_bounds_panic`); `--unchecked-indexing` removes them
  (`tests/cases/arr_unchecked`), after which out-of-range is undefined
  behaviour.
- **`new Array<T>(n)` zero-fills** (`0` / `false`), no holes; pointer element
  types are rejected because a zeroed pointer would be null
  (`tests/cases/arr_new_zeroed`, `reject_arr_new_string`).
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
- **Memory** is one global bump arena; nothing is ever freed individually;
  `main`'s wrapper releases everything on exit. Objects and arrays are never
  null. A C host may `sts_reset_arena()`.
- **Parameters are immutable** and used as SSA values; locals use
  `alloca`/`load`/`store` and are promoted by `mem2reg`.
- **Every function is an external C symbol** unless `--strict-exports`.

<!-- TODO(WP9): document `--target` (datalayout/triple emission), `--nsw` overflow mode, and the benchmark numbers once WP9 lands. -->

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
| ordering on strings / structs | `` Operator `<` requires two operands of the same primitive type, got string and i32 `` | `reject_str_lt`, `reject_str_lt_str`, `reject_cls_ordering` |
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
| module errors | see [`export` and `import`](#export-and-import), [`main`](#main) | `reject_bare_import`, `reject_default_import`, `reject_namespace_import`, `reject_side_effect_import`, `reject_missing_module`, `reject_export_*`, `reject_main_params`, `tests/link/*` |
| unsupported syntax the validator allows | `Unsupported statement in Phase 1: <Kind>` / `Unsupported expression in Phase 1: <Kind>` / `` Unsupported binary operator `**` `` / `` Unsupported unary operator `~` `` / `` Unsupported type `...` `` | *(CLI only)* |

## Known inconsistencies

Behaviour observed with the current compiler that disagrees with the design
notes or with JavaScript. Listed here so the reference stays truthful; each
is a candidate fix, not a feature.

1. **Ordering comparisons on booleans are inverted.** `a < b` with boolean
   operands is accepted and lowers to `icmp slt i1`, a *signed* compare on
   `i1`, where `true` is `-1`: `lt(false, true)` prints `false` and
   `lt(true, false)` prints `true` natively, the reverse of JavaScript.
   *(CLI + native run, no test case.)* Until fixed, do not order booleans.
2. **Optional chaining is silently accepted.** `a?.length` and `s?.length`
   compile exactly like `a.length` (the `?.` token is ignored by both the
   validator and the checker), although `docs/MASTER_PLAN.md` §3.2 lists
   `?.` on non-nullable types as forbidden. *(CLI only.)*
3. **`-2147483648` is rejected** with `` Literal `2147483648` does not fit in i32 ``
   because the range check runs on the unnegated literal; write
   `-2147483647 - 1`. *(CLI only.)*
4. **The `main` parameter message points at WP7** (`` `main` cannot take parameters yet (process.argv arrives in WP7) ``,
   `tests/cases/reject_main_params`), but WP7 shipped without
   `process.argv`; there is no `process.argv` today.
5. **`runtime/statictsc.h` still says `sts_str_from_f64` prints `%.17g`**;
   since WP7 it prints the shortest round-trip form (`tests/runtime_test.c`).
