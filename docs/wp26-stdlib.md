# WP26: The standard library

**Landed.** `std/` exists, with two modules — [`std/testing`](../std/testing.ts),
a test runner a compiled program drives to check itself, and
[`std/text`](../std/text.ts), the string operations the language deliberately
does not have — and one program written on top of both,
[`tests/nish/run.ts`](../tests/nish/run.ts), which runs this repository's golden
cases and its `tests/link/` programs in the language it tests.

This note is the plan of record for the directory: what a module there is, what
it is not, and the four or five rules a second contributor needs before adding
one. [LANGUAGE.md](LANGUAGE.md) stays normative for what the language *is* and
[`std/README.md`](../std/README.md) is the operational rule list as it currently
stands; this note is the *why* behind both, and where it and LANGUAGE.md ever
disagree, LANGUAGE.md wins.

It also closes a sentence written down three notes ago.
[wp23-language-surface.md](wp23-language-surface.md) §10 question 5 ended with
"There is no standard library today and this note does not propose creating one
for a four-line type." There is one now, so the question changes shape rather
than disappearing: §2 below is the rule that decides whether `Pair<A, B>` — or
anything else — belongs in it, and the answer for a four-line interface is still
no, for a reason this note can now state rather than assume.

Read [wp21-packages.md](wp21-packages.md#2-the-decision) first. "Source is the
distribution format" is the decision `std/` leans on entirely, and §1 here is
that decision applied inside one repository instead of across an ecosystem.
[wp5-modules.md](wp5-modules.md) is the second, because whole-program
compilation is what makes §1 true rather than aspirational.

---

## 1. What `std/` is, and what it is not

**A `std/` module is an ordinary Nish source file that is compiled into the
program importing it.** There is no library artifact, no link step, and nothing
the compiler knows about the directory: `src/` and `self/` contain no reference
to `std/` at all, and a program reaches a module by relative specifier because
that is the only import form the language has.

That is not a shortcut taken for lack of a build system. It is
[wp21-packages.md](wp21-packages.md#2-the-decision) §2 — a foreign host takes a
built artifact, another Nish consumer takes source — with `std/` as the first
consumer to exercise the second half.

### 1a. What it buys, measured

Three things, and all three are consequences of the module being *in* the
program rather than beside it. Each was checked on the emitted IR of a
throwaway program that imports one function from `std/text`:

- **The whole-program fact fixpoint sees straight through it.**
  `analyzeFunctions` runs over every module at once
  ([`docs/ARCHITECTURE.md`](ARCHITECTURE.md), "Attribute soundness rules"), so a
  `std/` function is annotated on the same evidence as a local one: `isBlank` in
  `std/text` comes out `nounwind willreturn readnone`, `contains` comes out
  `nounwind willreturn readonly`, and `splitLines` comes out with
  `readonly nocapture` on its parameter and `dereferenceable(24)` on the array
  it returns. A compiled library could carry none of that
  ([wp21-packages.md](wp21-packages.md) §3a).
- **A `std/` function inlines like a local one.** `trim` is a composition of
  three other functions in the module — `trimEnd` over `trimStart`, both calling
  the private `isBlank` — and in the linked binary there is one function where
  the source has four.
- **What the program does not call is dropped.** Linking a program that imports
  `trim` and nothing else leaves exactly `trim` in the binary: the other seven
  exports of `std/text` are gone. The mechanism is worth naming precisely,
  because it is *not* `internal` linkage — an exported function is an external
  C-ABI symbol whoever imports it (LANGUAGE.md, the linkage rule under
  *`export` and `import`*) — it is
  `-ffunction-sections -Wl,--gc-sections`, which every profile in
  `scripts/build.sh` passes and which is the same mechanism that makes an unused
  runtime function cost nothing ([wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget)).

### 1b. What it costs

- **There is no separate compilation.** Every program that imports `std/text`
  compiles `std/text`, every time. That is the cost wp21 §3 states honestly for
  the whole scheme, and the mitigation there is a content-addressed cache
  ([wp21-packages.md](wp21-packages.md#8-stages) S4), not a change of format.
  At 155 and 204 lines the cost is currently noise; it is written down because
  it grows with the directory and not with the program.
- **`std/` has no version of its own.** It ships inside the compiler package —
  `std` is in `package.json`'s `files`, so an installed compiler has the library
  beside it — which means the library's version is the compiler's version, 0.1.1
  today, and a program cannot pin one without the other. §7 question 2 asks
  whether that should change and recommends that it should not yet.
- **It shares the program's one flat symbol namespace**, which is a real
  constraint on how a module is written rather than a theoretical one. §3e has
  the measurement.
- **It is not resolvable by name.** `import { Suite } from "nish/testing"` is
  what [wp21-packages.md](wp21-packages.md#5b-import-has-no-bare-specifiers) S2
  would buy, and it is deliberately not faked in the meantime: a resolver that
  special-cased this one directory would be a second module system, and the one
  that is coming has to agree with Node's. So the specifier is
  `../std/testing` inside this repository and
  `node_modules/nish/std/testing` outside it. That path is the honest spelling
  of "no resolution yet", and it is the first thing WP21 replaces.

---

## 2. The line between a `std/` module and a builtin

This is the question the directory will keep raising, and it now has a rule.

**A builtin is for what the language cannot express. A `std/` module is for
everything it can.**

Three things qualify as "cannot express", and they are the three reasons every
existing builtin exists:

1. **A syscall.** `opendir`, `posix_spawn`, `clock_gettime`. No amount of Nish
   reaches an operating system, so `readdirSync`, `spawnSyncTo` and
   `monotonicNanos` are builtins ([LANGUAGE.md](LANGUAGE.md#directories-and-subprocesses),
   [LANGUAGE.md](LANGUAGE.md#the-clock)).
2. **An operation the runtime must own for memory-layout reasons.** A string is
   a header plus bytes and an array is a 24-byte header; allocating one means
   agreeing with `src/codegen/runtime.ts`, `runtime/nish.h` and `runtime.c` at
   the same time (orientation rule 4). `nish_str_new` cannot be written in Nish
   because writing it means describing the layout twice.
3. **Something the whole-program pass has to see through.** An effect the
   attribute fixpoint must know about belongs where the fixpoint can read it. A
   clock is the sharp case: `monotonicNanos` is recorded as a `write` precisely
   so that two reads with work between them do not fold into one, and no library
   function can state that about itself.

Everything else is a `std/` module, and `std/text` is the proof. It adds **not
one line to `runtime/runtime.c`**: the commit that landed it touches `std/` and
`std/README.md` and nothing under `runtime/`.

One qualification, because the tempting shorter claim is false and a reader will
check it. `std/text` does not avoid runtime *symbols* — compiled on its own it
declares `nish_str_new`, `nish_str_index_of`, `nish_str_eq`, `nish_arena_mark`,
`nish_arena_grow`, `nish_arena_keep`, `nish_array_grow` and `nish_panic_index`,
because `substring`, `indexOf`, `push` and a bounds check are what it is built
out of. The test is not "does this call into C", it is **"does this need a C
function that does not exist yet"**. For every one of `std/text`'s eight exported
functions the answer was no.

The rule bites in both directions, and the second direction is the one worth
guarding:

- **Do not add a C function for something `std/` could do.** The runtime has a
  measured byte budget that a test enforces
  ([wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget); 4,670 of 4,864
  bytes of `.text*` today, 194 bytes of headroom), and a library function costs
  that budget nothing. The live example is `sort`: `readdirSync` sorts its own
  result *because there is no `sort` for a caller to reach for*, and the answer
  to that gap is a `std/` function, not `nish_sort`.
- **Do not write a `std/` module for something only C can do.** A wall clock, a
  locale table, a `toLowerCase` that knows about anything but ASCII: each needs
  data or a syscall the language cannot reach, and a module that fakes one would
  be wrong in a way the type system cannot catch.

This is also the answer to wp23 §10 question 5. `Pair<A, B>` is expressible, so
it is not a builtin; but expressible is a necessary condition and not a
sufficient one, and §7 question 3 has the sufficient one: a module earns its
place when more than one program would otherwise write the same loop. A
two-field interface is not a loop.

---

## 3. What the language's restrictions did to the API

This is the part that transfers to every future module. Each item below is a
language decision the library had to absorb, not a style preference, and each
removed the shape a JavaScript library would have reached for first. The header
of `std/testing.ts` names the five it met while the module was being written;
this section says what each one costs and why the language is not going to give
it back, and adds a sixth (§3e) that the library found afterwards and no module
header mentions yet.

### 3a. A function is not a value, so there is no `test(name, callback)`

`const alias = double` is `` Unknown identifier `double` ``, and function types
are forbidden outright (LANGUAGE.md, *Functions*;
`tests/cases/reject_arrow_as_value`). So a suite cannot be a registry of
callbacks, and the API is an object a program drives with straight-line calls
whose names are arguments:

```ts
const t = new Suite("stats");
t.eqI32("sumOf", sumOf(xs), 25);
return t.done();
```

The restriction is not a gap waiting to be filled. A callback is an unknown
callee, and the whole-program pass cannot prove purity, termination or escape
facts through one — which is the same argument [wp25-inheritance.md](wp25-inheritance.md)
§2 makes against a vtable and [wp24-async.md](wp24-async.md) makes against a
promise as a first-class value. A test framework built on callbacks would have
been a request to give that up for the benefit of the tests.

What is lost is real and worth naming: there is no `beforeEach`, no way to run
one body against a table of inputs without writing the loop, and no way for the
harness to catch a failure *inside* a check. What is gained is that the report
is ordinary code, so a test program reads in execution order.

### 3b. There is no `try` / `catch`, so an assertion records and *answers*

`try`/`catch`/`finally` is a Phase 0 rejection — there is no unwinding, and
every function is `nounwind` (`tests/cases/reject_try_catch`). An assertion
therefore cannot throw and be collected, so each one prints its outcome,
increments a tally, and returns a `boolean`; `done()` turns the tally into the
exit code.

The `boolean` is the load-bearing part, and the reason is not ergonomics. **An
out-of-range index panics and ends the process**, as does an empty `pop`, so
"check the length, then read the element" cannot be two statements — it has to
be a branch:

```ts
if (!t.eqI32("length", xs.length, 4)) {
  return t.done();            // xs[3] below would abort the whole run
}
t.eqI32("last element", xs[3], 9);
```

`Result<T, E>` is the language's answer to a recoverable failure and is
deliberately *not* the shape here. WP16's first rule is that a `Result` cannot
be dropped, and a `Result`-valued expression statement is a hard error
([wp16-results.md](wp16-results.md) §4) — while every assertion in a test
program is an expression statement. An assertion's failure is data for the
report, not an error travelling to a caller, so the type that says "handle me"
is the wrong type for it.

### 3c. There are no generics, so there is one assertion per type

`eqBool`, `eqI32`, `eqI64`, `eqF64`, `nearF64`, `eqStr`, plus `ok`. Not one
`eq`, because the language has no type parameters
([wp18-generics.md](wp18-generics.md) is the proposal, not the present tense).

The alternative was available and was refused: a single `eq(name, actual,
expected)` over strings, with every caller interpolating. It would report
`expected "3", got "4"` for two numbers, losing the type in exactly the message
where the type is the thing a reader is trying to work out — and it would put an
allocation at every passing assertion. `nearF64` is the one that could not be
folded in at all: a float comparison needs a tolerance, and `eqF64` is exact
`fcmp oeq` on purpose, so that a computation which can produce `NaN` fails
rather than passing by accident.

### 3d. There are no optional or default parameters

`Optional/default parameters are not supported` is a Phase 0 rejection
(LANGUAGE.md, *Functions*). So `skip` takes its reason, `nearF64` takes its
tolerance, and `fail` takes its detail — with the empty string, rather than an
absent argument, meaning "the name already says it". The same rule is why
`spawnSyncTo` is a second builtin instead of two more parameters on `spawnSync`
(LANGUAGE.md, *Directories and subprocesses*): in this language, an optional
argument is a second name.

### 3e. One flat symbol namespace, shared with the importer

This one was not in the plan and is the most surprising thing the library found.
A function name is unique across the whole program, exported or not, because the
attribute fixpoint is keyed by symbol name (LANGUAGE.md, *`export` and
`import`*;
`tests/link/duplicate_internal`). A `std/` module is part of the program, so its
*private* helpers are not private to the namespace. A program that declares its
own `isBlank` and imports `std/text` does not compile:

```
error: Function `isBlank` is also defined in main.ts; a function name must be
unique across the program whether or not it is exported, because the
whole-program attribute analysis is keyed by symbol name
```

Module-level constants do not behave this way — `NEWLINE`, `SPACE`, `TAB` and
`CARRIAGE_RETURN` in `std/text` are folded at their uses, and a program may
declare all four itself — so the hazard is functions only.

This is [wp21-packages.md](wp21-packages.md#5a-the-symbol-namespace-is-flat-the-blocker)
§5a arriving early, inside one repository, with two modules instead of an npm
tree. The rule until S1 lands is therefore a naming rule: **a `std/` module
keeps its private functions few and their names distinctive**, and a module
whose internals want ordinary names (`compare`, `next`, `parse`) is telling you
it should wait for package-scoped symbols.

---

## 4. The number-mode rule, and the half of it `std/text` does not keep

**The rule: a `std/` module spells its widths — `i32`, `i64`, `f64` — and never
`number`.** `--number-mode` decides what `number` *is*, so a module written in
`number` means a different program in each mode, and its API changes type
underneath a caller. `examples/arrays.ts` says the same thing for the same
reason, in a comment that predates the directory: "The types are spelled
explicitly (i32 / f64) so the module means the same thing in both number modes."

That rule is necessary and it is **not sufficient**, which this note records
because the shorter claim is currently in `std/README.md` and a reader will test
it:

| Module | `--number-mode i32` (default) | `--number-mode f64` |
| --- | --- | --- |
| `std/testing` | compiles | compiles; three comparisons against a `.length` lower to `fcmp`/`sitofp` instead of `icmp`/`trunc` |
| `std/text` | compiles | **8 errors** |

The cause is not the module's declarations, which are all explicit. It is that
several *builtins* answer `number`: `s.length`, `a.length` and `charCodeAt` all
do (LANGUAGE.md, *Arrays and strings as receivers*). So under `--number-mode f64`,
`let end: i32 = text.length` is `Cannot initialize i32 variable` and
`while (i < text.length)` is `` Operator `<` requires two numeric operands, got
i32 and f64 ``. A module can spell every width it declares and still be
mode-dependent at every place it reads a length.

The fix exists and costs what it should: `toI32(x)` is identity on an `i32` and
a saturating `fptosi` on an `f64` (LANGUAGE.md, *Numeric conversions*), so
`const len: i32 = toI32(text.length)` compiles in both modes, emits the same
`trunc` the plain read already emitted in the default mode, and costs one
`sitofp` plus one `llvm.fptosi.sat.i32.f64` per read in f64 mode. That is the
honest price of mode independence for a module that walks bytes, and it is
small.

**The decision: the rule stands, in two halves.** A module declares its widths
explicitly, *and* converts at every point where a builtin hands it a `number`.
`std/text` keeps the first half and not the second, which makes it a
default-mode module today rather than a portable one. §7 question 4 is what to
do about it, with a recommendation and the test shape that would pin it.

---

## 5. How a `std/` module is tested, and why that is the rule

**Every `std/` module ships with a `tests/link/<name>/` case.** Not a
`tests/cases/` golden, and not nothing.

Two reasons, and the second is the one that makes it a rule rather than a
preference:

1. **`tests/link/` is the only place a multi-module program runs end to end.**
   A `tests/cases/<name>.ts` is one file, compared against a `.ll` golden and
   optionally run for its stdout; a library is two files by definition. A link
   case is a directory with a `main.ts`, an `expected.out` and an
   `expected.code`, compiled, linked, run, and compared on both stdout and exit
   status.
2. **A link case is what puts the module in front of *both* compilers.**
   `tests/self/corpus.js` exports `linkPrograms()`, which walks
   `tests/link/*/main.ts`, and `ir_oracle.js`, `parity.js` and
   `reject_oracle.js` all read it. Since a link program is compiled
   transitively, `std/testing` and `std/text` are compiled by stage0 *and* by
   stage1 on every suite run, and the IR oracle requires the two to agree byte
   for byte.

Stated as the rule a contributor needs: **a `std/` module with no importer in
`tests/link/` is compiled by neither compiler on any run.** It is not in
`tests/cases`, so the golden harness never sees it; it is not in `CORPUS_DIRS`,
so the oracles never see it; and it is not imported by `src/` or `self/`, so no
build touches it. It would be a file that type-checks in an editor and nothing
else.

**`std/` is deliberately not in `CORPUS_DIRS`** (`tests/self/corpus.js`:
`tests/cases`, `examples`, `self`, `docs/cookbook`, `bench`, `tests/parser`).
Adding it would be the easy way to get the oracles to read it, and it is the
wrong shape: every entry in that list is compiled *standalone, as its own whole
program*, and a library alone is a shape no user ever produces. The comparison
worth making is the one through an importer, where the attributes of §1a are
computed over the caller as well — and that is precisely what a link case does.
The one honest gap this leaves is narrow and worth recording: `checked_oracle.js`
reads `programs()` only and not `linkPrograms()`, so the *checker-dump* oracle
never sees a `std/` module; the IR, parity and reject oracles do.

The three cases, and why there are three rather than two:

| Case | What it pins |
| --- | --- |
| `tests/link/std_testing` | `std/testing` on a real subject (`stats.ts`), exit code 0, and the guard idiom of §3b. 8 passed, 0 failed, 1 skipped |
| `tests/link/std_testing_fail` | the other outcome: every assertion fails on purpose, so `expected.out` is the *wording* of every failure message and `expected.code` is 1. 1 passed, 8 failed, 1 skipped |
| `tests/link/std_text` | `std/text` checked through `Suite`, the way a user would compose the two — 65 assertions, each one an edge case the doc comments in `std/text.ts` decide |

A library whose failure path is observable therefore gets two cases, one per
outcome. `std/testing`'s report *is* its output, so the wording of a message is
a contract and a golden is the only thing that keeps it one.

Packaging is the last leg of the same rule: source is the distribution format,
so shipping the library *is* shipping those files, and `tests/run.js` requires
`std/testing.ts` and `std/README.md` to be in the tarball. §7 question 6 notes
that the required list has not grown with the directory.

---

## 6. What it cost

In this repository's style of accounting, with every number measured or read
from the tree rather than remembered.

| Surface | Count |
| --- | ---: |
| `std/testing.ts` | 204 lines — one `Suite` class, 4 fields, 11 methods |
| `std/text.ts` | 155 lines — 8 exported functions, 1 private helper, 4 constants |
| Lines added to `runtime/runtime.c` by either module | **0** |
| New diagnostics, new Phase 0 rules, new checker rules | **0** |
| `tests/nish/run.ts` — the program the library exists for | 246 lines when it landed; 668 today, as it catches up with `tests/run.js` |
| `tests/link/` cases | 3 (`std_testing`, `std_testing_fail`, `std_text`) |
| Assertions in `tests/link/std_text` | 65 |
| Importers of `std/` in the repository | 4 (the three link cases and the runner) |

**The three builtins.** They are the part that did cost runtime bytes, and they
are builtins for §2 reason 1 — they are syscalls. Measured with
`clang -Oz -c runtime/runtime.c` and `size -A` on clang 18.1.3, linux-x64, which
is what `node tests/run.js budget` does on every run:

| | Bytes of `.text` |
| --- | ---: |
| `nish_readdir` | 294 |
| `nish_spawn_impl` (the shared body; the old `nish_spawn` body was 172) | 319 |
| `nish_monotonic_nanos` | 36 |
| `nish_spawn_to` | 33 |
| `nish_spawn`, reduced to a call of the shared body | 6 |
| **Total added** | **516** `.text`, plus 232 `.eh_frame` |

That took the `.text*` sum from 4,154 to **4,670** against a budget of
**4,864** — 194 bytes of headroom — and it cost a program that calls none of the
three exactly nothing: `examples/hello.ts` at the `size` profile is 4,680 bytes
against this runtime and against the one before it, because
`-ffunction-sections -Wl,--gc-sections` drops all three. The full accounting,
including why the metric is the sum of every `.text*` section rather than the
single `.text` line, is [wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget).

**The runner.** `npm run test:nish` compiles, links and runs the corpus through
`Suite` in about four and a half minutes; the pass it landed with was **0
failed**, and `npm test` keeps a subset of it green on every run.

This note deliberately does not freeze the check count, and the reason is itself
a finding: the count is a function of the corpus and of how much of
`tests/run.js` the runner has caught up with, and both move. The shape is one
check per case plus one for each extra thing a case supports, so counting
`tests/cases` as it stands — 449 sources, 259 of them with an `.err` sidecar,
184 with an `.ll` golden, 157 with a `.out` — gives the order of magnitude, and
the run's own summary line gives the number. Since the library landed the runner
has already grown the `.stdout`, `.argv` and `.env` sidecars it used to skip,
`llvm-as` and `opt -passes=verify` over every case that compiled, and the
`tests/link/` programs. A count in a historical note would have been wrong
within the week; `npm run test:nish` is never wrong.

What has not moved is the rule the count exists to serve: **every skip is
counted and named**, because a skip that is counted is a to-do list and one that
is not is a green run that proved less than it looks
([`.claude/testing.md`](../.claude/testing.md)). The `Suite` summary line —
`N passed, M failed, K skipped` — is that rule expressed as an API, and it is
the reason `std/testing` has a `skip` at all.

`npm test` runs the runner over the `pop` cases only — one golden, one native
round trip, three rejections — rather than over the corpus: it spawns a compiler
per case, and a second full pass would double the suite to prove what those five
prove. It is still the only place `readdirSync`, `spawnSyncTo` and
`monotonicNanos` are exercised *together* on a real workload rather than in a
case written to pin one rule.

**What the runner is not** bears repeating here, because it is the claim most
easily overstated. It covers the golden cases and the link programs, and none of
the pipeline checks: no interop sidecars, no layout assertions, no wasm profiles,
no packaging, no differential rewrite, no self-hosting oracles, and none of the
fourteen flag variations `tests/self/parity.js` runs. What it demonstrates is
that the language can host its own harness. What `tests/run.js` does is prove
the compiler.

---

## 7. What is still open

Stated as questions, in the shape [wp23-language-surface.md](wp23-language-surface.md#10-where-the-answer-is-genuinely-open)
§10 uses, each with a recommendation rather than a decision.

1. **The bare specifier.** `import { Suite } from "nish/testing"` is what
   [wp21-packages.md](wp21-packages.md#8-stages) S2 buys, and today the
   specifier is `../std/testing` in this repository and
   `node_modules/nish/std/testing` outside it. **Recommendation: do not fake
   it.** A special case for this one directory would be a second resolver that
   the real one then has to agree with, and the condition name itself has to
   land in `src/branding.ts` and `self/branding.ts` first (orientation rule 5).
   The ugly path is the honest signal that resolution does not exist yet.

2. **Whether `std/` is versioned separately from the compiler once WP21 lands.**
   Today it cannot be: it ships in the compiler's tarball at the compiler's
   version. **Recommendation: no, until something outside this repository
   depends on a `std/` module by name.** The library and the compiler are
   released by the same train and a `std/` module can depend on a builtin that
   only a newer compiler has, so one version for both is a true statement about
   compatibility rather than a shortcut. The moment to revisit is the first
   consumer that wants a `std/` fix without a compiler bump, and the mechanism
   is already specified — the `nish` condition and an `engines` floor
   (wp21 §6), not a second version number.

3. **What the second and third modules should be, and the criterion for
   admitting one at all.** **Recommendation: a module earns its place when more
   than one program in the repository would otherwise write the same loop**, and
   the word doing the work is *program*. The two obvious candidates fail that
   test in an interesting way: `StringBuilder`, `splitByte`, `repeatString` and
   `compareStrings` are already written in `self/strings.ts`, and `dirname`,
   `basename`, `joinPath`, `normalizePath` and `relativePath` in `self/paths.ts`
   — so a `std/strings` and a `std/path` look overdue until you notice that
   `self/` must not import `std/`, and their only other importer would be the
   runner. `self/` is excluded on purpose: the compiler is what has to build
   before the library means anything, `self/` is written in Nish-0
   ([`.claude/selfhost.md`](../.claude/selfhost.md)), and a `std/` edit that
   moved the bootstrap fixpoint would be a library change breaking the compiler
   that compiles it. The candidate that arrives with its own reason is **`sort`**
   — `readdirSync` sorts its own result because there is no `sort` for a caller
   to reach for (LANGUAGE.md, *Directories and subprocesses*), and that is a
   gap named in the normative reference rather than inferred from a corpus
   reading.

4. **Whether a `std/` module must compile in both number modes.** §4 says
   `std/text` does not. **Recommendation: yes for any new module, and fix
   `std/text` with `toI32` at each length and `charCodeAt` read.** The test
   shape already exists and costs one directory: a `tests/link/std_text_f64/`
   whose `args` file is `--number-mode f64`, the way `tests/link/strict/args`
   already carries `--strict-exports`. Both `tests/run.js` and
   `tests/self/corpus.js` read that file, so one directory pins the rule for
   both compilers at once — and its `main` has to be declared `main(): i32`,
   since `number` is not an exit code in that mode. Without such a case the rule
   is prose, and §4 is what prose turns into.

5. **Whether `std/` may carry anything that allocates heavily.** There is no GC
   and the arena is global, so a library cannot know its caller's discipline.
   **Recommendation: a `std/` function may allocate, and must never call
   `Arena.release` or `Arena.reset`.** The reason is a rule in the normative
   reference rather than a taste: a function that calls either — *or has a
   callee that does* — never gets an automatic arena scope (LANGUAGE.md,
   *Arena*), so a library that reset the arena would silently remove the scope
   from every caller in its transitive cone, and could free memory the caller
   still holds. Allocation policy belongs to the program; the library's duty is
   to say what it allocates, which is why `replaceAll` documents that it
   collects parts and `join`s once rather than concatenating in a loop — the one
   string mistake this project has measured, at 180 MB of peak arena for 88 KB
   of output ([wp14-selfhost.md](wp14-selfhost.md) §3). A module that wants a
   caller-supplied buffer instead has no way to ask for one today, and that is
   the shape to reconsider if a `std/` module ever becomes hot.

6. **Whether the packaging check should name every module.**
   `tests/run.js` requires `std/testing.ts` and `std/README.md` in the tarball;
   `std/text.ts` ships because `files` names the whole directory, but nothing
   asserts it. **Recommendation: the required list should name every module, or
   be replaced by one assertion that every `std/*.ts` in the tree is in the
   tarball.** The second is better: it cannot go stale.

7. **Whether WP18 collapses the assertion set.** With monomorphisation,
   `eqI32`/`eqI64`/`eqF64`/`eqStr` could become one `eq<T>` — but only if the
   failure message can still name the type and the value, which means a generic
   `toString`, which the language does not have and which
   [wp18-generics.md](wp18-generics.md) does not propose.
   **Recommendation: leave the API alone when WP18 lands.** Four names that
   report precisely beat one that reports `expected "3", got "4"`.

---

## 8. What this note does not decide

- **Whether `self/` ever imports `std/`.** It does not today and question 3
  gives the reason. Changing it is a [wp19-stage0-retirement.md](wp19-stage0-retirement.md)-shaped
  decision about what the compiler's source is allowed to be, not a library
  decision, and it would put every `std/` edit on the bootstrap's critical path.
- **Anything about the language.** This is the unusual thing about the package
  and worth stating explicitly: `std/` added no construct, no Phase 0 rule, no
  checker rule and no diagnostic code, and moved no golden `.ll`. The three
  builtins it depends on are WP7-shaped runtime work that landed in its own
  commit with its own measurement. A standard library is the first thing here
  that is written *in* the language rather than *about* it, which is why this
  note argues about API shape where its neighbours argue about lowering.
- **Whether `std/testing` should grow towards a framework.** Fixtures,
  parameterised cases and a discovery mechanism all want a function value, and
  §3a is why they are not coming. The honest ceiling is what the module is now:
  a tally, a report, and an exit code.
- **What a `std/` module may export.** The answer is whatever `export` accepts
  today — `export function`, `export class`, `export interface`, and an arrow
  bound to a module-level `const` ([wp22-arrow-functions.md](wp22-arrow-functions.md))
  — and wp21 §4 already states the two rules that follow, including that a
  library module must never declare `export function main`. There was nothing
  left to decide here.
