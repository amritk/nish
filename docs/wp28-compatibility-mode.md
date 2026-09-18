# WP28: Compatibility mode, and what `async` means in each dialect

**Proposed. Nothing here is built, and one of its two gating measurements has
been taken (§7.4).** This is the plan of record for two questions that arrived
together and turn out to be one question:

1. Should there be a mode that accepts most of ordinary TypeScript, so that a
   team can port a codebase first and buy the performance back afterwards, one
   construct at a time?
2. If it exists, does `async`/`await` belong in it — and is there a second
   answer that gets the parallelism JavaScript's `async` was invented to fake?

The answer to both is yes, with a rule attached in each case, and the rules are
what make this a plan rather than a wish. [LANGUAGE.md](LANGUAGE.md) stays
normative for the language; where this note and LANGUAGE.md ever disagree,
LANGUAGE.md wins. Read [wp24-async.md](wp24-async.md) and
[wp20-threads.md](wp20-threads.md) first: §6 here does not overturn wp24's
refusal, it finds the one condition under which the refusal does not apply, and
it uses wp24's own load-bearing finding to do it.

---

## 1. The decision

**Build the mode. Make it a porting aid with a proof obligation, not a second
language.** Five rules, and every later section is one of them worked out:

1. **Strict is the default, stays normative, and does not grow.** Compatibility
   mode may only ever *add* acceptance. It changes no rule of the language that
   `docs/LANGUAGE.md` states today.
2. **A construct may enter compatibility mode only if every value's layout
   stays fixed at compile time.** That is the whole line, and §2 shows it
   sorts the entire remaining surface of TypeScript into two piles without a
   judgement call. Anything that needs a tagged value or a tracing collector is
   refused in every dialect, permanently: that is writing a JavaScript engine,
   and MASTER_PLAN §1's fourth bullet refuses it from the other direction
   already.
3. **Every compatibility construct prints its bill.** Each one costs a proof
   the whole-program fixpoint was making, and the compiler says which, where,
   and what the rewrite is. The diagnostic class for this **already exists** —
   `performance`, WP15 item 2, `PerformanceWarning` in `src/diagnostics.ts`,
   the `NL9xxx` band, `--json`, `--no-warn-performance`. No new class is
   needed, and that is the single cheapest thing on this page.
4. **The ratchet is one list, not one flag per feature.** `--compat=<features>`
   is an allow-list that a team narrows in version control until it is empty
   and the flag is deleted. §5.
5. **The erasure invariant is a test, not a promise.** Every program in the
   corpus, compiled with the mode switched on and no compatibility construct
   used, must emit **byte-identical IR** — and every one of the 437 `reject_*`
   cases whose construct the allow-list does not name must still reject, with
   the same code and the same words. Both halves run against what is already
   there, which makes the mode provably a no-op until somebody uses it, and it
   is the cheapest guard against this package's worst failure mode: a dialect
   flag that quietly changes the strict language.

One sequencing decision belongs here rather than only in §7.3, because it
changes which half of §6 gets built: **the threads come first.** WP20's T1 and
T2 — `Thread.spawn`, `join`, the shareable-type rule — are built as a language
surface of their own, with their own diagnostics, before any `await` is lowered
onto them, and the payoff that justifies them is now measured rather than
hoped: 3.76x on four cores for a compute kernel at 94% efficiency
([wp20-threads.md](wp20-threads.md) §8). The compat `async` of
§6 is notation over that engine, and notation is the wrong thing to design an
engine through — T2's shareable-type rule is the stage wp20 §4 says to
prototype against a real program, and a keyword that hides it is not a real
program.

And the thesis, because it is the argument for the whole package and it is not
the obvious one:

> **Compatibility mode is what lets strict mode stay small.**

[wp23-language-surface.md](wp23-language-surface.md) declined `?.`, a string
`switch` and `for...of` over a string, and each refusal is correct *as a
language decision*: none of the three adds expressiveness, and every one of
them is a second way to say something the language already says. But every one
of them also appears in ordinary TypeScript that somebody has already written,
and rejecting it is the difference between a two-hour port and a two-week one.
Today those two facts fight, and the project resolves the fight by saying no —
which is right, and which also means the language is perpetually one refusal
away from being unusable for a migration. A dialect separates them: strict
keeps saying no to surface growth, compatibility says yes to code that already
exists, and neither decision has to be made on the other's behalf again.

---

## 2. The line: representation, not difficulty

The temptation is to sort TypeScript's remaining surface by how hard each
construct is to compile. That sort is useless — it changes every time somebody
gets clever, and it gives no rule a reviewer can apply. The sort that works
asks one question:

> After this construct, can the compiler still name the layout of every value
> in the program?

If yes, the construct costs *analysis* — some attribute the fixpoint was
proving becomes unprovable, some allocation that was an `alloca` goes back to
the arena — and the cost is measurable, local, and reportable. If no, the
construct costs *the object model*: every value becomes a tagged word, every
field access becomes a lookup, and the collector arrives about four minutes
later. There is no partial version of the second one.

| Tier | What it is | Where it goes | Why |
| --- | --- | --- | --- |
| **1 — Static** | what compiles today | strict | — |
| **2 — Compatible** | fixed layout, weaker proofs | **compat** | the cost is attributes and allocation, both measurable and both local to the construct |
| **3 — Dynamic** | requires a tagged value or a tracing GC | **refused in every dialect, permanently** | MASTER_PLAN §1 bullets 1 and 3, and non-goal 4 |
| **4 — Absent library** | syntax is fine, the *API* does not exist | neither: it is WP26 and WP18 work | a mode flag cannot conjure `Map`, `RegExp` or `fetch` |

Tier 4 is the row that keeps this note honest, and §4.4 is about nothing else.

### 2.1 Tier 2, the candidates

Each row is admissible; none is free. "Costs" is what the whole-program pass
stops being able to prove, which is what the `performance` warning will say.

| Construct | Why strict rejects it | Compat lowering | Costs |
| --- | --- | --- | --- |
| optional and default parameters | one arity per signature | callee-side default, arity fixed at each call site | nothing measurable |
| `?.` and `??` on nullables | wp23 §9: a second spelling of a narrowing the language has | the narrowing it already compiles to | nothing |
| string `switch` | wp23 §8 | a chain of content comparisons, or a length-bucketed tree | nothing the `if` chain does not cost |
| `for...of` over a string | wp23 §7 | the byte loop the note describes, with the UTF-8 rule stated | nothing |
| labelled `break` / `continue` | no rule; nobody asked | a branch to a named block | nothing |
| overload signatures | one signature per name | monomorphised per implementation | nothing at runtime |
| `try` / `catch` / `throw` | WP16: a failure is a `Result`, and nothing unwinds | either landing pads, or a desugaring to `Result` with implicit propagation | **large** — `nounwind` comes off every function in the module, and §7 says why the choice between the two lowerings must be measured before it is made |
| **function values and closures** | Phase 0: the fixpoint cannot see through an unknown callee | an indirect call, and closures as a captured-environment struct with fixed layout | **the big one** — every attribute the callee would have contributed is dropped at the call site, and nothing reachable from the call can be stack-allocated. §7's first spike prices it |
| `async` / `await` | wp24 | §6 — three lowerings, one rule | §6.3 |
| generators as iterators | wp24 §7 | the rustc-shaped state machine of wp24 §3b: a struct, a one-byte discriminant, a `switch`, no allocation | a frame per live generator; the same "does it escape" question `escape.ts` already answers |
| `extends` with virtual dispatch | wp25: dispatch is static, and a vtable is an indirect call the fixpoint cannot see through | a vtable | exactly the function-value cost, so it lands after it and not before |
| mutable module-level state | wp23 §4, and WP21's flat namespace | a module-private global | the fixpoint's `readnone`/`readonly` on anything that touches it |

### 2.2 Tier 3, refused permanently

`any` and `unknown` in value positions, adding or deleting a property that was
not declared, `eval`, `Function`, `Proxy`, `Reflect`, `with`, prototype access
and mutation, `arguments`, computed property names over open key sets,
`Object.assign` onto a typed value, `symbol` as a key, structural duck typing
resolved at run time, and `JSON.parse` returning a shape nobody declared.

These are not a harder tier of the same work. Each one requires that a value
carry its type at run time, which requires a tagged representation, which
requires a collector for the boxes, which is the first thing MASTER_PLAN's
vision spends. A "compatibility mode" that accepted them would not be a mode;
it would be a second compiler for a different language, sharing a flag.

**This is the sentence a user of the mode has to read first**, because "most of
regular TypeScript" means something different to the person asking than it does
here: the mode accepts most of the *statically typed* TypeScript people write.
It accepts none of the dynamism, and no amount of staging gets there.

---

## 3. What the mode is, precisely

Three properties, all testable.

**It is additive.** Compatibility mode never changes the meaning of a program
that compiles today. The test is §1's erasure invariant: the corpus compiles to
byte-identical IR with the mode on. One exception is deliberate and is the
subject of §5.3 — `number` — and it is an exception the flag surface has to
make loud rather than quiet.

**It is priced, per construct, at the site.** A compat construct is not a
silent degradation. It emits a `performance` diagnostic in the existing class:

```
warning[NL9xxx]: `sort(items, compare)` passes a function value
  --> src/table.ts:88:22
   = 2 allocations reachable from this call move from the stack to the arena
     (`Row` at table.ts:64, `Key` at table.ts:71) -- measured at up to 8.8x
     per object on an allocating loop (wp28 §7.4)
   = the call cannot be inlined: about 1.3x on the loop it sits in
   = `readonly` and `willreturn` are dropped from 3 transitive callers
   = rewrite: make `compare` a top-level function and call it directly
```

The order of those lines is the order S1 measured (§7.4) and not the order this
note first guessed: the arena is the expensive one by a factor of six, and the
attribute loss — which is what a compiler author reaches for first — was worth
nothing at all on the shapes tested.

`--json` over that class is the migration dashboard, and it is a dashboard the
project already ships the plumbing for. The interesting number is not the count
but the *blast radius*: how many functions lost a proof because of this one
site. That is a query the fixpoint can answer and a reviewer cannot.

**It is bounded by the root package.** WP21 compiles a Nish dependency from
source into the consumer's program, so a dependency's dialect is the
consumer's problem: a compat construct in a library degrades the application's
attributes. One rule handles it without a new flag — **the root package's
allow-list is the whole program's ceiling.** A dependency may use fewer
features than the root allows, never more, and a violation names the
dependency, the module and the feature. An application that has ratcheted to
strict cannot silently acquire a closure through a package bump.

---

## 4. What this does not buy, said early

### 4.1 The syntax is not what blocks the port

A Node codebase that cannot use `?.` is annoyed. A Node codebase that cannot
use `Map`, `Set`, `RegExp`, `Date`, `JSON.parse`, `Buffer`, `fs.promises`,
`http` or a single npm dependency cannot be ported at all. Tier 4 is where
almost every real migration actually stops, and a compatibility mode that
admits `async` while `Map` does not exist admits nothing anybody can use.

So the honest shape of the package is the same shape wp24 found for async: the
*flag* is cheap and the *surface behind it* is the work. Two consequences for
the staging in §7:

- The library tier is not an afterthought to the syntax tier; for a real port
  it outranks most of it. It is also newly reachable: generic classes and
  interfaces are monomorphised as of this month, which is exactly what a
  `Map<K, V>` needed and what [wp18-generics.md](wp18-generics.md) §16 ordered.
- npm packages are out, and not by staging. A published package is JavaScript,
  and the Nish consumer path takes *source* in a statically typed subset
  ([wp21-packages.md](wp21-packages.md) §2). Nothing in this note changes that.

### 4.2 It is not a performance promise in reverse

Compatibility mode is slower than strict — that is the point, and it is why
each construct is priced. What it must never become is a mode where the
slowdown is unattributable. If the report cannot say which construct cost
what, the migration story collapses into "it got slower somewhere", and the
whole package was for nothing. §7's first spike was run to find out whether the
attribution is even possible for the function-value tier: it is, because the
blast radius is exactly the transitive caller set of the opaque callee and the
checker already builds that graph (§7.4). What the spike also found is that the
report's *order* matters more than its completeness, because the three costs it
would list differ by a factor of six.

### 4.3 It is not a second freeze

M4 freezes the language reference. Compatibility mode adds no rule to it, so
M4 is not waiting on this note and this note is not waiting on M4. Compat's
own reference is a separate document with its own version line and an explicit
statement that it may churn: it is a migration surface, not a language.

### 4.4 It is not for `self/`

`self/` may never use a compatibility construct, for the same reason the
rolling freeze exists: stage1 must be compilable by the previous release's
seed ([wp19-stage0-retirement.md](wp19-stage0-retirement.md) G4). CI's
`bootstrap` job already checks the shape of this; the compat ceiling of the
root package makes it one line.

---

## 5. The flag surface, re-thought

### 5.1 What is wrong with it today

Twenty-three options before `-h` and `-v`, and the problems are structural
rather than cosmetic:

- **No axis is visible in a name.** `--plain`, `--wrapping`, `--threads` and
  `--unchecked-indexing` all read alike. Two of them change what a program
  *means*, one changes how fast it goes, one changes the runtime it links
  against. Nothing in the spelling says which.
- **Meaning-changing flags are invisible in the artifact.** Two `.ll` files
  from the same source under `--number-mode i32` and `--number-mode f64` are
  different programs, and nothing in either file says so.
- **Meaning-changing flags are per-invocation, and compilation is
  whole-program.** WP21 makes this acute: a dependency compiled into your
  program inherits your `--wrapping` and your `--number-mode`, whether or not
  its author ever tested that combination.
- **Boolean pairs multiply.** `--strict-exports` / `--no-strict-exports`,
  `--nsw` / `--wrapping`, and a dozen compat features would make a dozen more.

### 5.2 The proposal

**Three axes, named in `--help`, and every flag belongs to exactly one.**

| Axis | Question it answers | Flags |
| --- | --- | --- |
| **Dialect** | what does this source *mean*? | `--compat`, `--number-mode`, `--wrapping`, `--async-model` |
| **Build** | how is it made? | `--profile`, `--target`, `--link`, `--plain`, `--no-stack-alloc`, `--unchecked-indexing`, `--threads`, `--no-strict-exports` |
| **Output** | what is written? | `-o`, `--emit-header`, `--emit-dts`, `--emit-napi`, `--emit-napi-async`, `--runtime-decls`, `-g`, the dumps |

Diagnostics (`--json`, `--no-warn-performance`) is a fourth, small and already
coherent.

**One dialect flag, with an allow-list.**

```
(no flag)                   strict: the default, and what every benchmark measures
--compat                    every tier-2 feature that is built
--compat=closures,async     exactly these; everything else still rejected
```

The third form is the user-facing answer to "disable them one by one". It is
one flag rather than twelve, the list is a fact about the project rather than
about one command line, and the thing a team does over a migration is delete
entries from it. A rejected construct names the feature that would admit it:

```
error[NL1021]: `async` functions are forbidden in Nish (no event loop or promises)
  = this program's dialect is `compat=closures`
  = add `async` to `nish.compat` in package.json to accept it, at the cost the
    `performance` class will then report
```

**The list lives in `package.json`, not only on the command line.** WP21
already puts a `nish` export condition there; `nish.compat` belongs beside it,
as `true` for every feature or an array for exactly some. That is where a ratchet has to live to be reviewable: the
diff that removes `"async"` from the list is the migration, and CI enforces it
for free. The CLI flag overrides for a one-off build.

**The dialect is recorded in the artifact.** A `!nish.compat` named metadata
node in every emitted module, and a line in `--emit-checked` — absent, like the
flag, for a strict build, so no existing golden moves. It costs one
line of IR, it makes a golden pin the mode, and it means a linked binary can
be traced back to the rules it was built under. Everything on the Dialect axis
goes in it, `--number-mode` included — which closes the second bullet of §5.1
for flags that predate this note.

**Renames, with the old spelling kept for one minor.** `--plain` says nothing
about what it does; it is `--no-attributes`. That is the only rename worth the
churn — the rest of the surface is fine once it is *grouped*, and grouping is
a `--help` change plus this table.

### 5.3 The one place compat must change meaning: `number`

`number` in TypeScript is a double. In Nish it is `i32` by default, and
`--number-mode f64` is the opt-in. For a compatibility mode that is backwards
and it is not a small point: a ported codebase whose arithmetic silently
truncates at 2³¹ is exactly the failure [wp13-differential.md](wp13-differential.md)
exists to catch, and it is a *quiet* failure — the program runs and the number
is wrong.

**So `--compat` implies `--number-mode f64`**, and an explicit
`--number-mode i32` beside it is an override that the `performance` class
reports as the divergence it is. This resolves MASTER_PLAN §3.4's oldest open
row in the only way that is defensible once two dialects exist: **`i32` in
strict, `f64` in compat**, and moving from one to the other is a step on the
ratchet with a measurement attached rather than a default nobody chose.

It is also the exception to §3's additivity, which is why it belongs in the
flag section rather than buried: the mode changes what an existing program
means, loudly, on the one axis where being quiet would be dangerous.

---

## 6. `async`, in three dialects

### 6.1 What JavaScript's `async` actually is

A workaround for one thread and blocking I/O. It buys *concurrency* —
interleaved progress on a single core — and it cannot buy *parallelism*,
because there is one thread and the whole design exists to keep it. Nish has
neither constraint: it compiles to native code with real threads
([wp20-threads.md](wp20-threads.md)), and it has no event loop to protect.

So the syntax and the engine underneath it are separable, and this compiler is
not obliged to copy an engine built to work around a problem it does not have.
That separation is what the rest of this section works out: the `async` a
programmer wrote is kept as *notation for sequential suspension*, and what runs
underneath it is chosen by a flag rather than by JavaScript's history.

### 6.2 One source text, three lowerings

| | `await f()` | `Promise.all([f(), g()])` | concurrency | parallelism |
| --- | --- | --- | --- | --- |
| `--compat --async-model sync` (the default under `--compat`) | call `f`, use the result | `f` then `g`, sequentially | none | none |
| `--compat --async-model threads` | spawn `f`, join at the `await` | spawn both, join both | yes | **yes** |
| strict (no `--compat`) | rejected, as today | rejected | — | `Thread`, `parallelFor` (WP20 T1–T4) |

Same source. Three engines. The ladder in §7.2 is what a team walks.

### 6.3 Why the erasing lowering is honest here, and wp24's refusal survives

[wp24-async.md](wp24-async.md) §7 refuses `async` as an erased no-op keyword,
and the refusal is right: erasure makes a program mean something different
under Node than it does here, in the one direction `tests/differential/` exists
to prevent. This note does not overturn that. It finds the condition under
which the difference does not exist, and the condition comes from wp24's own
load-bearing finding.

**wp24 §2: there is nothing to await.** No timer, no sleep, no poller, no
socket, in either compiler or either runtime. That finding is the reason wp24
declines to *build* async. It is also, read the other way, the reason erasure
can be exact — because a JavaScript `await` only changes the observable order
of a program when some *other* pending continuation exists to run in the gap
the yield opens. If no such continuation can exist, the gap is empty and eager
evaluation and microtask evaluation produce the same sequence of effects.

> **Claim.** For programs this language can express, eager synchronous
> evaluation of an `async` function is observationally identical to
> JavaScript's whenever no two promises are simultaneously live.

That direction is the paragraph above: one live promise means an empty queue at
every yield, so there is nothing for the yield to let through. The converse is
*nearly* true and the gap is exactly §6.4's — two live promises diverge unless
neither call can observe the other — so the rule below is sufficient rather
than necessary, and §6.4 is the one exception it admits by proof rather than by
syntax. Here is the divergence the rule has to reject:

```ts
const p = slow();      // starts, runs to its first await, yields
console.log("a");      // under Node this runs BEFORE the rest of slow()
const r = await p;     // eagerly, "a" would print after all of slow()
```

Two live promises, and the order diverges. So the rule that implies the claim
is a syntactic one, checkable in the checker with no new analysis:

1. `await` applies directly to a call expression — `await f(x)`, never
   `await p` where `p` is a variable, a field, an element or a parameter.
2. A call to an `async` function is awaited in the expression that makes it.
   No fire-and-forget, no storing a promise, no returning one to a synchronous
   caller.

Together: at most one promise is live at any point, so erasure is exact.
Every program the rule rejects either would have diverged, or is §6.4's case
and is re-admitted there by a proof — so the refusal is wp24's, narrowed to
the programs that earned it and carrying a line number and a rewrite instead of
a blanket no to the keyword.

And this is [wp24-async.md](wp24-async.md) §9.3 arriving from the other side.
That section concluded that if async is ever built, `async`/`await` survive and
the promise as a first-class value does not. Rule 1 and rule 2 *are* that
conclusion, stated as a checker rule: a promise you cannot store is a promise
that cannot be simultaneously live with another one.

**The claim is falsifiable and the harness to falsify it exists.** Every compat
program with `async` in it goes in `tests/differential/`, and the match is on
stdout *including the order of the prints*. If the rule is wrong, it fails
loudly and program by program, which is the standard this repository holds a
semantic claim to.

### 6.4 `Promise.all`, and the analysis that pays twice

`Promise.all([f(), g()])` has two live promises, so §6.3's rule rejects it —
correctly, because eager sequential evaluation would run all of `f` before any
of `g`, and Node would interleave them at their `await` points.

Unless neither call can tell. If the whole-program fixpoint proves `f` and `g`
do not interfere — `readnone` or `readonly`, or writes through provably
disjoint pointers — then no interleaving is observable, and both orders are
the same program. `src/codegen/attributes.ts` computes this today for other
reasons.

Two things fall out, and the second is the best technical result on this page:

- Under `--async-model sync`, a non-interfering `Promise.all` over direct calls
  is admitted and runs sequentially, because nobody can tell.
- Under `--async-model threads`, the *same expression* over the *same proof*
  becomes a real fork/join across cores. Non-interference is what makes eager
  evaluation unobservable, and non-interference is also — almost exactly —
  WP20 T2's shareability rule. **One analysis, two payoffs**, and the second is
  parallelism that the JavaScript original could never have delivered, from
  source the author wrote for a single-threaded runtime.

That is the concrete answer to "is there a mode that does the multithreading
properly instead". The efficient one is not a different syntax; it is a
different engine under the syntax people already wrote, gated by a proof the
compiler already makes.

### 6.5 `--async-model threads`

`await f(x)` becomes spawn-and-join, which for a single live promise is a call
with extra steps — so the model is only interesting where §6.4's rule admits
more than one, and it rides WP20 T1 and T2 rather than adding machinery. It
inherits both of their limits without softening either: the entry is a named
top-level function (free — there are no function values in strict, and a compat
closure is not shareable), the argument must be shareable, and the handle
cannot escape the frame. A call that fails T2 is not silently sequential; it is
a diagnostic that names the field that disqualified the type, in the voice
wp20 §5 sets for exactly this message.

This is why WP20 T1 and T2 are a prerequisite for this row rather than a
parallel track, and why C4 in §7.3 is gated on that note rather than on this
one.

### 6.6 What compat `async` does not buy

`setTimeout`, `fetch`, `fs.promises`, `await` on anything outside the program:
these do not exist, and they are missing *library*, not missing syntax. wp24's
A2 gate — sockets, timers, a poller, and the runtime-budget conversation that
comes with them — is untouched by every word above. A ported server still has
nothing to run on.

What it does buy is the common case, and it is common enough to justify the
row: **most application TypeScript is `async` by contagion rather than by
need.** One leaf did I/O once, the colour propagated to every caller
(wp24 §4.2 lists that propagation as a *cost* of building async), and now four
hundred functions are `async` and two of them ever suspend. In Nish the colour
has no semantics behind it at all, so erasing it is a whole-program
decolouring — and wp24 §4.2's cost is this note's asset. That is the measurement
§7's second spike exists to take before anyone believes it: on a real
TypeScript application, how many `async` functions await something that could
actually block?

---

## 7. Staging, and what must be measured first

### 7.1 The spikes, before any of it

In the house style: the note that proposes something measures the thing its
argument rests on, and this note has not, because nothing here is built yet.
These are the measurements that decide whether the staging below is worth
starting, in the order they would change the answer.

| | Spike | What it decides |
| ---: | --- | --- |
| S1 | **done — §7.4.** One opaque callee in a hot loop, three ways: as a `declare`d C function (opaque to the fixpoint, visible to LTO), as a true indirect call through a pointer installed at run time, and as the escape analysis it forfeits | priced the entire function-value tier, and moved the headline: the call is worth 1.26x–1.40x and the *escape analysis* is worth 8.8x |
| S2 | on a real TypeScript application, count `async` functions against `async` functions that await something that can block | decides whether §6.6's decolouring is the common case or a story |
| S3 | the erasure invariant, run against the corpus with a feature-less `--compat` | it is C0's acceptance test, and it is runnable the day the flag parses |
| S4 | `Promise.all` over two non-interfering calls under `--async-model threads`, against WP20 T4's `parallelFor` on the same work | decides whether §6.4's second payoff is real or a rounding error |
| S5 | the benchmark suite under `--number-mode f64` | prices §5.3, which is the one thing compat changes about an existing program |
| S6 | `try`/`catch` by landing pads against `try`/`catch` desugared to `Result` with implicit propagation, on the same program | the two lowerings have very different costs and the choice should not be made on taste |

S1 and S2 were the two that could stop the package. S1 has run (§7.4) and did
not stop it, but it did change what the mode has to report and in which order
the stages are worth building. S2 is unrun.

### 7.2 The ladder a team walks

The product, stated as the sequence a migrating team actually experiences,
because it is what the staging has to serve:

1. `--compat` — it compiles. Slower than strict, with a report saying exactly
   where and why.
2. Ratchet `nish.compat` down, guided by the report's blast-radius numbers.
   Highest cost first, which is the ordering the report exists to give.
3. `--async-model threads` — the same source gets parallelism it never had
   under Node. This is the step where the migration stops being a tax and
   starts paying.
4. A codemod erases the now-meaningless `async`/`await`, the list is empty, and
   the flag comes off. The repository already has codemod machinery from the
   stage C rewrite.

Step 3 is the one worth designing the whole package around. Every other step
is a team paying down a debt; that one hands them something the original
runtime could not do.

### 7.3 The stages

| | Stage | Contents | Size |
| ---: | --- | --- | --- |
| **C0** | the machinery, zero features | `--compat`, the allow-list, `nish.compat` in package.json, `!nish.compat` in the IR, the `--help` regrouping of §5.2, the compat half of the `performance` class, and S3 as its acceptance test | S. Provably a no-op, and every later stage becomes an entry rather than a redesign |
| **C1** | the free tier | optional and default parameters, `?.`, `??`, string `switch`, `for...of` over a string, labelled break/continue, overload signatures — each a wp23 refusal reversed *in compat only*, each checker-only | M |
| **C-lib** | the library tier | `Map`, `Set`, `Date`, `JSON`, `RegExp`, `Buffer`, on WP18's monomorphised generic classes and WP26's rules | L, and per §4.1 it outranks most of what follows for a real port |
| **C2a** | callbacks whose callee is statically known | wp23 §6's compile-time function parameter: an arrow at the call site or a function passed by name, monomorphised into the caller | M, and **free at run time** (§7.4). Covers most of what a migrating codebase spells with a callback: `.map`, `.filter`, `.sort(cmp)` |
| **C2b** | function values proper | a value whose target the checker cannot name: the indirect call, the captured-environment struct, and the escape proof it forfeits | L, and the expensive one — 1.26x for the call and up to 8.76x for what it does to WP6 (§7.4). `.then` and a callback in a field are downstream of this, not of C2a |
| **C3** | `async`/`await`, `--async-model sync` | §6.3's two rules, the erasure, §6.4's non-interference admission, and the differential cases that hold it | M. **After WP20 T1 and T2**, not just after C2b: the sequencing in §1 is a decision, and S2 may yet retire this stage in favour of C4 alone |
| **C4** | `--async-model threads` | §6.5, riding WP20 T1 and T2 | M, and gated on WP20 rather than on this note. This is the stage the whole ladder is for (§7.2 step 3) |
| **C5** | exceptions | whichever lowering S6 chose | L |
| **C6** | generators as iterators | wp24 §3b's shape | M |
| **C7** | `extends` with virtual dispatch | wp25 reversed in compat only; the vtable is an indirect call, so it costs exactly what C2 costs and lands behind it | M |

C0 is worth doing on its own merits even if the project never builds C1. It
makes the flag surface coherent (§5), it puts the dialect in the artifact, and
it converts every future "should we accept X" from a language argument into a
one-line entry in a list — which is the thing this note is actually for.

---

### 7.4 S1, measured — and the headline it moves

Five programs, in §11, on the machine §8 of
[wp20-threads.md](wp20-threads.md) describes; best of seven, variants
interleaved run by run. The instrument is wp27's `declare function`, which
gives a genuinely attribute-less callee inside the language as it is today, and
a hand-edited call through a function pointer the C half installs at run time,
which gives a callee LTO cannot see either — the position a closure's code
pointer is actually in.

**What one opaque callee does to the fact table**, on a four-function program
whose every function is pure in the baseline:

| | baseline | with the callee opaque |
| --- | --- | --- |
| the callee | `nounwind willreturn readnone` | `nounwind` (it is a `declare`) |
| its caller, `run` | `nounwind willreturn readnone` | `nounwind` |
| *its* caller, `nish_main` | `nounwind willreturn` | `nounwind` |

So the blast radius is the **transitive caller set**, entire, and it reaches
the program entry from one leaf. That is computable from the call graph the
checker already builds, which answers §4.2's question — the cost is
attributable — and it is the *only* part of S1 that came out as predicted.

**What it costs, measured:**

| Shape | callee known | opaque to the fixpoint, in the LTO unit | truly indirect | ratio |
| --- | ---: | ---: | ---: | ---: |
| a serial hash chain, 400M calls | 489 ms | 490 ms | 616 ms | **1.26x** |
| the same call inside an array loop, 1,024 elements × 400k rounds (`xs.reduce(cb)`) | 543 ms | 542 ms | 760 ms | **1.40x** |

| Shape | object proved local (today) | object not provable | ratio |
| --- | ---: | ---: | ---: |
| one 8-byte object per iteration, 200M iterations | 137 ms | 1,200 ms | **8.76x** |

Three findings, and the third is the one that moves the plan:

1. **The frontend's own attributes, in isolation, are worth nothing on these
   shapes.** 490 ms against 489, and 542 against 543. Losing `readnone` and
   `willreturn` on every transitive caller cost *zero*, because the callee was
   still inside the LTO unit and LLVM re-derived what it needed. The existing
   `tests/cases/ffi_scalar` already records the attribute loss; what it could
   not say is that the loss alone is free. A reader should not conclude the
   fixpoint is worthless — WP15 §1a measured 1.63x to 3.96x from alias facts on
   array loops — only that *these* two facts, lost this way, are not what a
   closure charges you.
2. **The call itself is worth 1.26x to 1.40x**, and that is the honest price of
   a `.map`/`.reduce` callback in a hot loop: real, survivable, and roughly
   what an experienced reader would guess.
3. **The escape analysis is worth 8.76x, and that is the whole story.** Where
   the object is provably local today, WP6 turns it into an entry-block
   `alloca` and LLVM then removes it entirely — 137 ms for 200M iterations is a
   loop with no object in it at all. An unknown callee cannot be given that
   proof, so the object goes back to the arena and 200M bump allocations
   arrive. Nothing else in this note is within a factor of six of that number.

**What that changes.** §3's sample diagnostic leads with the attribute loss and
mentions the arena second; it is the wrong way round and has been corrected
there. The compat report must lead with **"this object moved from the stack to
the arena, and here is the call that took the proof away"**, because that is
where the time goes, and it must say so for every object reachable from the
call rather than for the call alone. It also splits C2 in two, along a line
another note has already drawn. Where the callee is *statically known* — an
arrow written at the call site, `xs.map(x => x * 2)`, or a named function
passed by name — nothing above applies: the call is direct, the callee inlines,
the escape proof survives, and the cost is zero. That case is
[wp23-language-surface.md](wp23-language-surface.md) §6's compile-time function
parameter, designed there and explicitly not a relaxation of function values,
and it covers most of what a migrating codebase spells with a callback. The
expensive case is the *other* one — a function value stored in a field, an
element or a variable, whose target the checker cannot name — and that is where
1.26x and 8.76x live. **So C2's first deliverable is the known callee, and
function values in general are a separate stage behind it**, because the two
differ by a factor of nine and a report that cannot tell a user which of the
two they wrote is not worth printing.

One caveat, stated because the number is large: `--no-stack-alloc` is the
instrument for the third row, and it disables the analysis program-wide, while
an opaque call disables it only for what the call can reach. In this program
those are the same set. The 8.76x is therefore an honest per-object figure and
not a program-wide multiplier, and how much of a real program is reachable from
its closures is the measurement C2 has to take before it ships.

## 8. Declined, with the rule each one breaks

- **Tier 3 in any dialect** — §2.2. A tagged value needs a collector and
  MASTER_PLAN §1 spends that budget in its third bullet. This is the one
  refusal that no staging reaches.
- **A user-storable `Promise<T>`** — wp24 §9.3, and §6.3's rule 2 is the
  checker's version of it. A promise you can hold is a promise that can be
  live beside another one, which is exactly the case where erasure lies.
- **`p.then(cb)` in strict** — unchanged from wp24 §9.3 and
  [wp16-results.md](wp16-results.md): `Result` has no `map` for this reason,
  and a language that refused `Result.map` and accepted `.then` would be
  trading the attribute fixpoint for a spelling. In *compat*, where function
  values exist at C2b's stated price, it follows from C2b and needs no separate
  decision — which is precisely the separation §1's thesis is about.
- **A third, middle dialect** (`loose`, or `compat-strict`) — two dialects plus
  a per-feature ratchet already *is* the gradient; a third would be a third
  test matrix for the same points on the line.
- **Running npm packages** — §4.1. The consumer path is source in a statically
  typed subset (wp21 §2), and a published package is neither.
- **Matching Node's microtask semantics in general** — wp24 §4.7. §6.3 does
  not implement them; it identifies the fragment where they are unobservable
  and rejects the rest. That is a much smaller promise and it is the only one
  worth making before there is an implementation to hold to it.
- **An M:N scheduler behind `--async-model`** — wp20 §1, unchanged: a growable
  stack needs relocation, relocation needs a precise GC.
- **Compat constructs in `self/`** — §4.4.
- **A flag per feature** — §5.2. Twelve booleans is not a ratchet; it is a
  matrix nobody can test and nobody can review.

---

## 9. Risks

- **It is the largest package ever proposed here**, and everything lands twice
  (wp24 §4.8) against a `self/` that keeps growing. C0 and C1 are small; C2
  onward is not, and the staging exists so that stopping after any stage leaves
  something coherent.
- **Two dialects and nobody writes strict.** Mitigations, all cheap: strict is
  the default, compat prints its bill on every build, the benchmark table is
  strict-only, `self/` may not use it, and the compat reference is explicitly a
  migration document rather than a language.
- **The ratchet is never pulled.** A team ports, ships, and leaves the list
  full. That is their call and the mode still did its job — but it is the
  reason the report has to lead with blast radius rather than a count: a list
  entry that costs 3% and one that costs 40% must not look alike.
- **§6.3's claim is wrong in a case nobody thought of.** The mitigation is that
  it is stated as a claim with a rule, and `tests/differential/` fails on it
  program by program rather than in a review.
- **Tier 4 swallows the package.** Someone turns compat on, finds no `Map`, and
  concludes the mode does not work. §4.1 is the answer and C-lib's position in
  §7.3 is the plan; the documentation has to say it before the flag does.

---

## 10. Open

- ~~**The flag's name.**~~ **Decided: `--compat`**, with the bare form meaning
  every built feature and `--compat=<list>` meaning exactly those. Strict is
  the *absence* of the flag rather than a value of it, which is what keeps the
  default spelled the way it is spelled today — a strict build's command line
  does not change, and neither does its IR.
- **Whether `async` belongs in compat at all**, or only as `--async-model
  threads` over an explicitly threaded surface. §6.3's rule makes the sync
  lowering defensible; S2 decides whether it is *useful*, and a negative S2 is
  an argument for dropping C3 and keeping C4. The order is no longer open —
  §1 settles that the threads are built first either way — so this question now
  only decides whether C3 is ever built, and it can be left until T1 and T2
  have landed and there is a real engine to measure the notation against.
- **Whether the compat ceiling should be per-dependency rather than global.**
  §3 takes the simple rule; a vendored dependency that legitimately needs one
  feature the application has ratcheted away is the case that would argue
  against it, and nobody has met it yet.
- **What `--emit-dts`, `--emit-header` and `--emit-napi` do with a compat
  program.** A closure has no C spelling. Probably: the interop surfaces stay
  strict-only and the diagnostic says so — but that is a decision, not an
  omission, and it is not made here.
- **Whether the compat reference is a document or a section.** It cannot be in
  LANGUAGE.md, which freezes at M4 and is normative for strict. A sibling with
  its own version line is the assumption above.
- **Whether `--number-mode` should be per-module.** §5.3 makes it a dialect
  setting; WP26 §"the number-mode rule" already found that a `std/` module has
  to care, and a mixed-dialect program makes that sharper.

---

## 11. Appendix: S1, in full

§7.4's measurements are the only facts this note has that are not an argument,
so the programs are here rather than only reported, by the convention
[wp24-async.md](wp24-async.md) §11 sets. None of this is a test case: it is a
spike, and every part of it uses the language and the toolchain exactly as they
are today.

### 11a. The call, direct

```ts
// S1 baseline. `transform` is a small pure function called once per iteration
// with a serial dependency through `acc`, so the loop has no closed form and
// the call cannot be hoisted or folded away. This is the shape `xs.map(cb)`
// and `xs.reduce(cb)` have, which is why it is the shape worth pricing.
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

### 11b. The same call, opaque to the fixpoint

wp27's `declare function` is the instrument: the callee carries no attributes,
which is precisely the "unknown callee" position, while still being in the LTO
unit — which is why this variant isolates the *fact loss* from the *codegen
loss*.

```ts
// S1 baseline. `transform` is a small pure function called once per iteration
// with a serial dependency through `acc`, so the loop has no closed form and
// the call cannot be hoisted or folded away. This is the shape `xs.map(cb)`
// and `xs.reduce(cb)` have, which is why it is the shape worth pricing.
declare function transform(x: i32, acc: i32): i32;

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

```c
#include <stdint.h>
int transform(int x, int acc) {
  int32_t m = acc ^ (int32_t)((uint32_t)x * 1103515245u);
  return ((m >> 13) ^ m) + 1;
}
```

### 11c. The same call, truly indirect

The `.ll` from 11a with the one call site rewritten, and a C half that installs
the target at run time so that LTO cannot fold it back. This is where a
closure's code pointer lives.

```llvm
  %fp = load i32 (i32, i32)*, i32 (i32, i32)** @transform_fp, align 8
  %4 = call i32 %fp(i32 %3, i32 %2)
```

```c
#include <stdint.h>
#include <stdlib.h>
static int t_a(int x, int acc) {
  int32_t m = acc ^ (int32_t)((uint32_t)x * 1103515245u);
  return ((m >> 13) ^ m) + 1;
}
static int t_b(int x, int acc) { return acc + x; }
int (*transform_fp)(int, int);
__attribute__((constructor)) static void install(void) {
  /* The target is not knowable at compile time, which is what makes the call
     indirect after LTO -- the same position a closure's code pointer is in. */
  transform_fp = getenv("NISH_SPIKE_ALT") ? t_b : t_a;
}
```

### 11d. The array shape

11a to 11c again with the loop holding the array and the callee taking one
element, which is `xs.reduce(cb)` and the shape WP15 §1a's alias domains are
about:

```ts
// S1, the array shape: the loop holds `xs` and the per-element work is a call.
// This is `xs.reduce(cb)`. With the callee known and pure, LLVM may hoist the
// array header out of the loop (WP15 §1a's alias domains) and fold the bounds
// check; with the callee unknown it may do neither, because an unknown callee
// could store through `xs` or grow it.
function mix(x: i32, acc: i32): i32 {
  const m: i32 = acc ^ (x * 1103515245);
  return ((m >> 13) ^ m) + 1;
}

function reduce(xs: i32[], rounds: i32): i32 {
  let acc: i32 = 1;
  for (let r: i32 = 0; r < rounds; r++) {
    for (let i: i32 = 0; i < xs.length; i++) {
      acc = mix(xs[i], acc);
    }
  }
  return acc;
}

export function main(): i32 {
  const xs: i32[] = new Array<i32>(1024);
  for (let i: i32 = 0; i < 1024; i++) {
    xs[i] = i * 7 + 1;
  }
  console.log(`${reduce(xs, 400000)}`);
  return 0;
}
```

### 11e. The allocation shape

The third row of §7.4, and the expensive one. `--no-stack-alloc` is the
instrument: it forces every `new` to the arena, which is what an object
reachable from an unknown callee would have to do.

```ts
// S1, the allocation shape. `p` provably does not outlive `run`, so WP6 turns
// the `new` into one entry-block alloca reused every iteration. An object
// reachable from an unknown callee cannot be proved that way, and goes back to
// the arena -- which is what `--no-stack-alloc` forces here.
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

### 11f. Built and run

```bash
nish direct.ts -o direct.ll
scripts/build.sh direct.ll runtime/runtime.c -o a_direct --profile speed
nish ffi.ts -o ffi.ll
scripts/build.sh ffi.ll transform.c runtime/runtime.c -o b_ffi --profile speed
# indirect.ll is direct.ll with the one call site rewritten, per 11c
scripts/build.sh indirect.ll fp.c runtime/runtime.c -o c_indirect --profile speed

nish alloc.ts -o alloc_stack.ll                    # WP6 proves it local
nish alloc.ts --no-stack-alloc -o alloc_arena.ll   # and this forbids the proof
```

All six binaries print the same number, which is the only correctness check a
spike of this shape needs.
