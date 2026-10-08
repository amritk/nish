# WP26: The standard library

**Status: landed.** `std/` arrived in 0.2.0 with `std/testing` and
`std/text` ([#47](https://github.com/amritk/nish/pull/47)) and `std/json`
([#65](https://github.com/amritk/nish/pull/65)), and the two programs written
on them, [`tests/nish/run.ts`](../tests/nish/run.ts) and
[`tests/nish/cli.ts`](../tests/nish/cli.ts). It has since grown `std/pair`
(0.9.0, [#172](https://github.com/amritk/nish/pull/172)), the modules behind
the global `Map` and `Set` and `nish/map` ([wp32-map.md](wp32-map.md)),
`nish/threads` ([wp29-thread-surface.md](wp29-thread-surface.md)), the source
of `nish:secret`, and the `nish/crypto/*` and `nish/net/*` stacks
([wp34-hosting-cs.md](wp34-hosting-cs.md)).
[`std/README.md`](../std/README.md) is the current module list and the
operational rules; [LANGUAGE.md](LANGUAGE.md) is normative for the language.
This note keeps the *why* behind both.

Read [wp21-packages.md](wp21-packages.md#2-the-decision) first: "source is the
distribution format" is the decision `std/` leans on entirely.

## 1. What `std/` is, and what it is not

**A `std/` module is an ordinary Nish source file compiled into the program
that imports it.** There is no library artifact and no link step. A program
reaches it as `nish/<module>`, which the compiler resolves to the `std/` beside
the running binary — the one right answer for the compiler's own package, and
the one Node and `tsc` give through `runtime/nish.mjs` and `tsconfig.json`
([wp21-packages.md](wp21-packages.md#5b-import-has-no-bare-specifiers) §5b). A
relative specifier works too. Four modules are known to the compiler —
`collections.ts`, `map.ts`, `threads.ts` and `secret.ts` — because it lowers
their calls itself; `std/README.md` says how each one is.

### 1a. What it buys, measured

Each was checked on the emitted IR of a program importing `std/text` when the
module landed:

- **The whole-program fact fixpoint sees through it.** `isBlank` came out
  `nounwind willreturn readnone`, `contains` `readonly`, and `splitLines` with
  `readonly nocapture` on its parameter. A compiled library could carry none of
  that ([wp21-packages.md](wp21-packages.md) §3a).
- **It inlines like a local function.** `trim` is `trimEnd` over `trimStart`
  over a private helper; the linked binary has one function where the source
  has four.
- **What the program does not call is dropped**, by `-ffunction-sections
  -Wl,--gc-sections` (an exported function is an external symbol, so this is
  not `internal` linkage). At the `speed` and `size` profiles a program
  importing three `std/text` functions and calling none is byte-identical to
  one without the import.

The costs: every importer compiles the module every time (wp21's S4 cache is
the mitigation); `std/` has no version of its own, because it ships in the
compiler's tarball and may depend on a builtin only that compiler has.

## 2. The line between a `std/` module and a builtin

**A builtin is for what the language cannot express. A `std/` module is for
everything it can.** Three things qualify as "cannot express":

1. **A syscall** — `readdirSync`, `spawnSyncTo`, `monotonicNanos`, and since
   then the `nish:net` sockets.
2. **An operation the runtime must own for memory-layout reasons** — allocating
   a string or an array means agreeing with `runtime/nish.h` and the runtime.
3. **An effect the whole-program pass has to see** — `monotonicNanos` is a
   `write` so that two reads with work between them do not fold into one; no
   library function can state that about itself.

The test is not "does this call into C" — `std/text` calls `nish_str_new` and
friends because `substring` and `push` are built from them — but **"does this
need a C function that does not exist yet"**. The rule bites both ways: do not
add a C function for something `std/` could do (the runtime has a byte budget
per translation unit, [wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget),
and a library function costs it nothing); and do not write a module for
something only C can do, such as a locale table or a wall clock, because a fake
would be wrong in a way no type catches. WP34 applied the same line to the
network stack: sockets are `nish:net`, everything above them is
`nish/crypto/*` and `nish/net/*`.

**Functions earn a place by a repeated loop; types by a shared name.** A
function earns its place when more than one program would otherwise write the
same loop. A two-field interface is not a loop, so this note first refused
`Pair<A, B>`, and that answer was reversed: Nish types are nominal, so a `Pair`
every program declares for itself is a different `Pair` in each, and a package
returning one cannot hand it to a caller holding another. A vocabulary type is
shared only if it lives in one place, and once WP18 G5 and G7 made a generic
interface exportable, the library is that place
([wp23-language-surface.md](wp23-language-surface.md) §5).

## 3. What the language's restrictions did to the API

Each item is a language decision the library absorbed, and each removed the
shape a JavaScript library would reach for first.

### 3a. A function is not a value, so there is no `test(name, callback)`

A callback the whole-program pass cannot name is an unknown callee, and no
purity, termination or escape fact survives one — the argument
[wp25-inheritance.md](wp25-inheritance.md) §2 makes against a vtable. So
`Suite` is an object a program drives with straight-line calls:
`t.eqI32("sumOf", sumOf(xs), 25)`. Function-typed parameters arrived later
(LANGUAGE.md, [Function parameters](LANGUAGE.md#function-parameters)), each
callee specialised into a `define` of its own, but a function still cannot be
stored, so a registry of tests, `beforeEach` and discovery are still out of
reach. A test program reads in execution order, which is what was gained.

### 3b. There is no `try` / `catch`, so an assertion records and *answers*

An assertion cannot throw, so each prints its outcome, tallies it and returns a
`boolean`, and `done()` turns the tally into the exit code. The `boolean` is
load-bearing: an out-of-range index ends the process, so "check the length,
then read the element" has to be a branch. `Result<T, E>` is the wrong type
here: a `Result` cannot be dropped ([wp16-results.md](wp16-results.md) §4), and
every assertion is an expression statement.

### 3c. There were no generics, so there is one assertion per type

`eqBool`, `eqI32`, `eqI64`, `eqF64`, `nearF64`, `eqStr`, and `ok`. WP18 has
since landed generics, and the set stays: one `eq<T>` could only report as
precisely with a generic `toString`, which the language does not have, and a
string-interpolating `eq` would report `expected "3", got "4"` for two numbers
and allocate at every passing assertion. `eqF64` is an exact `fcmp oeq` so that
a `NaN` fails; `nearF64` carries the tolerance.

### 3d. There are no optional or default parameters

So `skip` takes its reason, `nearF64` its tolerance and `fail` its detail, with
the empty string meaning "the name already says it". In this language an
optional argument is a second name, which is also why `spawnSyncTo` is a second
builtin.

### 3e. One flat symbol namespace

A function name is unique within its package whether or not it is exported,
because the attribute fixpoint is keyed by symbol (`tests/link/duplicate_internal`).
When `std/` landed it shared its importer's namespace, so a program declaring
its own `isBlank` could not import `std/text`. Since WP21 S2 a module reached
as `nish/<module>` is package `nish` — decided by the specifier, not by the
path, so a checkout and an installed compiler agree — and its symbols carry
the `nish.` prefix (`tests/link/std_package_scope`). What remains is that every
`std/` module shares package `nish`'s namespace with every other, so **a `std/`
module's private functions carry its own name** (`isTextBlankByte`,
`quicFrame…`, `hpack…`), the way `src/manifest.ts`'s helpers are
`manifest`-prefixed. Module constants are folded at their uses and are exempt.

### 3f. A function is not a value, so `jsonFields` shares a step, not a loop

`jsonField(object, name)` scans from the start of the object on every call, so
a program that wants a diagnostic's `code`, `line` and `message` reads each line
three times. `jsonFields(object, names)` reads it once and answers one slot per
name, in the order of `names`; slot `k` is what `jsonField(object, names[k])`
answers, in every case: a name that is not there, a duplicated key (the first
wins), a name asked twice, and a malformed object, where both stop at the same
member. It stops as soon as every name has answered.

The JavaScript shape would be one scanner taking a callback per member. With no
function values, the two readers instead share the step that reads one member:
`jsonReadMember` fills a `JsonMember` — the key's bounds, the value's bounds and
the next key — and answers whether there was a member to read, so each reader
is a short loop over it and neither can find a member the other does not. The
`JsonMember` never leaves its reader, so it is a stack slot, and the step adds
no allocation to `jsonField`.

What `jsonFields` adds is its answer. Each value is stored into the array it
returns, and a stored allocation is where the escape analysis stops following
one, so a loop that calls it is refused its per-pass release, and
`using a = arena()` around the call is refused outright. A function whose
parameters are only strings and numbers still takes everything back when it
returns (`tests/link/std_json`: 1,000 calls leave `Arena.used()` where one
left it); a loop that has to run in constant memory calls `jsonField`, which
keeps the per-pass release. §7 item 8 is the open question.

## 4. The number-mode rule

**A `std/` module spells its widths — `i32`, `i64`, `f64` — never `number`, and
converts at every point where a builtin hands it a `number`.** The first half is
necessary and not sufficient: `s.length`, `a.length` and `charCodeAt` answer
`number`, which is `f64` under `--number-mode f64`, so a module that declared
every width of its own still failed to compile there (`std/text` had 8 errors).
`toI32(x)` is identity on an `i32` and a saturating `fptosi` on an `f64`, so
reading each length through it once per function makes the module one program
in both modes at no cost to the default. `tests/link/std_text_f64` pins it, and
each `nish/crypto` and `nish/net` module has `_f64` link cases
(`tests/link/crypto_sha256_f64`, `net_tls_rfc8448_f64`, …) that run the same
checks under `--number-mode f64`.

## 5. How a `std/` module is tested, and why that is the rule

**Every `std/` module ships with a `tests/link/<name>/` case.** `tests/link/` is
the only place a multi-module program runs end to end, and it is what puts the
module in front of the self-hosting oracles (`linkPrograms()` in
`tests/self/corpus.js`). `std/` is deliberately not in `CORPUS_DIRS`: every
entry there is compiled standalone, and a library alone is a shape no user
produces — the comparison worth making is through an importer, where §1a's
attributes are computed over the caller as well. A `std/` module with no
importer in `tests/link/` is compiled on no run. A module whose failure path is
observable gets two cases, one per outcome (`std_testing`, `std_testing_fail`),
because its report is its output and a golden is what keeps the wording a
contract. `tests/run.js` also type-checks `std/` against
[`runtime/nish.d.ts`](../runtime/nish.d.ts) under `tsc --strict`, and requires
every `std/**/*.ts` on disk to be in the published tarball.

## 6. What it cost

When it landed: no construct, no Phase 0 or checker rule, no diagnostic code
and no moved golden; three builtins (`readdirSync`, `spawnSyncTo`,
`monotonicNanos`, 516 bytes of runtime `.text`, dropped by `--gc-sections` from
a program that calls none of them). `tests/nish/run.ts` shows the language can
host its own harness; it covers the golden cases and link programs, not the
pipeline checks `tests/run.js` makes, and every skip it takes is counted and
named.

## 7. What is still open

1. **Bare specifiers. Answered**: `nish/<module>` resolves, and third-party
   packages resolve through WP21 S2.
2. **Whether `std/` is versioned separately from the compiler.**
   Recommendation: no, until something outside this repository wants a `std/`
   fix without a compiler bump; the mechanism would then be the `nish`
   condition and an `engines` floor (wp21 §6), not a second version number.
3. **The admission criterion.** A module earns its place when more than one
   program would otherwise write the same loop. `src/` may not import `std/`
   (the compiler must build before the library means anything, and a `std/`
   edit must not move the bootstrap), so `src/strings.ts` and `src/paths.ts`
   do not count as importers. `std/json` was admitted with one importer, as the
   exception: it reads this project's own `--json` contract, which every Nish
   program reading compiler output needs. `contains`, `containsAll` and
   `eqLines` moved into `std/testing` only after a second harness needed them.
   The WP34 stack was admitted by owner decision (wp34 S2), each module with
   its own link cases.
4. **Whether a module must compile in both number modes. Answered: yes** (§4).
5. **Allocation.** A `std/` function may allocate and must never call
   `Arena.release` or `Arena.reset`: a function with such a callee loses its
   automatic arena scope (LANGUAGE.md, *Arena*), so a library that reset the
   arena would silently strip the scope from every caller. It documents what it
   allocates, as `replaceAll` does by collecting parts and `join`ing once.
6. **Whether the packaging check names every module. Answered: it asks the
   tree**, so a module cannot ship unchecked as the directory grows.
7. **Whether WP18 collapses the assertion set. Answered: no** (§3c).
8. **Whether a loop over `jsonFields` keeps its per-pass release.** Not today
   (§3f). The values it stores go into an array the call itself allocated and
   returns, and nothing older than the call can reach that array, so a store
   into it might flow as "returned" rather than "stored". Whether it can
   without loosening anything else the analysis proves is for that change to
   show, in `src/escape.ts`; until then the per-pass release is `jsonField`'s
   alone.
