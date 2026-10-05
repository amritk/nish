# WP23: The language surface a corpus review turned up

**Status: settled; every row is answered.** A review of `src/` for comments
that say *the language has no X* produced eight items that no other work
package owned. Four landed: non-generic `type` aliases (§2, before 0.1.0;
exported in 0.14.0, [#300](https://github.com/amritk/nish/pull/300)), numeric
`enum` (§3, 0.2.0, [#54](https://github.com/amritk/nish/pull/54); exported in
0.14.0, [#296](https://github.com/amritk/nish/pull/296)), `Pair<A, B>` in
`std/` (§5, 0.9.0, [#172](https://github.com/amritk/nish/pull/172)), and
compile-time function parameters (§6, 0.11.0,
[#213](https://github.com/amritk/nish/pull/213)). Module-level mutable state
is decided **no** (§4). Three are **declined**: `for...of` over a string (§7),
a string `switch` (§8) and `?.` (§9). [LANGUAGE.md](LANGUAGE.md) is normative
for each rule that landed. This note keeps the reasoning. The full text,
including the evidence traced line by line, is this file at commit `2b2eb95c`.

## 1. Where these came from, and the rule they are judged by

The evidence is `src/`'s own sentences about its workarounds. Every item is
judged by the rule MASTER_PLAN §1 and [wp15-performance.md](wp15-performance.md)
§1a set: an addition must either close a *functional* gap or cost nothing at
run time. Ergonomics alone is not a reason. A functional gap makes an addition
*eligible*. It does not make the addition worth its cost, which is why §4,
the only functional item, is still a no.

## 2. Non-generic `type` aliases — **landed**

**An alias is the type it names, not a distinct one.** This follows the
precedent of `Int32Array` being a spelling of `i32[]`. `sameType` never sees
the alias, and an alias emits no IR. So the existing goldens are the feature's
oracle, the same structural argument
[wp22-arrow-functions.md](wp22-arrow-functions.md) §2 makes for arrows. An
alias of a forbidden type is still forbidden, because the alias is resolved
before the type is checked. Generic aliases stay refused: an alias only renames
a type that already exists. Exported aliases arrived with WP34 N1. LANGUAGE.md
"Type aliases" has the rules.

## 3. Numeric `enum` — **landed**

**An enum is a DISTINCT type with `i32` representation.** That is stricter
than TypeScript, and it has to be: two values are compatible only when their
types are identical, and an enum that were silently `i32` would be the one
exception. The motivating count was `src/`'s three principal discriminant
families (`N_*`, `TOK_*`, `T_*`): 171 `i32` constants sharing one type, in a
compiler that dispatches on all three. The three choices the decision forced
went this way:

1. **`switch` takes an enum discriminant and enum-member labels**, folded so
   that the statement is still LLVM's `switch`. `case 1:` on an enum switch is
   refused.
2. **Bit flags stay `i32` module constants.** `|`, `&`, `^` and `~` on an enum
   are refused (`tests/cases/reject_enum_bitwise`). This is the one answer that
   can be widened later without invalidating a program (§10 question 1).
3. **`biome.json` turns `noEnum` off for Nish programs.**

Auto-numbering is TypeScript's. The record here once said an enum cannot be
exported. That changed in 0.14.0: an imported enum is the exporter's type, bound
before any signature is collected. LANGUAGE.md "Enums" has the rules. `src/`
does not use enums, because Nish-0 excludes them
([`.claude/selfhost.md`](../.claude/selfhost.md)).

## 4. Module-level mutable state — **decided: no**

This was the one *functional* item. Its only candidate was a `--json` flag that
`src/ice.ts` wanted, so that an internal error could print an `NL0003` object.
§4.2 designed the narrowest version, and §4.6 decided against it.

**The revisit trigger is concrete**, in the shape
[wp18-generics.md](wp18-generics.md) §14 uses: two more places in `src/` that
want module state for a reason that is **not** "a CLI flag a driver already
parsed" bring this back with their own cases.

**The divergence that motivated it is closed, without a language change.**
`internalErrorFor(message, json)` in `src/ice.ts` takes `Options.json` from its
call site and prints one `NL0003` object under `--json`. This is the parameter
remedy §4.6 recommended, and it landed before the first release (`afdb3066`).

### 4.1 The evidence

The contract is orientation rule 7: under `--json`, every failure is one
parseable object, internal errors included. The workaround comment counted 39
call sites that would need the flag. The count was 38. It also blamed the
missing `process.argv`, which was the wrong reason: `src/` is a corpus
directory, so each of its modules is also compiled as its own program, without
an entry `main`.

### 4.2 The narrow design

If it is ever built, it is a module-scope `let` with four restrictions:

1. **Module-private, never exportable.** This keeps the symbol out of linkage,
   headers and WP21's flat namespace. It stops the *symbol* crossing a module
   boundary, not the *value*: an exported setter still moves the value.
2. **Scalar types only.** A pointer-typed global is a new escape route (§4.3).
3. **A literal initialiser**, so the global is an LLVM initialiser rather than
   code, and the language keeps having no initialisation order.
4. **Thread-local by construction** (§4.5).

### 4.3 What it does to escape analysis

A store into a global is `leaks`, and `leaks` turns off the automatic arena
scopes of the whole call tree above it. Restricting the global to scalars
removes the question, because a scalar is never an allocation's destination.

### 4.4 What it does to the attribute fixpoint

A read of a global is at least `read`, and a write is `write`. Both propagate to
every caller. When this was measured, about one function in ten of `src/`
carried an effect attribute that a badly placed global would withdraw. The
global would also be the first writable `internal global` the compiler defines
for user code.

### 4.5 What it does to WP20's promise

[wp20-threads.md](wp20-threads.md) §2 opens its asset table with "no mutable
global state, at all". A module `let` withdraws that row. Restriction 4 has to
be part of the feature from its first commit, or a program's meaning would
change silently when it is recompiled with threads. Thread-local is a semantic
choice, not a safety wrapper: two threads see two values.

### 4.6 Is it worth it? Honestly: for this case, no

An unused boolean parameter costs nothing the compiler cares about. A parameter
is not memory, and every helper concerned already called `internalError` and was
already `write`. The parameter version costs a few ugly signatures and no
proofs. The module-state version costs a new IR construct, a symbol in a flat
namespace, a threading decision and a withdrawn safety asset. One case is not
enough for that.

## 5. Pairs and multiple return — **landed: `nish/pair`**

[`std/pair.ts`](../std/pair.ts) is `export interface Pair<A, B> { first: A;
second: B; }`, imported as `import { Pair } from "nish/pair"`. It needs no
grammar and no new diagnostics. The `tests/link/std_pair_*` programs return
one across a module boundary in several shapes. `src/lexer.ts` still keeps its
`escapeEnd` out-parameter field, because Nish-0 has no generics.

### 5.1 The evidence

The one real case was `scanEscape`'s second return value, held in a field on
`Lexer`. Two other cited sites did not count. `src/codes.ts` is flat for
mirroring reasons, and `src/target.ts` is a counter-example. The house style
already prefers parallel arrays to an array of records
(`src/program.ts`). So a pair type is for *returning two values from one call*,
not for storing two values side by side.

### 5.2 The design: `Pair<A, B>` under WP18, not new syntax

Not `[i32, string]`. A tuple type is a new type constructor in the grammar, in
every annotation position, in mangling, in `sameType`, in DWARF and in every
interop generator. `Pair<A, B>` is [wp18-generics.md](wp18-generics.md) §2's
worked example verbatim, and needs WP18's generic interfaces and exported
templates and nothing else.

### 5.3 What WP17 does and does not prove about the ABI

`Result<T, E>` does **not** prove that the compiler passes a two-field aggregate
in a register pair. [wp17-result-abi.md](wp17-result-abi.md) §2 refused that,
because the lowering differs per target. What WP17 proves is that a small
two-scalar value travels packed in one `i64`. Anything larger is a pointer to
an arena struct.

### 5.4 The honest cost

One interface declaration once WP18 had landed, against one out-parameter
field. The cost was low because the wait was free and no grammar was added.

## 6. Compile-time function parameters

**Landed, for a callee the checker can name** (0.11.0, as WP29 P1's
prerequisite). A parameter of a top-level function may have a function type.
Its argument is a top-level function named at the call, or an arrow written
there. Each distinct callee is its own instantiation, keyed by (template, type
arguments, *function arguments*). The symbol gains a `$fn.<length>.<symbol>`
segment per function argument, and the IR has a direct call and no function
pointer. A name bound to such a parameter may be called or passed on, and is
refused anywhere else. A function type anywhere else is refused.
[LANGUAGE.md](LANGUAGE.md#function-parameters) has the rules and the cases.

**This does not relax function values.** `Function` is still a Phase 0 error,
and the reason is load-bearing in four places: wp18's monomorphisation
argument, wp16's lack of `Result.map`, wp20 §2's thread-entry asset, and
wp22 §2's measurement that a polymorphic call site is what costs 7x. A function
value the checker cannot name, whether stored, returned or held in a field,
still does not exist.

### 6.1 The shape that costs nothing

A function parameter whose value is known at the call site monomorphises there,
exactly as a type parameter does. There is no value of function type at run
time, and the fixpoint sees an ordinary direct call. WP28 §7.4 measured it at
no run-time cost. The kind it excludes, a callee the checker cannot name,
measured 1.26x for the call and up to 8.76x for the escape proof it forfeits.

### 6.2 The evidence that did not count

Four of the five `src/` comments that name the absence of function values are
dispatch tables. A compile-time parameter solves none of them: a table exists
to choose a callee the call site does not know. Those are D2 of
[wp14-selfhost.md](wp14-selfhost.md) §3a, a central `switch` that lowers to a
jump table.

### 6.3 The evidence that did count

Two hand-written sorts in `src/`, each with a comparator fixed at its call site.
That evidence was thin. The case that scheduled the feature was WP29 P1's
parallel bodies ([wp29-thread-surface.md](wp29-thread-surface.md) §6).

### 6.4 Where this stood

The decision was "not scheduled until WP18 has landed and a real program has
asked twice". WP18 landed, the second ask was WP29, and it was built.

## 7. Declined: `for...of` over a string

`for (const c of s)` stays `` `for...of` requires an array, got string ``
(`tests/cases/reject_arr_forof_non_array`). Three reasons:

- **It would not be TypeScript.** `tsc --strict` types `c` as `string`, so a
  byte-yielding loop would compile here and mean something else under `tsc`.
- **The type-honest version is quadratic**: one arena allocation per character,
  the shape WP15's `performance` class warns about.
- **It would diverge from Node.** JavaScript iterates code points, and Nish is
  byte-oriented.

The idiom already costs nothing: a `while` loop over `s.charCodeAt(i)`, which
is one `load i8` per byte. [wp15-performance.md](wp15-performance.md) §2 found
that slice iterators buy nothing for arrays either.

## 8. Declined: string `switch`

Only an integer switch lowers to LLVM's `switch`. A string switch would be a
chain of `nish_str_eq` calls, which `if`/`else` states honestly (LANGUAGE.md
"`switch`"). A keyword recogniser already interns strings to `i32` kinds and
switches on those. A hash-dispatched switch would make the IR unreadable from
the source. **Trigger:** a real program where a string dispatch is hot and
interning is unavailable. None exists.

## 9. Declined: optional chaining `?.`

**The blocker is `undefined`.** `a?.b` evaluates to `undefined` when `a` is
null, and `undefined` is not a value in this language. `?.` stays a Phase 0
error (`reject_optional_chain`), and that is permanent, not a backlog item. The
saving would have been about ten lines of hoist-and-narrow in `src/`. Even
there, the hoist is required by a different rule: a nullable *field* does not
narrow. A statement-only `?.` was refused too, because an operator that is
legal as a statement and illegal as an expression is a rule readers get wrong.

Since 0.11.0 ([#232](https://github.com/amritk/nish/pull/232)), `undefined`
exists in one narrow place: `Map.get` answers `V | undefined`, and `??` is
accepted with such a result on its left. Everywhere else `??` is still
`reject_nullish`. This does not reopen `?.`, which has no `Map.get` form.

## 10. Where the answer is genuinely open

1. **Bit flags on an enum** (§3). The conservative answer shipped: refuse the
   operators, and keep flags as `i32` constants. It stays here because it can be
   widened later, to accepting non-member values or to a separate `flags`
   form, without breaking a program.
2. **Whether an enum is `i32` or takes a width.** It is `i32`. A `u8` enum
   would matter inside a contiguous struct array (WP15 item 7), and a later
   choice is a layout change. No evidence asks yet.
3. ~~The revisit trigger for module state.~~ **Answered:** a count of uses
   (§4).
4. ~~`--json` parity for `NL0003` before §4.~~ **Answered:** independent of §4,
   and closed (§4).
5. ~~`Pair` in `std/` or per program.~~ **Answered:** `std/` (§5).
6. ~~One mangling segment or two for a function and a type parameter.~~
   **Answered by the build:** a function argument has its own `$fn` segment (§6).
7. **Whether §7's refusal should name the `charCodeAt` loop**, the way
   `reject_nullish` names `!== null`. That is a message change, not a language
   change.

## 11. What this note does not decide

- **`src/` adopting §2, §3 or §5.** Nish-0 excludes aliases, enums and generics,
  and a construct enters the language before it enters `src/` (the rolling
  freeze, [`.claude/selfhost.md`](../.claude/selfhost.md)).
- **Diagnostic codes.** These are allocated in `src/codes.ts` when a rule
  lands, never in a design note.
