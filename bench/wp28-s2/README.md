# WP28 spike S2: `async` by contagion, counted on real TypeScript

[The compatibility-mode note](../../docs/wp28-compatibility-mode.md#66-what-compat-async-does-not-buy)
rests its `async` stage on one sentence: "most application TypeScript is
`async` by contagion rather than by need". [Its S2](../../docs/wp28-compatibility-mode.md#71-the-spikes-before-any-of-it)
is the measurement that has to come before anyone believes it. This directory
is that measurement: a census of every `async` function in four real
applications, re-runnable with one command.

```bash
node bench/wp28-s2/run.mjs                 # every table below
node bench/wp28-s2/run.mjs --sample 48     # and the list the hand audit read
node bench/wp28-s2/run.mjs --only appium --json out.json
```

It needs network access to the npm registry, and `build/nish` (`npm run
build`) for the last table, which it skips with a message otherwise. A run
takes about 13 seconds. **The counts are exact for the pinned tarballs: there
is no noise band, and a rerun prints the same tables.** They were taken with
Node 22.23.4, `typescript` 5.9.3 and nish 0.38.0 on a 4-core x86-64 Linux
container; nothing in them depends on the machine.

## The verdict

**The sentence holds, with a qualification the note should carry.**

- **Contagion is the majority, in every application.** Of 2364 `async`
  functions, 1268 (53.6%) wait on nothing but other functions of the same
  program, and 835 (35.3%) wait on something outside it. The other 261 (11.0%)
  the census cannot place, so the share by contagion is **53.6% to 64.7%**,
  with the unknown column as the whole of the gap. The lower bound is above
  half in each of the four: 64.2%, 54.4%, 50.3% and 50.2%. In two of them it is
  above half by less than one point, so "most" is the word and "nearly all" is
  not.
- **By need, in the note's sense, is rare.** The note's leaf is the function
  that "did I/O once". Only 89 `async` functions (3.8%) wait on the platform
  directly: a Node module, a global such as `fetch`, a timer, or a `new
  Promise`. That is one for every 26 `async` functions; the note's "four
  hundred callers" is a figure of speech, and the measured one is 26. The rest
  of the 35.3% wait on a dependency, and the dependencies they wait on are
  mostly the application's own sibling packages (`@budibase/backend-core`,
  `@nomicfoundation/hardhat-utils`, `@appium/support`), which a whole-program
  build would compile as program functions. Counted that way the share by
  contagion can only rise, to at most 96.2%.
- **The colour comes off; the leaf does not go away.** Only 8.6% to 25.2% of
  `async` functions sit on chains that reach nothing outside the program at
  all. For the rest, erasing `async` leaves a call chain that still ends in a
  file read or a socket, which is the missing library §6.6 already names. The
  decolouring is the common case; a program that runs after it is not, until
  the leaves exist.

**Against §10's "does `async` belong in compat at all, or only as
`--async-model threads`":** this is not the negative S2 that would drop
[C3](../../docs/wp28-compatibility-mode.md#73-the-stages) for C4 alone. The
threads model pays only where more than one promise is live, and the census
finds that rare: 94.7% of the 4487 `await`s are on a direct call, and 3.0% are
on the `Promise.all` family. For the 94.7%, spawn-and-join is, as §6.5 says,
a call with extra steps. C3's erasure is the lowering that fits what the
corpus writes, and C4 is an option on the 3%.

**What strict already takes** (below) changes what C3 is. The note was written
when strict rejected `async` outright. Strict now accepts it, under rules
close to §6.3's two, so C3 is no longer "`async` in compat": it is the shapes
strict still refuses. The largest are an `async` method (30.7% of `async`
functions) and an inferred return type (56.3%).

## The corpus

Four applications, not libraries: each is a program someone runs, published to
npm with its TypeScript source in the tarball. [`corpus.json`](corpus.json)
pins each by name, version and the registry's `sha512` integrity; `run.mjs`
fetches them with `npm pack` into a directory under the system's temporary
directory, refuses a tarball whose integrity is not the pinned one, and
removes the directory on the way out. None of their code is in this
repository.

| application | version | what it is | source files | functions | `async` |
| --- | ---: | --- | ---: | ---: | ---: |
| hardhat | 3.21.2 | a command-line build and test tool | 292 | 1641 | 531 |
| appium | 3.9.0 | an HTTP server that drives apps for tests | 55 | 557 | 158 |
| @stryker-mutator/core | 10.1.1 | a mutation-testing runner | 125 | 894 | 171 |
| @budibase/server | 3.38.1 | the HTTP backend of a low-code platform | 496 | 3758 | 1504 |

A source file is a `.ts` or `.tsx` file that is not a declaration file, not
under a `test`, `tests`, `__tests__`, `__mocks__`, `__fixtures__`, `fixtures`,
`e2e`, `spec`, `specs` or `node_modules` directory, and not named `*.test.ts`, `*.spec.ts`, `*.e2e.ts` or `*.bench.ts`.
A function is anything with a body: a declaration, an arrow, a method, an
accessor, a constructor.

## The method

[`census.mjs`](census.mjs) builds one `typescript` program per application,
with `@types/node` loaded and **none of the application's dependencies
installed**. An import that does not resolve is, by that fact, outside the
program. For each function it collects the function's *waits*: the operand
of every `await` in its own body (not in a nested function), every `for
await`, and, in a function that is `async` or returns a promise, every
expression it returns whose type is a promise and every call it returns whose
type the checker does not know. A function that is not `async` but returns a
promise is not counted, and is a link in the chains of those that are. It
resolves each wait to one of four things.

- **A leaf**: something outside the program. The census names five kinds: a
  Node built-in module, a global (`fetch`, a `Response` body), a timer, a `new
  Promise`, and a dependency: anything imported by a bare specifier that does
  not resolve to a file of the program. A sibling package from the
  application's own repository is a dependency by that rule.
- **An edge**: a function of the program. A call through an interface member
  or an abstract method is an edge to every class body in the program that
  implements it.
- **Nothing**: a value that is not a promise, or a dynamic `import()`.
- **Unknown**: the resolver cannot say which of the above it is. A returned,
  unawaited dependency call is unknown and not a leaf, because without the
  dependency's types it may answer a value.

Two rules bend that. A dependency call that is handed an inline `async`
function is read as an edge to that function, not as a leaf. And the promise
vocabulary is matched by name: `.then`, `.catch`, `.finally`, the `Promise.all`
family, and an array built with `.push` or `.map` and then gathered, are
recognized whatever their receiver, and a `new Promise` is a timer when its
executor's text names `setTimeout`, `setInterval` or `setImmediate`.

A leaf's reach is then carried back along the edges to a fixed point, and
each function lands in one class.

| class | the function's waits |
| --- | --- |
| leaf | at least one leaf, no edge |
| mixed | at least one leaf and at least one edge |
| contagion-blocks | edges only, and some chain of them ends at a leaf |
| contagion-unknown | edges only, no chain is known to end at a leaf, and some chain ends at an unknown |
| contagion-never | edges only, and every chain ends at a function that waits on nothing |
| no-wait | none: `async` with no `await` that waits |
| unknown | no leaf, and at least one wait the resolver cannot place |

"By need" is leaf plus mixed. "By contagion" is the three contagion classes
plus no-wait: the function carries the colour and waits on nothing outside
itself. Unknown is never folded into either.

## The tables

`async` functions by class:

| application | `async` | leaf | mixed | contagion-blocks | contagion-unknown | contagion-never | no-wait | unknown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| hardhat | 531 | 79 | 49 | 190 | 27 | 27 | 97 | 62 |
| appium | 158 | 35 | 16 | 45 | 31 | 2 | 8 | 21 |
| @stryker-mutator/core | 171 | 41 | 11 | 52 | 27 | 4 | 3 | 33 |
| @budibase/server | 1504 | 289 | 315 | 647 | 45 | 12 | 51 | 145 |
| all | 2364 | 444 | 391 | 934 | 130 | 45 | 159 | 261 |

As shares of the `async` functions. A range runs from "every unknown is by
need" to "every unknown is by contagion":

| application | waits outside itself | of which on the platform | waits only on the program | reaches nothing outside |
| --- | ---: | ---: | ---: | ---: |
| hardhat | 24.1% | 3.6% | 64.2% to 75.9% | 23.4% to 40.1% |
| appium | 32.3% | 3.2% | 54.4% to 67.7% | 6.3% to 39.2% |
| @stryker-mutator/core | 30.4% | 12.9% | 50.3% to 69.6% | 4.1% to 39.2% |
| @budibase/server | 40.2% | 2.9% | 50.2% to 59.8% | 4.2% to 16.8% |
| all | 35.3% | 3.8% | 53.6% to 64.7% | 8.6% to 25.2% |

"Waits outside itself" is leaf plus mixed. "Of which on the platform" counts
the functions with a leaf that is not a dependency. "Reaches nothing outside"
is contagion-never plus no-wait, with contagion-unknown and unknown as its
gap.

What the leaf and mixed functions wait on (a function counts once per kind):

| kind | hardhat | appium | @stryker-mutator/core | @budibase/server | all |
| --- | ---: | ---: | ---: | ---: | ---: |
| dependency | 114 | 47 | 32 | 579 | 772 |
| node | 7 | 2 | 19 | 20 | 48 |
| global | 2 | 1 | 3 | 23 | 29 |
| new Promise | 9 | 1 | 1 | 2 | 13 |
| timer | 1 | 1 | 0 | 2 | 4 |

The dependencies waited on most are `@budibase/backend-core` (390 functions),
`@nomicfoundation/hardhat-utils` (104), `@budibase/pro` (59), `node-fetch`
(37), `@budibase/types` (35) and `@appium/support` (33). Five of those six are
a sibling package from the application's own repository.

Why a function is in the unknown column (a function counts once per reason):

| reason | functions |
| --- | ---: |
| a call the checker cannot resolve to a declaration | 112 |
| an `await` on a call to a callback parameter | 49 |
| a returned call whose type is unknown | 39 |
| an `await` on a call to a function value | 36 |
| an interface member no class in the program implements | 16 |
| an `await` on a value, not a call | 14 |
| a `Promise.all` whose elements cannot be traced | 4 |
| a `for await` over an iterable that is not the program's | 3 |

## Known false positives: the hand audit

`--sample 48` draws 48 of the 2364 functions in an order seeded by a hash of
the application, file and line, so a rerun draws the same ones. Each was read
against its source and classified by hand.

| census class | drawn | agreed | by hand |
| --- | ---: | ---: | --- |
| leaf | 13 | 13 | |
| mixed | 6 | 6 | |
| contagion-blocks | 17 | 17 | |
| contagion-never | 1 | 1 | |
| no-wait | 5 | 5 | one is a judgement, below |
| contagion-unknown | 2 | - | one resolves to contagion-blocks; one is undecidable |
| unknown | 4 | - | one resolves to leaf; three are undecidable |

**Of the 42 functions the census placed, all 42 are in the class a reader
puts them in.** Of the 6 it did not place, 2 can be placed by hand, one on
each side, and 4 cannot be placed by reading either (a callback parameter, a
hook chain, an adapter the program is handed). So the audit found no
misclassification, and no sign that the unknown column leans one way. A
sample of 48 cannot rule out an error rate of a few percent: with none seen in
42, the 95% upper bound is about 7%.

What the audit and the reading of the classifier's output did find, and which
way each pushes:

1. **A dependency is "outside", not "blocks"** (overstates need). A wait on a
   dependency is a leaf whether or not the dependency does I/O. Of the 19 leaf
   and mixed functions drawn, one waits on the platform directly and two on
   `node-fetch`; the other 16 wait on a dependency call: five on a file
   helper and five on a database handle, both from a sibling package, and six
   on other calls. Most of those reach I/O, but two (a feature-flag read and
   a plugin `init`) cannot be verified without the dependency's source. The "of which on the platform" column is
   the bound that does not depend on this.
2. **A type-only package is charged with the call** (no effect on the class).
   A database handle typed by `@budibase/types` and constructed by
   `@budibase/backend-core` shows as a wait on the first. It is a dependency
   leaf either way.
3. **A dependency call that is returned, not awaited, is unknown**
   (understates need). With no dependency installed the call's type is
   unknown, so `return this.client.delete(params)` on a database client lands
   in unknown where `return await` of the same call is a leaf. The one unknown
   the audit resolved was this.
4. **Interface dispatch resolves to classes only** (understates both). A call
   through an interface is an edge to the program's implementing classes. An
   implementer that is an object literal, or that a plugin supplies, is not
   seen; with no class at all the wait is unknown, which is where the audit's
   terminal-prompt function went.
5. **A call on a class type ignores overrides.** The edge is to the declared
   method, not to a subclass that overrides it.
6. **A dependency wrapper is read as its callback** (understates need). A
   dependency call handed an inline `async` function, such as a tracer span, a
   mutex or a transaction, is an edge to that function, on 141 calls. That is
   right for a span and hides the wait a mutex or a transaction makes itself.
7. **A dynamic `import()` is not a wait** (understates need). A function whose
   only `await` is on `import()` is no-wait; under Node the import reads a
   file. 61 `await`s are on `import()`. An ahead-of-time build links the
   module, which is why the census reads it this way.
8. **Every `new Promise` is a leaf** (overstates need), whatever its executor
   does: 13 functions.
9. **The promise vocabulary is matched by name.** A program's own method named
   `then` or `catch` would be read as a promise chain, and a comment naming
   `setTimeout` inside an executor as a timer. Neither appeared in the sample;
   chains are 14 `await`s and timers 4 functions, so the reach is small.
10. **Tests are excluded by path**, so a test helper kept outside a test
   directory is counted.

Items 1 and 8 overstate need and 3, 6 and 7 understate it. None moves a
bound past half in an application, except that the two applications at 50.2%
and 50.3% are within reach of items 3, 6 and 7 together, and the verdict says
so.

## What strict `async` already does

The note describes strict as rejecting `async`. WP24 and WP49 have since built
it ([LANGUAGE.md](../../docs/LANGUAGE.md#async-functions-async-and-await)), so
the question for C3 is what remains. [`strict/`](strict) holds one reduced
example of each class and of each shape the census counts; `run.mjs` compiles
each with `build/nish --json` and prints the exit code and the diagnostic. On
nish 0.38.0:

| example | exit | diagnostic | share of the corpus with this shape |
| --- | ---: | --- | --- |
| `01-leaf.ts`, on `sleep` from `nish:async` | 0 | accepted | 35.3% of `async` functions are leaf or mixed |
| `02-contagion.ts` | 0 | accepted | 53.6% are by contagion |
| `03-mixed.ts` | 0 | accepted | |
| `04-no-wait.ts` | 0 | accepted | 6.7% wait on nothing |
| `05-unknown-callback.ts` | 0 | accepted | |
| `10-shape-method.ts` | 1 | NL1063 | 30.7% are methods |
| `11-shape-arrow-top-level.ts` | 0 | accepted | 7.9% are top-level arrows; 44.5% top-level functions |
| `12-shape-arrow-argument.ts` | 0 | accepted | 12.6% are arrows passed as an argument |
| `13-shape-inferred-return.ts` | 1 | NL2655 | 56.3% leave the return type to inference |
| `14-shape-await-in-expression.ts` | 1 | NL2642 | 9.5% of `await`s stand inside an expression |
| `15-shape-returned-call.ts` | 1 | NL2645 | 7.4% of calls to a program `async` function are returned unawaited |
| `16-shape-return-await.ts` | 0 | accepted | 87.9% of such calls are awaited where made |
| `17-shape-promise-all.ts` | 1 | NL2643 | 3.0% of `await`s are on the `Promise.all` family |
| `18-shape-await-all.ts` | 0 | accepted | the strict spelling of the same |
| `19-shape-await-value.ts` | 1 | NL2645 | 0.7% of `await`s are on a value |
| `20-shape-then.ts` | 1 | NL2643 | 0.3% of `await`s are on a `.then` chain |
| `21-shape-recursion.ts` | 1 | NL2648 | 66 functions (2.8%) are on a cycle of awaits |
| `22-shape-for-await.ts` | 1 | NL2133 | 8 loops |

The nine examples strict accepts were also built and run with `nish run`: each
exits 0 and prints the value its source computes.

Read against the classes: **strict accepts every class.** A contagion chain, a
leaf, a mixed function and one with no wait all compile, as does an `await` on
a function value handed in as a parameter. What strict refuses is shape, not
class, and the leaf it accepts is its own (`sleep`, `readable`, `writable`),
not Node's.

Read against the shapes, strict's rules are §6.3's two and four more. The two
§6.3 states are already strict's: an `await` takes a direct call (94.7% of the
corpus's `await`s do), and a call to an `async` function is awaited where it
is made (87.9%). The refusals a ported application would meet first are the
ones §6.3 does not have:

- **an `async` method** (NL1063): 725 of 2364, 30.7%;
- **an inferred return type** (NL2655): 1332, 56.3%, which `--fix` or one
  annotation each answers;
- **an `await` inside an expression** (NL2642): 428 of 4487 `await`s, 9.5%;
- **a returned, unawaited call** (NL2645): 168 of 2283 calls to a program
  `async` function, 7.4%. This one is the erasure's easiest case: in an
  `async` function `return f()` and `return await f()` differ only in where a
  rejection surfaces.

The shares are marginal: the census does not count how many functions pass
every rule at once.

## What this does not measure

- Four applications from npm are not "application TypeScript". All four are
  Node programs (two servers, two tools); none is a browser application, where
  the leaves are events and `fetch`.
- It counts functions, not calls. A leaf called from a thousand sites and one
  called once each count once.
- It says nothing about whether the erased program behaves as Node's does.
  That is §6.3's claim, and `tests/differential/unmodified.js` is where it
  would be tested.
