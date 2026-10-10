# WP27 — Calling C from Nish

**Status:** S1 and S2 are built; S3 is planned (§8) and unbuilt; S4 and S5
are proposed and unbuilt. S1, scalar-only `declare function`, shipped in 0.2.0
([#62](https://github.com/amritk/nish/pull/62), `tests/cases/ffi_scalar`); S2,
the opaque pointer `CPtr`, in 0.3.0 (`tests/cases/ffi_pointer`, §7), with its
debug-info type in 0.4.0 ([#90](https://github.com/amritk/nish/pull/90), §7e).
Since then a call to a `declare function` is the `ffi` capability in
`--emit-capabilities` (`tests/cases/caps_ffi`), so `--deny ffi` refuses a
program that reaches C
([wp36-capability-policy.md](wp36-capability-policy.md)). Whether S4 and S5
should happen at all is a language question (§3); §8 answers it for S3. The rules are normative in
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
| S3 | `string` ↔ `char *` marshalling, and who owns the bytes | planned, §8 |
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
  cannot be released around the call" would start to bind. §8 plans it.
- **S4, struct layout.** The first layout in the language the compiler did not
  choose, and so the first whose size and alignment it would be told rather
  than know.
- **S5, `errno`.** A thread-local the runtime does not model.

Whether S4 and S5 should happen at all is a language question, not a
schedule (§8 answers it for S3): a
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

The differential oracle ([wp13-differential.md](wp13-differential.md), now run
from its frozen rewrites) and the unmodified-Node run beside it compare a native
build with the same program under Node, on the premise that the same source
means the same thing in both worlds. That premise does not hold for a
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

## 8. S3 plan: `string` across the boundary

**Status: planned, unbuilt.** This section is the design S3 is built from; the
rules become normative in [LANGUAGE.md](LANGUAGE.md#calling-c) only as each
step lands. §3 asked whether S3 should happen at all; this plan answers yes,
for a narrow reason: without it every C API that takes a name, a path or a
message needs a hand-written C shim that turns the string into a scalar and
back, so the shim — not the program — becomes where the bugs live.

### 8a. The decision

**A `string` in a `declare function` signature is C's NUL-terminated
`char *`, borrowed in and copied out.**

```ts
declare function puts(s: string): i32;
declare function getenv(name: string): string | null;
declare function strerror(errnum: i32): string;
```

| Position | C type | Lowering | Who owns the bytes |
| --- | --- | --- | --- |
| parameter `string` | `const char *` | `s->data`: the address 8 bytes into the `nish_str`, no copy | the program; C borrows them for the length of the call |
| parameter `string \| null` | `const char *` | as above, or `NULL` | as above |
| return `string` | `const char *` | copied into the arena with `nish_str_new(p, strlen(p))`; a `NULL` panics | C, untouched; the program holds its own copy |
| return `string \| null` | `const char *` | as above, and `NULL` is `null` | as above |

Two facts about the existing layout make the parameter direction free.
`nish_str` already stores its bytes NUL-terminated
(`{ uint64_t len; char data[]; }`, `runtime/nish.h`), and a literal is the
same shape in constant data (`{ i64 12, [13 x i8] c"hello, world\00" }`), so
`s->data` is a valid C string for every string the program can hold, with no
allocation and no copy.

### 8b. The borrow, and why it is a decision rather than a proof

The question §3 left open is the escape question in its hardest form: a
pointer this compiler allocated now crosses into C, and the function that
allocated it may release its arena scope (`nish_arena_mark` /
`nish_arena_release`, WP6) when it returns. Nothing about a C body can be
proved, so S3 **decides**, the way S1 decided `nounwind`:

> A `string` argument is borrowed for the length of the call. A foreign
> function may read it until it returns and may not keep the address.

Under that rule `src/escape.ts` treats a string passed to a `declare function`
as a read, the way it treats the string `console.log` prints, and the
`escaping` facts of a foreign callee in `src/attributes.ts` stay empty. The
arena scope releases after the call has returned, which is safe for every C
function that honours the rule: `strlen`, `puts`, `open`, `setenv` (which
copies), `strtol`, `dlopen`, `sqlite3_prepare_v2`.

The alternative was to copy every string argument into `malloc`ed memory and
free it after the call. It costs an allocation per call and **fixes nothing**:
a function that keeps the address keeps a pointer to the freed copy instead
of the released arena, which is the same use-after-free one line later. Only a
copy that is never freed survives a retaining callee, and the program can
already make that one on purpose:

```ts
declare function strdup(s: string): CPtr | null;
declare function putenv(entry: CPtr): i32;   // keeps the pointer: C's, not ours

const kept = strdup("MODE=fast");
if (kept !== null) {
  putenv(kept);
}
```

So the language needs no "retained string" type. A function that keeps its
argument (`putenv`, `setvbuf`'s buffer, a callback context) is declared to
take a `CPtr`, and the program hands it one C allocated. The rule goes beside
the escape analysis's foreign-callee branch and into LANGUAGE.md with the
example above.

Three things the borrow does **not** grant, each refused or documented:

- **Writing through the argument.** The parameter is `const char *`. A literal
  lives in read-only constant data and an arena string is shared freely
  (strings are immutable), so a C function that writes into its argument
  (`strtok`, `mkstemp`) corrupts a value the program still holds, or faults.
  Such a function takes a `CPtr` buffer the program allocated through C. This
  is a rule the compiler cannot check, so it is written in LANGUAGE.md beside
  the borrow rule.
- **Attributes.** The `declare` keeps carrying none (§2). `nocapture` and
  `readonly` on a string parameter would be the borrow rule restated as an
  LLVM fact, and an LLVM fact the C does not honour is a miscompile rather
  than a broken contract. The decision is used by the escape analysis only.
- **`CPtr` from a string.** There is no way to take a `string`'s address as a
  `CPtr`. `strdup` is the conversion, and it is visible at the call.

### 8c. Embedded NUL bytes: a panic, not a truncation

A Nish string may hold a NUL (`"a\0b".length` is 3), and C reads to the first
one. Passing `"secret\0.txt"` to a C function that opens a path would pass a
`.txt` check in the program and open `secret` — the bug the runtime already
closed for its own calls (RT-3, `nish_cpath`, `docs/security/runtime.md`).
`nish_cpath` answers `""` there because every caller answers an empty path as
a missing one; a foreign function has no such answer, so S3 **panics**:

```
panic: `open`: argument 1 (path) holds a NUL byte, which C would read as the end of the string
```

That is a new panic kind, **`ffi-nul`**, listed by `--emit-panics`, refused
under `--deny-panics`, and proved away for a **literal with no NUL in it**,
which the checker knows at compile time — so `puts("hello")` has no check and
no site. Anything else is checked with one runtime call,
`nish_ffi_cstr(const nish_str *s, …)`, which answers `s->data` or panics; its
test is `nish_cpath`'s (`strlen(s->data) == s->len`), one pass over bytes the
callee is about to read anyway. Proving more strings NUL-free (a template of
numbers, a concatenation of proved parts) is left for a measured need.

### 8d. Returns: copied, and `NULL` is the type's business

A returned `char *` is copied into the arena at the call, for the reason
`nish_getenv` copies (`runtime/runtime-os.c`): `getenv`'s answer points into
`environ`, which a later `setenv` may move, and `strerror`'s into a static
buffer the next call overwrites. A copy is an ordinary arena string with the
lifetime every other string has, so the escape analysis, the arena scopes and
`nish_arena_keep` need to know nothing new. The cost is one `strlen` and one
`memcpy` per call, measured in S3.2 (§8g).

- `string | null` maps `NULL` to `null`, the ordinary nullable (WP6).
- `string` with a `NULL` result panics, a second new kind, **`ffi-null`**:
  `` panic: `strerror` returned NULL for a `string` result; declare it `string | null` ``.
  Nothing proves it away; a C function's contract is not visible to the
  checker. A declaration the author knows never answers `NULL` costs one
  compare and branch, and `string | null` removes even that.
- **The copy never frees.** Whether the C bytes need freeing is the C API's
  contract, which the type cannot say. A function whose result the caller
  must free (`strdup`, `realpath(p, NULL)`, `asprintf`) is declared to return
  `CPtr | null`, and the program copies the bytes with `readCString` (§8e)
  before freeing the pointer itself:

```ts
import { readCString } from "nish:unsafe";

declare function realpath(path: string, resolved: CPtr | null): CPtr | null;
declare function free(block: CPtr): void;
```

The second parameter needs §8f's one widening: today a `CPtr` parameter cannot
be nullable, and `realpath(p, NULL)` is how C asks for the allocating form.

### 8e. `readCString`, in `nish:unsafe`

`readCString(p: CPtr): string` copies the NUL-terminated bytes at `p` into the
arena. It belongs in [`nish:unsafe`](LANGUAGE.md#nishunsafe-unchecked-access-and-defined-wrapping)
and not in the global namespace, because it is exactly the kind of thing that
module exists to make visible: an address with no proof behind it that a NUL
ends it is read until one is found, and a `CPtr` that does not point at a C
string is undefined behaviour. It panics on nothing, so like `uncheckedGet` it
is an `unchecked` site with `"allowed": true`, and `--emit-checked` records
the import and every call, as it does for the other five.

It is the one place S3 dereferences a `CPtr`, and it does so in the runtime,
not in the IR: §7a's "no dereference" stays true of the language, and the
`CPtr` keeps getting no pointer attributes.

### 8f. What S3 widens and what it still refuses

Widened:

- `string` and `string | null` in every position of a `declare function`.
- **A `CPtr | null` parameter**, reversing `reject_ffi_pointer_nullable_param`
  for one reason: `realpath(p, NULL)`, `setlocale(LC_ALL, NULL)`,
  `time(NULL)` and `strtol(s, NULL, 10)` are how C APIs ask for a default, and
  S2's rule left them uncallable. The rule §7a gives — that a `null` handed back
  to C is a handle the program forgot to narrow — is still right for a
  *variable*, so the widening is the literal `null` only: a `CPtr | null`
  local is still narrowed before it is passed. The checker change is the
  nullable branch in `checkForeignSignature` (`src/declarations.ts`) plus a
  rule at the call.

Still refused, each by name, each with a `reject_*` case:

- `string[]` (`char **`, argv-style): a C array of borrowed pointers, which is
  S3's rule over an allocation the compiler would have to build per call.
- `u8[]` as `uint8_t *` and a length: the byte-buffer stage. It is the next
  most-asked-for shape (`read`, `write`, compression and hashing libraries)
  and is not a string, because it carries a length and may be written; it is
  proposed separately rather than folded in.
- A Nish function passed as a C callback: a function pointer, and with it a
  call *into* the program from a frame it did not set up.
- Variadic C functions (`printf`): the C variadic convention is a different
  call lowering on most targets, and the TypeScript spelling (`...args`) is
  already refused in every signature (`Rest parameters are not supported`).
- Any other `CPtr` widening from §7a: no field, no element, no program
  parameter or return.

### 8g. Steps, each one pull request

| Step | Delivers | Tests |
| --- | --- | --- |
| **S3.1** | `string` and `string \| null` parameters; the borrow rule in `src/escape.ts`; `nish_ffi_cstr` and the `ffi-nul` panic kind; the literal proof | `ffi_string_param` (golden `.ll` + native round trip against libc: `strlen`, `puts`, `atoi`, `setenv` then the runtime's `getenv`); `ffi_string_param_arena` (a concatenated string passed from a function whose arena scope releases after the call, linked against a C sidecar that copies what it read, so the output shows the bytes were live during the call); `panics_ffi_nul`; `reject_ffi_string_array_param` |
| **S3.2** | `string` and `string \| null` returns; `nish_ffi_str` and the `ffi-null` panic kind | `ffi_string_return` (`getenv`, `strerror`, `setlocale` query); `panics_ffi_null`; a timing of `strerror` in a loop whose argument changes on every iteration, folded into a printed checksum, to state the copy's cost in the commit's `Measured:` trailer |
| **S3.3** | `readCString` in `nish:unsafe`; the literal-`null` `CPtr \| null` parameter | `ffi_owned_string` (`strdup`/`free` and `realpath(p, null)`/`free` round trips); `reject_ffi_pointer_nullable_variable` (the narrowed-local rule kept); `reject_unsafe_no_import` extended |

Each step is a feature in the language, so each ships the full set the
definition of done names: the golden `.ll`, `llvm-as`, the native round trip,
the negative tests, the LANGUAGE.md rule (in "Calling C", replacing the
`reject_ffi_string_param` refusal as S3.1 lands), an
[IR_COOKBOOK.md](IR_COOKBOOK.md#declare-function-calling-c) entry with its
`docs/cookbook/` program, and the regenerated `checked.txt` goldens. The new
runtime functions are additions to `runtime/nish.h` and `runtime/runtime.c`
inside that unit's `.text*` ceiling, the two panic kinds are rows in the
LANGUAGE.md panic table and `src/panics.ts`, and S3.1 adds a finding to the
runtime's security record for the borrow and the NUL rule.

What does not change: the `ffi` capability still names every call
(`--deny ffi` still refuses the program), FFI programs stay outside the
differential oracle (§5), and no generator (`--emit-header`, `--emit-dts`,
`--emit-napi`) is touched, because a `declare function` is never exported.

### 8h. The rolling freeze

`std/` may use S3 from the commit that lands it. `src/` may not until the
release after S3.1, because the seed must accept a `string` in a foreign
signature before the compiler's own source writes one. Nothing in `src/` is
waiting on it: every OS call the compiler makes is a builtin.

### 8i. What a reviewer should push back on

The borrow rule is a contract the compiler states and cannot check, which is
the first such contract the language has had about *its own* memory: before S3,
every foreign rule was about C's memory. The alternatives were weighed above
(§8b) and none of them is safer, but the rule is still a place where a
correct-looking program has undefined behaviour, so the LANGUAGE.md text has to
say so in the first sentence and name `putenv` as the example. If that is not
acceptable, the fallback is to stop at S3.2's *return* direction (copying out
is sound by construction) and leave string parameters to a shim.
