# WP22: Arrow functions as the declaration form

**Proposed, not implemented.** Nothing here exists in the compiler today: an
arrow function still fails in the checker, and every function in the corpus is
a `function` declaration. It is the plan of record for one decision —
**`const f = (...) => ...` becomes how AmritScript declares a function, and
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
JavaScript is an indirect call site with more than one callee — and AmritScript
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
`function double` is not how AmritScript declares a function; write
`const double = (n: i32): i32 => ...`
```

## 7. The surfaces, measured

| Surface | Count | Note |
| --- | --- | --- |
| `self/` | 603 declarations, 25,008 lines | the bootstrap; must be migrated before stage D |
| `examples/`, `docs/cookbook/`, `bench/`, `tests/cases/` | 798 declarations | goldens unchanged, so the `.ll` files verify the rewrite |
| `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `README.md` | every snippet | the real cost centre; IR blocks beside them stay as they are |
| `src/checker` | 2 new rules, 1 desugaring | `FunctionSig.decl` gains a fourth member |
| `self/lexer.ts` | none | `TOK_ARROW` is already emitted (`self/lexer.ts:772`) |
| `self/parser.ts` | arrow parsing | the token exists and is imported; nothing consumes it yet |

## 8. The order, and why it is forced

The bootstrap is the constraint. `self/` is AmritScript compiled by stage0, and
stage1 compiles itself. So `function` cannot be removed from the language
before `self/` is arrows, and `self/` cannot *be* arrows before stage1 parses
them. That forces four stages, and no two of them can be merged:

| Stage | What lands | Done when |
| --- | --- | --- |
| **A** | Stage0 accepts arrows: §5's rules, the concise-body branch, negative tests | `npm test` green; the two spellings of one program emit byte-identical IR |
| **B** | Stage1 accepts arrows: the lookahead and `parseArrowFunction` in `self/parser.ts`, the concise-body branch in its checker and emitter | the parser oracle builds the same tree with the same spans, and `IR(stage0) == IR(stage1)` byte for byte |
| **C** | The migration: `self/` first, then the corpus, then the docs | goldens unchanged; the bootstrap reproduces stage1 byte for byte |
| **D** | a `function` *definition* is rejected, with §6's message and its `reject_function_declaration` case; `declare function` stays legal (§9) | `npm test` green with no `function` declaration left in any AmritScript source |

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
tooling around it that reads AmritScript with a regex.

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

**WP18's surface has to be restated.** [wp18-generics.md](wp18-generics.md) is
the plan of record for user generics and every example in it is written
`function identity<T>(x: T): T`. Nothing technical is lost — the arrow form
parses — but that rewrite belongs in stage C alongside the rest of the docs,
not deferred until generics land and the two notes contradict each other.

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

- **The entry point.** `export const main = (): number => ...` is the
  consequence of §1, and it changes the first line of every example, every
  README and every cookbook entry. Nothing technical objects; it is the single
  most visible edit in the repo and should be confirmed before stage C.
- **Whether stage D happens at all.** A and B are cheap and strictly additive.
  C and D are 1,401 rewrites for zero expressiveness. Shipping A and B, letting
  new code use arrows and converting a file when it is opened for another
  reason — the migration policy `.claude/typescript.md` already applies to
  `src/` — reaches the same place without a flag day, and leaves D as a
  decision to take when the count is small rather than now.
