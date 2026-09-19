# WP23: The language surface a corpus review turned up

**Every row is answered.** This note is the plan of record for the language
additions that a review of the corpus found wanting and that no existing work
package owns. Two of them (§2 non-generic `type` aliases, §3 numeric `enum`)
**landed**; §7 to §9 are the items the same review looked at and **declined**;
and §4 to §6, which stood as proposals while they were reviewed, are decided
now — §4 **no**, §5 **yes, as a library type**, §6 **not scheduled**. Each of
the three keeps the section that argued it and gains a decision paragraph under
its heading saying what was decided and what would turn it; the argument is not
restated, because the argument is what the section already is. Where the answer
is genuinely open, §10 says so instead of inventing certainty.

[LANGUAGE.md](LANGUAGE.md) stays normative for what the language *is*. The
rules for §2 and §3 land there as the work does, and this note does not restate
them; where this note and LANGUAGE.md ever disagree, LANGUAGE.md wins.

Read [wp18-generics.md](wp18-generics.md) first if you are reading §5 or §6:
both propose to spend WP18's monomorphisation machinery rather than new
grammar, and neither is coherent without it. Read [wp6-memory.md](wp6-memory.md)
before §4, because every hard part there is a place where a WP6 guarantee stops
holding once a value outlives every frame.

## 1. Where these came from, and the rule they are judged by

Six of the eight items below were found the same way: by reading `self/` for
comments that say *the language has no X*, and then asking what X would cost.
`self/` is the largest Nish program in existence (25,706 lines, 54
modules) and it is written by people who also write the compiler, so where it
works around a gap it usually says so in a sentence. Those sentences are the
evidence sections below cite, and they are quoted rather than paraphrased.

The rule every item is judged by is the one MASTER_PLAN §1 and
[wp15-performance.md](wp15-performance.md) §1a already set: an addition must
either close a *functional* gap — something a program cannot do at all — or
cost nothing at runtime. Ergonomics alone is not a reason, which is why §7 to
§9 are declined and why §5 and §6 are argued as reuses of existing machinery
rather than as conveniences.

Exactly one item here is functional: §4. The rest are shapes.

That §4 is also the one decided **no** is not the rule failing. The rule says
an addition must close a functional gap *or* cost nothing at run time — it does
not oblige the language to close every gap it finds, and §4.6's answer is that
this one's whole content is a boolean a driver already parsed. A functional gap
is what makes an addition *eligible*, not what makes it worth its cost.

---

## 2. Non-generic `type` aliases — **landing**

Today:

```
$ nish alias.ts
alias.ts:1:1: error: Only top-level function declarations are supported in
Phase 1 (found TypeAliasDeclaration)
```

Phase 0 lets a `type` alias through — `checkGenericDeclaration` in
`src/validator.ts` rejects only a type *parameter* on one — and the checker's
`collectFunction` fallback (`src/checker/index.ts:226`) refuses it as a
top-level declaration it has no case for. That is the "not implemented yet"
bucket, not the "can never compile" one
([`.claude/typescript.md`](../.claude/typescript.md) says which is which).

**The decision: an alias is the type it names, not a distinct one.** The
precedent is already normative and already tested: LANGUAGE.md's type table
says of `Int32Array` and its three siblings that they are "aliases, not
distinct types (`sameType` holds)", and `TYPED_ARRAY_ALIASES`
(`src/types.ts:191`) is a four-entry name-to-`StaticType` map that
`resolveType` consults. A user alias is the same map with user entries in it.

Consequences worth stating because they follow from the decision rather than
from an implementation:

- `sameType(Byte, u8)` is true, so `Byte` and `u8` are interchangeable
  everywhere, in both directions. This is not TypeScript's *nominal* `type`
  (TypeScript has none either).
- **Zero IR.** The alias is resolved in the checker and no side table, no
  mangling and no `%struct` name learns about it. Not one golden `.ll` changes.
  That is the same structural argument [wp22-arrow-functions.md](wp22-arrow-functions.md)
  §2 makes for arrows, and it has the same consequence: the existing goldens
  are the feature's oracle rather than work it creates.
- Generic aliases stay refused. `type Pair<A, B> = ...` is Phase 0's
  `Generic type parameters are forbidden`, and wp18 §2 already lists generic
  aliases as not accepted, so this adds nothing there.
- An alias of a forbidden type is still forbidden, because the alias is
  resolved before the type is checked. `type Anything = any` is Phase 0's
  `any` rule, unchanged.

One interaction the sibling work has to settle rather than inherit: LANGUAGE.md
records that "type-only imports are rejected", so a cross-module alias travels
as an ordinary named import (`import { Byte } from "./widths"`) or not at all.
Which of the two is chosen is a LANGUAGE.md rule and is not this note's.

---

## 3. Numeric `enum` — **landing**

Today `enum Kind { If = 1, While = 2 }` fails identically, with
`(found EnumDeclaration)`. Phase 0 has an opinion about enums already and it is
narrow: `checkEnum` (`src/validator.ts:232`) refuses only a member whose
initialiser is not a numeric literal, with `Enum members must be numeric
literals in Nish (enums lower to plain integers)`. MASTER_PLAN §3.2
forbids "enums with computed values", not enums.

**The decision: an enum is a DISTINCT type with `i32` representation.** That is
stricter than TypeScript, where a numeric enum member is assignable to
`number`. A subset may be stricter, and here it has to be, because the type
rule this language is built on is that "two values are compatible only when
their types are identical" (LANGUAGE.md, "Types"). An enum that is silently
`i32` would be the one type in the language that is compatible with something
it is not spelled as.

### What it is worth, counted

`self/` declares its three principal discriminants as module constants, because
that is the only spelling it has:

| Family | File | Members |
| --- | --- | ---: |
| `N_*` node kinds | `self/nodes.ts` | 59 |
| `TOK_*` token kinds | `self/tokens.ts` | 99 |
| `T_*` type kinds | `self/types.ts` | 13 |
| | **total** | **171** |

Every one is `i32`, so nothing in the type system stops `checkNode(T_I32)`
where an `N_FUNCTION` belongs — three separate integer namespaces sharing one
type, in a compiler that dispatches on all three. A distinct type per family is
exactly the check that is missing.

*(A correction to how this was first counted: 64/99/13 = 176 mixes a file total
with a family total. `self/nodes.ts` holds 64 module-level `i32` constants, of
which 59 are `N_*` node kinds and 5 are `FLAG_*` bits; `self/types.ts` holds 21,
of which 13 are `T_*`, 4 are `K_*` derived-type kinds and 3 are `R_*` `Result`
states. Counted by family the three principal enums are 171 members, and there
are 184 module-level `i32` constants across the three files in seven families.
Either number makes the point; this one is the one that is true.)*

### Three things the distinct-type decision forces

Named here because they are design consequences rather than implementation
detail, and because two of them are places the sibling work has to choose:

1. **`switch` has to accept an enum discriminant and enum case labels.**
   LANGUAGE.md today requires an integer discriminant and requires every `case`
   label to be "an integer literal or a module constant". A `switch` over a
   node kind is the single most common statement in `self/`, so an enum that
   cannot be switched on is worth nothing.
2. **Bit flags are a separate question.** `self/nodes.ts`'s five `FLAG_*`
   constants are combined with `|` and tested with `&`. TypeScript allows both
   on a numeric enum and gives back the enum type; a distinct type that refuses
   `|` cannot express the existing code, and one that allows it admits values
   that are no declared member. This note does not decide it (§10).
3. **`biome.json` has `noEnum: "error"`** repo-wide, mirroring what the
   validator refuses. It lints `examples/**` as well as `src/`, so an example
   or cookbook entry that uses an enum needs the rule relaxed for the
   Nish-program half. Mechanical, but it is a file the sibling work
   touches and this note is where it is written down.

`self/` itself does not adopt enums when they land: Nish-0 excludes them
by name ([wp14-selfhost.md](wp14-selfhost.md) §2), and converting 171 constants
would rewrite the discriminant of every dispatch in the compiler while the
bootstrap is the only thing checking the rewrite. That is the same posture
wp18 §10 takes towards generics, for the same reason.

### What landed, and how the three forced choices were answered

The rule is [LANGUAGE.md](LANGUAGE.md) → "Enums"; this is only the record of
which way each open decision went.

1. **`switch` takes an enum discriminant and enum-member labels.** The label is
   folded the way a module constant's is, so the statement is LLVM's `switch`
   and the jump table, unchanged. `case 1:` on an enum switch is refused —
   `` `case` label is i32 but the discriminant is Kind `` — because the integer
   a member stands for is not the member.
2. **Bit flags stay `i32` module constants**, which is the second of the three
   answers §10 question 1 offers and the one `self/nodes.ts` already lives by.
   `|`, `&`, `^` and `~` on an enum are refused by the existing integer rule
   (`tests/cases/reject_enum_bitwise`). It is the answer that can be widened
   later without invalidating a program, which the other two are not.
3. **`biome.json` turns `noEnum` off for the Nish-program half** — the
   override that already exempts `examples/**`, `docs/cookbook/**`, `bench/**`,
   `self/**`, `std/**` and `tests/self/**` from the two house-style rules — and
   leaves it an error over `src/`, where an enum in the compiler's own
   TypeScript is still a mistake.

Two decisions the note did not list, both settled the way the `type` alias
was: **auto-numbering is TypeScript's** (a member with no initialiser is the
one before it plus one, starting at `0`), and **an enum cannot be exported**,
because a module's signatures are resolved before its imports are bound, so an
imported name in type position resolves provisionally as a class and an enum
has no layout to stand in for. §10 question 2 — whether an enum takes a width
— is still open and still `i32`.

---

## 4. Module-level mutable state — **decided: no**

This is the only item in the note that closes a *functional* gap. Everything
else is a shape; this is a thing the compiler cannot do.

**Decided: no, and §4 stays as the design for when a second use case turns
up.** §4.6 is the argument and is not restated here. The short of it: the one
candidate's whole content is a boolean a driver already parsed, the parameter
version costs seven ugly signatures and no proofs, and the module-state version
costs a new IR construct, the first writable global the compiler defines for
user code, a symbol in the flat namespace WP21 has to fix, a thread-local
decision taken years before WP20 lands, and a withdrawn row from WP20 §2's
asset table. One case is not enough to add the first mutable global to a
language whose *absence* of them is load-bearing in another package's safety
argument.

**The revisit trigger is concrete**, in the shape [wp18-generics.md](wp18-generics.md)
§14 uses: two more places in `self/` wanting module state for a reason that is
**not** "a CLI flag a driver already parsed" brings this back with its own
cases. One more of the same shape does not.

**The divergence §4.6 names is still open, and deciding this row did not close
it.** `self/ice.ts`'s `internalError` prints the human report and not the
`NL0003` object stage0 prints, so orientation rule 7 — every failure, internal
errors included, is one `--json` object — is a stated contract that is not true
of stage1. The comment beside it gives module state as one of its three
reasons, and that reason is now answered: the remedy is `json` on `Options` and
one parameter through the callers, it needs no language change, and it is owed
whatever happens to this row. `docs/wp14-selfhost.md` §7 records the difference
among the deliberate ones; it is the one entry there that is a to-do rather
than a decision.

### 4.1 The evidence, traced exactly

`--json` is a contract, not a convenience. Orientation rule 7 states it:
"`--json` prints one flat object per diagnostic whose `code` is a stable rule
identifier, and **every failure — toolchain and internal errors included — is
one of those objects**." `tests/run.js:3563` says why, in the voice of the
consumer:

> Under `--json` every failure is a parseable line, not just the ones with a
> source span. A wrapper that asked for JSON and got an empty stdout plus a
> non-zero exit has to scrape stderr to find out what happened, which is the
> thing `--json` exists to avoid.

stage0 honours it: `NISH_SIMULATE_ICE=1` plus `--json` produces an `NL0003`
object on stdout with exit 70, and `tests/run.js` checks the object field by
field. **stage1 does not.** `self/ice.ts`'s `internalError` prints the human
report and nothing else, and says so in a comment on the line that would have
printed the object (`self/ice.ts:68-74`):

> It cannot: `process.argv` needs an `export function main` and this is a
> library module, the language has no mutable module state to stash the flag
> in, and threading it through all 39 callers would put a diagnostics flag in
> the signature of every broken invariant in the compiler.

[wp14-selfhost.md](wp14-selfhost.md) §7 records the same thing as one of the
two surfaces still stage0's. Every other `--json` object, the codes included,
is byte-identical between the two compilers.

**Two corrections to that sentence, both of which matter to the design.**

*The count is 38, not 39.* `internalError` has 38 call sites across nine
modules today (`self/emit.ts` 11, `self/emit_classes.ts` 9, `self/emit_ops.ts`
4, `self/interop_napi.ts` 4, `self/emit_builtins.ts` 3, `self/debug.ts` 2,
`self/emit_arrays.ts` 2, `self/emit_result.ts` 2, `self/types.ts` 1). The note
and the comment have drifted by one.

*`process.argv` is out of reach for a narrower reason than "library module".*
`hasEntryMain` is a **program-wide** fact — `src/checker/context.ts:36` says
"the program's entry module declares `export function main`", and it is set on
every module before any body is checked. So `self/ice.ts` compiled as part of
the real compiler, whose entry is `self/compile.ts`, could read `process.argv`
perfectly well. What stops it is that **`self` is a corpus directory**
(`tests/self/corpus.js:27`), so every module of `self/` is also compiled
standalone as its own whole program by the IR and checked-dump oracles — and
standalone, `self/ice.ts` has no entry `main`. The blocker is a testing
invariant, and a good one: it is what makes each module its own oracle case.
It is not a language rule, and the note should not have said it was.

### 4.2 The narrow design

A module-scope `let`, with four restrictions, each of which buys a specific
proof back:

1. **Module-private, never exportable.** `export let` is a compile error. The
   symbol therefore never crosses a linkage boundary, never appears in
   `--emit-header`, and never has to be resolved across a WP21 package
   boundary — where it would be a fifth entry in a flat symbol namespace that
   [wp21-packages.md](wp21-packages.md) §5a already names as that package's one
   hard blocker.
2. **Scalar types only** — `boolean`, the signed and unsigned integer widths,
   `f64`. Not `string`, not an array, not a class, not `T | null`. §4.3 is
   why: a pointer-typed global is a new escape route and it costs the whole
   WP6 model.
3. **A literal initialiser**, under exactly the grammar a module `const`
   already has. LANGUAGE.md's module-constant rule says a `const` emits no
   symbol and runs no initialiser, and that "is what lets a module keep its
   table of kinds and limits while still having no top-level code and
   therefore no initialisation order." A `let` does emit a symbol; keeping its
   initialiser to a constant expression means it is an LLVM initialiser rather
   than code, so the "no initialisation order" guarantee survives intact.
4. **Thread-local by construction**, from the day it lands — not from the day
   WP20 does. §4.5.

The `--json` case fits inside all four. `self/ice.ts` gains

```ts
let jsonMode: boolean = false;
export const setJsonMode = (on: boolean): void => {
  jsonMode = on;
};
```

and `main` in `self/compile.ts` calls the setter after parsing the flag. Note
what this exposes about restriction 1: **module-private stops the *symbol*
crossing, not the *value*.** A two-line exported setter puts the value across
any boundary you like. The restriction buys ABI and linkage cleanliness, which
is real and is what WP21 needs, and it buys no information hiding at all. It
should be defended as the first thing and not the second.

### 4.3 What it does to escape analysis, and why restriction 2 is not optional

`src/codegen/escape.ts` classifies every allocation site's flow as `local`,
`returned` or `leaks`, and `leaks` is "anything else: stored into a field,
element, array or object literal, pushed, assigned to another variable, passed
to a capturing callee". A store into a module-level global is squarely in that
list, and the soundness argument for stack allocation is exactly what it
breaks: WP6's rule is sound because "every reference to the object is either
consumed inside the site's own statement or lives in a local declared at or
below the site's block, so once control leaves that block, or the function
returns, nothing can name the object." A global names it forever.

The damage is not local, either. `leaks` sets `allocLeaks`, and escape.ts's own
header says `allocLeaks` "disables the scope of every caller too, since the
leaked memory may be reachable from an object the caller still holds." One
pointer-typed module `let` written anywhere in a call tree turns off the
automatic arena scopes for that whole tree.

Restricting the type to scalars removes the question rather than answering it:
a scalar is not an allocation site's destination, so escape.ts needs no new
flow class and `escape.ts` is not edited at all. That is a much better outcome
than a fourth flow class, and it is the reason restriction 2 is the load-bearing
one.

### 4.4 What it does to the attribute fixpoint

Rule 3 of the orientation is that no attribute is emitted without a proof, and
`src/codegen/attributes.ts` is where the proofs live. The memory-effect lattice
is `none < read < write` (`EFFECT_RANK`, line 202), propagated over the call
graph to a fixpoint (line 268); `none` becomes `readnone` and `read` becomes
`readonly` (lines 811-812). A read of a global is memory the function does not
own, so it is at least `read`; a write is `write`; and because the fixpoint
merges each callee's effect into its callers, both climb the whole call tree.

What is at stake, measured rather than asserted. Over the 173 golden `.ll`
files in `tests/cases/`, 65 of the 470 function-attribute groups carry
`readnone` and 30 carry `readonly`. Over `self/` compiled by stage0 — 54
modules, 1,046 `define`s — 30 functions are `readnone` and 73 are `readonly`,
so about one function in ten of the largest Nish program in existence
carries an effect attribute that a badly-placed global would withdraw. WP6 §1
makes the coupling explicit in the other direction too: stack promotion is
what makes some of those `readnone` in the first place ("a stack object is the
function's own memory: its allocation is no longer a write ... so a function
like `swapped` below is `readnone`").

**For the `--json` case specifically the cost is zero, and it is worth saying
why rather than being relieved about it.** `internalError` calls
`console.error`, whose runtime entry `nish_print` is `effect: "write"`
(`src/codegen/runtime.ts`), and every one of the 38 call sites is
`process.exit(internalError(...))`. So `internalError` and every caller of it
is already `write` and already unattributed. The flag poisons nothing because
everything it touches was already poisoned. That is a fact about this one use
case and not a property of the feature.

There is also a new IR object. Today the compiler emits no writable data symbol
for user code at all: string literals are `private unnamed_addr constant` and
the only `global` in a golden is `@nish_arena = external global`, defined in
`runtime.c`. A module `let` would be the first `internal global` the compiler
*defines*, which means a name in the flat symbol namespace (WP21 §5a again), a
linkage decision, and a new line in a golden for every module that has one.

### 4.5 What it does to WP20's promise

This is the largest cost and it is not a compile-time one.
[wp20-threads.md](wp20-threads.md) §2 opens its table of assets with:

> **No mutable global state, at all** ... The largest category of
> shared-mutable-state bug in C and half of it in Go cannot be written.
> Everything two threads can both reach arrived through a pointer somebody
> passed, which is exactly the thing an analysis can follow.

A module-level `let` withdraws that row. WP20 §1 is blunt about what depends on
it: "Either the checker rejects data races statically, or the attribute fixpoint
has to be given up," and a false LLVM attribute "is undefined behaviour — the
failure is silent miscompilation of correct-looking code, not a race report."

Restriction 4 is the answer, and it has to be part of the feature rather than a
WP20 follow-up, because a program written against a shared global and then
recompiled against a thread-local one is a program whose meaning changed
silently. So: the `let` is thread-local from the first commit, exactly as
WP20 T0 makes `@nish_arena` thread-local, and a program that wants two threads
to share a counter has to say so with something this note does not propose.
Two consequences follow honestly:

- **It is not free.** WP20 §3.1 costs a thread-local `@nish_arena` at "about
  one extra register on the hot path" under initial-exec, worse under `-fPIC`.
  A scalar flag read once per internal error will never notice; a counter in a
  loop would.
- **Thread-local is a semantic choice, not a safety wrapper.** Two threads see
  two values. For a `--json` flag set before any thread exists that is exactly
  right and for a shared tally it is a silent bug, which is an argument for
  keeping restriction 2 narrow rather than for widening it later.

### 4.6 Is it worth it? Honestly: for this case, no

The alternative the note dismissed is a parameter through the 38 call sites,
and it is cheaper than it was made to sound. Of the 38, about 30 sit inside a
function that already holds an `Emitter`, a `CheckContext` or an `Options` — so
the flag rides on a record those sites already have, and `Options` is where a
CLI flag belongs anyway (twelve flags live there already, `numberMode`,
`strictExports` and `nsw` among them, and `self/compile.ts` already threads a
plain `json: boolean` parameter through five of its own report functions). The
remaining seven are in small leaf helpers — `basicType`, `integerOpcode`,
`floatOpcode`, `napiReaderLines`, `napiBoxerCall` — and those are the sites the
original objection is really about: `integerOpcode(op: string, json: boolean)`
is an ugly signature and the ugliness is the whole complaint.

**But an unused boolean parameter costs nothing the compiler cares about.** A
parameter is not memory; a function that ignores an `i1` argument keeps every
attribute it had, and these five helpers already call `internalError` and are
therefore already `write`. So the parameter version costs seven ugly signatures
and zero proofs, while the module-state version costs a new IR construct, the
first writable global the compiler defines for user code, a symbol in the flat
namespace WP21 has to fix, a thread-local decision taken years before WP20
lands, and a withdrawn row from WP20 §2's asset table.

**Recommendation: thread the parameter, and keep §4 as the design for when a
second use case turns up.** The revisit trigger should be concrete, in the shape
wp18 §14 uses: if two more places in `self/` want module state for a reason that
is not "a CLI flag a driver already parsed", it comes back with its own cases.
One case, whose whole content is a boolean that a driver could pass, is not
enough to add the first mutable global to a language whose absence of them is a
load-bearing asset in another work package's safety argument.

The thing worth doing *now* is smaller than either: close the divergence. Adding
`json` to `Options` and one parameter to `internalError` makes both compilers
honour orientation rule 7, which is a stated contract that is currently not
true, and it needs no language change at all.

---

## 5. Pairs and multiple return — **decided: a library type, and unblocked**

**Decided: `Pair<A, B>` as a library type under WP18; no tuple syntax, and no
special case in the grammar.** §5.4 is the argument.

**What changed since it was written is that the gate is open.** §5.4 said this
costs one interface declaration "on the day WP18 is green", and read the gate
as the whole package. It is narrower than that, and the two milestones it
actually needed are both in: G5 gave a generic *interface* more than one type
parameter, and G7 (wp18 §15.5) made a template exportable — which together are
the whole of what a library type is. The four lines §5.2 designed compile and
link today:

```ts
// the module it would live in
export interface Pair<A, B> { first: A; second: B; }

// the caller, in another module
import { Pair } from "./pair";
const scanEscape = (at: i32): Pair<i32, boolean> => ({ first: at + 2, second: true });
```

(compiled and run as a two-module program to check that claim rather than
assert it; `std/` has no `pair.ts` yet, and adding one is what this row now
asks for)

and that is §5.1's strong case answered with the `Lexer` field gone: an object
literal at the return, no constructor, and nothing on the class to write and
read three lines apart. A `class Pair<A, B>` works too, for a caller that wants
a constructor; the interface is the cheaper of the two and is what §5.2 asked
for. What is still out is G6, which anything wanting to *constrain* `A` or `B`
would need, and G8, which an exported `Pair` crossing a C boundary would.
Neither is a prerequisite here.

So the row is decided **and** buildable, and §10 question 5 — which of `std/`
or each program — is answered there rather than left open: `std/` exists now,
so it goes in `std/`. What remains is the construct checklist for it, which is
a build rather than a decision.

### 5.1 The evidence, and what is not evidence

Three sites in `self/` say the language has no tuple. They are not equally
good and the difference decides the design.

**The strong one** is `self/lexer.ts:311`. `scanEscape` has to answer two
things — where the escape ended, and whether it was malformed — and the second
lives in a field on the `Lexer` class:

> Where the escape `scanEscape` just read ends, or -1 when it was malformed:
> its second return value, which the language has no tuple for. Written and
> read in the same three lines, at both call sites.

That is a genuine out-parameter: hand-written, hand-maintained, eight write
sites and two read sites, and a piece of a function's *result* living on the
object rather than in the return.

**The weak one is `self/codes.ts:46`**, and the review that led with it was
wrong to:

> Fragment, code, fragment, code -- flat because the language has no tuple, and
> a function rather than a module constant because a constant's initialiser
> must be a literal.

The sentence is true, and 342 rules make 684 flat entries. But `self/codes.ts`
**is generated** — `scripts/gen-diagnostic-codes.mjs` writes it and `npm test`
fails while it is stale (orientation rule 7) — so nobody reads or maintains
those pairs by hand, and a `Pair<string, string>[]` would save exactly nobody
any effort. Worse for the argument: `src/codes.ts:44` is written the *same*
flat way in TypeScript-on-Node, where tuples are available, and says why —
"flat rather than tuples so the stage1 twin can hold it too". That flatness is
a mirroring decision, not a language limit.

**And `self/target.ts` is not evidence at all.** The claim that it "holds its
table the same way" misreads the parenthesis in `codes.ts`: what `target.ts`
shares is being *a function rather than a module constant* (because a
constant's initialiser must be a literal), not being flat. `self/target.ts`
holds a `Target` class with two named string fields and looks it up with an
`if` chain. It is the counter-example, not the example.

One more counter-example is worth naming because it is the strongest argument
*against* this whole item. `self/program.ts:36`:

> Parameters are parallel arrays rather than a `Param[]`: a signature is read
> far more often than it is built, and this is one allocation instead of one
> per parameter.

That is not a workaround. It is [wp15-performance.md](wp15-performance.md)
§1a's data-oriented paradigm applied deliberately, and a `Pair[]` there would
be slower. **A pair type has to justify itself against a house style that
already prefers the flat shape**, which narrows what it is for: returning two
values from one call, not storing two values side by side.

### 5.2 The design: `Pair<A, B>` under WP18, not new syntax

Not `[i32, string]`. A tuple type is a new type constructor in the grammar, a
new spelling in every annotation position, new parse ambiguity against array
literals and index signatures, and a new case in `mangleType`, `sameType`,
`typeToString`, the DWARF builder and all five interop generators — on both
compilers. `Pair<A, B>` is `interface Pair<A, B> { first: A; second: B; }`,
which is [wp18-generics.md](wp18-generics.md) §2's second worked example
verbatim, and it needs **no grammar at all**: `Pair<i32, string>` in a type
annotation already parses (wp18 §2a: "`<` after a type name is already a
type-argument list in `self/parser.ts`"), and `new Pair<i32, string>(...)`
already parses too, because `new Array<T>(n)` needs it.

So the ask is one library type after WP18 lands, and one fewer type
constructor in the grammar forever.

### 5.3 What WP17 does and does not prove about the ABI

The review claimed `Result<T, E>` "already proves the compiler passes a
two-field aggregate in a register pair". **It proves the opposite of that**, and
the correction is the most useful thing in this section.

[wp17-result-abi.md](wp17-result-abi.md) §2 explicitly *refused* the by-value
aggregate — its option (b) — and refused it on portability, with a table:
`struct R { bool ok; int32_t value; int32_t error; }` returned by clang 18 is
`{ i64, i32 }` on the two x86-64 triples, `[2 x i64]` on the two aarch64 ones,
and `void @agg_12(ptr sret(...))` on both wasm32 ones. "LLVM does not lower an
aggregate to a platform's calling convention — the frontend does, per target."
The compiler emits target-neutral IR by default so one `.ll` links against a C
host built for any of the six, and a register pair would end that.

What WP17 §1 actually proves is narrower and better: **a small two-scalar value
travels packed into a single `i64`**, returned *and* passed, because `i64` is
the only width all six targets agree about. The threshold is a fact about the
targets rather than a tuning knob, and `resultByValue` in `src/types.ts` is the
one place that decides it: `void`, `boolean`, `u8`, `u16`, `i32`, `u32`, `f32`.

For a `Pair` this is very good news and it needs one adjustment. A `Result`
spends bits 0-31 on a discriminant and 32-63 on whichever arm is live; a
`Pair` has no dead arm and no tag, so it spends 0-31 on `first` and 32-63 on
`second`. `Pair<i32, i32>` is exactly the word. Everything outside the
four-byte-scalar rule — `Pair<i32, string>`, `Pair<f64, f64>`, a nested pair —
is a pointer to an arena struct, which is what WP16 did for every `Result`
before WP17 and is not a regression from anything.

So the reuse is real, it is just a different piece than claimed: the packing
predicate, the shift-and-mask lowering, the interop bridges that already
describe a packed word in `--emit-header` / `--emit-dts` / `--emit-napi`, and
the DWARF shape. What is *not* reused is a register pair, because there is not
one.

### 5.4 The honest cost

`Pair` is strictly after WP18, which is WP15 item 8 and the largest item on
that list. It buys, on today's evidence, one out-parameter field in
`self/lexer.ts` and whatever the next lexer-shaped function wants. That is a
thin return for waiting on the largest package in the plan — but the waiting is
free, because nothing about `Pair` is on WP18's critical path and it costs one
interface declaration on the day WP18 is green.

**Recommendation: adopt it as a library type when WP18 lands; do not add tuple
syntax, and do not build a special case before then.** The one thing worth
doing now is not adding a type constructor to the grammar in the meantime.

---

## 6. Compile-time function parameters — **decided: not scheduled**

**Decided: not scheduled.** §6.4 is the argument, and the reason to keep the
section is negative rather than positive — so that the next person who wants
`xs.map(f)` finds the shape that is compatible with this compiler written out
beside the reasons the general version never will be.

**The trigger now has a named first consumer, which is what makes it
measurable.** §6.4 asks for WP18 to have landed and for a real program to have
asked twice. [wp29-thread-surface.md](wp29-thread-surface.md) §6 is one of the
two asks and says so plainly: every parallel form that note proposes takes a
body, a body is a function argument, and its P1 is gated on this row and on
nothing else on that page. WP28 §7.4 has already measured the half this row
would build at **no run-time cost**, because the callee is statically known.
One more ask of that shape and this comes back with a schedule; until then the
answer to "when" is "not yet", not "never".

**This does not relax function values, and nothing here should be read as
proposing that.** `Function` is a Phase 0 error with a stated reason — "no
dynamic function values" — and the reason is load-bearing in four separate
places: wp18's argument for monomorphisation over dictionary passing, wp16 §6's
reason there is no `Result.map`, wp20 §2's asset table (a thread entry can only
be a named top-level function), and wp22 §2's measurement that what costs 7x in
JavaScript is a polymorphic call site, which this language cannot have. A
function pointer defeats the whole-program fixpoint, which is the mechanism WP9
and WP15 were spent buying.

### 6.1 The shape that costs nothing

A function *parameter* whose value is known at the call site and which
monomorphises there, exactly as a type parameter does:

```ts
function sortBy<T>(xs: T[], less: (a: T, b: T) => boolean): void { ... }

sortBy(names, compareStrings);   // one specialised `define`, direct calls
sortBy(diags, byPosition);       // a second one
```

The instantiation key gains a component — (template, type arguments, *function
arguments*) — and the mangling gains a segment. Nothing else changes: there is
no function pointer in the IR, no indirect call, no value of function type at
runtime, and the whole-program fixpoint sees an ordinary direct call it can
prove things through. The rules that keep it honest are wp22 §5's second rule
almost word for word: a name bound to a function may appear only in call
position or as a compile-time argument, never stored, returned or put in an
array.

### 6.2 The evidence, and the large part of it that does not count

Five comments in `self/` name the absence of function values:

| Site | What it says |
| --- | --- |
| `self/emit.ts:23` | "`Emitter` is `EmitContext` and `Emitter` at once, because the language has no function values to separate them with." |
| `self/expressions.ts:9` | "a table of function values needs function pointers, which the language does not have" |
| `self/attributes.ts:26` | `src/` "registers them into a `factCollectors` array from each `emit/*.ts`, which needs function values" |
| `self/emit_classes.ts:19` | "the language has no function values to register" |
| `self/interop_napi.ts:42` | `src/` "models a reader and a boxer as records of closures ... so a `Reader` and a `Boxer` here are **data with a kind**" |

**Four of the five are dispatch tables, and a compile-time function parameter
solves none of them.** A dispatch table exists precisely to choose a callee the
call site does not know; if the callee were known at compile time there would
be no table. Those four are D2 of [wp14-selfhost.md](wp14-selfhost.md) §3a — a
central `switch` instead of a table — and D2 was taken with its cost known and
with a reason that survives this proposal intact: a `switch` on a node kind
lowers to an LLVM `switch` and therefore a jump table, which is the fast shape.
They are not evidence for anything here and the review was wrong to count them.

The `self/emit.ts` one is real but is about *closures* — a record of functions
each capturing a context — which is further from this proposal than the
dispatch tables are, not closer.

### 6.3 The evidence that does count

Sorting, and it is small and clean. `src/` calls `Array.prototype.sort` exactly
twice (`src/diagnostics.ts:250`, `src/dump.ts:98`). `self/` has to write both
by hand, with two different algorithms over two different element types:

- `DiagnosticSink.sorted()` (`self/diagnostics.ts:288`), a 35-line bottom-up
  merge sort, stable "because the comparison never falls back to the message
  text: two errors at one position keep the order the phases produced them in,
  which is what makes a multi-error golden reproducible";
- `sortedStrings()` (`self/dump.ts:49`), a 12-line insertion sort over
  `compareStrings`, chosen because "these are a function's parameter names and
  its callees, so the lists are short and the constant matters more than the
  exponent".

Two call sites, two element types, two comparators, each fixed at its call
site. That is exactly the shape §6.1 lowers, and the second sort even documents
why one generic `sort` would be wrong for it — which is itself an argument for
a *parameterised* algorithm rather than one builtin.

Two hand-written sorts is a thin case. It is the honest one.

### 6.4 Where this stands

Strictly after WP18, and strictly after somebody has written a container
library against WP18 and found out whether the want is real. It is the most
speculative item in this note and it is marked so deliberately: it proposes to
extend the instantiation key of a package that has not been built, on the
strength of two sorts.

**Recommendation: do not schedule it. Revisit when WP18 has landed and a real
program has asked twice.** The reason to write it down now is negative rather
than positive — so that the next person who wants `xs.map(f)` finds the shape
that is compatible with this compiler written out beside the reasons the
general version never will be.

---

## 7. Declined: `for...of` over a string

This looks like the most obvious omission in the language and it does not
survive contact with three rules the project has already accepted. Today
`for (const c of s)` is `` `for...of` requires an array, got string ``
(LANGUAGE.md, `tests/cases/reject_arr_forof_non_array`), and it should stay
that way.

**It would not be TypeScript.** `tsc --strict` types `c` in
`for (const c of s)` as `string`. Verified, not assumed: annotating it
`const n: number = c` is `TS2322: Type 'string' is not assignable to type
'number'`. So a byte-yielding `for...of` would be a construct that compiles
here and means something else under `tsc` — and "every other rule in this
repository exists to keep an Nish program a TypeScript program that
`tsc --strict` also accepts" ([wp16-results.md](wp16-results.md) §5, which
tests the claim rather than asserting it).

**The type-honest version is quadratic.** Yielding a one-byte `string` per
iteration is an arena bump per iteration, which is the exact shape
[wp14-selfhost.md](wp14-selfhost.md) §3 measured when it made `join` a language
requirement: building 88 KB of text by repeated `+` cost **180 MB of peak RSS**,
"quadratic in both time *and* memory". A loop that allocates per character is
the same mistake with a nicer spelling, and WP15 item 2's `performance`
diagnostic class exists to warn about exactly it. The compiler would be
shipping a construct its own warnings would flag.

**And it would diverge from Node.** JavaScript's string iterator yields code
points; Nish is byte-oriented all the way down —
`s.length` is the UTF-8 byte length, `s.charCodeAt(i)` is "the **byte** at `i`
... No call: a `load i8`", and `String.fromCharCode(c)` is the one-byte string
of `c & 0xFF`. `tests/differential/` already goes to considerable trouble to
keep those agreeing: `runtime/shim.mjs` runs every string method over
`Buffer.from(s, "utf8")` rather than over the JavaScript string so that
`"héllo".charCodeAt(1)` is `195` on both sides. But `String.fromCharCode` above
127 is *already* a documented hole — "one byte that is not valid UTF-8 on its
own, which a JavaScript string cannot represent" — and the corpus keeps that
call to ASCII to stay out of it. A byte-yielding `for...of` would fall into the
same hole once per iteration.

**And the idiom already works and already costs nothing.**

```ts
let i = 0;
while (i < s.length) {
  const b = s.charCodeAt(i);
  i = i + 1;
}
```

Zero allocations, one `load i8` per byte, and it is what every loop in
`self/lexer.ts` is. The sugar would be three lines shorter, would be a
different program under `tsc`, and would allocate.

**Declined.**

---

## 8. Declined: string `switch`

Already declined in LANGUAGE.md, with an argument this note agrees with:

> Only an integer switch lowers to LLVM's `switch` and a jump table; a string
> switch would have been a chain of `nish_str_eq` calls wearing a switch's
> clothes, and `if`/`else` says that honestly.

`self/target.ts:13` is the decision being lived with rather than complained
about: two `Record<string, Target>` tables in `src/` are two `if` chains there,
and the comment says why it is fine — "there are six triples and ten aliases
and the lookup happens once per compilation, so the chain is the honest shape."

**The one variant that could change the answer**, recorded so that the next
person asking has the argument rather than the conclusion: dispatch on
`s.length` first and compare only within the bucket, or hash the string and
switch on the hash with an equality check in each arm — the shape a perfect-hash
keyword recogniser uses. Both turn N comparisons into roughly one, and both are
what a hand-written lexer does.

It is not worth it today, for two reasons that are about this compiler rather
than about the technique. First, the language already has the fast shape for
the case that matters: a keyword recogniser interns its strings into `i32`
kinds once and switches on those, which is what `self/tokens.ts` and
`self/lexer.ts` do with 99 `TOK_*` constants — a string switch would be
*slower* than what the corpus already writes. Second, a string `switch` that is
secretly a hash table is a construct whose IR does not read like its source,
and LANGUAGE.md's whole argument for the current rule is that the lowering
should be legible from the spelling. A construct that lowers to something
cleverer than it looks is the thing that rule exists to prevent.

If it is ever revisited, the trigger is a measurement and not a preference: a
real program where a string dispatch is hot and interning is genuinely
unavailable. None exists in the corpus.

**Declined, in agreement with LANGUAGE.md.**

---

## 9. Declined: optional chaining `?.`

The cost of its absence is real but it is smaller than it looks, and the
blocker is exact.

`self/emit.ts:25` names the pattern:

> **Debug info is a field, not a table of hooks.** `-g` builds the DWARF
> metadata in `self/debug.ts`, which stage0 reaches through an optional
> `DebugInfo` and this emitter through a `DebugInfo | null` that every call
> site narrows with `!== null`, because the language has no `?.`.

Measured rather than estimated: that is **four sites in `self/emit.ts` and one
elsewhere**, each of the form

```ts
const debug = this.debug;
if (debug !== null) { debug.beginFunction(...); }
```

— about ten lines of hoist-and-narrow in total. (The review's "at every call
site" overstates it; there are five call sites.) The hoist is required not by
`?.`'s absence but by a different decision, WP14 §3's *"What is deliberately
not being added"*: a nullable **field** does not narrow, only a local does,
because "a sound rule would have to invalidate on every call". `?.` would not
change that rule; it would only save the two lines around it.

**The blocker is `undefined`.** `a?.b` evaluates to `undefined` when `a` is
null, and `undefined` is forbidden in this language by name — as a type
(`` `undefined` is forbidden in Nish; use `null` with a `T | null`
type ``, `reject_undefined_value`), as a value, and as the reason `void expr`
is refused. It is also why `a.pop()` on an empty array panics rather than
answering anything (`self/emit_arrays.ts:415`: "there is no `undefined` to
return and no second return type to widen to"), and why nullish coalescing is
refused beside it. Optional chaining without `undefined` is not a smaller
version of optional chaining; it is a different operator.

One narrower version *is* expressible and is worth naming so that the decline
is honest: in **statement position** the result is discarded, so
`debug?.beginFunction(...)` as a statement needs no value for the null case at
all. That would cover four of the five sites above. It is still refused, and on
the ground `.claude/typescript.md` gives for `src/` — "prefer `!== null` when
the null case is a real branch with its own meaning" — plus a stronger one: an
operator that is legal as a statement and illegal as an expression is a rule
readers get wrong, and it would save ten lines across the largest program in
the language.

Note also where the current rejection lives: `?.` and `??` are **Phase 0**
errors (`reject_optional_chain`, `reject_nullish`), not checker ones. By the
validator's own doctrine — and wp22 §6 restates it — Phase 0 is for what the
language can never compile. `?.` is in that bucket because `undefined` is, and
that is the right reading: the operator's value in the null case is a thing
this language does not have, which is a permanent property and not a backlog.

**Declined.**

---

## 10. Where the answer is genuinely open

Recorded as questions rather than answered, in the shape
[wp18-generics.md](wp18-generics.md) §14 uses, because this note is meant to be
reviewed before more code is written.

1. **Bit flags on an enum** (§3) — **answered, conservatively**. `self/nodes.ts`
   combines `FLAG_EXPORTED | FLAG_CONST` and tests with `&`. TypeScript allows
   both on a numeric enum and gives back the enum type — which admits values
   that are no declared member, in a language whose whole enum argument is that
   a value has one identical type. Three answers were defensible: allow
   `| & ~ ^` on an enum and accept non-member values; refuse them and leave bit
   flags as `i32` module constants (which is what `self/` has today and what it
   would keep); or add a separate `flags` form. **The second shipped**
   (`tests/cases/reject_enum_bitwise`), because it is the only one of the three
   that can be widened later without invalidating a program that was already
   written. The question stays here because the *choice* is still open in the
   direction of widening.

2. **Whether an enum is `i32` or takes a width.** `i32` is proposed and matches
   every discriminant in `self/`. `u8` for a small enum would matter inside a
   struct once WP15 item 7 makes struct arrays contiguous, and choosing later
   is a layout change. Choosing now on no evidence is guessing.

3. ~~**The revisit trigger for module state** (§4.6).~~ **Answered by taking
   the count.** §4 is decided *no* with "two more places in `self/` that are
   not a CLI flag a driver already parsed" as the trigger, because a count is
   falsifiable by reading the corpus and a WP20 stage is not: restriction 4
   settles the feature's *meaning* against the threading model, which is a
   thing to check when the trigger fires rather than the trigger itself. If
   WP20 lands first it narrows what the answer may be, and does not change
   what asks the question.

4. ~~**Whether `--json` parity for `NL0003` should be closed before §4 is
   decided at all.**~~ **Answered by events: no, and the two are independent.**
   §4 is decided and the divergence is still open, which is the arrangement
   this question was unsure was possible. It is a WP19-shaped decision (a
   stated contract two compilers disagree about) rather than a language one,
   the remedy needs no language change, and `tests/self/parity.js` is where it
   would be pinned. What deciding §4 *did* settle is that waiting for module
   state is no longer one of the reasons it is open.

5. ~~**Whether `Pair<A, B>` belongs in a standard library or in each
   program** (§5).~~ **Answered, because the premise expired.** This question
   turned on "there is no standard library today", and there is one now:
   [`std/`](../std/README.md) holds `testing`, `text` and `json`, and a program
   reaches them as `nish/text`. wp18 §6.1's reasons for keeping `Result` and
   `Array` out of library code still do not apply to `Pair` — it is an ordinary
   two-field interface with no compiler knowledge behind it — and that is now an
   argument for `std/` rather than against it, because `std/` is exactly where
   a type like that belongs. Declaring it per program was only ever the answer
   while there was nowhere else to put it.

6. **Whether a compile-time function parameter and a type parameter share one
   mangling segment or two** (§6). It matters only for `--emit-header`
   collisions, which wp18 §14 question 4 already flags as an unclosed gap.

7. **Whether §7's decline should be softened to a diagnostic.** `for (const c
   of s)` today says `` `for...of` requires an array, got string ``. It could
   name the replacement — the `charCodeAt` loop — the way `` `??` `` names
   `!== null`. That is a message change, not a language change, and it belongs
   in whichever package next touches the array diagnostics.

---

## 11. What this note does not decide

- ~~**Whether any of §4 to §6 lands before the M4 freeze.**~~ **Answered, and
  the answer is none of them** — which is what takes all three off M4's
  critical path. M4 freezes the language reference (MASTER_PLAN §9), and none
  of the three adds a rule to it: §4 is decided no, §6 is not scheduled, and §5
  adds a *library type* rather than a rule, so `std/` gaining a `Pair` moves
  `std/README.md` and not LANGUAGE.md. The honest default is still the one
  [wp20-threads.md](wp20-threads.md) §7 takes — 1.1 scope — but it is now a
  decision rather than a deferral.
- **Anything about `self/` adopting §2 or §3.** Nish-0 excludes both by
  name and a construct enters the language before it enters `self/`
  ([`.claude/selfhost.md`](../.claude/selfhost.md), rule 1). Converting 171
  module constants to enums is a package with its own bootstrap risk, and it is
  the same shape as wp18 §14 question 8.
- **The diagnostic codes.** Every rule §2 to §6 would add is an `NL1xxx`
  (Phase 0) or `NL2xxx` (checker) entry generated by
  `scripts/gen-diagnostic-codes.mjs`, which appends and never renumbers. There
  is nothing to design here and inventing numbers in a design note would only
  make them wrong.
- **The two-implementation multiplier.** Every rule here lands twice, in `src/`
  and in `self/`, with the bootstrap having to close afterwards.
  [wp20-threads.md](wp20-threads.md) §3.6 states it once for the whole project
  and this note does not restate it per item — but it is the largest multiplier
  on every estimate above, and §2 and §3 are cheap *because* they are checker-
  only and change no IR, which is what makes their two implementations two
  small ones.
