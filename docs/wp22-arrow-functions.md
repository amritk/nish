# WP22: Arrow functions as the declaration form

**Stages A and B have landed; C is half done and D has not started.** Both
compilers read `const f = (n: i32): i32 => n * 2` today, the two spellings emit
byte-identical IR, and `tests/cases/fn_arrow` carries the golden, the `llvm-as`
pass and the native round trip (§8 has what each stage cost). C's **docs half**
has landed: `README.md`, `docs/LANGUAGE.md`, every `docs/cookbook/` snippet (so
every listing in `docs/IR_COOKBOOK.md`), `examples/`, the playground and the
`.claude/` rules are arrows, and §8a records the two concise-body bugs the
rewrite found. What is still `function` is `self/` and `tests/cases/`, the two
surfaces the bootstrap and the goldens gate; a `function` declaration is still
accepted — whether stage D ever rejects it is open, and §10 is where that is
argued. It is the plan of record for one decision —
**`const f = (...) => ...` becomes how Nish declares a function, and
`function` is legacy and eventually removed** — and for the order that
decision has to happen in, which is forced by the bootstrap and is the only
hard part.

The normative rules land in [LANGUAGE.md](LANGUAGE.md) as each stage does;
where this note and LANGUAGE.md disagree, LANGUAGE.md wins.

## 1. The decision

One spelling for a top-level callable, and it is the arrow bound to a `const`:

```typescript
const double = (n: i32): i32 => n * 2;

export const main = (): number => {
  console.log(`${double(21)}`);
  return 0;
};
```

`function` keeps working until stage D, then stops. This is a spelling change
and nothing else: it adds no expressiveness, removes none, and cannot change
the output of a single program.

## 2. Why it costs nothing at runtime

**The IR is identical, and that is structural rather than lucky.** The emitter
never sees the declaration form: `codegen/emitter.ts` iterates
`program.functions` — the checked `FunctionSig`s — and there is no
`isFunctionDeclaration` anywhere in `src/codegen/`. Everything that shapes the
output comes from the signature (name, params, return type, `exported`) and
from the attribute facts. An arrow-declared function produces the same
`define`, the same attributes, the same body.

Two consequences, and the second is what makes the migration affordable:

- There is no closure, no `this` binding and no allocation. The arrow is erased
  before codegen begins, exactly as the `function` keyword is.
- **The golden `.ll` files do not change.** Rewriting a test case's `.ts` from
  `function f()` to `const f = () => ...` must leave its golden byte for byte
  identical, so the existing goldens are the migration's oracle rather than
  work the migration creates. A diff in any `.ll` means the rewrite was wrong.

The same holds for the compiler's own source under Node. Measured over 2x10^9
calls at a monomorphic call site, three runs each in a fresh process:
declarations 1475.6 / 1494.9 / 1495.2 ms, arrows 1510.1 / 1486.1 / 1486.3 ms —
noise, with the arrow ahead in two of three.

A first attempt at that measurement said arrows were 7.6x slower, and the
reason it was wrong is worth keeping: it passed both forms through one
`bench(f)` helper, so the second form made the call site polymorphic and
deoptimised it. The declaration then measured 10.5 s too. What costs 7x in
JavaScript is an indirect call site with more than one callee — and Nish
forbids function values outright (`Function` is a Phase 0 error, "no dynamic
function values"), so every call site is monomorphic by construction. The
prohibition is doing the work; the spelling is doing none.

## 3. What is not changing

- **Class methods stay methods.** `m(): void { ... }` inside a class body is
  not an arrow and will not become one. So the "one way to declare a callable"
  goal has exactly one permanent exception: a callable is a top-level arrow
  `const`, or a method. That is the same split `src/` already lives with
  (`.claude/typescript.md`), and for the same reason — a method is not a value
  either.
- **Function values stay forbidden.** This note does not relax `Function`, and
  §5's second rule exists to keep it that way.
- **Constructors** are unaffected.

## 4. What is genuinely new: the concise body

`ArrowFunction.body` may be an expression rather than a `Block`:

```typescript
const double = (n: i32): i32 => n * 2;          // concise
const double = (n: i32): i32 => { return n * 2; };  // block
```

Both are accepted, and the concise form is checked and emitted exactly as the
block form with one `return`. This is the one place the four declaration kinds
stop agreeing: `FunctionDeclaration`, `MethodDeclaration` and
`ConstructorDeclaration` always carry a `Block`, so the ~40 sites that reach
`sig.decl.body` need one desugaring helper rather than a special case each.

## 5. The two rules the checker gains

1. **A module-level `const` whose initializer is an arrow is a function
   declaration**, and takes its signature from the arrow's own annotations —
   which are already there. The current failure is that it is treated as a
   value: `` Module constant `double` needs a type annotation ``, and
   annotating it gives `` Unsupported type `(n: i32) => i32` ``, because
   function types are forbidden. Neither error is reachable once the
   initializer is recognised, and the function-type prohibition stays exactly
   as it is.
2. **A name bound to a function may appear only in call position.**
   `const g = double;`, `foo(double)`, `[double]` and `obj.f = double` are all
   rejected. This is what keeps rule 1 from quietly introducing first-class
   functions, and it is the same shape as the existing `` `process.argv` is
   read-only ``.

`FunctionSig.decl` is already `FunctionDeclaration | MethodDeclaration |
ConstructorDeclaration`; arrows are a fourth member, not a refactor.

## 6. Where the removal rule lives

In the **checker**, not Phase 0. The validator's own doctrine is that Phase 0
is for what the language "can never compile: anything that requires dynamic
typing, prototype lookup, reflection, unwinding, exceptions, or a
garbage-collected heap". A `function` declaration requires none of those — it
compiles perfectly, and did for every program in the repo up to stage D. It is
a deprecated spelling, which is the checker's business, and its message names
the rewrite:

```
`function double` is not how Nish declares a function; write
`const double = (n: i32): i32 => ...`
```

## 7. The surfaces, measured

Re-measured on 2026-09-13, because the first row had drifted by a fifth since
it was written and a count nobody re-derives is a count nobody can act on. A
*definition* here is a top-level `function` that carries a body; the seven
`declare function` lines in the repository are not in any of these numbers and
are not stage D's to take (§9).

| Surface | `function` | arrow | Note |
| --- | --- | --- | --- |
| `self/` | **721** | 7 | 31,050 lines. The bootstrap; must be migrated before stage D, and it is the one commit of stage C that is worth taking on its own |
| `tests/cases/` | **688** | 196 | the goldens gate; every `.ll` beside one verifies its rewrite rather than being work the rewrite creates |
| `tests/differential/corpus/` | 153 | 0 | compiled *and* rewritten to JavaScript, so the arrow-parity guard (§8b) is what these rest on |
| `tests/link/` | 51 | 32 | whole programs, several modules each |
| `bench/` | 22 | 0 | `bench/run.mjs` reads the same `.args` sidecars `tests/` does |
| `tests/parser/` | 9 | 0 | fixtures no checker accepts; the parser is the only reader |
| `docs/cookbook/` | 3 | 137 | `decl_ffi` (done in stage C) and `fn_add_function`, which exists *to be* the `function` spelling |
| `examples/`, `std/`, `tests/nish/` | 0 | 76 | done |
| `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `README.md` | every snippet | — | the real cost centre; IR blocks beside them stay as they are. Done |
| `src/checker` | 2 new rules, 1 desugaring | — | `FunctionSig.decl` gains a fourth member |
| `self/lexer.ts` | none | — | `TOK_ARROW` is already emitted (`self/lexer.ts:772`) |
| `self/parser.ts` | arrow parsing | — | done in stage B |

**1,647 definitions**, against 78 when stage C's docs half was finished. The
number matters to one decision and no other: §10 argues stage D on the size of
what is left, and the honest figure for that argument is this one rather than
the 798 the row above used to carry.

## 8. The order, and why it is forced

The bootstrap is the constraint. `self/` is Nish compiled by stage0, and
stage1 compiles itself. So `function` cannot be removed from the language
before `self/` is arrows, and `self/` cannot *be* arrows before stage1 parses
them. That forces four stages, and no two of them can be merged:

| Stage | What lands | Done when |
| --- | --- | --- |
| **A** | Stage0 accepts arrows: §5's rules, the concise-body branch, negative tests | `npm test` green; the two spellings of one program emit byte-identical IR |
| **B** | Stage1 accepts arrows: the lookahead and `parseArrowFunction` in `self/parser.ts`, the concise-body branch in its checker and emitter | the parser oracle builds the same tree with the same spans, and `IR(stage0) == IR(stage1)` byte for byte |
| **C** | The migration: the docs and `examples/` first (done), then `self/`, then the corpus | goldens unchanged; the bootstrap reproduces stage1 byte for byte |
| **D** | a `function` *definition* is rejected, with §6's message and its `reject_function_declaration` case; `declare function` stays legal (§9) | `npm test` green with no `function` declaration left in any Nish source |

**A cannot carry its own positive golden, and that is the plan's one real
correction.** *(Resolved in B: `tests/cases/fn_arrow` ships there, with its
golden `.ll`, its `llvm-as` pass and its native round trip.)* Every `.ts` in `tests/cases/` is compiled by *both* compilers —
`tests/self/ir_oracle.js` requires stage1 to emit what stage0 emits for each of
them — so an arrow program in the corpus fails the oracle until B lands, with
`1 rejected by stage1`. Stage A therefore ships its rejection cases (stage1's
parser refuses those, which the reject oracle already tolerates as "refused by
the parser instead") and the positive `fn_arrow` golden with its native round
trip lands in B. The identity of the two spellings is still proven in A, by
compiling one program written both ways and diffing the IR; it just cannot live
in the corpus yet.

Stage C is where the risk is, and it is worth doing `self/` in one commit of
its own: the bootstrap comparing stage1's output against itself is the only
check that the 603 rewrites were all meaning-preserving.

The order inside C turned out to be the other way round from the row above, and
for a reason worth keeping: the docs and `examples/` were done first *because*
they are the cheap surface to verify. Every `docs/cookbook/*.ts` is compiled by
`regen.sh`, so rewriting all 68 of them and diffing the emitted `.ll` against
the previous run is one command — and that diff is what found both bugs in §8a.
Doing `self/` first would have put 603 rewrites and two latent stage0 bugs in
the same commit.

`self/` has that property now too, and §8b is the tooling that gives it to
every other surface as well.

### 8a. What C's first half cost: two concise-body bugs

§4 said a concise body "is checked and emitted exactly as the block form with
one `return`". That was true of the checker's own `checkReturnValue` and false
twice over, because two kinds of pass decide what a `return` is by looking at
the *parent node* rather than by being told:

1. **Contextual typing.** Three walks climb the parent chain to ask what the
   enclosing construct expects — `contextualType` in `src/checker/classes.ts`
   (object literals, and a class value where an interface is wanted),
   `contextualType` in `src/checker/arrays.ts` (the element type of `[]`), and
   `contextType` in `src/checker/math.ts` (the width of a numeric literal).
   Each stopped at `ts.isReturnStatement(parent)`, and a concise body's parent
   is the arrow. So `const swap = (p: Pair): Pair => ({ first: p.second,
   second: p.first })` was `Object literal needs a contextual class or
   interface type` and `const asPair = (o: Ordered): Pair => o` was `Return
   type mismatch`, while both block-bodied twins compiled.

2. **The call-site reclaim.** `flowTarget` in `src/codegen/escape.ts` and its
   twin in `self/escape.ts` decided where a freshly allocated value goes by the
   same test, so a concise body that returns an allocation was read as
   producing a *local*. That made `allocates` false for the callee, and WP9's
   `nish_arena_mark` / `nish_arena_keep` bracket disappeared from every call to
   it — quietly worse code rather than an error, which is why
   `docs/cookbook/mem_reclaim` catching it in a byte-for-byte IR diff
   mattered.

Both are one predicate on this side, `isFunctionResult` in
`src/checker/declarations.ts`: the operand of a `return`, or the body an arrow
*is*.

**Stage1 had exactly one of the two**, and which one is the useful part.
Its checker threads the wanted type down as `want` (`checkReturnValue` in
`self/statements.ts`) rather than climbing to a parent, so bug 1 was never
reachable there — for a while the two compilers silently disagreed about
programs no test had written. Its `flowTarget` (`self/escape.ts`) *does* climb,
so it had bug 2, and `tests/self/ir_oracle.js` caught it the moment
`docs/cookbook/mem_reclaim.ts` became an arrow: stage0 emitted the bracket,
stage1 did not.

The general lesson for the rest of C: the gap is never in the code that reads
`sig.body`, which sees the expression either way. It is in the code that reads
`node.parent` and expects to find a statement there. `tests/cases/fn_arrow_concise`
pins all five behaviours, and `--emit-checked` will not show you any of them —
only the IR diff and the type errors will.

### What B cost, measured

Stage1's parser needed one piece of genuine work and the rest fell out. The
piece: the parenthesis that opens a parameter list also opens a parenthesised
expression, and `self/parser.ts` keeps one token of lookahead, which cannot
tell `const x = (a + b) * c` from `const f = (a: i32): i32 => a`. A scratch
`Lexer` over the same source runs ahead from the `const`, counts to the
parenthesis that closes this one and looks at what follows — `=>`, or the `:`
of a return type. Nothing else can follow a parameter list, and at the head of
an initialiser nothing else puts a `:` after a parenthesis, so the test is
exact rather than heuristic.

Everything downstream was free, because the parser **normalises**: it builds
the same `N_FUNCTION` node the `function` spelling builds, with the name from
the `const` and the parameters, return type and body from the arrow. Stage1's
checker, emitter, attribute pass and escape analysis are untouched for block
bodies. `tests/parser_oracle.js` normalises the same way, and says so — it is
the one place that oracle reshapes a `typescript` tree rather than
transcribing it, and it does so because the language says the two spellings
declare one thing.

The concise body cost four small branches, mirroring stage A's: `body()`
answers the expression rather than `null`, the checker calls
`checkReturnValue`, the emitter calls `emitReturnValue`, and the dump already
tested for a block. The analyses that only walk the tree took the expression
unchanged.

The oracles caught one thing the branches missed: `self/dump.ts` guarded its
body walk on `N_BLOCK`, so a call inside a concise body never reached
`--emit-checked`, and `tests/self/checked_oracle.js` said so. The emitted IR was
never affected — `walkBody` prints the callee table, it does not build it — but
it is the shape of mistake this migration invites, and the reason every branch
added for the concise body is worth reading twice.

**The surprise was outside the compiler.** `tests/run.js` decided whether a
case is a whole program by matching `/\bexport\s+function\s+main\b/` against
the source, and `tests/differential/{lib,unmodified}.js` did the same — so an
arrow entry point linked against `tests/driver.c` and failed with *multiple
definition of `main`*. Three regexes, each now accepting either spelling. This
is the shape of what stage C will keep finding: not the compiler, but the
tooling around it that reads Nish with a regex.

### 8b. The codemod, and the diff that is one command

The reason the docs half went first is the reason the rest of C can now go at
all: `regen.sh` made "did this rewrite change anything?" a single command, and
a question you can ask in one command is a question you ask on every file
rather than on the ones you are worried about. `self/` had no such command —
its 721 declarations are a program whose output is checked by the bootstrap,
which is the slowest check in the repository — so stage C's expensive half
starts by building one.

```bash
node scripts/arrowify.mjs self/lexer.ts          # rewrite, in place
node scripts/arrowify.mjs --check self/*.ts      # what is left, and why
node scripts/arrow-verify.mjs                    # the whole corpus, before and after
node scripts/arrow-verify.mjs --debug self       # the same, under `-g`
```

**`scripts/arrowify.mjs` is textual, driven by the parse tree.** `typescript`
locates each declaration and the splice is computed from its spans, so every
byte outside the edit survives: comments, blank lines, formatting, and the
body's own indentation. That is not tidiness. Moving `{` to sit after `=>`
leaves every line of the body at the column it was already at, so a
block-bodied rewrite **preserves the line count of the file and the column of
every statement in it** — which is the one property that keeps a 721-file
rewrite from moving a `-g` line number, a `DILocation`, or the caret of a
diagnostic somebody pinned. §A5 of
[wp19-stage0-retirement.md](wp19-stage0-retirement.md) is what happens when a
declaration's position moves and nothing is watching.

What it will not touch, and why each one is a decision rather than a gap:

| Left alone | Because |
| --- | --- |
| `declare function f(...): T;` | it defines nothing, so §9 keeps it legal; the arrow spelling for it needs a function type, which Phase 0 forbids |
| class methods and constructors | §3: a method is not an arrow and will not become one |
| anything below the top level | Nish-0 has no nested functions, so a nested one is a program this tool has no opinion about |
| `async function`, an unnamed declaration | neither compiles here, and converting one would only move the error |
| a comment between the signature and the `{` | it would have to be rewritten rather than moved, and a codemod that silently drops a comment is worse than one that refuses |

**`scripts/arrow-verify.mjs` is the answer in one command.** It copies the
tracked tree, compiles every program `tests/self/corpus.js` enumerates,
rewrites the copy in place, compiles again, and compares every emitted `.ll`
byte for byte. Both compiles run **out of the same directory**, which is the
detail that makes `-g` comparable at all: `; ModuleID` and `!DIFile` carry the
path, so two sibling copies would differ in every module for a reason that has
nothing to do with arrows (wp19 §A3).

`--debug` is not decoration. §A5 records a closed parity gate reopening because
stage0 took an arrow-declared function's position from the `ArrowFunction`
rather than from the declaration — and it stood for as long as it did because
*no corpus program had ever been compiled as an arrow with `-g`*. The sweep
asks that question of every program at once, which is the only form of the
question that does not depend on somebody having thought to write the case.

`--concise` collapses a body that is exactly one `return expr;`. It is **off by
default and stays off for the bulk rewrite**: a concise body is the one shape
where the four declaration kinds stop agreeing (§4), it changes the line count,
and it is what found both bugs in §8a. Its use is the sweep — running the whole
corpus through it is a search for the rest of that bug class, rather than a
rewrite anybody lands.

`npm test` pins the tool against a file a person wrote rather than against its
own output: `tests/differential/arrow-parity/declared.ts` and `arrow.ts` are one
program in the two spellings, and three checks ride on the pair — that the two
spellings emit identical IR (stage A's defining claim, which until now nothing
in the suite asked), that the codemod turns the first into the second character
for character, and that it leaves `ffi_scalar`'s `declare function` alone while
rewriting the definitions beside it.

## 9. What stage D forecloses

Stages A to C are additive and reversible. **D removes a spelling, and a
removed spelling cannot express anything later**, so this is the audit of what
`function` can say that an arrow `const` cannot:

| `function` form | Arrow equivalent | Consequence of D |
| --- | --- | --- |
| `function* g()` | **none.** `const g = *() => {}` is a TypeScript syntax error (TS1109); JavaScript has no arrow-generator syntax | forecloses top-level generators |
| overload signatures | none. `const f: { (a: i32): void; (a: string): void }` is an object type with call signatures, which Phase 0 forbids | forecloses overloading |
| `declare function f(...)` | `declare const f: (a: i32) => i32` needs a function type, which Phase 0 forbids | forecloses ambient/extern declarations |
| `function f<T>(x: T): T` | `const f = <T>(x: T): T => x` — valid in a `.ts` file (the `<T,>` disambiguation is only needed in `.tsx`) | none, but see below |
| `async function f()` | `async (n: i32): Promise<i32> => ...` | none |

Three of those need an answer before D lands, and two have one already.

**Generators are not a plan being blocked; they are a forbid being kept.**
`function*` and `yield` are Phase 0 errors today with a stated reason — "no
coroutine runtime" (`reject_generator`, `reject_yield`) — and MASTER_PLAN §3.2
lists them among the constructs the language excludes rather than defers. D
does not change that. And if a coroutine runtime ever arrives, the spelling is
still reachable, because **class methods survive D**: `class Chars { *bytes():
Generator<i32> { ... } }` parses as TypeScript and is a generator method, not a
generator function. So the escape hatch is the same exception §3 already keeps
for an unrelated reason.

**WP18's surface has been restated.** [wp18-generics.md](wp18-generics.md) is
the plan of record for user generics and every example in it was written
`function identity<T>(x: T): T`. Nothing technical was lost — `const identity =
<T>(x: T): T => x` parses in a `.ts` file, the `<T,>` disambiguation being a
`.tsx` problem only — and the rewrite went in with the rest of C's docs rather
than waiting for generics to land and the two notes to contradict each other.

**Ambient declarations are the live hazard, and D's rule should be narrower
than "no `function`".** `declare function` is refused by the checker today as
*not supported yet* rather than forbidden, which is exactly the bucket things
climb out of: declaring an external C function is the natural thing to want the
first time somebody binds a library, and the arrow spelling for it needs a
function type. The fix is to scope D to what it is actually for:

> **D rejects a function *definition* written with the `function` keyword.**
> `declare function` is not a competing way to define a function — it defines
> nothing — so it stays legal, and the extern surface stays open.

That keeps D to one spelling of one thing, which is the whole point of taking
it.

## 10. Open

- ~~**The entry point.**~~ **Settled, and taken.** `export const main =
  (): number => ...` is the consequence of §1 and is now the first line of
  every example, of the README quickstart, of `docs/INSTALL.md`'s hello world
  and of `decl_main` in the cookbook. The diagnostics that name the entry still
  say `export function main`: their text is what
  `scripts/gen-diagnostic-codes.mjs` keys a stable code on, so rewording them
  retires `NL2229` and `NL2149` for a spelling change. They are stage D's to
  change, alongside the rejection that makes the other spelling wrong.
- **Whether stage D happens at all.** A and B are cheap and strictly additive.
  C and D are 1,401 rewrites for zero expressiveness. Shipping A and B, letting
  new code use arrows and converting a file when it is opened for another
  reason — the migration policy `.claude/typescript.md` already applies to
  `src/` — reaches the same place without a flag day, and leaves D as a
  decision to take when the count is small rather than now.
