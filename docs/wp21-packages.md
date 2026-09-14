# WP21: Packages

**Stages S1 and S2 have landed; everything after them is proposed, and rough.**
Package-scoped symbols exist in both compilers (§5a, and §9 for what exactly was
built), and so does the resolution that gives them something to scope: a bare
specifier resolves through `node_modules` and the `nish` export condition (§5b,
and §10 for S2 as built). Nothing after that does.

It is the plan of record for two questions that arrived together —
"what would an extra `exports` condition alongside `cjs` and `esm` look like",
and "how should an Nish package depend on another Nish package" —
and the first thing it decides is that they are *different* questions with
different answers. Sections 5 and 6 are firm because they follow from
decisions already made; sections 7 and 8 are sketches and are expected to move.
The normative rules would land in [LANGUAGE.md](LANGUAGE.md) as each stage
does; where this note and LANGUAGE.md ever disagree, LANGUAGE.md wins.

Read [wp5-modules.md](wp5-modules.md) first — whole-program compilation and
the linkage table are what force §3 — and [wp8-interop.md](wp8-interop.md)
second, because the artifacts §2 hands to a foreign consumer are the ones WP8
already generates.

## 1. The two consumers

| Consumer | Wants | Crosses |
| --- | --- | --- |
| **A foreign host** — JavaScript on Node, JavaScript in a browser, C | a built artifact it can load and call | the C ABI, or the N-API / wasm bridges over it ([wp8-interop.md](wp8-interop.md)) |
| **Another Nish program** | the package's *functions*, checked and optimised as if they were its own | nothing: there is no boundary to cross |

Giving both the same answer is the mistake this note exists to avoid. A
foreign host is calling across a wire whose type vocabulary is narrow by
construction — numbers, `boolean`, bigint, `string`, four typed arrays, and
nothing else (WP8's table). An Nish consumer is not calling across
anything; it is compiling one program that happens to have been written by two
people.

## 2. The decision

**Source is the distribution format for Nish. Built artifacts are for
foreign hosts, and — for an Nish consumer — a cache, never a package
format.**

An `exports` map states both, because Node's resolution algorithm is worth
reusing and the condition mechanism is exactly the right shape for "which of
these five things did you come here for":

```jsonc
{
  "exports": {
    ".": {
      "nish":   "./src/index.ts",      // an Nish consumer: source
      "node":    "./build/index.node",  // JS on Node: the N-API addon
      "browser": "./build/index.mjs",   // JS in a browser: the wasm loader
      "import":  "./dist/index.js",     // plain tsc output
      "require": "./dist/index.cjs"
    }
  }
}
```

Conditions match in declaration order, so `nish` leads and `node` precedes
`import`. Only `nish` ever asks for the `nish` condition, so a bundler, a
type-checker and Node each keep resolving the package exactly as they do
today. The last three rows are what WP8's `--emit-napi`, `--emit-dts` and
`tsc` already produce; the first row is a path, not an artifact, and building
it is the whole of this note.

The `nish` row also carries the number mode, by spelling — `nish-f64`,
`nish-i32`, or plain `nish` for a package correct under either. §6 says why
that is the right place for it and why nothing else needs a manifest, and §10a
says why those two are the one pair this compiler ranks itself rather than
leaving to the order the manifest wrote them in.

`"nish"` is what it ended up being, and it is a spelling of the project's name,
so it lives in `src/branding.ts` and `self/branding.ts` with the rest of them
(orientation rule 5) as `PACKAGE_CONDITION` — where both compilers read it, which
is what makes them agree about which file a package offers.

## 3. Why source, and not a compiled library

Four reasons. None of them is a preference; each is a consequence of something
the project already decided.

### 3a. Whole-program facts are the performance thesis

`analyzeFunctions` runs over every module at once, keyed by LLVM symbol, so
purity, loop and escape facts are program-wide — and an imported function's
`declare` in the importer carries *exactly* the exporter's parameter
attributes, return attributes and function attribute set
([wp5-modules.md](wp5-modules.md), "Imported functions in IR"). That is what
lets the optimiser working on the caller fold, hoist or drop a call into
another module as if it were local. Non-exported functions get `internal`
linkage for the same reason: it is what lets LLVM inline, specialise or drop
them (WP15 §3).

A prebuilt library severs all of it. The consumer gets an opaque symbol with
no facts attached, and every proof the fixpoint would have found about the
package's internals is gone. This is not a modest regression at the boundary;
it is giving up the mechanism that WP9 and WP15 were spent buying.

### 3b. A generic has no code until somebody instantiates it

WP18 lowers generics by monomorphisation: one `define` per (template,
type-argument tuple), and the instantiation set is discovered from *call
sites* ([wp18-generics.md](wp18-generics.md) §3a). A package exporting
`function sum<T>(xs: T[]): T` has nothing to compile until a consumer asks for
`sum<i32>`. Any binary format would have to ship the template as source
anyway, which is the problem `rustc` solves by putting MIR inside an `.rlib` —
shipping source wearing a hat.

### 3c. `number` is a compile-time ABI

`--number-mode i32|f64` decides what `number` *is*. A package built in i32
mode cannot be called from an f64 program: same source, two ABIs, no
conversion. Prebuilding therefore means prebuilding the cross product:

```
{i32, f64} × {x86_64, aarch64, wasm32} × {speed, size, debug}
```

and the wasm column is not even the same runtime (`runtime_wasm.c` is
freestanding: no strings, no I/O). Eighteen artifacts per release, for a
language whose source is sitting right there and compiles in milliseconds.

### 3d. Source gets dead-code elimination that a library cannot

If the consumer compiles the package's source, everything it never calls is
`internal` and LLVM drops it. A prebuilt object can only be dropped whole.
Tree-shaking, and the real kind rather than the syntactic approximation a JS
bundler performs.

### The cost, stated honestly

Compile time now grows with the transitive dependency tree, which is the C++
and Rust cost and it is real. §8 S4 is the mitigation and it is a cache, not a
change of format.

## 4. What a source package may contain

A package's public surface is whatever `export` accepts today — `export
function`, `export class`, `export interface`, and nothing else
([wp5-modules.md](wp5-modules.md); `export const`, `export {f}`,
`export default` and `export *` are all rejected by name). Two further rules
fall out of the existing design:

- **A library package must not declare `export function main`.** Only the
  entry module may, and a package is never the entry.
- **Internals are unrestricted.** The ABI narrowness of §1 constrains the
  three *artifact* rows of the exports map, not the `nish` row. A package
  consumed as source may take and return classes, `T | null`, `string[]`,
  `Result<T, E>` — anything the language has — because nothing is crossing a
  boundary.

That second point is the payoff, and it is worth being loud about: the
package a JS host sees through `--emit-napi` is a narrowed projection of the
package an Nish consumer sees.

## 5. What blocks this today

Three things blocked it, all in the compiler rather than in packaging. The
first two are closed; §9 and §10 are the account of how.

### 5a. The symbol namespace was flat (**closed by S1**)

Two modules exporting the same name was an error, and — worse — two modules
defining the same *non-exported* name was an error too, in either linkage mode.
The reason was never the linker: `analyzeFunctions` keys the whole-program fact
fixpoint by symbol name, so a duplicate would hand each function the other's
attributes, which is a miscompile rather than a link failure
(`tests/link/duplicate_internal`, and the rule deliberately does not consult
`--no-strict-exports`).

In an ecosystem that is fatal at the first `npm install`. Two unrelated
packages that both have a private `helper()` would fail to compile together,
and two that both export `hash` certainly would. So symbols became
package-scoped, and §9 is what that turned out to mean.

### 5b. `import` has no bare specifiers

**Closed by S2**, and it was closed in two steps. First the compiler's own
package became a legal bare form, then every package did; what follows is the
section as it read before S2, with the amendment it already carried, because the
narrowing in it is still the rule for `nish/` itself.

Two bare forms were legal before S2, and neither is the general case this
section is about:

- `nish:fs` / `nish:process` / `nish:io` name *builtins*. They resolve to no
  file at all — the import renames a builtin the checker already has — so no
  resolution is involved and none of this section applies to them.
- `nish/<module>` names a standard-library module, resolved to `std/<module>.ts`
  beside the running compiler.

The second is the one that touches this section, and it is a deliberate
narrowing rather than an exception: for the compiler's *own* package there is
exactly one right answer — the `std/` that shipped with this binary, versioned
with it, unskewable against it — and that answer is also the one Node gives,
because `package.json` declares `"./*": "./std/*.ts"` and `nish/text` is
therefore a package self-reference. The compiler short-circuits to it instead
of walking `node_modules` to arrive at the same file.

The general case — `import { blake3 } from "@scope/hash"` — is what remained,
and S2 built it: resolution through Node's own algorithm with the `nish`
condition, deliberately *not* inventing a resolver, a lockfile or a registry,
all of which npm already has and none of which this project should own. §10 is
what that turned out to mean.

### 5c. Compatibility has to be a diagnostic, not a miscompile

A package declares the number modes and targets it supports; an i32 consumer
pulling an f64-only package gets an error naming both sides and the field that
said so. The same check covers a package that requires a newer compiler than
the one compiling it.

## 6. How a package says it is Nish

The `nish` condition is the whole answer, and the first draft of this section
was wrong to reach for a manifest beside it. Its presence is the claim, its
value is the entry module, and its *absence* is what lets a bare import of an
ordinary npm package fail with "package `lodash` has no Nish entry
point" (a new `NL3xxx` code) rather than a module-not-found that reads like
the consumer's own mistake.

### The number mode goes in the condition

The mode is the one semantic flag a package can be wrong about without saying
so. The consumer picks it — one `--number-mode` for the whole program — but
they picked it for *their* code, and it tells them nothing about whether a
dependency was written under the other one. The demonstration is in this
repository, in a benchmark that has been checked in since WP9.
`bench/strbuild.ts` divides once:

```ts
const step = (count + 31) / 32; // ceil(count / 32)
```

That comment is true in i32 mode, where `/` truncates, and false in f64 mode,
where `step` is fractional, `piece(i)` then formats numbers like `1.5,`, and
the built string comes out three times too long. Compiled both ways the
program builds, links, runs, exits 0 — and prints a different answer:
**806394** in i32 mode, **2410293** in f64. Nothing in the source announces
which mode it is for except the comment.

Most f64-flavoured code is not so quiet. `Math.sqrt` on a `number` in i32 mode
is `` `Math.sqrt` requires an f64 argument, got i32 (use --number-mode f64 or
toF64(x)) ``, a `1.5` literal is `Non-integer literal`, and `bench/result.ts`
does not compile in f64 mode at all because `&` needs two integer operands.
So the silent window is narrow — division, and what is built on it — but
inside it the failure is a wrong answer rather than a diagnostic, which is
exactly the case a package boundary should catch.
[wp9-optimisation.md](wp9-optimisation.md#what-the-number-mode-costs) has the
rest of the mode comparison, including what i32 buys to be worth the split.

So the mode rides in the condition rather than in metadata:

```jsonc
"exports": { ".": { "nish-f64": "./src/index.ts" } }   // f64 only
"exports": { ".": { "nish":     "./src/index.ts" } }   // correct under either
```

`nish --number-mode f64` asks for `["nish-f64", "nish"]` and `--number-mode
i32` for `["nish-i32", "nish"]`, so a both-modes package matches either, a
single-mode package matches one, and a mismatch is a *resolution* failure at
the package boundary — before a byte of the dependency is checked, and with no
new file format, sidecar or manifest key to keep in sync. A package that needs
genuinely different source per mode gets that for free by listing both.

That list is asked for **in that order, whichever order the manifest declares
the two conditions in**, and it is the one place the reader departs from Node's
condition matching (§10a, `tests/link/package_mode_order`). Node takes the
first key of the object the consumer asked for, which is right when the
conditions are rivals — `node` before `import` is a package choosing — and
wrong here, because `nish-f64` is not a rival of `nish` but `nish` refined by
the mode. Under declaration order a package writing `nish` above `nish-f64`
would ship f64 source that is never compiled and get no diagnostic saying so,
which is the silent failure this whole section is arguing against.

One implementation note: `nish`'s resolver has to read the `exports` object
itself rather than delegating blindly, because the good message —
"`@scope/hash` supports Nish in f64 mode only; this program is
compiling in i32" — needs to know which conditions the package *does* offer.
A plain resolver would only be able to say "unresolved".

### The other two need no declaration either

- **Runtime capabilities** — strings, the arena, file I/O, `spawnSync`,
  `getenv` — are not the package's to declare, because the compiler already
  knows both halves: the target, and which builtins the whole program touches
  (the same fact that decides whether the runtime ABI prelude is emitted
  without `--runtime-decls`). "`@scope/hash` calls `readFileSync`, which the
  freestanding wasm profile has no runtime for" is a whole-program diagnostic,
  not a manifest field.
- **A compiler version floor** goes in `"engines": { "nish": ">=x" }`, the
  slot npm already has for exactly this.

Which leaves an `--emit-manifest` sidecar with nothing left to carry, and it
should not be built. The general rule the draft violated: **a fact the
compiler can recompute is not metadata.** Package metadata earns its place
only where resolution has to happen *before* the compiler can look, which is
true of the mode (it selects the file) and false of everything else here.

### Why none of this is a trust boundary

Unlike "is this package really ESM", Nish-safety needs no trust,
because the consumer's own build re-establishes it from source every time and
the compiler is the verifier. A package whose condition lies, or whose source
has drifted, is caught on the first compile that uses it. Everything above is
therefore an *error-quality* feature — fail at the package boundary, early,
naming the package — and not a correctness or security boundary. That is also
why nothing here needs a signature or a registry: they would protect a
property that is recomputed anyway.

One diagnostic obligation follows. When a dependency's source does fail to
compile, the message must say so — the location is in `node_modules/<pkg>/…`
and the reader's next move is an upstream bug report, not a hunt through their
own code. A compile error inside a dependency and one in your own program
should not look alike.

## 7. What this note does not decide

- **Diamond dependencies.** If A wants `hash@1` and B wants `hash@2`,
  package-scoped symbols let both link — but a `Point` from `hash@1` is a
  different `%struct` from `hash@2`'s and they are not interchangeable, which
  needs a diagnostic that says so in those words rather than a type error
  about two identically-named classes.
- **Whether the compiler or a separate tool resolves.** §5b assumes the
  compiler reads `node_modules`. A thin resolver that hands `nish` a flat
  list of files is the alternative and is less coupled.
- **Prebuilt closed-source distribution.** If it is ever needed, the shape is
  the `.d.nish.json` sidecar that MASTER_PLAN §5 WP5 specified and
  [wp5-modules.md](wp5-modules.md) set aside as unnecessary ("separate
  compilation of a library against a sidecar can be added when a use case
  needs it") — signatures *plus* the proven attributes, so the importer's
  `declare` keeps its facts. It costs generics, pins the mode and the target,
  and should not be built until somebody asks for it by name.
- **The trust boundary.** Source packages mean the compiler compiles
  third-party code, which is what every TypeScript project already does; the
  thing worth noticing is that it removes the `postinstall` step that native
  npm packages need, so the supply-chain surface gets *smaller*, not larger.

## 8. Stages

| | Stage | Depends on | Notes |
| ---: | --- | --- | --- |
| S1 | Package-scoped symbols | — | **done**, §9. §5a. No language surface, and the diff turned out small rather than large: the root package's prefix is empty, so not one golden `.ll` moved. |
| S2 | Bare specifiers and the `nish` condition | S1 | **done**, §10. §5b. The condition name landed in `branding.ts` on both sides. |
| S3 | The boundary diagnostics | S2 | §5c, §6. No new artifact: the `NL3xxx` entries for a missing or mode-mismatched `nish` condition, a version floor from `engines.nish`, a builtin the target has no runtime for, and a compile error attributed to a dependency rather than to the consumer. |
| S4 | The build cache | S2 | Content-addressed by (package version, number mode, target, profile, compiler version). Invisible to the package author; a pure compile-time optimisation, and the answer to §3's stated cost. |
| S5 | Prebuilt distribution | S4 | §7. Deferred, possibly permanently. |

S1 was the only one with no design questions left open, which is why it went
first, and it is done; S2 followed it and is done too. **S3 is the next stage
and is the one to resist over-building**: §6 already talked one manifest out of
existence, everything left in it is a message rather than a file, and S2 left it
exactly one place to start — the single "has no Nish entry point" diagnostic
that S2 answers every resolution failure with, carrying a `TODO(WP21 S3)` in
`src/manifest.ts`, `self/manifest.ts` and both `compilation.ts` files. Nothing
here is on the M4 critical path and none of it should delay the freeze.

## 9. S1 as built: package-scoped symbols

### 9a. The scheme, and the one it replaced

§5a offered two spellings — `pkg@version.symbol` or a content hash — and both
of them move *every* symbol in *every* program, because both qualify the
program's own code as readily as a dependency's. That is a rewrite of every
golden `.ll` in `tests/cases/`, of the link goldens, of the `--emit-header` asm
labels, and of the three interop sidecars, to buy nothing at all for the
single-package programs that are the only programs that exist today. It was
rejected for that reason.

What landed instead is the same idea with one asymmetry: **the root package's
prefix is empty.**

- A module belongs to exactly one package. The *root package* is the program
  being compiled; a module under `<...>/node_modules/<name>/` (or
  `.../@scope/<name>/`) belongs to that package instead.
- Every function, method and constructor a module declares is emitted under
  `<prefix><name>`, where the prefix is `""` for the root package and
  `<mangled package name>.` otherwise — the `.` that `Point.shifted` already
  uses, so `--emit-header` declares such a symbol exactly as it has always
  declared a method, as `hash_helper` with an asm label.
- The whole-program fact table is keyed by that symbol. `analyzeFunctions` did
  not have to change at all, which is the point: the key it was already using
  stopped being a bare name.

So a program of one package — which is every program that could be compiled
before this landed — emits byte for byte the IR it always did, and the
`docs/IR_COOKBOOK.md` entries, the goldens and the C ABI of every exported
function are untouched. A prefix appears only where a second package does,
which is a program that did not compile at all until now.

The qualification happens in one place per compiler, at the end of pass 1
(`Checker.qualifySymbols` in `src/checker/index.ts` and `self/checker.ts`),
after every signature exists — so a free function, a method and a constructor
are scoped by the same line of code and nothing added later can forget to be.

That single place is also what makes the scheme compose with
[wp18-generics.md](wp18-generics.md). A monomorphised instantiation's symbol is
built from its template's symbol, and the template's symbol is package-scoped
before any instantiation exists, so `sum<i32>` from two packages is two symbols
without the generic mangling needing to know that packages are a thing.

### 9b. How a module says which package it is in

It does not; its path says it. There is no manifest, no resolver, no flag and
no language surface, which is what lets S1 land years before S2: the identity
is read off the module name the compiler already carries, and that name is the
*same string in both compilers* (WP19 §A3), so stage0 and stage1 put a module
in the same package without either of them needing a working directory.

The entry's own package directory is what *is* the root package, rather than
"no `node_modules` on the path". Comparing directories rather than names is
what stops a compiler invoked on a file that itself lives inside
`node_modules/<pkg>` from deciding that its own entry is one of its
dependencies.

This is a placeholder and is labelled as one in both files. S2 resolves bare
specifiers through Node's algorithm with the `nish` condition, and the package
a module belongs to becomes something the resolver *states*; when that lands,
only the mangling below it survives.

### 9c. Where S1 deliberately stops

- **Struct names are still program-wide.** `%struct.<name>` is a module-level
  LLVM type and `StaticType` equality compares names, so two packages that both
  declared `Node` would silently be treated as declaring one type. Rather than
  half-scope that, the Compilation now *reports* it — naming both packages, in
  the words §7 uses — so the hole is a diagnostic instead of a miscompile.
  Scoping the layouts, and saying what a `Point` from two versions of one
  package means, is §7's question and not this stage's.
- **Versions are not in the identity.** §5a floated `pkg@version.symbol`;
  reading a version means reading a manifest, which §6 spent a section
  refusing. Two copies of one package name in one build therefore still
  collide, and they collide *loudly*, through the same clash check.
- **The mangling is not injective.** `@scope/hash` and `scope_hash` reduce to
  one prefix. They do not have to be distinguishable, because the clash check
  runs over the *qualified* symbols: two packages that reduce to one prefix are
  refused with a name in the message rather than silently sharing a fact table.

### 9d. What proves it

`tests/link/two_packages/` is the case §5a names: two packages, each with a
private `helper()` and an exported `scale()`, and a program that keeps a
private `helper()` of its own. Three functions called `helper`, two called
`scale`, one program; every `helper` computes something different, so the exit
code is right only if each call reached its own package's. It compiles, it
links, `llvm-as` and `opt -passes=verify` accept every module, each importer's
`declare` matches its exporter's `define` attribute for attribute, and the
binary exits 7.

`tests/link/duplicate_internal` is the same rule inside one package and is
unchanged: a name still has to be unique within the package that declares it,
and `internal` linkage still buys inlining rather than a second namespace.
`tests/link/two_packages_struct` is the negative for where S1 stops — two
packages, a private `Node` in each, refused by name with both packages in the
message.

Everything else is the proof that nothing moved: every golden `.ll` in
`tests/cases/` and `tests/link/` is byte-identical, `tests/self/goldens/` needed
no regeneration, and `tests/self/ir_oracle.js` — which compiles the corpus with
*both* compilers and diffs the IR byte for byte, `tests/link/two_packages`
included — is what says the two implementations scope symbols the same way.

## 10. S2 as built: bare specifiers and the `nish` condition

### 10a. What resolves, and what it resolves to

`import { blake3 } from "@scope/hash/blake3"` now compiles. The specifier is
split into a package name and an `exports` subpath (`@scope/hash` and
`./blake3`), `node_modules/<name>` is looked for in the importing file's
directory and in every directory above it — Node's algorithm, including its rule
that a directory already called `node_modules` is stepped over wherever the
module's own name spells one — and the file compiled is the one that package's
`exports` map offers for the `nish` condition.

Two constants landed in `branding.ts` on both sides, which is where §2 asked for
them: `PACKAGE_CONDITION` (`nish`) and `packageConditionFor`, which spells the
mode-qualified `nish-i32` / `nish-f64`. The compiler asks the whole condition
map for its own mode and only then for the plain one. A package correct under
either mode declares `nish` and matches both; one that needs different source
per mode declares both and gets two entry points for free, **in either order**.

That last clause is the one thing here Node would do differently, and it was the
other way round until the review of this stage: the reader matched the two
conditions in one walk, so the manifest's declaration order decided, as it does
in Node. It made `{"nish": "./any.ts", "nish-f64": "./f64.ts"}` compile
`any.ts` for an f64 program and leave `f64.ts` dead with nothing said — a
package author's ordinary mistake turning into precisely the silent wrong answer
§6 introduced the mode-qualified condition to prevent. Declaration order is
right for *rival* conditions, where the package is choosing between artifacts it
built; these two are not rivals, since `nish-f64` is `nish` refined by the mode,
and the refinement is not the package's to rank. So the rank is the compiler's,
it is written down in both `manifest.ts` headers, and
`tests/link/package_mode_order` and `tests/link/package_mode_order_f64` are two
packages that declare the plain condition first and whose exit code is right
only if the mode-qualified file is the one compiled.

Nothing about the module downstream of resolution is special. The file is
compiled, checked, analysed and emitted like any other module, which is §3 in
one sentence: for an Nish consumer the distribution format is source, so there
is no boundary to cross and no second code path to maintain.

**"Every directory above it" is the whole climb in both compilers, and it took
three goes to be.** stage0 used to resolve the entry to an absolute path and
climb to `/`. stage1 has no `process.cwd()` to build one from — WP19 §A3 keeps
that builtin out, and module identity is the path as written — so its walk ran
out where `dirname` does, which for the usual relative entry is `.`: the working
directory. That made `proj/node_modules` beside `proj/src/main.ts`, compiled as
`nish main.ts` from `proj/src`, resolve under stage0 and fail under stage1 with
`` Cannot find package `pkg` ``, and that layout is the one npm produces rather
than an exotic one. Above `.` the walk is now *spelled* — `..`, `../..`, one
level per step — and the operating system resolves those against the working
directory `process.cwd()` would have answered, so the two compilers search the
same directories. One thing follows from spelling it rather than computing it
and is written at `parentDirectory` in both files: the walk cannot recognise the
filesystem root (`/..` is `/`), so a limit ends it rather than the root does —
256 levels, which is two orders of magnitude past any directory a compiler is
run in and keeps a failed resolution at about 10 ms, where probing PATH_MAX's
worth of levels cost 1.8 s of kernel time.
`tests/link/package_above` is that layout, compiled from the subdirectory by
both compilers and compared byte for byte (§10e).

**The third go was the `node_modules` ancestor, and it is what decided whose
walk the other one copies.** Node steps over a directory already called
`node_modules` instead of searching it, so `node_modules/node_modules/<pkg>` is
a package Node never finds. stage0 could apply that rule the whole way up,
because an absolute path names every ancestor; stage1 cannot, because above the
name's own root it has only `..`, which names a directory without naming it.
Learning the name from below would take `getcwd` or an inode to compare — the
classic `pwd(1)` algorithm — and the language has neither, by two separate
decisions (WP19 §A3, and `nish:fs` has no `statSync`). So `nish main.ts` run in
`R/node_modules/app` with `R/node_modules/node_modules/zed` installed was
`` Cannot find package `zed` `` from stage0 and a clean compile from stage1: a
program that compiles with one compiler and not the other, which is the one
outcome this project will not ship.

It was closed by driving **both** walks from the importing module's *name* —
the string both compilers hold for it (WP19 §A3) — rather than one of them from
the working directory. `src/compilation.ts` grew the same `parentDirectory` and
the same 256-level limit, and the two now visit the same directories in the same
order because they are given the same input and take the same steps, which is a
stronger statement than "they agree about the tests". What it gives up is Node's
rule *above the name's own root*: neither compiler can tell that `..` is a
`node_modules`, so neither steps over it. That changes an answer only where a
`node_modules/node_modules/<pkg>` actually exists — the rule is unobservable
otherwise, since the directory it declines to search has to be there for the
declining to matter — and npm does not produce one. Everywhere the name spells
the ancestor, including every dependency's own imports, the rule holds exactly
as Node states it. `tests/link/package_doubled` is that tree, compiled both
ways by both compilers: found from inside, refused from the root, the same
answer from each (§10e).

### 10b. The manifest reader, and why stage0 does not use `JSON.parse`

`src/manifest.ts` and `self/manifest.ts` are the same narrow scan rather than a
parser and a hand-rolled twin. That is the one design decision in this stage
worth arguing about, so it is written down: stage1 has no `JSON.parse`, the two
compilers must select the *same file* for the same manifest, and a program that
resolved under stage0 and not under stage1 would be a program that compiles with
one compiler and not the other. Delegating on one side and scanning on the other
would have made that a question about malformed input rather than a fact.

What the narrowing costs is stated in both module headers rather than left to be
discovered: only the `nish` conditions are honoured (`default`, `import` and
`node` are skipped, not matched — a `default` target is JavaScript and this
compiler cannot compile it), a subpath is an exact key rather than a `"./*"`
pattern, a target is a string beginning with `./` with no `..` segment and
no backslash escape, and the mode-qualified condition outranks the plain one
whatever order the manifest declares them in (§10a). Node's one-entry shorthand
— an `exports` object with no
`.`-prefixed key is the condition map for `.` — is read, because a one-export
package is the common case and writing it that way is not a mistake.

### 10c. Where the package identity now comes from

§9b called the path rule a placeholder for the one the resolver would state, and
S2 stated it: a module reached by a bare specifier is in the package whose
manifest the resolver just read. What the path rule still answers is every
module the resolver is never asked about — a relative import that points into
`node_modules` (`tests/link/two_packages`, unchanged), and a dependency's own
relative imports, which stay in their dependency. The two rules agree wherever
both apply, which is what §9b predicted, so the placeholder shrank rather than
disappeared and `packages.ts` says so.

### 10d. What S2 deliberately stops short of

- **One diagnostic, not four.** Every failure to find a Nish entry point — no
  `exports`, no such subpath, no `nish` condition, a shape the reader does not
  understand — is `` Package `X` has no Nish entry point ``. S3 is the stage that
  splits it into the specific ones §5c and §6 want, the mode mismatch named with
  both modes among them, and a `TODO(WP21 S3)` sits at each of the four places
  that would change.

  One message does not license a false one, and the second clause of this one
  was: it said the package's `exports` `` declares no `nish` condition ``, which
  the ranking above can make untrue — a manifest whose `nish-i32` names
  something that is not a file never reaches its perfectly good `nish` row, and
  the author who checks that row finds it correct and is no further forward. It
  reports what this compiler came away with instead — `` its `exports` gave this
  compiler no file to compile for `.` `` — which holds for every shape that
  reaches it. The registry calls that `NL3015` and keeps `NL3013` reserved for
  the spelling it replaced (`tests/wordings/unreachable.txt`).
- **No `engines.nish` floor**, for the same reason: it is a message rather than
  a file, and it is S3's.
- **No `realpath`, so a symlinked package is a second package.** Node's resolver
  realpaths what it finds, which is how one package reached both as
  `node_modules/shared` and as `node_modules/app2/node_modules/shared` — a
  symlink to the first, and the layout pnpm always produces and npm produces
  whenever it cannot hoist — is one module there. Here it is two, and the S1
  clash check refuses the program: `` Exported function `val` is also defined
  in … ``. That is a real limitation rather than a decision, and it is *declared*
  rather than fixed for one reason: the language has no `realpath` builtin, so
  `self/` cannot call one, and a stage0 that resolved symlinks would compile
  programs stage1 refuses — trading a limitation both compilers share for a
  divergence between them, which §10b spends a paragraph refusing. Closing it
  means the builtin (a `nish:fs` addition, and so another work package's call) or
  a rule that needs no path at all, such as deciding package identity from the
  manifest rather than from the directory — which is S3's question because it is
  the same question diamond dependencies ask (§7). `tests/link/package_symlink`
  is the case: both compilers run it and both must refuse it with the same
  sentence, so the day either one stops refusing is a failing test rather than a
  surprise.
- **No cache.** §3's stated cost — compile time grows with the dependency tree —
  is unpaid, and S4 is the payment.
- **Struct names are still program-wide**, exactly as §9c left them.
- **A dependency's exports are not the program's C ABI**, and no stage of this
  note makes them one. `--emit-header`, `--emit-dts` and `--emit-napi` declare
  the *root package's* functions (§4: a package's artifact rows are the
  embedding program's to choose), so the way a dependency's function should
  reach a host is a re-export from the root package — `export { f } from "pkg"`,
  which the language does not have and which `docs/LANGUAGE.md` rejects by name.
  It waits on that construct rather than on a stage here, and
  `src/interop/abi.ts` and `self/interop_abi.ts` say so at the line that
  skips a dependency's module.

### 10e. What proves it

`tests/link/package_bare/` is the positive: a program importing `pkg_bare`, the
`./util` subpath of that same package, and the scoped `@scope/hash`, whose
manifest declares `nish-i32` before `nish` so that the i32 compile picks a
different file from the one an f64 compile would. Each package keeps a private
`helper()` and so does the program, so the exit code is 7 only if every call
reached the file the condition selected and the symbol its package's prefix.

`tests/link/package_mode_order/` and `tests/link/package_mode_order_f64/` are
that fixture's other half, and the half the first review of this stage found
missing: the same two conditions declared the other way round, plain `nish`
above the mode-qualified one, one package per mode. Under declaration-order
matching each compiles the mode-agnostic file and exits 164; each exits 7 only
because the compiler ranks the two conditions itself (§10a). A fixture in the
order that already worked is what let the wrong rule survive a round of review,
so both orders are pinned now.

`tests/link/package_above/` is the walk: the manifest beside `src/` rather than
inside it, compiled as `nish main.ts` from `src/`, which is the ordinary npm
layout compiled the ordinary way and the case that tells a walk that stops at
the working directory from one that climbs past it. `tests/run.js` compiles it
with **both** compilers from that subdirectory and compares every byte of every
module, because a program stage0 resolves and stage1 does not is exactly the
divergence `tests/self/` exists to prevent. The other fixtures cannot see this:
the harness spawns the compiler with the repository root as the working
directory and names the entry by path, so their walk never leaves the fixture.

`tests/link/package_doubled/` is the `node_modules` ancestor, and it is
compiled twice because the answer is supposed to depend on how the entry is
named. From inside `node_modules/app`, where the ancestor is `..` and no name
says what it is, both compilers search it and both compile the program; named
from the fixture root as `node_modules/app/main.ts`, where the ancestor is
spelled, both step over it and both refuse with `` Cannot find package `zed` ``.
Each run is made with both compilers and compared — every byte of every module
for the first, the exit status and the whole of stderr for the second — because
what is being pinned is not which answer they give but that it is the same one
(§10a).

`tests/link/package_not_nish/` is the negative §6 asks for by name: an ordinary
npm package, with `import`, `require` and `default` rows and no `nish` one.
`tests/cases/reject_bare_package` is the package that is not installed at all,
and `tests/cases/reject_bare_import` is a specifier that is neither relative nor
a package name. `docs/cookbook/mod_package.ts` is the lowering, and it shows the
only thing a package changes about the IR: the prefix on the imported symbol.
