# WP27 — Calling C from Nish

**Status:** S1 and S2 are built; S3 to S5 are proposed and unbuilt. S1,
scalar-only `declare function`, shipped in 0.2.0
([#62](https://github.com/amritk/nish/pull/62), `tests/cases/ffi_scalar`); S2,
the opaque pointer `CPtr`, in 0.3.0 (`tests/cases/ffi_pointer`, §7), with its
debug-info type in 0.4.0 ([#90](https://github.com/amritk/nish/pull/90), §7e).
Since then a call to a `declare function` is the `ffi` capability in
`--emit-capabilities` (`tests/cases/caps_ffi`), so `--deny ffi` refuses a
program that reaches C
([wp36-capability-policy.md](wp36-capability-policy.md)). Whether S3 to S5
should happen at all is a language question (§3). The rules are normative in
[LANGUAGE.md](LANGUAGE.md#calling-c) and the lowering is in
[IR_COOKBOOK.md](IR_COOKBOOK.md#declare-function-calling-c).

Before this package every builtin bottomed out in a C function, and that was
the *only* way the language reached the operating system: a capability that
needed a syscall could be added only by editing `runtime/` and the compiler
together. This package removes that restriction, and is honest that doing so
points a loaded weapon at the thing that makes the compiler fast.

## 1. The decision

**A Nish program may declare a C function and call it, using TypeScript's own
ambient-declaration syntax, and the compiler emits an LLVM `declare` and a
`call` with no attributes.**

```ts
declare function getpid(): i32;

export function main(): i32 {
  return getpid();
}
```

The spelling is already valid TypeScript and already means "this exists,
somewhere I cannot show you"; the symbol is the identifier, with no mangling,
which is the promise `--emit-header` makes in the other direction; and the type
mapping is `src/interop-abi.ts`'s table for `--emit-header` read right to left,
so there is one ABI in the compiler rather than two.

## 2. Why this is not merely plumbing

The compiler's performance thesis is that it sees all of the code. The
whole-program fixpoint in `src/attributes.ts` emits only attributes it can
justify, and escape analysis is what grants a function its automatic arena
scope. A foreign function is a hole in that fixpoint, so a foreign call is
assumed to do the worst of each:

| Fact | What a foreign call forces |
| --- | --- |
| memory effect | `write` — the caller loses `readnone` and `readonly` |
| escape | every pointer argument escapes |
| `willreturn` | not provable — the callee may `exit` or loop forever |
| `nounwind` | *decided, not proved* — see below |
| allocation | a returned pointer is **not** arena memory and has unknown lifetime |

The declaration carries **no attributes at all** — "no attribute without a
proof", applied honestly. A function that calls C loses `readnone` and
`willreturn`, and so does everything above it in the call graph.

`nounwind` is the one row being conservative cannot settle: every function
carries it, justified by "the language has no exceptions", and a foreign callee
could unwind through the frame. Dropping it buys nothing in a language with no
`throw` and no landing pad, so S1 **decides** that unwinding out of a foreign
call is undefined — the position clang takes compiling C — and the decision is
written next to the attribute.

The bug that shipped in 0.1.0 has this shape: `getenv` returned a pointer the
escape analysis did not know was allocated, the arena was released before the
`ret`, and a program printed freed memory. FFI reopens that class *in user
code*, where no guard of the compiler's can see it, which is why the
conservatism is the feature and the stages are small.

## 3. Stages

| | Deliverable | Status |
| --- | --- | --- |
| S1 | scalar-only `declare function`: `i32`, `i64`, `f64`, `boolean`, `void`, `u8`–`u64` | **built**, 0.2.0 |
| S2 | an opaque pointer type, `null` only from a foreign call, no arithmetic | **built**, 0.3.0, §7 |
| S3 | `string` ↔ `char *` marshalling, and who owns the bytes | proposed |
| S4 | C structs by layout declaration | proposed |
| S5 | `errno`, and whether it is a builtin or a declared foreign global | proposed |

S1 calls a great deal of libc (`getpid`, `abs`, `isatty`, `sysconf`). It is not
enough to write `readdirSync` in Nish, the motivating request, and neither is
S2: `readdir` returns a `struct dirent *`, and reading `d_name` needs a struct
layout the compiler did not lay out (S4) and a conversion from C's
NUL-terminated `char *` to the length-prefixed `nish_str *` (S3). Each open
stage is a real decision rather than a missing line:

- **S3, `string` marshalling.** Converting at the boundary means allocating,
  which means the arena, which means the escape question of §2 in its hardest
  form: a pointer the compiler allocated would cross into C, and "the arena
  cannot be released around the call" would start to bind.
- **S4, struct layout.** The first layout in the language the compiler did not
  choose, and so the first whose size and alignment it would be told rather
  than know.
- **S5, `errno`.** A thread-local the runtime does not model.

Whether S2–S5 should happen at all is a language question, not a schedule: a
language whose selling point is that every value has one known layout may
decide that the OS is reached through builtins on purpose.
[wp34-hosting-cs.md](wp34-hosting-cs.md) weighed C crypto through FFI against
pure Nish and chose pure Nish, partly because the C route needed S3 and S4.

## 4. What S1 refuses

A declared function with a body (`reject_ffi_body`), an exported one
(`reject_ffi_export`, since `export` offers a function this module defines), a
generic one (`reject_ffi_generic`), and a `string` parameter or return
(`reject_ffi_string_param`, `reject_ffi_string_return`, S3's) are each refused
by name.

## 5. What FFI costs the test strategy

The differential oracle ([wp13-differential.md](wp13-differential.md)) runs a
program's JavaScript rewrite against a shim, on the premise that the same
source means the same thing in both worlds. That premise does not hold for a
source whose meaning is "whatever this C function does", so **every FFI program
is outside the differential oracle by construction**. The evidence is arranged
the other way round: a golden `.ll`, an `llvm-as` pass, a native round trip
against real libc, and the attribute assertions — a caller of C keeps only
`nounwind`, one that calls no C keeps `willreturn readnone`.

## 6. The thing a reviewer should push back on

The runtime budget exists because C in this project is meant to be a closed,
shrinking set, and FFI makes C reachable from any program. The answer is
written in [wp7-runtime.md](wp7-runtime.md#what-ffi-does-and-does-not-do-to-the-budget):
the budgets measure the translation units linked into *every* binary, and a
`declare function` adds a symbol to one program's link line. The honest half of
the objection survives and is recorded there too: what FFI opens is the
*language's* reach into C, which the budget never bounded — LANGUAGE.md did, by
having no way to name a foreign function.

## 7. S2 as built: `CPtr`

### 7a. What it is, and the four words that bound it

`CPtr` is an address a C function handed back: `i8*` in the IR, eight bytes
wide, and **that is all the compiler knows about it** — not arena memory, not a
struct, not a `nish_str *`.

- **Opaque.** No dereference, index, member or arithmetic. What is left is
  `=== null`, `!== null`, comparing two `CPtr`s, assignment, and passing one
  back to a foreign function.
- **`null` only from a foreign call.** A `declare function` may *return*
  `CPtr | null` and may not *take* one, so a pointer is narrowed with
  `!== null` before it goes back (`reject_ffi_pointer_nullable_param`).
- **Nowhere but a foreign signature and a local.** A field, an array element, a
  `Result` arm, a type argument, and the parameters and return of a function
  this program defines are refused with one message
  (`reject_ffi_pointer_field`, `_array`, `_param`, `_return`,
  `_type_argument_fn`). The type-argument clause is checked where a generic
  *function* is instantiated; a generic *class* at `CPtr` is refused by
  whichever member rule the monomorphised class trips
  (`reject_ffi_pointer_type_argument`).

  **Known gap:** a template that never mentions `T` in a member
  (`class Empty<T> { n: i32 = 0; }`) compiles `new Empty<CPtr>()`, because no
  member rule is reached (`src/generics.ts` says so at the line). Nothing
  unsound follows — no `CPtr` is laid out, stored or exported — but the rule as
  written says a `CPtr` cannot be a type argument. Closing it is a short loop
  in the struct instantiation plus a case.

The name is PascalCase where the language's own types are lower case on
purpose: `CPtr` is C's, borrowed for the length of a call, and its lifetime
belongs to whoever allocated it.

### 7b. Why the placement rule is the soundness argument

S2 weakens no row of §2's table. The question a returned value raises is
**"can this compiler mistake a foreign address for one of its own?"**, and the
answer is no by construction in two places:

1. **`isPointerParam` is an allow-list.** It grants `dereferenceable`,
   `nonnull`, `align`, `nocapture` and `readonly` to structs, arrays and a
   non-packed `Result` — memory this compiler laid out — and to nothing else, so
   `CPtr` falls out without being named. A deny-list would have admitted the
   next pointer-shaped type by omission, and a wrong attribute is undefined
   behaviour.
2. **The placement rule keeps it out of everything else that walks memory.** A
   field or element would put a foreign address inside a value the arena owns
   and `src/escape.ts` walks; a parameter or return of a program function would
   put one across a boundary `--emit-header`, `--emit-dts` and `--emit-napi`
   render. Refusing the type where it would reach them is one rule instead of
   five silent special cases.

The arena is untouched: `tests/cases/ffi_pointer` allocates a string in the
function that calls `calloc`, `realloc` and `free`, and `nish_arena_mark` /
`nish_arena_release` bracket it exactly as without the foreign calls. That is
safe because **no pointer this compiler allocated crosses the boundary in
either direction** — which is precisely what S3 would change.

What S2 buys is a handle that comes out of C, is proved non-null, is held, and
goes back in: `opendir`/`closedir`, `fopen`/`fclose`, `dlopen`/`dlsym`,
`malloc`/`free`, and every C API whose type is a cookie. It is proved by
`tests/cases/ffi_pointer` (a link test against real libc), nine
`reject_ffi_pointer_*` cases, and `docs/cookbook/decl-ffi-pointer.ts`.

### 7e. What `-g` says about a type with no structure

Debug info is the one place the placement rule does not reach: `-g` names the
type of every local, and a local may hold a `CPtr`. The rule is §7a's — **the
compiler says the width and nothing more**:

```
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: null, size: 64)
```

A `null` `baseType` is DWARF for an undescribed pointee, what `clang -g` writes
for `void *`. A pointer to `char` is tempting, since that is the shape a `CPtr`
and a string share in the IR, and wrong for §7a's reason: a debugger told
`char *` would print an arbitrary foreign address as text. Before
`tests/cases/dbg_cptr` the debug-info lookup had no entry for `CPtr` and failed
under `-g`; only the `--parity` run, which compiles the corpus under every flag,
saw it. `tests/cases/dbg_cptr_shadow` is #90's case: a program may also declare
a `class CPtr`, and the debug cache was keyed by type name, so whichever was
described first answered for the other; the foreign pointer is now memoised
apart from that cache.
