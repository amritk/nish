# WP27 — Calling C from Nish

**Status:** S1 and S2 are built; S3 (§8) is built: S3.1, `string`
parameters, S3.2, `string` returns, and S3.3, `readCString` and the
literal-`null` `CPtr | null` parameter; S4 (§9) is built: S4.1, a `declare class`
as a C struct layout passed by pointer, and S4.2, `readStruct`; S5 (§10), `cErrno`, is built. S1, scalar-only `declare function`, shipped in 0.2.0
([#62](https://github.com/amritk/nish/pull/62), `tests/cases/ffi_scalar`); S2,
the opaque pointer `CPtr`, in 0.3.0 (`tests/cases/ffi_pointer`, §7), with its
debug-info type in 0.4.0 ([#90](https://github.com/amritk/nish/pull/90), §7e).
Since then a call to a `declare function` is the `ffi` capability in
`--emit-capabilities` (`tests/cases/caps_ffi`), so `--deny ffi` refuses a
program that reaches C
([wp36-capability-policy.md](wp36-capability-policy.md)), and a declaration in
a package or a `std/` module binds the bare C name rather than the package's
prefixed one, with duplicate declarations required to agree
(`tests/link/ffi_package_declare`). Whether S3 to S5
should happen at all was a language question (§3); §8 answers it for S3,
§9 for S4 and §10 for S5, all three built. The rules are normative in
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
| S3 | `string` ↔ `char *` marshalling, and who owns the bytes | **built**, §8: S3.1 (`string` parameters), S3.2 (`string` returns), S3.3 (`readCString`, the literal-`null` `CPtr \| null` parameter) |
| S4 | C structs by layout declaration | **built**, §9: S4.1 (`declare class` as a layout, passed by pointer), S4.2 (`readStruct`, a copy back, §9h) |
| S5 | `errno`: `cErrno()` in `nish:unsafe`, zeroed before and saved after each foreign call | **built**, §10 |

S1 calls a great deal of libc (`getpid`, `abs`, `isatty`, `sysconf`). It is not
enough to write `readdirSync` in Nish, the motivating request, and neither is
S2: `readdir` returns a `struct dirent *`, and reading `d_name` needs a struct
layout the compiler did not lay out (S4) and a conversion from C's
NUL-terminated `char *` to the length-prefixed `nish_str *` (S3). Each open
stage is a real decision rather than a missing line:

- **S3, `string` marshalling.** Converting at the boundary means allocating,
  which means the arena, which means the escape question of §2 in its hardest
  form: a pointer the compiler allocated would cross into C, and "the arena
  cannot be released around the call" would start to bind. §8 plans it, and
  S3.1 has built its parameter half, the borrow rule (§8b), and S3.2 its
  return half, the copy (§8d).
- **S4, struct layout.** The first layout in the language the compiler did not
  choose, and so the first whose size and alignment it would be told rather
  than know.
- **S5, `errno`.** A thread-local the runtime does not model.

Whether S5 should happen at all was a language question, not a
schedule: a language whose selling point is that every value has one known
layout may decide that the OS is reached through builtins on purpose. §8
answers it for S3, §9 for S4 and §10 for S5.
[wp34-hosting-cs.md](wp34-hosting-cs.md) weighed C crypto through FFI against
pure Nish and chose pure Nish, partly because the C route needed S3 and S4.

## 4. What S1 refuses

A declared function with a body (`reject_ffi_body`), an exported one
(`reject_ffi_export`, since `export` offers a function this module defines), a
and a generic one (`reject_ffi_generic`) are each refused by name. A `string`
parameter was refused too (`reject_ffi_string_param`) until S3.1 accepted it,
and a `string` return (`reject_ffi_string_return`) until S3.2 did; a
`string[]` is refused in either position (`reject_ffi_string_array_param`,
`reject_ffi_string_array_return`), as is every other array, save the one
exception: a `u8[]` or `readonly u8[]` parameter followed by its `u64` count,
which WP53 B1.1 accepts ([wp53-ffi-buffers-handles.md](wp53-ffi-buffers-handles.md)
§3a). A `u8[]` return stays refused there too (`reject_ffi_buffer_return`).

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
- **`null` back to C only as the literal.** A `declare function` may return
  and, since S3.3 (§8f), take `CPtr | null`; a call passes such a parameter the
  literal `null` or a pointer narrowed with `!== null`, and a nullable pointer
  the program holds is refused at the call (NL2539,
  `reject_ffi_pointer_nullable_variable`). S2 refused the parameter in the
  declaration (`reject_ffi_pointer_nullable_param`, NL2324, both retired).
- **Nowhere but a foreign signature and a local.** A field, an array element, a
  `Result` arm, a type argument, and the parameters and return of a function
  this program defines are refused with one message
  (`reject_ffi_pointer_field`, `_array`, `_param`, `_return`,
  `_type_argument_fn`). The type-argument clause is checked where a generic
  function or class is instantiated (`reject_ffi_pointer_type_argument`), so
  `new Empty<CPtr>()` is refused for a template that never mentions `T` in a
  member (`class Empty<T> { n: i32 = 0; }`), closed with WP53 H1.1. A class
  with a `CPtr` field is a handle class since WP53 (§4a); the field rule
  holds for an interface and for any second pointer field.

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
either direction** — which held until S3. S3.1 lends a `string`'s bytes to C
for the length of the call (§8b): the scope is released only after the call
returns, so the bracket stays where it was.

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

**Status: S3.1, S3.2 and S3.3 built.** This section is the design S3
is built from; the rules become normative in
[LANGUAGE.md](LANGUAGE.md#calling-c) only as each step lands, and S3.1's are
there now. S3.1 departs from §8c in one place, the runtime call, and §8c says
how; S3.2 departs from §8d in the same place, and §8d says how; S3.3 departs
from §8e in that place too, and §8e says how. §3 asked whether S3 should happen at all; this plan answers yes,
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

**As built (S3.1), the check is lowered in the IR, not in a runtime call.**
`runtime/runtime.c` is at its `.text*` ceiling (`RUNTIME_TEXT_BUDGET` in
`tests/runtime-budgets.js`), and a ceiling raised to fit a feature is not a
fix, so there is no `nish_ffi_cstr`. The emitter writes the test with a
runtime function that already exists — `nish_str_index_of(s, "\0")`, a
`memchr` over the same bytes — and branches to a cold `ffi.nul` block that
calls `nish_panic` with a message built at compile time for that call site,
then takes `s->data` with a `getelementptr` on the other arm
(`emitForeignString`, `src/emit-strings.ts`). The cost is the same one pass;
what moved is that each checked call carries a short block and its own message
constant, instead of one shared runtime function. Measured on a loop of 4M
`strlen` calls over runtime strings of 1,024, 1,024 and 16 bytes in turn,
folded into a printed checksum, at `--profile speed`: 19.2 ns a call with the
check and 10.2 ns with its branch deleted from the same IR. A byte-identical
copy of the checked build timed 19.6 ns in the same 21 interleaved rounds, so
the noise band is about 2%. A C function that reads the whole string pays
about twice as much per byte as it did without the check, and one that reads
only a prefix pays more. A literal with no NUL in it is not checked. The
message prints without §8c's `panic: ` prefix, as every runtime panic does
(`slice out of range: [2, 5) of length 4`).

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

**As built (S3.2), the copy is lowered in the IR, not in a runtime call.**
`runtime/runtime.c` is still at its `.text*` ceiling, so there is no
`nish_ffi_str` either. A module whose program declares a C function with a
`string` or `string | null` result gets one private helper,
`@nish.ffi.str(i8* %p)`: a byte loop that counts to the `NUL`, then
`nish_str_new(p, n)`, the runtime's existing copy into the arena. It counts
bytes itself rather than calling `strlen` because a program may declare
`strlen` with its own signature, and a second declaration of one symbol is an
IR error. Each call site tests the answer against `null` first: a `string`
result branches to a cold `ffi.null` block that calls `nish_panic` with a
message built at compile time (without the `panic: ` prefix, as in §8c), a
`string | null` result to an `ffi.none` arm joined with the copy in a `phi`
(`emitForeignStringResult`, `src/emit-strings.ts`). Two things outside the
emitter moved with it. The escape analysis treats a foreign call as a local
allocation site rather than a callee whose result is placed by the callee: the
copy is made in the caller's arena scope, and the call is the `oom` site
`--emit-panics` lists. And a call whose result is copied is never marked `tail`, since
the copy runs after it returns. For `strchr`, which answers into its own
argument, S3.1's rule already refuses the mark, because the call takes a
string; the S3.2 refusal (`planTailCall`, `src/emit.ts`) covers a result
copied from a call with no string argument, where sinking the release ahead of
the copy is harmless today, so no test can tell it apart. It stays so that the
copy is never inside a released scope by construction. Measured at `--profile speed` on 10^7 calls of
`strerror(i % 134)`, each answer's length and first byte folded into a printed
checksum: 94.1 ns a call (median; min 87.6) in 15
interleaved rounds, against 96.4 ns for a byte-identical copy of the binary, a
noise band of about 2.5%. The same loop in C at `-O2`, with `strlen` and no
copy, took 83.4 ns (min 77.7; its own copy 87.3, a band of about 5%). The copy
costs some 10 ns on top of glibc's `strerror`, which is most of the time.

### 8e. `readCString`, in `nish:unsafe`

`readCString(p: CPtr): string` copies the NUL-terminated bytes at `p` into the
arena. It belongs in [`nish:unsafe`](LANGUAGE.md#nishunsafe-unchecked-access-and-defined-wrapping)
and not in the global namespace, because it is exactly the kind of thing that
module exists to make visible: an address with no proof behind it that a NUL
ends it is read until one is found, and a `CPtr` that does not point at a C
string is undefined behaviour. `--emit-checked` records the import and every
call, as it does for the other five.

It is the one place S3 dereferences a `CPtr`, and it does so in the runtime,
not in the IR: §7a's "no dereference" stays true of the language, and the
`CPtr` keeps getting no pointer attributes.

**As built (S3.3), the copy is the IR helper S3.2 built, not a runtime
function.** `runtime/runtime.c` is still at its `.text*` ceiling, so
`readCString(p)` lowers to `call i8* @nish.ffi.str(i8* %p)`, the private
byte-loop-and-`nish_str_new` helper of §8d, which a module now defines when it
declares a C function with a `string` result *or* calls `readCString`. The
dereference is therefore in the IR after all, but only inside that helper,
which the program cannot spell; §7a's "no dereference" stays true of the
language, and the `CPtr` still gets no pointer attributes. The parameter is a
non-null `CPtr`, so a `CPtr | null` must be narrowed first
(`reject_unsafe_read_cstring`), but that proves nothing about a result C
answered: a `declare function` whose result is declared `CPtr` may still
answer `NULL`. So the call tests its pointer before the copy and panics with
the `ffi-null` kind (``` `readCString` read a NULL pointer ```,
`panics_ffi_read_cstring_null`), the test `readStruct` makes (§9h) and a
`string` result makes (§8d), emitted by one helper (`emitFfiNullTest` in
`src/emit-builtins.ts`); `@nish.ffi.str` itself tests nothing, so no path
tests twice. `--emit-panics` lists the call as an `ffi-null` site with the
copy's `oom` beside it, and no proof removes the test, so `--deny-panics`
refuses a call in its scope (RT-16). The copy is a fresh allocation of the
calling function (`isAllocatingBuiltin` in `src/escape.ts`)
(`tests/cases/ffi_owned_string`, `reject_ffi_owned_string_arena`). On wasm32
the helper and the test are the same IR, and need only `nish_str_new` and
`nish_panic`.

**As built (S3.3), the literal-`null` rule is a call-site rule.** The nullable
branch of `checkForeignSignature` is gone, so the declaration accepts
`CPtr | null` in a parameter, and `refuseForeignNullable`
(`src/expressions.ts`) refuses, at each call of a foreign function, an argument
of a nullable type that is not the literal `null`, after parentheses are
unwrapped (NL2539). The rule reads the argument's checked type, so it covers a
local, a ternary or `??` that may answer `null`, a call in a constructor
reached by `new` or in a method, and a call through a function parameter a
`declare function` is passed to, each pinned in
`reject_ffi_pointer_nullable_variable` and
`reject_ffi_pointer_nullable_specialised`. A `string | null` parameter keeps
S3.1's rule, under which `null` passes `NULL` from any expression: a string
argument is lent and then checked, while a pointer argument is C's own handle.

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
  and is not a string, because it carries a length and may be written, so it
  was designed separately rather than folded in:
  [wp53-ffi-buffers-handles.md](wp53-ffi-buffers-handles.md). Its B1.1 stage
  accepts the parameter with its `u64` count in a declaration, and B1.2
  lowers a call to one, checking the count (`ffi-length`).
- A Nish function passed as a C callback: a function pointer, and with it a
  call *into* the program from a frame it did not set up.
- Variadic C functions (`printf`): the C variadic convention is a different
  call lowering on most targets, and the TypeScript spelling (`...args`) is
  already refused in every signature (`Rest parameters are not supported`).
  *Status:* a Nish function, method or constructor now ends in a rest
  parameter; a `declare function` still may not, so a variadic C function
  stays out of reach.
- Any other `CPtr` widening from §7a: no field, no element, no program
  parameter or return.

### 8g. Steps, each one pull request

| Step | Delivers | Tests |
| --- | --- | --- |
| **S3.1** (built) | `string` and `string \| null` parameters; the borrow rule in `src/escape.ts`; the NUL check (lowered in the IR rather than `nish_ffi_cstr`, §8c) and the `ffi-nul` panic kind; the literal proof | `ffi_string_param` (golden `.ll` + native round trip against libc: `strlen`, `puts`, `atoi`, `setenv` then the runtime's `getenv`); `ffi_string_param_arena` (a concatenated string passed from a function whose arena scope releases after the call, linked against a C sidecar that copies what it read, so the output shows the bytes were live during the call); `panics_ffi_nul`; `reject_ffi_string_array_param` |
| **S3.2** (built) | `string` and `string \| null` returns; the copy (lowered in the IR rather than `nish_ffi_str`, §8d) and the `ffi-null` panic kind | `ffi_string_return` (`getenv`, `strerror`, `setlocale` query, and `strchr` answering into its own argument, each copy kept across a churned arena); `panics_ffi_null`; `reject_ffi_string_array_return`; a timing of `strerror` in a loop whose argument changes on every iteration, folded into a printed checksum, to state the copy's cost in the commit's `Measured:` trailer |
| **S3.3** (built) | `readCString` in `nish:unsafe` (lowered to S3.2's IR helper rather than a runtime function, §8e); the literal-`null` `CPtr \| null` parameter | `ffi_owned_string` (`strdup`/`free` and `realpath(p, null)`/`free` round trips, each copy kept across a churned arena); `reject_ffi_pointer_nullable_variable` and `reject_ffi_pointer_nullable_specialised` (the narrowed-local rule kept); `reject_unsafe_read_cstring`; `reject_ffi_owned_string_arena`; `reject_unsafe_no_import` extended |

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

## 9. S4: C structs by layout declaration

S4 lets a program name a C struct's layout and hand C a pointer to an instance
of it. It is the first layout in the language that the compiler did not choose
for its own reasons, so the rule below is stated as the C rule the targets
share, and the compiler computes the offsets from it rather than being told
them.

### 9a. The spelling

```ts
declare class Rlimit {
  rlim_cur: u64;
  rlim_max: u64;
}
declare function getrlimit(resource: i32, rl: Rlimit): i32;

const rl = new Rlimit(); // every field zero
if (getrlimit(7, rl) === 0) {
  console.log(rl.rlim_cur);
}
```

`declare` is TypeScript's "this exists elsewhere", as for `declare function`;
the elsewhere is C. Before S4.1 the checker refused every `declare class`
(`reject_cls_declare`: a layout from elsewhere, and no elsewhere).

### 9b. The layout rule

A *layout class* is a `declare class` whose members are fields only, each one
of:

- a foreign scalar: `i32`, `i64`, `u8`–`u64`, `f32`, `f64`;
- `CPtr` or `CPtr | null`, one pointer-sized word: eight bytes on a 64-bit
  target and four on wasm32 (§9g);
- another layout class, nested **by value**: its bytes sit inside the outer
  struct, as a C `struct inner in;` member does.

The fields are laid out in declaration order, each at its natural alignment,
and the size is rounded up to the largest alignment among them. This is the
rule the System V x86-64 and AArch64 ABIs and Apple's arm64 ABI agree on for
these member types; `tests/cases/ffi_struct_layout` holds the compiler to a C
compiler's own `offsetof` and `sizeof` for a struct that mixes every width,
nests a struct and ends in padding. The widest-first reorder
`src/structs.ts` applies to an ordinary class, and the padding warning that
suggests it, never apply: the order is C's, not the compiler's to improve.

Refused, each by its own diagnostic: a `string` (C has no length-prefixed
string), an array (a fixed inline C array is a later decision), an ordinary
class (a Nish pointer C would have to keep alive), `boolean` (`_Bool`'s width
is the ABI's business; write `u8`), `number` (its width is whatever
`--number-mode` picks, and a struct has one layout; write `i32` or `f64`), an
initialiser, a method, a constructor, a
`static` member, an accessor, a type parameter, `extends`, `implements`, and
`export`. A class whose nesting reaches itself has no finite size and is
refused. A C `int8_t` or `int16_t` member has no field type yet, because the
type system has no `i8` or `i16`; a field of either width waits on that, and
until then a declaration spells one as `u8`/`u16` and reinterprets the sign.

### 9c. Instances

`new Name()` takes no arguments and gives an instance whose every byte is zero,
which is C's `= {0}`: one `llvm.memset` of the struct's size, not a
`zeroinitializer` store, because LLVM may leave a store's padding bytes
unwritten and arena memory is not cleared, while C may `memcmp` or hash the
whole struct. Fields read and write as an ordinary class's do. A layout
instance lives in a local, a field of an ordinary class, or a parameter or
return of a function the module keeps to itself. It is not an array element,
and no exported signature holds one, however deep (§9g); a `declare function`
borrows it and never returns it.

A nested field is the one new shape: `o.inner` names bytes inside `o`, not a
separate object. It may be the head of a member chain (`o.inner.tv_sec`,
`o.inner.tv_sec = 0n`) and an argument to a layout parameter of a `declare
function`, which receives the interior address. It may not be assigned (`o.inner
= x` would be a copy the language has no spelling for yet) or taken as a value
(`const i = o.inner` would be a pointer into `o` that outlives nothing the
escape analysis tracks). Both are refused by name.

### 9d. Crossing: by pointer, borrowed

A `declare function` parameter typed as a layout class, or `Name | null` under
S3.3's rule (the literal `null` or a narrowed value), lowers to a pointer to the
struct. A struct never crosses by value, in either direction: the C ABI for
struct arguments and results differs per target (registers, a hidden pointer,
split across classes) and LLVM leaves that lowering to the front end. A layout
class as a `declare function` result is refused (`reject_ffi_struct_return`);
S4.2's `readStruct` is how a C-owned struct comes back, by copy (§9h).

The pointer is **borrowed for the call**, S3.1's rule (§8b) applied to a
struct: C may read and write through it while the call runs and must not keep
it. The compiler cannot check that, so it is a stated contract, and the
LANGUAGE.md rule says so first. In the compiler it reads as follows:

- `src/escape.ts` treats the argument as a use for the call's length, so an
  instance in a function's arena scope or on its stack stays live across the
  call and the foreign callee's escaping facts stay empty;
- C may write any field, so the call ends every fact about the instance's
  fields (a narrowed `CPtr | null` field, a known value), as WP53 §3c does for
  a `u8[]` buffer, and no attribute marks a parameter passed on to C
  `readonly`.

### 9e. What does not change

The `ffi` capability still names every foreign call and `--deny ffi` refuses
the program; FFI programs stay outside the differential oracle (§5);
`--emit-header`, `--emit-dts` and `--emit-napi` never see a layout class
(§9g); `--emit-ts` refuses a layout class as it
refuses a `declare function`. Out of scope: structs by value, unions,
bit-fields, packing, fixed inline array fields, writing C-owned memory,
callbacks and variadics.

### 9f. Steps

| Step | Delivers | Tests |
| --- | --- | --- |
| **S4.1** (built) | `declare class` as a layout (§9b, §9c); a layout-class `declare function` parameter lowered to a borrowed pointer (§9d) | `ffi_struct_param` (`getrlimit`/`setrlimit` round trip, `clock_gettime` twice, a nested layout); `ffi_struct_layout` (a C sidecar's `offsetof`/`sizeof` against the fields Nish read); one `reject_ffi_struct_*` per refusal; `reject_cls_declare` rewritten |
| **S4.2** (built) | `readStruct(p: CPtr)` in `nish:unsafe`, a copy of a C-owned struct into a Nish-owned instance of the `declare class` its context names (§9h) | `ffi_struct_read` (`localeconv`, a sidecar's static struct overwritten after the copy, a churned arena); `reject_unsafe_read_struct_*`; `reject_unsafe_no_import` extended; `panics_ffi_read_struct_null` (the `ffi-null` panic); `tests/ffi-struct.js` (the `ffi-null` site, the wasm32 size) |

### 9g. Headers, bindings and targets

A layout class must not reach `--emit-header`, `--emit-dts` or `--emit-napi`.
Refusing `export` on the class is not enough: an exported function's parameter
or return type, an exported class's field and an exported method's signature
all name their types, and before this rule `export const f = (p: Point)`
compiled and its header carried a `struct Point` the generator had written as
an ordinary Nish class, which C would have read as a different object. Two
answers were open:

1. **Describe the layout in the header**, as the C struct it is. The header
   could, but the `.d.ts` and N-API generators would then need a JavaScript
   shape for a struct C fills, which is S4.2's question, and every exported
   signature would turn a borrowed pointer into a contract with a caller this
   program never sees.
2. **Keep the layout in its module.** The checker refuses a layout class as a
   parameter or return type of an exported function or an exported class's
   method, and as a field of an exported class or interface
   (`reject_ffi_struct_export_param`, `_return`, `_method`, `_field`); the
   header generator also skips a layout when it lists structs.

"Names a layout" is transitive: `Result<Point, string>`, `Point | null`, an
array, a generic instance `Box<Point>` and a class of this program with a
layout field all hold one, and each is refused where the layout itself is
(`reject_ffi_struct_export_result`, `_generic`, `_holder`). The check runs
once every struct has its fields, after signatures and again after bodies, since
a holder may be declared below the export that names it and a generic instance
may first appear in a body. The `.d.ts` and N-API generators read only exported
signatures, so the refusal keeps a layout from them. The header lists every
class of the program, exported or not, so a private class that holds a layout
is declared there opaque, `typedef struct Holder Holder;`, with no fields for C
to misread.

S4.1 takes the second. It is the smaller promise, it matches §9d's contract (a
layout is lent to a `declare function`, by this program), and lifting it later
is additive. `tests/ffi-struct.js` pins the result: the `--emit-header` of a
module with a private layout and an exported function has no `struct` for the
layout, a private holder is opaque, and both headers compile under
`-Wall -Wextra -Werror`.

**Targets.** A `CPtr` field is the target's `void *`, so a layout's sizes and
offsets follow the target: on wasm32 (`--profile wasi`) a pointer field is four
bytes, aligned to four, and the struct `{ u8; CPtr; { u16; CPtr | null }; u8 }`
is 20 bytes where it is 40 natively. `tests/ffi-struct.js` measures Nish's
build, never a constant: the `memset` length and the `dereferenceable` a
lending parameter claims are read from the IR, `llc` lays the IR's own struct
type out for the triple, and clang must give the same C struct those
`offsetof`s and that `sizeof`.

A page module — freestanding wasm, or any build that writes `--emit-dts` — is
compiled once for the host and its IR recompiled for wasm32 later, so a size
fixed at check time would be the wrong target's; and nothing on a page links C
to lend a struct to. A `declare class` there is refused (NL2757,
`tests/wordings/nl2757_declare_class_emit_dts`). A `--profile wasi` build knows
it is wasm32 from the start and is sized for it. Debug info still describes a pointer member as 64 bits wide on
wasm32, as it does for every pointer the compiler emits; the offsets it gives
are the layout's.

The rolling freeze (§8h) holds: `std/` may declare a layout class from the
commit that lands S4.1, `src/` not until the release after it.

### 9h. `readStruct`: a C-owned struct comes back by copy (S4.2)

§9d lends a struct Nish owns to C. The other direction is a struct C owns,
whose address a `declare function` hands back: `localeconv()`'s `struct
lconv`, `getpwnam`'s `struct passwd`, `gmtime`'s `struct tm`, each a static
buffer the next call overwrites. Three shapes were open.

1. **A view.** A layout-class value that is C's pointer, read field by field
   in place. It costs no copy, but every read is then through memory the
   program does not own and C may rewrite between two reads (the next
   `localeconv()`, `setlocale`, another thread), and the value's lifetime is
   C's, which no rule of Nish can state: a view kept in a field outlives the
   buffer as easily as a local does. Escape analysis would have to treat a
   layout value as possibly foreign everywhere, and §9d's borrowed pointer
   would no longer be the only way a layout and C meet.
2. **A borrowed reference, scoped to a block.** A view the checker keeps from
   escaping a block, as `using` scopes an arena. That bounds the lifetime, but
   not C's writes inside the block, and it is a new kind of value with its own
   refusals at every place a layout may go, for a struct that is a few dozen
   bytes.
3. **A copy.** `readStruct(p)` allocates an instance as `new` does and copies
   the layout's size of bytes into it, once. After the call the instance is
   the program's, like any other: C may free or rewrite its struct, the copy
   lives and dies by §9c's rules, and nothing about a layout value changes.

S4.2 takes the copy. The cost is one `memcpy` of a struct, and the pointer is
dereferenced exactly once, at a call the program spells in `nish:unsafe`.
What the copy cannot do is deep-copy: a `CPtr` field of the copy is still C's
pointer, read with `readCString` while C keeps it live, as S3.3 already
requires.

**The spelling: the layout comes from context.** The plan wrote
`readStruct<T>(p)`, but a type argument is not written at a call site in
Nish: `identity<i32>(7)` parses as `(identity < i32) > (7)`, and WP18 §2a
refuses it by name. `readStruct` has nothing to infer `T` from in its argument,
so it takes `T` from where the result goes, as `Ok(v)` and `Err(e)` do: an
annotation (`const lc: Lconv = readStruct(p)`), a parameter, a return type or
an assignment's target. The context, stripped of `| null`, must be a
`declare class`; a call with no context, or one whose context is not a layout,
is refused (`reject_unsafe_read_struct_context` holds both), and
`readStruct<Lconv>(p)` is refused with a message that names the annotated form
(`reject_unsafe_read_struct_type_args`). `runtime/nish.d.ts` still declares
`readStruct<T>(p: CPtr): T`, which `tsc` infers from the same context.

**A `NULL` test, and no size test.** The parameter is a non-null `CPtr`, so a
`CPtr | null` is narrowed first, as for `readCString`
(`reject_unsafe_read_struct_null`). That narrowing proves nothing about a
result C answered: a `declare function` whose result is declared `CPtr` may
still answer `NULL`, and reading a struct through it is a fault natively and a
silent read of address 0 on wasm32. So the copy tests its pointer first and
panics with the `ffi-null` kind, naming the layout (``` `readStruct` read a NULL
pointer into a `Pair` ```, `panics_ffi_read_struct_null`). `--emit-panics`
lists the call as an `ffi-null` site with the copy's `oom` beside it, and no
proof removes the check, so `--deny-panics` refuses a call in its scope.
`readCString` makes the same test (§8e). The
size is not checked: the compiler cannot know how many bytes C's pointer
covers, so the layout must be the struct or a prefix of it. That, and the
liveness of the pointer, are why the function is in `nish:unsafe`, and
`--emit-checked` records the import and every call.

**As built.** The checker is `checkReadStruct` in `src/builtins.ts`; the
emitter is `emitStructCopy` in `src/emit-classes.ts`: the `NULL` test and
its panic, then the arena allocation
`new` makes (`nish_alloc_struct`, rounded to 8), then
`llvm.memcpy` of the layout's size, the destination aligned to 8 and the source
to 1, since C's struct is aligned to what C chose and the compiler knows only
the address. The copy is a fresh allocation of the calling function
(`isAllocatingBuiltin` in `src/escape.ts`), so a copy made in a callee and
returned is held by the caller's scope. The size is the target's (§9g): 16 bytes for
`{ CPtr; CPtr }` natively and 8 on wasm32. `tests/cases/ffi_struct_read` reads
`localeconv()` and a C sidecar's static struct, and prints each copy after C
has overwritten its struct and the arena has been churned. There is no
`writeStruct`: writing C-owned memory stays out of scope (§9e), and a struct
C should fill is lent to it by §9d.

## 10. S5 as built: `cErrno`

### 10a. The decision

```ts
import { cErrno } from "nish:unsafe";
declare function open(path: string, flags: i32): i32;

if (open("/nonexistent/x", 0) < 0) console.log(`${cErrno()}`); // 2
```

`cErrno(): i32` in [`nish:unsafe`](LANGUAGE.md#nishunsafe-unchecked-access-and-defined-wrapping)
answers the errno the most recent `declare function` call **on this thread**
left. In a program that names it anywhere, the compiler sets errno to 0
immediately before every `declare function` call and copies errno into a
runtime slot immediately after it returns, before any result marshalling.
Before any foreign call it answers 0. A program that never names it pays
nothing: no store, no load, no runtime call, and its IR is byte for byte what
it was.

### 10b. Why not a foreign global

errno is not a variable C exports. glibc and musl define it as
`(*__errno_location())` and Darwin as `(*__error())`, a macro over a function
answering a pointer into thread-local storage, so `declare let errno: i32` would
name a symbol that does not exist on any of them. Nish also has no `declare let`
(`reject_ffi_errno_global` pins the parser's refusal). Exposing the
platform's accessor by name would put a per-libc spelling in the compiler, so
the runtime reads errno through C's own `errno`: `nish_errno_ptr()` is
`return &errno;`, and each libc (glibc, musl, Darwin, wasi-libc) compiles its
own definition of it.

### 10c. Why after the call, and why before

Anything the compiler runs after the call may call into libc and move errno:
copying a `string` result into the arena (`@nish.ffi.str`, §8d), an arena
allocation that maps a new chunk, or a later `console.log`. So the save is the
first thing after the `call` instruction, ahead of the `NULL` check of a
`string` result, and `cErrno()` reads the saved copy, not errno. The case
`ffi_errno` calls a C function that sets errno to 5 and answers a C string,
then reads 5 after the copy.

The zeroing is the owner's decision at sign-off. A C function that reports
failure only through errno, `strtol` out of range or `readdir`, which answers `NULL` both at
the end of a directory and on an error, can only be checked if errno was 0 going in, and
Nish exposes no setter. So in such a program `cErrno()` after a successful
call is 0 unless the callee set it: `strtol("42")` reads 0 right after an
out-of-range `strtol` read `ERANGE` (34).

### 10d. The runtime: one pointer and one slot

```c
NISH_TLS int32_t nish_errno_slot;
int *nish_errno_ptr(void) { return &errno; }
```

The emitted sequence around a foreign call is:

```llvm
%e = call i32* @nish_errno_ptr()      ; errno's address on this thread
store i32 0, i32* %e
%r = call i32 @open(i8* %p, i32 0)
%v = load i32, i32* %e
store i32 %v, i32* @nish_errno_slot
```

and `cErrno()` is `load i32, i32* @nish_errno_slot`. Three runtime functions
(zero, save, read) would be the plainer shape, but `runtime.c` is held to a
`.text*` ceiling (`tests/runtime-budgets.js`) and three functions did not fit
under it; `nish_errno_ptr` compiles to one jump to the libc accessor, and the
slot is data. `nish_errno_ptr` is declared `nonnull`, and the attribute pass
gives it no memory effect of its own, so a caller of C keeps exactly the facts
a caller of C kept before. A function that calls `cErrno()` reads memory: it is
`readonly`, never `readnone`, so it is not moved across a foreign call or
merged with a `cErrno()` on the other side of one. A foreign call in such a
program is never a tail call, since the save follows it.

### 10e. Threads

The slot is `NISH_TLS`, `_Thread_local` under `-DNISH_THREADS=1`, and the IR of
a `--threads` build declares it `thread_local(initialexec)`, as it does the
arena. errno is per thread in every libc, so each thread reads what its own
last foreign call left. A `parallel` worker cannot call a `declare function`
at all (a foreign call is a shared write, §8 and WP20), so the per-thread case,
`ffi_errno_threads`, runs two pthreads from its C driver: each stages a
different errno through a Nish function, waits at a barrier until both have,
and reads its own.

### 10f. What it does not cover

- **A host-module import** (`--host`, WP50) is not a C call and leaves no
  errno, so it is neither zeroed nor saved.
- **A `using` handle's close** (WP53) runs C's close function at scope exit
  and is not captured: the close is the compiler's call, not the program's,
  and a program that wants the close's errno calls the close function itself.
- **wasm32.** A freestanding wasm build has no operating system, and a
  `declare function` there is already refused, so `cErrno` is refused too,
  with the wasm32 message every OS builtin gives (`reject_ffi_errno_wasm`).
  `--profile wasi` links `runtime.c` against wasi-libc, whose `errno` is a
  plain global, and keeps it.
- **No setter, no `strerror`.** A program that wants the text declares
  `strerror(e: i32): string` itself; the copy of its result does not move the
  saved errno.

### 10g. What a reviewer should push back on

The capture is program-wide, not per call: naming `cErrno` once makes every
foreign call in every module of the program pay two stores, a load and a call
it did not ask for. A per-declaration opt-in (`@errno` on the `declare
function`) would be cheaper and more precise, but it is a new attribute
syntax for a few nanoseconds against a call into C, and the rule "the most
recent foreign call on this thread" would then quietly mean "the most recent
foreign call that asked", which is the kind of rule a reader gets wrong.
