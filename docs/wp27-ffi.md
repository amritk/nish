# WP27 — Calling C from Nish

**Status:** S1 proposed. Nothing here is built yet.

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
| S1 | scalar-only `declare function`, no attributes, both compilers, byte-identical IR |
| S2 | an opaque pointer type, `null` only from a foreign call, no arithmetic |
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
