# WP21: Packages

**Proposed, not implemented, and rough.** Nothing here exists in the compiler
today. It is the plan of record for two questions that arrived together —
"what would an extra `exports` condition alongside `cjs` and `esm` look like",
and "how should an AmritScript package depend on another AmritScript package" —
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
| **Another AmritScript program** | the package's *functions*, checked and optimised as if they were its own | nothing: there is no boundary to cross |

Giving both the same answer is the mistake this note exists to avoid. A
foreign host is calling across a wire whose type vocabulary is narrow by
construction — numbers, `boolean`, bigint, `string`, four typed arrays, and
nothing else (WP8's table). An AmritScript consumer is not calling across
anything; it is compiling one program that happens to have been written by two
people.

## 2. The decision

**Source is the distribution format for AmritScript. Built artifacts are for
foreign hosts, and — for an AmritScript consumer — a cache, never a package
format.**

An `exports` map states both, because Node's resolution algorithm is worth
reusing and the condition mechanism is exactly the right shape for "which of
these five things did you come here for":

```jsonc
{
  "exports": {
    ".": {
      "amrit":   "./src/index.ts",      // an AmritScript consumer: source
      "node":    "./build/index.node",  // JS on Node: the N-API addon
      "browser": "./build/index.mjs",   // JS in a browser: the wasm loader
      "import":  "./dist/index.js",     // plain tsc output
      "require": "./dist/index.cjs"
    }
  }
}
```

Conditions match in declaration order, so `amrit` leads and `node` precedes
`import`. Only `amritc` ever asks for the `amrit` condition, so a bundler, a
type-checker and Node each keep resolving the package exactly as they do
today. The last three rows are what WP8's `--emit-napi`, `--emit-dts` and
`tsc` already produce; the first row is a path, not an artifact, and building
it is the whole of this note.

`"amrit"` is a placeholder. Whatever it ends up being is a spelling of the
project's name, so it belongs in `src/branding.ts` and `self/branding.ts` with
the rest of them (orientation rule 5), and both compilers have to agree on it
before either can resolve a bare specifier.

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
  three *artifact* rows of the exports map, not the `amrit` row. A package
  consumed as source may take and return classes, `T | null`, `string[]`,
  `Result<T, E>` — anything the language has — because nothing is crossing a
  boundary.

That second point is the payoff, and it is worth being loud about: the
package a JS host sees through `--emit-napi` is a narrowed projection of the
package an AmritScript consumer sees.

## 5. What blocks this today

Two hard blockers, both in the compiler rather than in packaging.

### 5a. The symbol namespace is flat (the blocker)

Today two modules exporting the same name is an error, and — worse — two
modules defining the same *non-exported* name is an error too, in either
linkage mode. The reason is not the linker: `analyzeFunctions` keys the
whole-program fact fixpoint by symbol name, so a duplicate would hand each
function the other's attributes, which is a miscompile rather than a link
failure (`tests/link/duplicate_internal`, and the rule deliberately does not
consult `--no-strict-exports`).

In an ecosystem this is fatal at the first `npm install`. Two unrelated
packages that both have a private `helper()` would fail to compile together,
and two that both export `hash` certainly would. Symbols have to become
package-scoped — `pkg@version.symbol`, or a content hash — which touches the
checker's clash detection (`src/compilation.ts`, the pass-1.5 symbol check),
the fact table's key, the generic mangling (WP18 §3), the class and method
symbols (`Point.constructor`), the `--emit-header` asm labels, and every link
golden. It is the first stage for that reason and not because it is the most
interesting.

### 5b. `import` has no bare specifiers

The only import form is a named import from a relative specifier; a bare one
is rejected with "AmritScript has no package resolution". Adding it means
resolving `import { blake3 } from "@scope/hash"` through Node's own algorithm
with `--conditions=amrit` — deliberately *not* inventing a resolver, a lockfile
or a registry, all of which npm already has and none of which this project
should own.

### 5c. Compatibility has to be a diagnostic, not a miscompile

A package declares the number modes and targets it supports; an i32 consumer
pulling an f64-only package gets an error naming both sides and the field that
said so. The same check covers a package that requires a newer compiler than
the one compiling it.

## 6. What a package manifest must declare

Beyond the exports map: the supported number modes, the minimum compiler
version, and the entry module for the `amrit` condition. The natural home is
the `package.json` the package already has, under one key, so that a package
with an AmritScript surface is still an ordinary npm package to everything
that is not `amritc`.

## 7. What this note does not decide

- **Diamond dependencies.** If A wants `hash@1` and B wants `hash@2`,
  package-scoped symbols let both link — but a `Point` from `hash@1` is a
  different `%struct` from `hash@2`'s and they are not interchangeable, which
  needs a diagnostic that says so in those words rather than a type error
  about two identically-named classes.
- **Whether the compiler or a separate tool resolves.** §5b assumes the
  compiler reads `node_modules`. A thin resolver that hands `amritc` a flat
  list of files is the alternative and is less coupled.
- **Prebuilt closed-source distribution.** If it is ever needed, the shape is
  the `.d.amrit.json` sidecar that MASTER_PLAN §5 WP5 specified and
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
| S1 | Package-scoped symbols | — | §5a. No language surface; a large mechanical diff across the checker, the fact table, the mangling and the goldens. Landable on its own merits. |
| S2 | Bare specifiers and the `amrit` condition | S1 | §5b. The condition name lands in `branding.ts` on both sides. |
| S3 | The compatibility diagnostics | S2 | §5c, §6. New `codes.ts` entries. |
| S4 | The build cache | S2 | Content-addressed by (package version, number mode, target, profile, compiler version). Invisible to the package author; a pure compile-time optimisation, and the answer to §3's stated cost. |
| S5 | Prebuilt distribution | S4 | §7. Deferred, possibly permanently. |

S1 is the only one with no design questions left open, which is why it is
first. Nothing here is on the M4 critical path and none of it should delay the
freeze; S1 is the piece worth landing early, because every day it waits it
gets more goldens to update.
