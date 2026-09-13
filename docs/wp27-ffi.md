# WP27 — Calling C from Nish

**Status:** S1 and S2 are built. S1 landed scalar-only `declare function` in
both compilers (#62, `tests/cases/ffi_scalar`); S2 landed the opaque pointer
§3's table calls for (`CPtr`, `tests/cases/ffi_pointer`, and §7 for what it
turned out to mean). S3 onward is proposal, and §3's last paragraph — whether
S2–S5 should happen at all is a language question — still stands over every one
of them.

Every builtin in this language bottoms out in a C function. `print` reaches
`nish_print_str`, `readFileSync` reaches `nish_read_file`, and WP26's
`readdirSync` reaches `nish_readdir`. That is not an implementation detail a
reader can ignore, because it is also the *only* way the language reaches the
operating system: a Nish program cannot name a foreign function, so a capability
that needs a syscall can only be added by someone editing `runtime/runtime_os.c`
and the compiler together.

This note is about removing that restriction, and about being honest that doing
so points a loaded weapon at the thing that makes this compiler fast.

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

```llvm
declare i32 @getpid()
...
  %0 = call i32 @getpid()
```

Three things recommend this spelling over inventing one:

- **It is already valid TypeScript, and it already means this.** `declare`
  in TypeScript means "this exists, somewhere I cannot show you". The parser
  this compiler uses accepts it today; `src/validator.ts` is what refuses it.
- **It needs no name mangling.** The symbol is the identifier, which is the
  same promise `--emit-header` makes in the other direction: "there is no
  hidden context argument, no return-slot pointer, no name mangling".
- **The type mapping is already written down.** `src/interop/abi.ts` pins the
  C ABI of every Nish type for `--emit-header`. Inbound FFI is that table read
  right to left, so there is one ABI in this compiler rather than two.

## 2. Why this is not merely plumbing

The machinery to emit a foreign call already exists and runs on every compile:
`src/codegen/runtime.ts` holds a `declare` line per runtime symbol and
`ctx.useRuntime(name)` emits it. Mechanically, S1 exposes that to user code.

What does *not* already exist is an answer to this:

> The performance thesis of this compiler is that it sees all of the code.

`src/codegen/attributes.ts` runs a whole-program fixpoint over purity, escape
and loop facts, and only emits an attribute the fixpoint justifies. Escape
analysis is what grants a function an automatic arena scope — the memory model
in `docs/LANGUAGE.md` is built on it. A foreign function is a hole in that
fixpoint: the compiler cannot know whether it stores a pointer it was handed,
whether it frees one, whether it returns memory it owns, or whether it returns
at all.

So a foreign call must be assumed to do the worst of each:

| Fact | What a foreign call forces |
| --- | --- |
| memory effect | `write` — the caller loses `readnone` and `readonly` |
| escape | every pointer argument escapes; the arena cannot be released around the call |
| `willreturn` | not provable — the callee may `exit` or loop forever |
| `nounwind` | *decided, not proved* — see below |
| allocation | a returned pointer is **not** arena memory and has unknown lifetime |

The declaration therefore carries **no attributes at all**. That is the rule
"no attribute without a proof" applied honestly rather than a conservative
mood.

`nounwind` on the *caller* is the one row that cannot be settled by being
conservative, because `src/codegen/attributes.ts` puts `nounwind` on every
function unconditionally, justified by "the language has no exceptions". A
foreign callee could unwind through that frame, so the justification stops being
a proof the moment FFI exists. Dropping the attribute from every caller of a
foreign function is the conservative move and it buys nothing: a language with no
`throw`, no landing pad and no way to spell a handler cannot do anything with an
unwind it admits to. So S1 **decides** instead: *unwinding out of a foreign call
is undefined in this language*, which is the position clang already takes
compiling C. The decision is written next to the attribute, because an inherited
assumption that quietly stopped being true is the defect this project keeps
finding.

**This is the same shape as the bug that shipped in 0.1.0.** `getenv` returned a
pointer the escape analysis did not know was allocated, the arena was released
before the `ret`, and a program printed freed memory. WP26 fixed it and added a
guard that derives the allocating-builtin set instead of restating it. FFI
re-opens that class *in user code*, where no guard of ours can see it — which is
why the conservatism above is the feature, and why S1 is deliberately small.

## 3. What S1 does and does not buy

**S1 is scalars only**: `i32`, `i64`, `f64`, `boolean`, `void`, and the integer
widths `u8`–`u64` that already have an ABI row. No pointers, no `string`, no
arrays, no structs.

That is enough to call a great deal of libc — `getpid`, `abs`, `isatty`,
`sysconf` — and it is enough to prove the mechanism, the attribute story and
the stage0/stage1 equality.

**It is not enough to write `readdirSync` in Nish, and that was the motivating
request.** `opendir` returns a `DIR *`, `readdir` returns a `struct dirent *`,
and reading `d_name` out of it needs a pointer type, a struct layout the
compiler did not lay out itself, and a conversion between C's NUL-terminated
`char *` and this language's length-prefixed `nish_str *`. Each is a real
decision, not a missing line:

- **A pointer type.** Nish has no pointer. Introducing one introduces the first
  value in the language whose dereference the compiler cannot prove safe.
- **`string` marshalling.** `string` is `nish_str *` — a length and bytes. C
  wants `char *`. Converting on the boundary means allocating, which means the
  arena, which means the escape question above in its hardest form.
- **`errno`.** A thread-local the runtime does not model.

So the staging is not padding: S1 is the part that can be made sound without
answering any of those.

| | Deliverable |
| --- | --- |
| S1 | scalar-only `declare function`, no attributes, both compilers, byte-identical IR — **done** |
| S2 | an opaque pointer type, `null` only from a foreign call, no arithmetic — **done**, §7 |
| S3 | `string` ↔ `char *` marshalling, and who owns the bytes |
| S4 | C structs by layout declaration |
| S5 | `errno`, and whether it is a builtin or a declared foreign global |

Whether S2–S5 should happen at all is a language question, not a schedule. A
language whose whole selling point is that every value has one known layout may
decide that a raw pointer is not welcome in it, and that the OS is reached
through builtins on purpose. This note does not decide that; it decides S1.

## 4. What has to change

Following the nine-step checklist in `docs/ARCHITECTURE.md`:

- **Validator.** `declare function` is refused today; the rule becomes
  conditional — a declared function with a body, a declared `class`,
  `namespace` or `var`, and a non-scalar signature stay refused, each with its
  own diagnostic code.
- **Checker.** A new declaration family records the signature as a
  `FunctionSig` marked foreign; calls type-check exactly as any other call.
- **Emitter.** A foreign symbol is declared through the same path runtime
  symbols use, with an empty attribute group.
- **Attributes.** `factCollectors` learns that a foreign call has
  `effect: "write"`, defeats `willreturn`, and that every pointer argument
  escapes.
- **`self/`.** The same in `self/validator.ts`, `self/parser.ts`,
  `self/nodes.ts`, `self/checker.ts` and `self/emit.ts`, because a construct
  enters `src/` and `self/` together — `#54` touched 23 files under `self/`.
- **Tests.** A golden `.ll`, an `llvm-as` pass, a native round trip that
  actually calls libc, and `reject_*` cases for each refusal above.
- **Docs.** A `docs/LANGUAGE.md` rule citing the case, a cookbook entry, and
  the note that a program using FFI is no longer one the compiler can reason
  about end to end.

## 5. What FFI costs the test strategy

The differential oracle (`docs/wp13-differential.md`) rewrites a Nish program to
JavaScript and runs it against `runtime/shim.mjs`, and its premise is that the
same source means the same thing in both worlds. That premise does not hold for a
source whose meaning is "whatever this C function does": `tests/cases/ffi_scalar`
calls `abs`, the shim has no `abs`, and no amount of shimming fixes the class —
the next program declares a different symbol.

So **every FFI program is outside the differential oracle by construction**, and
that is a cost rather than an oversight. It is why S1's evidence is arranged the
other way round: a golden `.ll`, an `llvm-as` pass, a native round trip against
real libc, and the attribute assertions — a caller of C keeps only `nounwind`,
one that calls no C keeps `willreturn readnone` — which the differential oracle
could never have made anyway.

## 6. The thing a reviewer should push back on

The runtime budget exists because C in this project is meant to be a closed,
shrinking set (`docs/wp7-runtime.md`). FFI makes that set *open* — not in
`runtime/`, but in any program. A reader could reasonably conclude that the
honest consequence is to stop describing the runtime as closed, rather than to
keep two stories.

The counter-argument is that the budget was always about what *ships in every
binary*, and a foreign call ships in the program that makes it. That is
probably right, but it should be written down in `wp7-runtime.md` as a decision
rather than left as an inference.

**It is written down now**, in `wp7-runtime.md` under "What FFI does and does
not do to the budget": the budgets measure `runtime/runtime.c` and
`runtime/runtime_os.c`, the two translation units linked into *every* binary,
and a `declare function` adds a `declare` to one program's IR and a symbol to
one program's link line. So the closed set stayed closed and the sentence that
describes it gained the clause it was missing. The honest half of the reviewer's
objection survives the answer and is recorded there too: what FFI opens is the
*language's* reach into C, and the budget was never the thing that bounded that
— `docs/LANGUAGE.md` was, by having no way to name a foreign function, and that
is the bound this package removed.

## 7. S2 as built: `CPtr`

### 7a. What it is, and the four words that bound it

`CPtr` is an address a C function handed back. It is `i8*` in the IR and eight
bytes wide, and **that is the whole of what the compiler knows about it**: not
arena memory, not a `%struct.<name>`, not a `nish_str *`. §3's row asked for
"an opaque pointer type, `null` only from a foreign call, no arithmetic", and
each clause of it is a rule with a case behind it:

- **Opaque.** No dereference, no index, no member, no arithmetic. The operations
  are `=== null`, `!== null`, comparing two `CPtr`s, assignment, and passing one
  back to a foreign function.
- **`null` only from a foreign call.** A `declare function` may *return*
  `CPtr | null` and may not *take* one, so a pointer is narrowed with
  `!== null` before it goes back. Without that asymmetry a program could hand C
  a null it never got from C, which is exactly what the narrowing was there to
  stop (`tests/cases/reject_ffi_pointer_nullable_param`).
- **Nowhere but a foreign signature and a local.** A field, an array element, a
  `Result` arm, a type argument, and the parameters and return type of a
  function this program defines are all refused with one message
  (`reject_ffi_pointer_field`, `_array`, `_param`, `_return`). §7b is why.

The name is PascalCase where every other type the language has is lower case,
and that is deliberate: `i32` and `string` are this language's types and `CPtr`
is not — it is C's, borrowed for the length of a call, and the `C` is the
reminder that its lifetime belongs to whoever allocated it.

### 7b. Why the placement rule is the soundness argument

§2's table is the reason S1 was small, and S2 does not weaken a single row of
it. The declaration still carries no attributes; the caller still loses
`readnone` and `willreturn`; `nounwind` is still a decision rather than a proof.
What S2 adds is a *value* coming back, and the question that value raises is not
"what attributes does the callee get" but **"can this compiler mistake a foreign
address for one of its own?"**

The answer is no, and it is no by construction in two places rather than by a
check somebody remembered to write:

1. **`isPointerParam` is an allow-list.** `codegen/attributes.ts` grants pointer
   facts — `dereferenceable`, `nonnull`, `align`, `nocapture`, `readonly` — to
   `struct`, `array` and a non-packed `Result`, and to nothing else. Every one
   of those facts is a claim about memory this compiler laid out: it knows the
   size because it chose it and the alignment because it emitted it. A `CPtr`
   falls out of that list without being named in it. Had the predicate listed
   exclusions instead, the next pointer-shaped type would have been admitted by
   omission, and a wrong attribute is undefined behaviour rather than a missed
   optimisation.
2. **The placement rule keeps it out of everything else that walks memory.** A
   field or an array element would put a foreign address inside a value the
   arena owns and `codegen/escape.ts` walks; a parameter or return type of a
   function this program defines would put one across a boundary
   `--emit-header`, `--emit-dts` and `--emit-napi` each render. Rather than
   teach five passes and three generators to recognise and skip a type, the type
   is refused where it would reach them. That is one rule and one message
   instead of five silent special cases, and it is the difference between a
   thing that is sound and a thing that is sound today.

**And the arena is untouched.** `tests/cases/ffi_pointer` allocates a string
through `console.log` in the same function that calls `calloc`, `realloc` and
`free`, and the golden shows `nish_arena_mark` / `nish_arena_release` bracketing
all of it exactly as they would without the foreign calls. That is safe for the
same reason S1 was: **no pointer this compiler allocated crosses the boundary in
either direction**, so there is nothing for C to be holding when the scope
releases. §2's "the arena cannot be released around the call" is a rule about a
boundary that passes Nish-owned memory, which is S3's, not this one's.

### 7c. What S2 deliberately does not buy

It still is not enough to write `readdirSync` in Nish, and §3 predicted exactly
that: `readdir` returns a `struct dirent *` and reading `d_name` out of it needs
a struct layout the compiler did not lay out itself (S4) and a conversion from
`char *` to `nish_str *` (S3). What S2 buys is the shape underneath both — a
handle that comes out of C, is proved non-null, is held, and goes back in —
which is `opendir`/`closedir`, `fopen`/`fclose`, `dlopen`/`dlsym`,
`malloc`/`free`, and every other C API whose type is a cookie.

`errno` is still S5's and is still a thread-local the runtime does not model.

### 7d. What proves it

`tests/cases/ffi_pointer` is the positive: `calloc` and `realloc` both return
`CPtr | null`, both are narrowed, the narrowed pointer goes back into `realloc`
and then `free`, and a neighbour that calls no C keeps `willreturn readnone`
while `main` keeps only `nounwind`. It is a link test against real libc, so a
pointer that did not round-trip would abort rather than merely differ.

Six `reject_ffi_pointer_*` cases pin the refusals, and
`docs/cookbook/decl_ffi_pointer.ts` pins the lowering. Both compilers implement
it: `tests/self/ir_oracle.js` compares the emitted IR byte for byte and
`tests/self/reject_oracle.js` compares every refusal's wording, which is the
strongest thing this repository can say about a lowering.

The differential oracle is still out of the picture, for §5's reason and not a
new one.
