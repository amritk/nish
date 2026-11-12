# WP28: Compatibility mode, and what `async` means in each dialect

**Status: in progress. All six spikes are measured (§7.4 to §7.9), and no
compatibility construct is built.** `--compat` parses as a bare flag that
admits nothing and changes no lowering, held to that by the erasure test
(S3, §7.6). The rest of C0 (the allow-list, `nish.compat`, the
`!nish.compat` metadata) and every stage after it are unbuilt. Neither
gating measurement stopped the package: S1 priced the function-value tier
(§7.4), and S2 found `async` by contagion to be the majority on four
applications, by a margin two of them do not settle (§7.5). What the
measurements leave for the owner to decide is in §10.
[wp33-round-trip.md](wp33-round-trip.md) schedules the package as R6, after
the way back out to TypeScript; its stages and their state are on the
[roadmap page](roadmap/wp28-compatibility-mode.md). Three things have landed
since this note was written that change its ground:

**2026-10-30:** an arrow passed to a function-typed parameter of a top-level
function may read the `const` locals and the parameters of the function it is
written in, each lowered as one more parameter of the direct call: no
environment struct, no indirect call
([LANGUAGE.md](LANGUAGE.md#function-parameters)). That is the strict-mode half of the closures row: what stays for
`--compat=closures` is a function *value*, stored or returned, with its
environment and indirect call.

- **`nish --fix`** ([#421](https://github.com/amritk/nish/pull/421),
  [#429](https://github.com/amritk/nish/pull/429),
  [#431](https://github.com/amritk/nish/pull/431), for the deprecated
  `--unchecked-indexing` #459, and for the NL9007 range guard #460) is the strict half of the same porting story, and the
  opposite mechanism: it adds no acceptance, it *rewrites* a refused construct
  into the strict spelling that means the same thing — `==` to `===`,
  `export default f` and export lists onto the declarations, `import type`
  without `type`, `from "fs"` to `from "nish:fs"`, a truthiness test into the
  comparison it meant, `String(n)` into a template, a bare `m.get(k)` into
  `m.get(k) ?? 0`. Where a construct has such a rewrite, compat mode has
  nothing to add, and the construct leaves §2.1's list. What `--fix` cannot do
  is what this note is for: constructs with no meaning-preserving strict
  spelling (a function value, `try`/`catch`, `async`), and porting without
  editing the source at all.
- **Strict absorbed two of §7.3's rows**: the statically known callee (C2a) is
  the strict language's function-typed parameter, and `Map` and `Set` are
  strict globals ([wp32-map.md](wp32-map.md)).
- **Strict has `async`** ([wp49-async-server.md](wp49-async-server.md),
  [LANGUAGE.md](LANGUAGE.md#async-functions-async-and-await)): a restricted
  `async`/`await` that compiles to a frame and a resume switch and runs on an
  executor that waits on sockets and timers. §6 was written when strict
  refused the keyword and nothing could be pending; §6.2 says what that
  changes.

The note answers two questions that arrived together and turn out to be one:

1. Should there be a mode that accepts most of ordinary TypeScript, so that a
   team can port a codebase first and buy the performance back afterwards, one
   construct at a time?
2. If it exists, does `async`/`await` belong in it — and is there a second
   answer that gets the parallelism JavaScript's `async` was invented to fake?

The answer to both is yes, with a rule attached in each case.
[LANGUAGE.md](LANGUAGE.md) stays normative; where this note and LANGUAGE.md
disagree, LANGUAGE.md wins. Read [wp24-async.md](wp24-async.md) and
[wp20-threads.md](wp20-threads.md) first: §6 does not overturn wp24's refusal,
it finds the one condition under which the refusal does not apply.

---

## 1. The decision

**Build the mode. Make it a porting aid with a proof obligation, not a second
language.** Five rules, and every later section is one of them worked out:

1. **Strict is the default, stays normative, and does not grow.** Compatibility
   mode may only ever *add* acceptance. It changes no rule LANGUAGE.md states.
2. **A construct may enter compatibility mode only if every value's layout
   stays fixed at compile time.** §2 shows this sorts the remaining surface of
   TypeScript into two piles without a judgement call. Anything that needs a
   tagged value or a tracing collector is refused in every dialect,
   permanently: that is writing a JavaScript engine, which MASTER_PLAN §1
   already refuses.
3. **Every compatibility construct prints its bill.** Each costs a proof the
   whole-program fixpoint was making, and the compiler says which, where, and
   what the rewrite is. The diagnostic class **already exists** — the WP15 §8
   `performance` class in `src/diagnostics.ts`, the `NL9xxx` band, `--json`,
   `--no-warn-performance` — and since #421 a diagnostic can carry a
   machine-applicable `fix`, which is how a compat construct with a mechanical
   strict spelling hands it over.
4. **The ratchet is one list, not one flag per feature.** `--compat=<features>`
   is an allow-list a team narrows in version control until it is empty and the
   flag is deleted (§5).
5. **The erasure invariant is a test, not a promise.** Every program in the
   corpus, compiled with the mode on and no compatibility construct used, must
   emit **byte-identical IR**, and every reject case (2696 today, §7.6) whose
   construct the allow-list does not name must still reject with the same code
   and words. That makes the mode provably a no-op until somebody uses it, and
   guards against this package's worst failure: a dialect flag that quietly
   changes the strict language.

**The threads came first**, as this section decided they should: the surface
was built as a language of its own before any `await` could be lowered onto
it — `nish/threads`' data parallelism (0.11.0,
[#219](https://github.com/amritk/nish/pull/219)) and `using s = scope()`
(0.13.0, [#262](https://github.com/amritk/nish/pull/262)), from
[wp29-thread-surface.md](wp29-thread-surface.md) — with the payoff measured at
3.96x on four cores for a compute kernel ([wp20-threads.md](wp20-threads.md)
§8). The compat `async` of §6 is notation over that engine.

And the thesis, because it is the argument for the whole package:

> **Compatibility mode is what lets strict mode stay small.**

[wp23-language-surface.md](wp23-language-surface.md) declined `?.`, a string
`switch` and `for...of` over a string, and each refusal is right *as a language
decision*: each is a second way to say something the language already says. But
each also appears in TypeScript somebody has already written, and refusing it is
the difference between a two-hour port and a two-week one. A dialect separates
the two: strict keeps saying no to surface growth, compat says yes to code that
already exists.

---

## 2. The line: representation, not difficulty

Sorting TypeScript by how hard each construct is to compile gives no rule a
reviewer can apply. The sort that works asks one question:

> After this construct, can the compiler still name the layout of every value
> in the program?

If yes, the construct costs *analysis* — an attribute becomes unprovable, an
`alloca` goes back to the arena — and the cost is measurable, local and
reportable. If no, it costs *the object model*: every value a tagged word,
every field access a lookup, and a collector shortly after. There is no partial
version of the second.

| Tier | What it is | Where it goes | Why |
| --- | --- | --- | --- |
| **1 — Static** | what compiles today | strict | — |
| **2 — Compatible** | fixed layout, weaker proofs | **compat** | the cost is attributes and allocation, both measurable and local to the construct |
| **3 — Dynamic** | requires a tagged value or a tracing GC | **refused in every dialect, permanently** | MASTER_PLAN §1 bullets 1 and 3, and non-goal 4 |
| **4 — Absent library** | syntax is fine, the *API* does not exist | neither: it is standard-library and runtime work | a mode flag cannot conjure `RegExp`, a `Date` object or `fetch` |

### 2.1 Tier 2, the candidates

Each row is admissible; none is free. "Costs" is what the whole-program pass
stops being able to prove, which is what the `performance` warning will say.

| Construct | Why strict rejects it | Compat lowering | Costs |
| --- | --- | --- | --- |
| optional and default parameters | one arity per signature | callee-side default, arity fixed at each call site | nothing measurable |
| `?.`, and `??` on a nullable | wp23 §9: a second spelling of a narrowing (strict accepts `??` on a `Map.get` result only) | the narrowing it already compiles to | nothing |
| string `switch` | wp23 §8 | a chain of content comparisons, or a length-bucketed tree | nothing the `if` chain does not cost |
| `for...of` over a string | wp23 §7 | the byte loop, with the UTF-8 rule stated | nothing |
| ~~labelled `break` / `continue`~~ | no rule; nobody asked | **Built in strict**: a branch to a named block (docs/LANGUAGE.md, "Labels") | nothing |
| overload signatures | one signature per name | monomorphised per implementation | nothing at run time |
| `try` / `catch` / `throw` | WP16: a failure is a `Result`, and nothing unwinds | landing pads, or a desugaring to `Result` with implicit propagation | **large** — `nounwind` comes off every function in the module; §7.1 S6 must choose the lowering by measurement |
| **function values and closures** | a function is never a value: the fixpoint cannot see through an unknown callee | an indirect call, and closures as a captured-environment struct with fixed layout | **the big one** — up to 8.76x per object the call makes unprovable (§7.4) |
| `async` / `await` | wp24 | §6 — three lowerings, one rule | §6.3 |
| generators as iterators | wp24 §7 | wp24 §3b's state machine: a struct, a one-byte discriminant, a `switch`, no allocation | a frame per live generator |
| `extends` with virtual dispatch | wp25: dispatch is static | a vtable | exactly the function-value cost, so it lands after it |
| mutable module-level state | wp23 §4 | a module-private global | `readnone`/`readonly` on anything that touches it |

> **Status:** strict mode now takes default parameters (a constant the call
> passes) and rest parameters; only `x?: T` and a default that is not a
> constant remain for this row.

A callee the checker can name — an arrow written at the call, or a top-level
function passed by name — is no longer on this list: strict accepts it as a
function-typed parameter of a top-level function, specialised per callee with
a direct call and nothing lost ([LANGUAGE.md](LANGUAGE.md#function-parameters)).

A function stored, returned or held in a field is still on it;
[wp51-function-references.md](wp51-function-references.md) (proposed, design
only) measures a lowering for references to capture-free top-level
functions — a tag and a `switch` — and proposes taking them off this row into
strict, as C2a was. It argues they are a third case, neither C2a nor C2b:
the target is not named at the call, but the closed set that can reach each
call is (per-place sets, in its first stage), so a reference costs the hand
`switch` over the same declaration's tags, and more only against a hand
program that keeps tags in finer places. A call whose set would join a
member that keeps an argument with one that does not is refused there, so
the escape cost this row measures cannot be reached through a reference.
Closures stay here.

### 2.2 Tier 3, refused permanently

`any` and `unknown` in value positions, adding or deleting an undeclared
property, `eval`, `Function`, `Proxy`, `Reflect`, `with`, prototype access and
mutation, `arguments`, computed property names over open key sets,
`Object.assign` onto a typed value, `symbol` as a key, structural duck typing
resolved at run time, and `JSON.parse` returning a shape nobody declared.

Each requires that a value carry its type at run time, which requires a tagged
representation, which requires a collector for the boxes. A "compatibility
mode" that accepted them would be a second compiler for a different language,
sharing a flag. **This is the sentence a user of the mode has to read first**:
the mode accepts most of the *statically typed* TypeScript people write, and
none of the dynamism.

---

## 3. What the mode is, precisely

**It is additive.** Compatibility mode never changes the meaning of a program
that compiles today; §1's erasure invariant is the test. The one deliberate
exception is `number` (§5.3), and the flag surface has to make it loud.

**It is priced, per construct, at the site**, in the existing `performance`
class:

```
warning[NL9xxx]: `sort(items, compare)` passes a function value
  --> src/table.ts:88:22
   = 2 allocations reachable from this call move from the stack to the arena
     (`Row` at table.ts:64, `Key` at table.ts:71) -- measured at up to 8.8x
     per object on an allocating loop (wp28 §7.4)
   = the call cannot be inlined: about 1.3x on the loop it sits in
   = `readonly` and `willreturn` are dropped from 3 transitive callers
   = rewrite: make `compare` a top-level function and pass it to a
     function-typed parameter
```

The order of those lines is the order §7.4 measured: the arena is the expensive
one by a factor of six, and the attribute loss — what a compiler author reaches
for first — was worth nothing on the shapes tested. `--json` over that class is
the migration dashboard, and the number that matters is the *blast radius*: how
many functions lost a proof because of this one site, a query the fixpoint can
answer and a reviewer cannot.

**It is bounded by the root package.** WP21 compiles a dependency from source
into the consumer's program, so a compat construct in a library degrades the
application's attributes. **The root package's allow-list is the whole
program's ceiling**: a dependency may use fewer features than the root allows,
never more, and a violation names the dependency, the module and the feature.
The compiler already draws this line for the deprecated unsafe flags, which
reach only the entry package's modules (#422), and for the capability policy,
which is read from the root manifest only
([wp36-capability-policy.md](wp36-capability-policy.md)).

---

## 4. What this does not buy, said early

### 4.1 The syntax is not what blocks the port

A codebase that cannot use `?.` is annoyed; one that cannot use `RegExp`,
`Date` objects, `JSON.parse`, `Buffer`, `fs.promises`, `http` or an npm
dependency cannot be ported at all. Tier 4 is where most real migrations stop,
and a compat mode that admits `async` while the library is absent admits
nothing anybody can use. So the library tier outranks most of the syntax tier.
Some of it has since arrived in strict — the global `Map` and `Set`, `Date.now`,
`crypto.getRandomValues`, and synchronous sockets in `nish:net` — and the rest
is standard-library work under [wp26-stdlib.md](wp26-stdlib.md)'s rules, not
this note's. npm packages are out, and not by staging: a published package is
JavaScript, and the Nish consumer path takes source
([wp21-packages.md](wp21-packages.md) §2).

### 4.2 It is not a performance promise in reverse

Compat is slower than strict, which is why each construct is priced. It must
never become a mode where the slowdown is unattributable. §7.4 showed the
attribution is possible for the function-value tier — the blast radius is the
transitive caller set of the opaque callee, which the checker already builds —
and that the report's *order* matters more than its completeness.

### 4.3 It is not a second freeze

Compat adds no rule to LANGUAGE.md. Its own reference is a separate document
with its own version line and an explicit statement that it may churn.

### 4.4 It is not for `src/`

`src/` may never use a compatibility construct, for the reason the rolling
freeze exists: `src/` must build with the previous release's seed. The root
package's ceiling makes that one line.

---

## 5. The flag surface, re-thought

### 5.1 What is wrong with it today

- **No axis is visible in a name.** `--plain`, `--threads` and `--number-mode`
  read alike; one changes what a program *means*, one how fast it goes, one the
  runtime it links. The two unsafe flags, `--wrapping` and
  `--unchecked-indexing`, are deprecated in favour of `nish:unsafe` at the site
  (#422, #459), which removed the worst case: a meaning-changing flag that
  reached every dependency.
- **A meaning-changing flag is invisible in the artifact.** Two `.ll` files of
  one source under `--number-mode i32` and `f64` are different programs, and
  neither says so.
- **Boolean pairs multiply.** A dozen compat features as flags would be a dozen
  more.

### 5.2 The proposal

**Three axes, named in `--help`, and every flag belongs to exactly one.**

| Axis | Question it answers | Flags |
| --- | --- | --- |
| **Dialect** | what does this source *mean*? | `--compat`, `--number-mode`, `--async-model` |
| **Build** | how is it made? | `--profile`, `--target`, `--link`, `--plain`, `--no-stack-alloc`, `--threads`, `--no-strict-exports` |
| **Output** | what is written? | `-o`, `--emit-header`, `--emit-dts`, `--emit-napi`, `--emit-napi-async`, `--runtime-decls`, `-g`, the dumps |

Diagnostics (`--json`, `--no-warn-performance`, `--warn-portability`) and the
policy checks (`--deny`, `--allow`, `--deny-panics`) are two more, small and
already coherent.

**One dialect flag, with an allow-list.**

```
(no flag)                   strict: the default, and what every benchmark measures
--compat                    every tier-2 feature that is built
--compat=closures,async     exactly these; everything else still rejected
```

A rejected construct names the feature that would admit it:

```
error[NL1015]: `async` functions are forbidden in Nish (no event loop or promises)
  = this program's dialect is `compat=closures`
  = add `async` to `nish.compat` in package.json to accept it, at the cost the
    `performance` class will then report
```

The example shows the two added lines, and its first line is of its time:
strict accepts an `async` function now (§6.2), so the refusal it would print
today is one of the shape rules §7.5 lists.

**The list lives in `package.json`**, as `compat` in the root package's
`"nish"` object beside `noPanic` and `capabilities` — `true` for every feature,
or an array for exactly some. That is where a ratchet is reviewable: the diff
that removes `"async"` is the migration. The CLI flag overrides for a one-off
build. The `"nish"` object is read strictly today and an unknown key is
`NL3036` (#458), so `compat` is one more key that reader learns.

**The dialect is recorded in the artifact.** A `!nish.compat` named metadata
node in every emitted module and a line in `--emit-checked` — absent for a
strict build, so no golden moves. Everything on the Dialect axis goes in it,
`--number-mode` included.

**One rename, with the old spelling kept for one minor:** `--plain` is
`--no-attributes`. The rest of the surface is fine once it is grouped.

### 5.3 The one place compat must change meaning: `number`

`number` in TypeScript is a double; in Nish it is `i32` by default. A ported
codebase whose arithmetic silently truncates at 2³¹ is a *quiet* failure. **So
`--compat` implies `--number-mode f64`**, and an explicit `--number-mode i32`
beside it is an override the `performance` class reports. That resolves
MASTER_PLAN §3.4's oldest open row the only defensible way once two dialects
exist — **`i32` in strict, `f64` in compat** — and it is the exception to §3's
additivity, which is why it belongs in the flag section rather than buried.

---

## 6. `async`, in three dialects

### 6.1 What JavaScript's `async` actually is

A workaround for one thread and an event loop. It buys *concurrency* on one
core and cannot buy *parallelism*. Nish compiles to native code with real
threads and has no event loop to protect, so the syntax and the engine under it
are separable: the `async` a programmer wrote is kept as *notation for
sequential suspension*, and what runs underneath is chosen by a flag.

### 6.2 One source text, three lowerings

| | `await f()` | `Promise.all([f(), g()])` | concurrency | parallelism |
| --- | --- | --- | --- | --- |
| `--compat --async-model sync` (the default under `--compat`) | call `f`, use the result | `f` then `g`, sequentially | none | none |
| `--compat --async-model threads` | spawn `f`, join at the `await` | spawn both, join both | yes | **yes** |
| strict (no `--compat`) | accepted on a direct call: the caller's frame suspends until `f` finishes | rejected (NL2643); the strict spelling is `await awaitAll(f(), g())` | yes, on one thread's executor | `nish/threads`, `scope()` |

**The strict row was "rejected, as today" when this note was written, and is
no longer.** WP49 built a restricted `async` in strict
([LANGUAGE.md](LANGUAGE.md#async-functions-async-and-await)): no expression
has a promise type, an `await` takes a direct call, and a call to an `async`
function is awaited where it is made, which are §6.3's two rules arrived at
from the other side. Two things in the rest of this section are therefore
stale as written, and are left as the argument they were:

- §6.3's premise, "there is still no event loop, no callback and no promise,
  so nothing can be pending", held for the language of that date. Strict now
  has an executor, `spawn`, and waits on a timer or a descriptor, so a task
  can be pending while another runs. The claim still covers a program that
  uses none of those; whether the erasing lowering can stand beside the built
  one is part of §10's first question.
- "Compat `async`" is no longer the difference between a refused keyword and
  an accepted one. What a ported application meets first is the shapes strict
  refuses, counted in §7.5.

### 6.3 Why the erasing lowering is honest here, and wp24's refusal survives

[wp24-async.md](wp24-async.md) §7 refuses `async` as an erased no-op keyword,
because erasure makes a program mean something different under Node than here.
This note finds the condition under which the difference does not exist, from
wp24's own load-bearing finding: **there is nothing to await** (wp24 §2). The
language has since gained sockets and a poller (`nish:net`, WP34 N5), but they
are synchronous — `pollWait` blocks the thread that calls it — and there is
still no event loop, no callback and no promise, so nothing can be pending
while a function runs. A JavaScript `await` changes the observable order only
when some *other* pending continuation runs in the gap the yield opens; if none
can exist, eager and microtask evaluation produce the same effects.

> **Claim.** For programs this language can express, eager synchronous
> evaluation of an `async` function is observationally identical to
> JavaScript's whenever no two promises are simultaneously live.

The divergence the rule has to reject:

```ts
const p = slow();      // starts, runs to its first await, yields
console.log("a");      // under Node this runs BEFORE the rest of slow()
const r = await p;     // eagerly, "a" would print after all of slow()
```

So the rule is syntactic, checkable with no new analysis:

1. `await` applies directly to a call expression — `await f(x)`, never
   `await p` where `p` is a variable, a field, an element or a parameter.
2. A call to an `async` function is awaited in the expression that makes it:
   no fire-and-forget, no storing a promise, no returning one to a synchronous
   caller.

Together, at most one promise is live at any point, so erasure is exact. The
rule is sufficient rather than necessary; §6.4 is the one exception it admits
by proof. It is also [wp24-async.md](wp24-async.md) §9.3 from the other side:
if async is ever built, `async`/`await` survive and the promise as a
first-class value does not. A promise you cannot store cannot be live beside
another.

**The claim is falsifiable.** Compat implies f64 (§5.3), which is exactly the
mode `tests/differential/unmodified.js` runs a program's `.ts` under Node in, so
every compat program with `async` in it goes there, matched on stdout
*including the order of the prints*. If the rule is wrong, it fails program by
program.

### 6.4 `Promise.all`, and the analysis that pays twice

`Promise.all([f(), g()])` has two live promises, so §6.3 rejects it — unless
neither call can tell. If the fixpoint proves `f` and `g` do not interfere
(`readnone` or `readonly`, or writes through provably disjoint pointers), no
interleaving is observable. Two things follow:

- Under `--async-model sync`, a non-interfering `Promise.all` over direct calls
  is admitted and runs sequentially, because nobody can tell.
- Under `--async-model threads`, the *same expression* over the *same proof*
  becomes a real fork/join. Non-interference is what makes eager evaluation
  unobservable, and it is also — almost exactly — the race-freedom
  rule a `scope()` task is already held to. **One analysis, two payoffs**, the second
  being parallelism the JavaScript original could never deliver.

### 6.5 `--async-model threads`

`await f(x)` becomes spawn-and-join, which for one live promise is a call with
extra steps — so the model matters only where §6.4 admits more than one. It
rides the built `using s = scope()` surface
([LANGUAGE.md](LANGUAGE.md#scoped-tasks-using-s--scope)) and inherits its limits
unsoftened: the entry is a top-level function, what it writes must satisfy
the race-freedom rules, and the task cannot outlive the scope. A call that fails the
rule is not silently sequential; it is a diagnostic naming what disqualified it.

### 6.6 What compat `async` does not buy

`setTimeout`, `fetch`, `fs.promises`, `await` on anything outside the program:
missing *library*, not syntax, and a ported event-driven server still has no
event loop to run on. What it does buy is the common case: **most application
TypeScript is `async` by contagion rather than by need** — one leaf did I/O
once and four hundred callers took the colour. In Nish the colour has no
semantics, so erasing it is a whole-program decolouring, and wp24 §4.2's cost
is this note's asset. S2 took the measurement this paragraph asked for: on
four applications the share by contagion is 53.6% to 64.7%, and only 8.6% to
25.2% of `async` functions sit on chains that reach nothing outside the
program (§7.5).

---

## 7. Staging, and what must be measured first

### 7.1 The spikes, before any of it

| | Spike | What it decides |
| ---: | --- | --- |
| S1 | **done — §7.4.** One opaque callee in a hot loop, three ways, and the escape analysis it forfeits | priced the function-value tier: the call is worth 1.26x–1.40x and the *escape analysis* 8.76x |
| S2 | **done — §7.5.** On a real TypeScript application, count `async` functions against those that await something that can block | whether §6.6's decolouring is the common case or a story: of 2364 `async` functions in four applications, 53.6% to 64.7% are `async` by contagion, and two of the four are above half by less than a point |
| S3 | **done — §7.6.** The erasure invariant, run against the corpus with a feature-less `--compat` | C0's acceptance test, and it runs: 1044 positive cases byte-identical and 2696 reject cases rejected alike, none skipped |
| S4 | **done — §7.7.** `Promise.all` over two non-interfering calls as a fork/join, against `parallelReduce` on the same work | whether §6.4's second payoff is real: it is above a task of about 16 µs (0.504x at 10.7 ms) and a loss below it (9.419x at 1 µs) |
| S5 | **done — §7.8.** The benchmark suite under `--number-mode f64` | prices §5.3: 1.008x on the 10 programs timed as they are, 1.10x and 1.19x on two integer-heavy ones, and 20 of 34 programs refused |
| S6 | **done — §7.9.** `try`/`catch` by landing pads against a desugaring to `Result` | the lowering, by measurement rather than taste: the spike recommends the `Result` desugaring, on the targets that have no unwinder; a throw costs about 770 ns against 2 ns |

S1 and S2 were the two that could stop the package. S1 did not. S2's count
came out on the side of the claim it tested, by a margin that §7.5 states
and §10 leaves with the owner.

### 7.2 The ladder a team walks

1. `--compat` — it compiles, slower than strict, with a report saying where and
   why. `nish --fix` has already rewritten every construct with a mechanical
   strict spelling.
2. Ratchet `nish.compat` down, highest blast radius first.
3. `--async-model threads` — the same source gets parallelism it never had
   under Node. This is the step the package is designed around: every other
   step pays down a debt, and this one hands a team something the original
   runtime could not do.
4. Erase the now-meaningless `async`/`await` with a `--fix` rewrite; the list
   is empty and the flag comes off.

### 7.3 The stages

| | Stage | Contents | Size |
| ---: | --- | --- | --- |
| **C0** | the machinery, zero features | `--compat`, the allow-list, `nish.compat`, `!nish.compat` in the IR, the `--help` regrouping of §5.2, the compat half of the `performance` class, and S3 as its acceptance test | S. Provably a no-op; every later stage becomes an entry rather than a redesign. The bare flag and S3's test are built (§7.6); the rest is not |
| **C1** | the free tier | optional parameters and non-constant defaults (constant defaults are in strict mode), `?.`, `??` on nullables, string `switch`, `for...of` over a string, overload signatures — each a wp23 refusal reversed *in compat only*, and each a candidate for a `--fix` rewrite instead wherever one keeps the meaning | M |
| **C-lib** | the library tier | `Date` objects, `JSON`, `RegExp`, `Buffer`, under WP26's rules. `Map` and `Set` are strict already | L, and per §4.1 it outranks most of what follows |
| ~~C1, labels~~ | labelled `break`/`continue`, once a C1 entry | **Built in strict**, as direct branches with no flag; it left C1 | — |
| ~~C2a~~ | callbacks whose callee is statically known | **Built in strict**, as function-typed parameters: free at run time, as §7.4 predicted | — |
| **C2b** | function values proper | a value whose target the checker cannot name: the indirect call, the captured-environment struct, and the escape proof it forfeits | L, and the expensive one — 1.26x for the call and up to 8.76x for what it does to WP6 (§7.4) |
| **C3** | `async`/`await`, `--async-model sync` | §6.3's two rules, the erasure, §6.4's admission, and the unmodified-Node cases that hold it | M. Whether S2 retires it in favour of C4 alone is open (§7.5, §10) |
| **C4** | `--async-model threads` | §6.5, on `scope()`, which is built | M. The stage the ladder is for. S4 priced its fork (§7.7) |
| **C5** | exceptions | the lowering S6 measured (§7.9); the spike recommends the `Result` desugaring and the choice is open (§10) | L |
| **C6** | generators as iterators | wp24 §3b's shape | M |
| **C7** | `extends` with virtual dispatch | wp25 reversed in compat only; it costs exactly what C2b costs and lands behind it | M |

C0 is worth doing on its own even if C1 never is: it makes the flag surface
coherent, puts the dialect in the artifact, and turns every future "should we
accept X" from a language argument into a one-line entry in a list.

---

### 7.4 S1, measured — and the headline it moves

Five programs (§11), on the machine [wp20-threads.md](wp20-threads.md) §8
describes; best of seven, variants interleaved run by run. The instrument is
[wp27](wp27-ffi.md)'s `declare function`, which gives an attribute-less callee
inside the language, and a hand-edited call through a function pointer the C
half installs at run time, which gives a callee LTO cannot see either — the
position a closure's code pointer is in.

**What one opaque callee does to the fact table**, on a four-function program
whose every function is pure in the baseline:

| | baseline | with the callee opaque |
| --- | --- | --- |
| the callee | `nounwind willreturn readnone` | `nounwind` (it is a `declare`) |
| its caller, `run` | `nounwind willreturn readnone` | `nounwind` |
| *its* caller, `nish_main` | `nounwind willreturn` | `nounwind` |

The blast radius is the **transitive caller set**, and it reaches the program
entry from one leaf. That is computable from the call graph the checker already
builds, which answers §4.2.

**What it costs, measured:**

| Shape | callee known | opaque to the fixpoint, in the LTO unit | truly indirect | ratio |
| --- | ---: | ---: | ---: | ---: |
| a serial hash chain, 400M calls | 489 ms | 490 ms | 616 ms | **1.26x** |
| the same call inside an array loop, 1,024 elements × 400k rounds (`xs.reduce(cb)`) | 543 ms | 542 ms | 760 ms | **1.40x** |

| Shape | object proved local | object not provable | ratio |
| --- | ---: | ---: | ---: |
| one 8-byte object per iteration, 200M iterations | 137 ms | 1,200 ms | **8.76x** |

1. **The frontend's own attributes, lost this way, cost nothing on these
   shapes** (490 ms against 489), because the callee was still in the LTO unit
   and LLVM re-derived what it needed. That does not make the fixpoint
   worthless — WP15 §2b measured 1.63x to 3.96x from alias facts on array
   loops — only these two facts are not what a closure charges.
2. **The call itself is worth 1.26x to 1.40x**, the honest price of a callback
   in a hot loop.
3. **The escape analysis is worth 8.76x, and that is the whole story.** Where
   the object is provably local, WP6 makes it an entry-block `alloca` and LLVM
   removes it entirely; an unknown callee cannot be given that proof, so 200M
   arena allocations arrive.

**What that changed.** The compat report leads with **"this object moved from
the stack to the arena, and here is the call that took the proof away"**, for
every object reachable from the call (§3's sample is in that order). And C2
split in two: a *statically known* callee costs nothing, since the call is
direct, inlines, and keeps the escape proof — which is why strict could take
it as the function-typed parameter of
[wp23-language-surface.md](wp23-language-surface.md) §6 — while a function
value whose target the checker cannot name is where 1.26x and 8.76x live.

One caveat: `--no-stack-alloc`, the instrument for the third row, disables the
analysis program-wide, while an opaque call disables it only for what the call
can reach. In this program the two sets are the same, so 8.76x is an honest
per-object figure and not a program-wide multiplier; how much of a real
program is reachable from its closures is the measurement C2b has to take
before it ships. For a reference to a capture-free top-level function that
reach is not a measurement but a fact the checker computes per call — the
set of functions that can be stored into the place the call reads — which is
the third case
[wp51-function-references.md](wp51-function-references.md) §1 argues out of
C2b (proposed, design only).

### 7.5 S2, measured: `async` by contagion

The census, its method, its hand audit and every table are in
[bench/wp28-s2/README.md](../bench/wp28-s2/README.md)
(`node bench/wp28-s2/run.mjs`). It parses four applications published to npm
with their TypeScript source, pinned by version and integrity: hardhat 3.21.2,
appium 3.9.0, @stryker-mutator/core 10.1.1 and @budibase/server 3.38.1. The
counts are exact for the pinned tarballs, so there is no noise band and a
rerun prints the same tables (Node 22.23.4, `typescript` 5.9.3, nish 0.38.0,
a 4-core x86-64 Linux container). The error bar is the functions the census
could not place.

| | `async` functions | share |
| --- | ---: | ---: |
| wait on nothing but functions of the same program (contagion) | 1268 | 53.6% |
| wait on something outside the program | 835 | 35.3% |
| not placed | 261 | 11.0% |
| all | 2364 | |

- **The share by contagion is 53.6% to 64.7%**, the unplaced column being the
  whole of the gap. Per application the lower bound is 64.2% (hardhat), 54.4%
  (appium), 50.3% (@stryker-mutator/core) and 50.2% (@budibase/server).
- **Two applications sit within a point of half.** Those two margins are
  smaller than the census's known undercounts of need, so for
  @stryker-mutator/core and @budibase/server it does not settle which side of
  half the true share is on. "Most" is supported across the corpus; "nearly
  all" is not.
- **By need in §6.6's sense is rare**: 89 functions (3.8%, one in 27) wait on
  the platform directly. The rest of the 35.3% wait on a dependency, mostly
  the application's own sibling packages; counting those as program
  functions, the share by contagion is at most 96.2%.
- **The colour comes off and the leaf stays**: only 8.6% to 25.2% of `async`
  functions sit on chains that reach nothing outside the program. For the
  rest, erasure leaves a call chain that still ends in a file read or a
  socket, the missing library §4.1 and §6.6 name.
- **More than one live promise is rare**: 94.7% of the 4487 `await`s are on a
  direct call and 3.0% on the `Promise.all` family.
- **Strict already accepts every class** the census sorts functions into. What
  it refuses is shape: an `async` method (NL1063; 725 functions, 30.7%), an
  inferred return type (NL2655; 1332, 56.3%), an `await` inside an expression
  (NL2642; 428 of 4487 `await`s, 9.5%), a returned, unawaited call (NL2645;
  168 of 2283 calls, 7.4%), `Promise.all` (NL2643), recursion through an
  `await` (NL2648; 66 functions, 2.8%) and `for await` (NL2133; 8 loops).
  These shares are marginal: the census does not count how many functions
  pass every rule at once.

**What it argues.** §6.6's sentence, "most application TypeScript is `async`
by contagion rather than by need", holds on this corpus as "most", with the
qualification above. The spike's README reads the figures as not the negative
S2 that §10 said would argue for dropping C3; the opposite reading is also
open, and both are set out in §10. The census covers four Node applications,
counts functions and not calls, and does not run anything against Node.

### 7.6 S3, measured: the erasure invariant

`--compat` parses as a bare flag with no feature behind it
([#1489](https://github.com/amritk/nish/pull/1489)): it admits no construct
and changes no lowering, and `--compat=<anything>` is a usage error.
`tests/compat-erasure.js` compiles every program in `tests/cases/` twice, with
the flags its `.args` names and then with `--compat` after them, and compares
the two: a positive case's output byte for byte, and for a reject case the
exit code, the diagnostic code and the words.

**1044 positive cases are byte-identical and 2696 reject cases are rejected
alike, with none skipped.** These are counts, not timings, so there is no
noise band. A self-test hands the harness a compiler that alters one IR line,
one diagnostic word and one code under `--compat` and expects each caught by
name. It runs in the suite as `node tests/run.js compat-erasure`.

**What it decides.** §1 rule 5 is now a test that runs on every push, and it
is the acceptance test C0 and every later stage are held to. One limit: the
harness compares each case under its own `.args` and `.env`, and the suite's
second compiles of a case under other flags are not yet compared.

### 7.7 S4, measured: `Promise.all` as a fork/join

`--async-model threads` is not built, so the spike writes the lowering by
hand, a `scope()` with one spawned task and one run inline, and times it
against the sequential pair and against `parallelReduce` over the same work.
Programs, method and the full table:
[bench/wp28-s4/README.md](../bench/wp28-s4/README.md)
(`npm run build && node bench/wp28-s4/run.mjs`). 4 logical CPUs of an Intel
Xeon at 2.30 GHz, linux-x64, nish 0.38.0, LLVM 18; 11 interleaved rounds after
a warm-up; the band is the sequential binary against a byte-identical copy of
itself in the same rounds.

| one task | fork/join over sequential | band |
| ---: | ---: | ---: |
| 0.98 µs | 9.419x | ±0.3% |
| 10.0 µs | 1.271x | ±1.6% |
| 20.2 µs | 0.882x | ±0.5% |
| 41.1 µs | 0.707x | ±1.9% |
| 10.7 ms | 0.504x | ±0.4% |

- **A fork/join of two tasks costs about 16 µs more than the work it shares
  out**, so the break-even task is about 15.9 µs on this machine
  (interpolated between the 10.0 µs and 20.2 µs rows).
- **Against `parallelReduce`**: below 2^20 elements a reduce is one block on
  the calling thread and runs as the sequential fold (0.977x to 1.014x), so
  the fork/join is the only form that forks. At 5,000,000 elements in five
  blocks the reduce runs in 0.381x of the sequential time and the fork/join
  in 0.504x: the reduce uses more than the two cores a two-call `Promise.all`
  can.

**What it argues.** §6.4's second payoff is real for calls worth tens of
microseconds or more. A fork taken on every non-interfering `Promise.all`,
whatever its calls cost, would make the small ones up to nine times slower
here, and how the lowering tells the two apart is a question the spike does
not answer and C4's design has to. The hand-lowering measured one callee
(`product`) over one array argument, two tasks, on one machine; two different
callees or other argument shapes need the arrow-capture form of `spawn`, whose
cost is not measured.

### 7.8 S5, measured: the price of `--number-mode f64`

Every program `bench/run.mjs` lists, built with and without the flag:
[bench/wp28-s5/README.md](../bench/wp28-s5/README.md)
(`npm run build && node bench/wp28-s5/run.mjs`). 4 vCPUs of an Intel Xeon at
2.10 GHz, linux-x64, nish 0.38.0; 7 interleaved rounds after a warm-up; each
band is a binary against a byte-identical copy of itself in the same rounds.

Of 34 programs: 10 timed, 4 with the same IR (their `.args` already name
`--number-mode f64`), **20 refused by the checker**, none with a changed
output.

- **Where it compiles as written, it costs nothing measurable**: 1.008x
  geometric mean over the 10 timed programs (bands ±0.3% to ±8.4%), at most
  +0.03% instructions. All ten are the `par-*` kernels, whose loops are
  written `let i: i32`, so the mode does not reach their hot code. One row,
  par-heavy-fold, reads 1.053x against ±4.3%, on instruction counts that
  differ by 1237 in 29.9 billion.
- **On integer-heavy code it costs 1.10x to 1.19x, from two programs**: fib
  (1.099x, ±4.9%) and sieve (1.186x, ±2.5%), 1.141x geometric mean, each
  measured from a copy whose `main` is declared `(): i32`.
- **20 of 34 are refused**, for two reasons. `main` returns a bare `number`,
  which is not an exit code as f64 (NL2140; fib, sieve, strbuild and result,
  one error each). Or a bare `number` meets an `i32` (NL2100, NL2117, NL2178,
  NL2231 and NL2236, with NL2021 in one program; the seven AWFY ports, the
  four map prototypes, the three `Map` measurements, par-alloc and
  par-histogram-atomic), because Nish has no implicit conversion between f64
  and i32.
- **One program compiles and computes something else.** With `main`
  annotated, strbuild prints `2410293` where it printed `806394`: its
  `(count + 31) / 32` is an integer division by default and a floating-point
  one under f64. result is still refused (NL2101, `&` on two f64).

**What it argues, for §5.3.** The sentence §5.3 was expected to get, "`--compat`
costs N× on integer-heavy code, within noise on the rest", has an N of about
1.1x to 1.2x from two programs. The larger finding is not a run-time one:
code that leaves an integer as a bare `number` beside an `i32` does not
compile under `--number-mode f64` until it is ported, so "`--compat` implies
`--number-mode f64`" would turn a strict program that mixes the two into one
`--compat` refuses, or (strbuild) one that prints a different answer. That
meets §1 rule 5, under which a strict program compiles to the same bytes with
the mode on, and S3's test holds the bare flag to exactly that today.
Whether §5.3 stands as written is the owner's question (§10). One machine,
one run.

### 7.9 S6, measured: landing pads against a `Result` desugaring

Three programs (a hot loop, a parser, a call chain), each as Nish compiles
`Result` today and as hand-written IR with `invoke` and `landingpad` over the
platform's Itanium unwinder and a personality of the spike's own:
[bench/wp28-s6/README.md](../bench/wp28-s6/README.md)
(`npm run build && node bench/wp28-s6/run.mjs --rounds 15`). 4 vCPUs of an
Intel Xeon at 2.30 GHz, Linux 6.18, glibc 2.39, clang and LLVM 18.1.3,
x86-64; 15 rounds, medians; a row's band is the `Result` binary against a
byte-identical copy in the same rounds. Each side is built inlined (as LTO
leaves it) and outlined (every function that can fail `noinline`). Ratios are
landing pads over `Result`.

| program | inlined | band | outlined | band |
| --- | ---: | ---: | ---: | ---: |
| hot loop, never throws | 0.98x (inside the band) | ±2.0% | 0.99x (inside the band) | ±2.6% |
| parser, never throws | 0.67x | ±3.9% | 0.94x | ±1.6% |
| parser, throws 1 in 1000 | 0.71x | ±2.1% | 0.99x (inside the band) | ±2.9% |
| parser, throws 1 in 100 | 0.98x (inside the band) | ±2.9% | 1.53x | ±5.3% |
| parser, throws 1 in 10 | 3.62x | ±3.8% | 6.70x | ±2.5% |
| call chain, unwinds 1 frame | 447.82x | ±6.2% | 367.28x | ±7.7% |
| call chain, unwinds 32 frames | 132.45x | ±0.8% | 111.97x | ±4.0% |

- **A failure costs landing pads two to three orders of magnitude more**:
  about 770 ns for a throw caught one frame up against about 2 ns, and about
  135 ns for each further frame against about 1.2 ns. The spike chose
  everything else to flatter landing pads (no allocation, an `i32` thrown, no
  cleanups, two shared objects), so these are their floor.
- **One row goes the other way: the inlined parser.** With nothing thrown,
  landing pads run it in 0.67x of the `Result` time, and in 0.71x at one
  failure in 1000. The README attributes most of that to the three-word
  `Result` return keeping `parseField` out of line, not to the checks; the
  outlined row, where both sides make the same calls, is 0.94x, and an
  earlier run put it inside its band. The parser breaks even at about one
  failure in 90 records inlined and one in 980 outlined.
- **Landing pads are larger**: each kernel grows in total (parse 624 to 898
  bytes), and the linked binary by 2.2 to 2.3 KB and a second shared library,
  `libgcc_s`.
- **Not every target has an unwinder.** Linux and macOS do. WASI and the
  freestanding wasm profiles do not, and the wasm backend lowers `invoke` to
  a plain `call`, so the `catch` is dropped without a diagnostic. On the
  native targets the release profiles build the C runtime without unwind
  tables, so a throw cannot cross a `runtime/*.c` frame, and every function
  that may throw or call something opaque loses `nounwind`.

**What it argues.** The spike recommends, for the owner to accept, that C5
lower `try`/`catch` to the `Result` desugaring. Its rule takes landing pads
only if they are faster outside the band in the outlined build both with
nothing thrown and at one failure in 1000, and every target has an unwinder.
The README says the recommendation stands on the second clause alone, the
targets without an unwinder: the first clause covers rows that disagree, and
read on the inlined build the parser would satisfy it. It names what the
rule gives up, the inlined parser's 0.67x, and what to measure first if C5's
programs show it (the `Result` ABI and the inliner's view of it). Frames with
cleanups (`finally`, a region released on the way out), a large binary,
AArch64 and macOS timings were not measured.

## 8. Declined, with the rule each one breaks

- **Tier 3 in any dialect** (§2.2). A tagged value needs a collector.
- **A user-storable `Promise<T>`** — wp24 §9.3, and §6.3's rule 2 is the
  checker's version of it.
- **`p.then(cb)` in strict** — wp24 §9.3 and [wp16-results.md](wp16-results.md):
  `Result` has no `map` for the same reason. In compat it follows from C2b.
- **A third, middle dialect** — two dialects plus a per-feature ratchet already
  is the gradient.
- **Running npm packages** (§4.1).
- **Matching Node's microtask semantics in general** — wp24 §4.7. §6.3
  identifies the fragment where they are unobservable and rejects the rest.
- **An M:N scheduler behind `--async-model`** — wp20 §1: a growable stack needs
  relocation, and relocation needs a precise GC.
- **Compat constructs in `src/`** (§4.4).
- **A flag per feature** (§5.2).

---

## 9. Risks

- **It is the largest package proposed here.** C0 and C1 are small; C2b onward
  is not, and the staging exists so that stopping after any stage leaves
  something coherent.
- **Two dialects and nobody writes strict.** Strict is the default, compat
  prints its bill on every build, the benchmark table is strict-only, `src/`
  may not use it, and the compat reference is a migration document.
- **The ratchet is never pulled.** The report leads with blast radius rather
  than a count so that an entry costing 3% and one costing 40% do not look
  alike.
- **§6.3's claim is wrong in a case nobody thought of.** It is stated as a
  claim with a rule, and the unmodified-Node run fails on it program by
  program.
- **Tier 4 swallows the package.** §4.1 is the answer and C-lib's position is
  the plan; the documentation has to say it before the flag does.

---

## 10. Open

- ~~**The flag's name.**~~ **Decided: `--compat`**, bare for every built
  feature and `--compat=<list>` for exactly those. Strict is the absence of the
  flag, so a strict build's command line and IR do not change.
- **Whether `async` belongs in compat at all**, or only as `--async-model
  threads`: that is, whether S2 retires C3. This note said a negative S2
  would argue for dropping C3 and keeping C4. S2 is measured (§7.5) and the
  owner has not decided. The figure: 53.6% to 64.7% of 2364 `async` functions
  are `async` by contagion, above half in each of four applications and by
  less than a point in two. The two readings:
  - *It is not the negative result, and C3 has a case.* Contagion is the
    majority everywhere it was counted, 94.7% of `await`s are on a direct
    call, where the threads model is a call with extra steps, and only 3.0%
    are on the `Promise.all` family, where it has something to add.
  - *It does not carry C3 either.* Two of the four margins are inside the
    census's own undercount of need. Only 8.6% to 25.2% of `async` functions
    sit on chains that end inside the program, so for the rest erasure leaves
    a program that still wants a library that is missing. And strict now
    accepts `async` under §6.3's two rules (§6.2), so what C3 would add is the
    shapes strict refuses (an `async` method, 30.7%; an inferred return type,
    56.3%), not the keyword.

  S4 bears on the C4 half: the fork pays above a task of about 16 µs and
  costs up to 9.4x below it (§7.7).
- **Whether `--compat` implies `--number-mode f64` as §5.3 has it.** S5
  (§7.8): the mode costs nothing measurable where a program compiles as
  written and 1.10x to 1.19x on two integer-heavy programs, but 20 of the 34
  benchmark programs are refused under it as written and one prints a
  different answer once it compiles. A strict program that mixes a bare
  `number` with an `i32` would not survive the implication, which §1 rule 5
  does not allow for a program that uses no compatibility construct. The bare
  `--compat` built today implies nothing.
- **Which lowering C5 uses.** S6 (§7.9) recommends the `Result` desugaring,
  for the owner to accept. The recommendation rests on WASI and the
  freestanding profiles having no unwinder; a throw costs about 770 ns
  against 2 ns; and one row, the inlined parser that never throws, goes the
  other way at 0.67x.
- **How C4 decides which `Promise.all` to fork.** S4 (§7.7) found the
  break-even at about 15.9 µs a task on one machine and left the rule
  unanswered: a fork on every non-interfering `Promise.all` loses on the
  small ones.
- **Whether the compat ceiling should be per-dependency.** §3 takes the simple
  rule; nobody has met the vendored dependency that would argue against it.
  No spike measured it.
- **What `--emit-dts`, `--emit-header` and `--emit-napi` do with a compat
  program.** A closure has no C spelling. Probably strict-only with a
  diagnostic, but that is a decision not made here. S3's test (§7.6) already
  compiles every case under its own `.args` with and without the flag, so a
  case that names an emitter holds whatever is decided.
- **Whether the compat reference is a document or a section.** Not in
  LANGUAGE.md, which is normative for strict.
- **Whether `--number-mode` should be per-module.** [wp26-stdlib.md](wp26-stdlib.md)
  §4 found that a `std/` module has to care, and a mixed-dialect program makes
  that sharper. S5's refusals (§7.8) are this question met in the benchmark
  suite: a program-wide f64 reaches every module that spells an integer as a
  bare `number` beside an `i32`.

---

## 11. Appendix: S1's programs

None of this is a test case: it is a spike, using the language and toolchain as
they were. Each program prints its result, and all six binaries print the same
number, which is the only correctness check a spike of this shape needs.

**11a, the call, direct.** `transform` is a small pure function called once per
iteration with a serial dependency through `acc`, so the loop has no closed
form and the call cannot be hoisted — the shape of `xs.reduce(cb)`.

```ts
function transform(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ (x * 1103515245);
  return ((m >> 13) ^ m) + 1;
}

function run(n: i32): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    acc = transform(i, acc);
  }
  return acc;
}

export function main(): i32 {
  console.log(`${run(400000000)}`);
  return 0;
}
```

**11b, opaque to the fixpoint.** The same program with
`declare function transform(x: i32, acc: i32): i32;` and the body moved to C, in
the LTO unit — which isolates the *fact loss* from the *codegen loss*.

**11c, truly indirect.** 11a's `.ll` with the one call site rewritten to
`%fp = load i32 (i32, i32)*, i32 (i32, i32)** @transform_fp` and
`call i32 %fp(...)`, and a C half whose `__attribute__((constructor))` installs
one of two targets chosen by `getenv`, so LTO cannot fold it back.

**11d, the array shape.** 11a to 11c with the loop holding a 1,024-element
`i32[]` and the callee taking one element per call, 400,000 rounds — the shape
WP15 §2b's alias domains are about, since an unknown callee could store through
`xs` or grow it.

**11e, the allocation shape.** `p` provably does not outlive `run`, so WP6
turns the `new` into one entry-block `alloca`; `--no-stack-alloc` forces it to
the arena, which is what an object reachable from an unknown callee would
need.

```ts
class P {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

function use(p: P): i32 {
  return (p.x * 3) ^ (p.y + 1);
}

function run(n: i32): i32 {
  let acc: i32 = 1;
  for (let i: i32 = 0; i < n; i++) {
    const p = new P(i, acc);
    acc = use(p) + 1;
  }
  return acc;
}

export function main(): i32 {
  console.log(`${run(200000000)}`);
  return 0;
}
```

**11f, built and run**, each with `scripts/build.sh … --profile speed`: 11a
with `runtime/runtime.c`, 11b with its C file, 11c with its function-pointer C
file, and 11e twice, as compiled and with `--no-stack-alloc`.
