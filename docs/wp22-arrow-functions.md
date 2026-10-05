# WP22: Arrow functions as the declaration form

**Status: A and B are built; C is done everywhere but the test corpus; D is an
open question.** Stages A and B (both compilers accept
`const f = (n: i32): i32 => n * 2`, and the two spellings emit byte-identical
IR) landed before 0.1.0. `tests/cases/fn_arrow` carries the golden, the
`llvm-as` pass and the native round trip. Stage C rewrote the docs, `examples/`
and the playground first, then `src/` (0.3.0), then every other Nish program and
the JavaScript tooling (0.13.0, [#253](https://github.com/amritk/nish/pull/253)).
The Biome plugin `biome-plugins/no-function-declaration.grit` now makes a
`function` declaration an error in every file Biome reads. What C has left is
the test corpus, which Biome does not read (§7). A `function` definition is
still accepted. Whether stage D ever rejects one is §10's open question, and
[MASTER_PLAN](MASTER_PLAN.md#what-remains) lists it as the one open language
question. The full plan, including the codemod's design history, is this file
at commit `2b2eb95c`.

The decision: **`const f = (...) => ...` is how Nish declares a function, and
`function` is legacy.** The rules are in [LANGUAGE.md](LANGUAGE.md)
("Functions"), which is normative.

## 1. The decision

There is one spelling for a top-level callable: an arrow bound to a `const`.

```typescript
const double = (n: i32): i32 => n * 2;

export const main = (): number => {
  console.log(`${double(21)}`);
  return 0;
};
```

This is a spelling change and nothing else. It adds no expressiveness, removes
none, and cannot change the output of any program.

## 2. Why it costs nothing at runtime

**The IR is identical by construction.** The parser normalises both spellings
to one `N_FUNCTION` node. The name comes from the `const`, and the parameters,
return type and body come from the arrow. So nothing after the parser can tell
the two apart. There is no closure, no `this` binding and no allocation. The
existing goldens are therefore the migration's oracle: a rewrite that moves any
`.ll` byte is wrong.

The same holds under Node. Measured over 2×10^9 calls at a monomorphic call
site, the two forms were within noise. A first measurement said arrows were
7.6x slower. It passed both forms through one helper, which made the call site
polymorphic. What costs 7x in JavaScript is a polymorphic call site, and Nish
cannot have one, because there are no function values.

## 3. What is not changing

- **Class methods stay methods.** A callable is a top-level arrow `const` or a
  method, and that exception is permanent.
- **Function values stay forbidden.** `Function` is a Phase 0 error, and
  §5's second rule exists to keep it so. A compile-time function *parameter*
  ([wp23-language-surface.md](wp23-language-surface.md) §6) is not a function
  value.
- **Constructors** are unaffected.

## 4. What is genuinely new: the concise body

`ArrowFunction.body` may be an expression. A concise body is checked and
emitted exactly like a block body holding one `return`. This is the one place
the declaration kinds stop agreeing, and §8a is what that cost.

## 5. The two rules the checker gains

1. **A module-level `const` whose initializer is an arrow is a function
   declaration**, and takes its signature from the arrow's own annotations. The
   function-type prohibition stays exactly as it is.
2. **A name bound to a function may appear only in call position**, or as the
   argument to a function-typed parameter (wp23 §6). `const g = double`,
   `[double]` and `obj.f = double` are refused. This is what keeps rule 1 from
   introducing first-class functions.

## 6. Where the removal rule lives

In the **checker**, not in Phase 0. Phase 0 is for what the language can never
compile, and a `function` declaration compiles perfectly. A deprecated spelling
is the checker's business, and its message names the rewrite:

```
`function double` is not how Nish declares a function; write
`const double = (n: i32): i32 => ...`
```

## 7. The surfaces, measured

A *definition* is a top-level `function` with a body. `declare function` lines
are not counted, and are not stage D's to take (§9). Counted on 2026-10-05 with
`grep -rhE --include=*.ts '^(export )?(default )?(async )?function\b' <dir> | wc -l`:

| Surface | `function` definitions | Note |
| --- | ---: | --- |
| `src/`, `std/`, `examples/`, `bench/`, `tests/self/`, `tests/nish/`, the JavaScript tooling | **0** | done, and the Biome plugin keeps it that way |
| `docs/cookbook/` | 1 | `fn-add-function.ts`, which exists *to be* the `function` spelling and is excluded from the plugin in `biome.json` (§9a) |
| `tests/cases/` | 715 | the goldens gate the rewrite. The count grows as new cases are written in the old spelling, and the corpus is outside Biome |
| `tests/differential/corpus/` | 153 | also rewritten to JavaScript, so the arrow-parity guard (§8b) covers it |
| `tests/link/` | 51 | whole multi-module programs |
| `tests/parser/` | 32 | parser fixtures no checker accepts |

That is **952** definitions in all, against 1,664 when stage C's docs half was
finished and `src/` had not been converted. §10 argues stage D from this
number.

## 8. The order, and why it is forced

`function` could not be removed before `src/` was arrows, and `src/` could not
*be* arrows before the compiler that builds it parsed them. That forced four
stages:

| Stage | What lands | State |
| --- | --- | --- |
| **A** | the first compiler accepts arrows: §5's rules, the concise body, negative tests | **done** |
| **B** | the self-hosted compiler accepts arrows, and the parser oracle builds the same tree | **done**, with `tests/cases/fn_arrow` |
| **C** | the migration: docs and `examples/`, then `src/`, then the corpus | **done but for the corpus** (§7) |
| **D** | a `function` *definition* is refused with §6's message and a `reject_function_declaration` case; `declare function` stays legal (§9) | **open** (§10) |

The docs were converted first because they were the cheapest surface to verify.
`regen.sh` compiles every cookbook listing, so a byte diff of the emitted
`.ll` is one command, and that diff found both bugs in §8a. B's surprise was
outside the compiler: three test-harness regexes looked for
`export function main` to decide whether a case was a whole program. Tooling
that reads Nish with a regex is where a spelling change breaks things.

### 8a. What C's first half cost: two concise-body bugs

Both bugs came from passes that decide what a value is *for* by climbing to
its parent and expecting to find a `return` statement. A concise body's parent
is the arrow.

1. **Contextual typing.** An object literal or a narrower type returned from a
   concise body lost its contextual type. A program whose block-bodied twin
   compiled was refused.
2. **The call-site reclaim.** `flowTarget` in the escape analysis read a concise
   body that returned an allocation as producing a local. WP9's
   `nish_arena_mark` / `keep` bracket then disappeared from every call. The
   result was worse code rather than an error, and a byte diff of
   `docs/cookbook/mem-reclaim` caught it.

The fix is to ask whether a node is the function's result (the operand of a
`return`, or the body an arrow *is*) instead of asking for its parent's kind.
`tests/cases/fn_arrow_concise` and `fn_arrow_concise_flow` pin the behaviours.

### 8b. The codemod, and the diff that is one command

```bash
node scripts/arrowify.mjs <files>              # rewrite in place, block bodies
node scripts/arrowify.mjs --concise <files>    # collapse a lone `return` body
node scripts/arrowify.mjs --check <files>      # what is left, and why
node scripts/arrow-verify.mjs [--applied] [--debug] <dirs>
```

- **`arrowify.mjs` is textual and driven by the parse tree.** Every span comes
  from the tree, so comments and formatting survive, and a block-bodied rewrite
  keeps the file's line count. It recognises each form it leaves alone
  (`declare function`, `function*`, `export default`, `async`) by the syntax
  that makes it that form, not by something that usually goes with it (§8c).
- **`arrow-verify.mjs` compiles the corpus before and after a rewrite and
  compares every output.** It covers emitted `.ll` files and sidecars, the
  `--json` diagnostics of every rejection and every warning with positions
  stripped, and dump output. Every subject ends in exactly one verdict, and a
  subject with nothing to compare fails the run. `--applied` checks a rewrite
  already in the tree against a revision. This is the mode the `src/` migration
  used, because a sweep run after the rewrite would otherwise compare the same
  source with itself.
- **The rewrite is two passes**: block bodies first, then `--concise`, with an
  `--applied` verification after each. The order is forced by Biome's
  `useConsistentArrowReturn` error, and doing the collapse second keeps each
  difference down to one cause.
- `tests/differential/arrow-parity/declared.ts` and `arrow.ts` are one program
  in both spellings. `npm test` checks that they emit identical IR and that the
  codemod turns the first into the second character for character.

### 8c. The rest of §8a's bug class, looked for before the rewrite rather than during it

The whole corpus was rewritten and recompiled before `src/` was touched: 1,678
modules, 0 differences. A source search for passes that climb to a parent found
no third compiler bug. One gap in the capture scan exists in both compilers and
cannot be reached, because a concise body has no statement for an assignment to
be in.

**The concise sweep found three bugs, all in the codemod**, each by
re-diagnosing a `reject_*` case:

| Case | What the rewrite did | Result |
| --- | --- | --- |
| `reject_ffi_body` | `declare function h(): i32 { ... }` became `declare const h = ...` | a refused program **compiled** |
| `reject_generator` | `function* g()` lost its asterisk | a refused program **compiled** |
| `reject_export_default` | `export default const f = ...` | refused, for the wrong rule |

A codemod that turns a refused program into a compiling one is the worst
failure, because every gate after it reads the program it was handed. The
three cases are pinned in `npm test`.

**What a block-bodied rewrite does to a position**, and the rule is short
enough to check a file against:

> A block-bodied rewrite moves no line. It moves the function's own name three
> columns left, and — only where a body is written on the same line as its
> declaration — everything inside that body three columns right.

`function NAME(` and `const NAME = (` are the same width, so parameters and
the return type keep their columns. `src/` has no single-line body. The corpus
has 77, and 76 of them are `reject_*` cases, where a column is what the
diagnostic carries. Give those the ordinary layout when converting them.

## 9. What stage D forecloses

Stages A to C are additive. **D removes a spelling**, so this is the audit of
what `function` can say that an arrow `const` cannot:

| `function` form | Arrow equivalent | Consequence of D |
| --- | --- | --- |
| `function* g()` | **none.** `const g = *() => {}` is a TypeScript syntax error (TS1109); JavaScript has no arrow-generator syntax | forecloses top-level generators |
| overload signatures | none. `const f: { (a: i32): void; (a: string): void }` is an object type with call signatures, which Phase 0 forbids | forecloses overloading |
| `declare function f(...)` | `declare const f: (a: i32) => i32` needs a free-standing function type, which is refused outside a parameter | forecloses ambient/extern declarations |
| `function f<T>(x: T): T` | `const f = <T>(x: T): T => x` — valid in a `.ts` file (the `<T,>` disambiguation is only needed in `.tsx`) | none |
| `async function f()` | `async (n: i32): Promise<i32> => ...` | none |

**Generators are a forbid being kept, not a plan being blocked.** `function*`
and `yield` are Phase 0 errors ("no coroutine runtime"), and D does not change
that. If a coroutine runtime ever arrives, a generator *method* survives D,
which is the same exception §3 keeps.

**Ambient declarations are the live hazard, so D's rule is narrower than "no
`function`".** `declare function` has bound C functions since 0.2.0
([#62](https://github.com/amritk/nish/pull/62)), and the arrow spelling for it
would need a function type. So:

> **D rejects a function *definition* written with the `function` keyword.**
> `declare function` is not a competing way to define a function — it defines
> nothing — so it stays legal, and the extern surface stays open.

### 9a. The `function` declarations stage D may not simply delete

These are the files where the `function` keyword is **the subject**, not just
the spelling. Each is a decision stage D owes an answer to:

| File | What it is | What stage D owes it |
| --- | --- | --- |
| `tests/cases/reject_fn_nested.ts` | a `function` inside a body, refused as `Unsupported statement in Phase 1: FunctionDeclaration` | **scope §6's rule to the top level.** A nested declaration is already refused by a rule with its own registry code; a stage D rejection that fired first would shadow that wording and `tests/diagnostic-coverage.js` would then have a code no program provokes |
| `tests/cases/reject_fn_anonymous.ts` | `export default function ()`, refused as `Functions must be named` | **name the function before refusing the spelling.** §6's message interpolates the name, so there is nothing for it to say here; the existing rule has to keep firing first |
| `tests/cases/reject_arrow_annotated.ts`, `reject_arrow_let.ts` | the arrow rules, whose `main` is still a `function` | mechanical, but **before** stage D rather than with it: each case pins a *first* diagnostic, and a rejection of its entry point would become the first |
| `docs/cookbook/fn-add-function.ts` | the listing that exists to be the legacy spelling, beside `fn-add` | the listing is the evidence for §2, so deleting it removes the demonstration that the two spellings compile identically. Either the section goes with the spelling, or the pair moves somewhere the rejection does not reach |
| `tests/differential/arrow-parity/declared.ts` | half of the guard that the two spellings rewrite to the same JavaScript (§8b) | the same question, and it is the sharper one: the guard *is* a pair of spellings, so stage D removes one of its halves. The guard has value after D only if a `function` program can still be checked somewhere |

The last two are one question: **what proves an equivalence after one of its
two sides is illegal?** It is stage D's to answer.

`tests/cases/reject_ffi_body.ts` needs nothing. `declare function f() { }` is
refused for carrying a body, and §9 keeps that rule.

**Where the rule goes.** The parser normalises both spellings to one
`N_FUNCTION` and records no flag for which one it read (§2). So D needs a flag
on the node for the keyword form, set in `src/parser.ts`. The refusal then goes
in `refuseBindingForm` (`src/statements.ts`), *after* the two checks that
already run there: `Functions must be named` (NL2203) and the `export default`
refusal. It must not fire for a `declare function`. That ordering gives the
first two rows above for free. `reject_fn_nested` is untouched, because a
nested declaration is refused as a statement before it reaches either check.
So stage D is one flag, one refusal, the `reject_function_declaration` case and
its wording, and the corpus. The corpus is the work.

**The two entry-point wordings §10 names are `NL2149` and `NL2229`**:
`` `process.argv` requires a `main` entry point (this program has no `export
function main`) `` and `` Only the entry module may declare `export function
main` ``. A code is keyed on its words, so rewording either retires its number.
That is why they are stage D's to change, together with the rejection that
makes the spelling they name wrong.

## 10. Open

- ~~**The entry point.**~~ **Settled, and taken.** `export const main =
  (): number => ...` is the consequence of §1 and is now the first line of
  every example, of the README quickstart, of `docs/INSTALL.md`'s hello world
  and of `decl-main` in the cookbook. The diagnostics that name the entry still
  say `export function main`: their text is what keys a stable code, so
  rewording them retires `NL2229` and `NL2149` for a spelling change. They are
  stage D's to change, alongside the rejection that makes the other spelling
  wrong.
- **Whether stage D happens at all.** A, B and most of C are done, and new
  code outside the test corpus cannot use `function` (the Biome plugin). What
  is left is 952 rewrites of test programs, for zero expressiveness (§7).
  The alternative is to leave D undone, convert a case when it is opened for
  another reason, and take D when the count is small. D withdraws an accepted
  construct. On 0.x that is a breaking minor, and after 1.0 it would need a
  major ([LANGUAGE.md](LANGUAGE.md)'s head), so it is cheaper while the project
  is on 0.x.
