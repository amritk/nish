# WP21: Packages

**Status: in progress.** S1, package-scoped symbols, shipped in 0.2.0
([#57](https://github.com/amritk/nish/pull/57)); S2, bare specifiers and the
`nish` export condition, in 0.3.0; S3's resolution diagnostics in 0.9.0
([#178](https://github.com/amritk/nish/pull/178)) and its package identity in
0.10.0 ([#202](https://github.com/amritk/nish/pull/202)). Open: S3's last two
items — a builtin the target has no runtime for, and a compile error attributed
to a dependency — then S4, the build cache, and S5, prebuilt distribution (§8).
The rules that shipped are normative in
[LANGUAGE.md](LANGUAGE.md#export-and-import); where this note and
LANGUAGE.md disagree, LANGUAGE.md wins.

The note answers two questions that arrived together — "what would an extra
`exports` condition alongside `cjs` and `esm` look like", and "how should a Nish
package depend on another Nish package" — and its first decision is that they
are *different* questions with different answers. Read
[wp5-modules.md](wp5-modules.md) first (whole-program compilation and the
linkage table are what force §3) and [wp8-interop.md](wp8-interop.md) second
(the artifacts §2 hands a foreign consumer are the ones WP8 generates).

## 1. The two consumers

| Consumer | Wants | Crosses |
| --- | --- | --- |
| **A foreign host** — JavaScript on Node, JavaScript in a browser, C | a built artifact it can load and call | the C ABI, or the N-API / wasm bridges over it ([wp8-interop.md](wp8-interop.md)) |
| **Another Nish program** | the package's *functions*, checked and optimised as if they were its own | nothing: there is no boundary to cross |

A foreign host calls across a wire whose type vocabulary is narrow by
construction (WP8's table). A Nish consumer calls across nothing; it compiles
one program that happens to have been written by two people. Giving both the
same answer is the mistake this note exists to avoid.

## 2. The decision

**Source is the distribution format for Nish. Built artifacts are for foreign
hosts, and — for a Nish consumer — a cache, never a package format.**

One `exports` map states both, because Node's resolution algorithm is worth
reusing and conditions are exactly the shape of "which of these did you come
here for":

```jsonc
{
  "exports": {
    ".": {
      "nish":    "./src/index.ts",      // a Nish consumer: source
      "node":    "./build/index.node",  // JS on Node: the N-API addon
      "browser": "./build/index.mjs",   // JS in a browser: the wasm loader
      "import":  "./dist/index.js",     // plain tsc output
      "require": "./dist/index.cjs"
    }
  }
}
```

Only `nish` asks for the `nish` condition, so a bundler, a type-checker and
Node keep resolving the package exactly as before. The artifact rows are what
WP8's `--emit-napi`, `--emit-dts` and `tsc` already produce. The `nish` row
also carries the number mode, by spelling — `nish-f64`, `nish-i32`, or plain
`nish` for a package correct under either (§6). The spelling is a form of the
project's name, so it lives in `src/branding.ts` as `PACKAGE_CONDITION`, with
`packageConditionFor` spelling the mode-qualified forms.

## 3. Why source, and not a compiled library

Each reason is a consequence of something the project had already decided.

### 3a. Whole-program facts are the performance thesis

`analyzeFunctions` runs over every module at once, keyed by LLVM symbol, and an
imported function's `declare` carries exactly the exporter's attributes
([wp5-modules.md](wp5-modules.md), "Imported functions in IR"). That is what
lets the optimiser fold, hoist or drop a call into another module as if it were
local, and why non-exported functions get `internal` linkage (WP15 §3). A
prebuilt library severs all of it: the consumer gets an opaque symbol with no
facts, which gives up the mechanism WP9 and WP15 were spent buying.

### 3b. A generic has no code until somebody instantiates it

Generics are monomorphised from call sites
([wp18-generics.md](wp18-generics.md) §3a), so `sum<T>` has nothing to compile
until a consumer asks for `sum<i32>`. Any binary format would ship the template
as source anyway.

### 3c. `number` is a compile-time ABI

`--number-mode i32|f64` decides what `number` *is*, so a package built in one
mode cannot be called from the other. Prebuilding means the cross product
`{i32, f64} × {x86_64, aarch64, wasm32} × {speed, size, debug}` — eighteen
artifacts per release for source that compiles in milliseconds.

### 3d. Source gets dead-code elimination that a library cannot

Everything a consumer never calls is `internal` and LLVM drops it; a prebuilt
object can only be dropped whole.

### The cost, stated honestly

Compile time grows with the transitive dependency tree, the C++ and Rust cost.
S4 is the mitigation, and it is a cache, not a change of format.

## 4. What a source package may contain

A package's public surface is whatever `export` accepts
([wp5-modules.md](wp5-modules.md)). A library package must not declare
`export function main`, because a package is never the entry. Internals are
unrestricted: a package consumed as source may take and return classes,
`T | null`, `string[]`, `Result<T, E>` — the narrowness of §1 constrains the
artifact rows, not the `nish` row. The package a JS host sees through
`--emit-napi` is a narrowed projection of the one a Nish consumer sees.

## 5. What blocked this

Three things, all in the compiler rather than in packaging. All three are
closed or mostly closed; §9–§11 say how.

### 5a. The symbol namespace was flat (**closed by S1**)

Two modules defining the same name — exported or not — was an error, because
`analyzeFunctions` keys the whole-program fact fixpoint by symbol, so a
duplicate would hand each function the other's attributes: a miscompile, not a
link failure (`tests/link/duplicate_internal`). Two unrelated packages that
both kept a private `helper()` could not have compiled together. Symbols became
package-scoped (§9).

### 5b. `import` has no bare specifiers

**Closed by S2.** `nish:fs`-style specifiers name builtins and resolve to no
file. `nish/<module>` names a standard-library module and is short-circuited to
the `std/` beside the running compiler — a deliberate narrowing, since
`package.json`'s `"./*": "./std/*.ts"` makes it a package self-reference and the
`std/` that shipped with this binary is the one right answer. The general case,
`import { blake3 } from "@scope/hash"`, resolves through Node's own algorithm
with the `nish` condition, deliberately *not* inventing a resolver, lockfile or
registry, all of which npm already has (§10).

### 5c. Compatibility has to be a diagnostic, not a miscompile

A package states the number modes it supports and the compiler it needs; a
consumer that does not match gets an error naming both sides and the field that
said so (§11).

## 6. How a package says it is Nish

The `nish` condition is the whole answer. Its presence is the claim, its value
is the entry module, and its *absence* is what lets a bare import of an ordinary
npm package fail with "has no Nish entry point" rather than a module-not-found
that reads like the consumer's own mistake (`tests/link/package_not_nish`).

### The number mode goes in the condition

The mode is the one semantic flag a package can be wrong about without saying
so. `bench/strbuild.ts` divides once — `const step = (count + 31) / 32; //
ceil(count / 32)` — which is true in i32 mode, where `/` truncates, and false in
f64 mode. Compiled both ways the program builds, runs and exits 0, printing
**806394** in i32 mode and **2410293** in f64. Most f64 code fails loudly in i32
mode (`Math.sqrt` on an i32, a `1.5` literal), so the silent window is narrow —
division and what is built on it — but inside it the failure is a wrong answer,
which is exactly what a package boundary should catch.
[wp9-optimisation.md](wp9-optimisation.md#what-the-number-mode-costs) has the
rest of the mode comparison.

So the mode rides in the condition rather than in metadata:

```jsonc
"exports": { ".": { "nish-f64": "./src/index.ts" } }   // f64 only
"exports": { ".": { "nish":     "./src/index.ts" } }   // correct under either
```

`--number-mode f64` asks for `["nish-f64", "nish"]` and i32 for
`["nish-i32", "nish"]`, so a mismatch is a *resolution* failure, before a byte
of the dependency is checked, with no sidecar to keep in sync. That list is
asked **in that order, whichever order the manifest declares the two in** — the
one place the reader departs from Node (`tests/link/package_mode_order`,
`package_mode_order_f64`). Declaration order is right for rival conditions;
`nish-f64` is not a rival of `nish` but `nish` refined by the mode, and under
declaration order a package writing `nish` above `nish-f64` would ship f64
source that is never compiled, with nothing said. The resolver reads the
`exports` object itself rather than delegating, because the good message
("supports Nish in f64 mode only; this program is compiling in i32") needs to
know which conditions the package *does* offer.

### The other two need no declaration either

- **Runtime capabilities** are not the package's to declare: the compiler
  knows the target and which builtins the whole program touches, so "`@scope/hash`
  calls `readFileSync`, which the freestanding wasm profile has no runtime for"
  is a whole-program diagnostic, not a manifest field.
- **A compiler version floor** goes in `"engines": { "nish": ">=x" }`, the slot
  npm already has.

The `--emit-manifest` sidecar of the first draft was therefore not built. The
rule: **a fact the compiler can recompute is not metadata.** Package metadata
earns its place only where resolution must happen *before* the compiler can
look — true of the mode, false of everything else here.

The root package's `"nish"` field (`noPanic`, `capabilities`;
[wp36-capability-policy.md](wp36-capability-policy.md#3-the-manifest)) does not
break that rule: it is a policy the program's owner chooses, not a fact about
the code, and it is read from the root manifest only, never a dependency's.

### Why none of this is a trust boundary

The consumer's build re-establishes Nish-safety from source every time, and the
compiler is the verifier, so a package whose condition lies is caught on the
first compile that uses it. Everything above is an *error-quality* feature, not
a correctness or security boundary, which is also why nothing here needs a
signature or a registry.

One diagnostic obligation follows: when a dependency's source fails to compile,
the message must say so, because the reader's next move is an upstream bug
report, not a hunt through their own code. That obligation is still open (§8).

## 7. What this note does not decide

- **Diamond dependencies.** If A wants `hash@1` and B wants `hash@2`, a `Point`
  from each is a different type. What is decided is the diagnostic: a package is
  its real directory, a program compiles one copy, and one name at two real
  directories is refused in those words (`NL3029`,
  `tests/link/package_two_dirs`). Linking both copies, or merging two copies of
  one version by their manifests, would each turn a refusal into an acceptance,
  so either stays open without breaking a program.
- **Whether the compiler or a separate tool resolves.** The compiler reads
  `node_modules`; a thin resolver handing `nish` a flat file list is the
  less-coupled alternative.
- **Prebuilt closed-source distribution** (S5). If ever needed, the shape is a
  `.d.nish.json` sidecar of signatures *plus* proven attributes, so the
  importer's `declare` keeps its facts. It costs generics and pins the mode and
  target, and should not be built until somebody asks for it by name.
- **Supply chain.** Source packages mean compiling third-party code, as every
  TypeScript project does; they also remove the `postinstall` step native npm
  packages need, so the surface gets *smaller*.

## 8. Stages

| | Stage | Status |
| ---: | --- | --- |
| S1 | Package-scoped symbols (§5a) | **Shipped**, 0.2.0, #57. §9. |
| S2 | Bare specifiers and the `nish` condition (§5b) | **Shipped**, 0.3.0. §10. |
| S3 | The boundary diagnostics (§5c, §6) | **Resolution half shipped**, 0.9.0, #178; **identity half**, 0.10.0, #202. §11. Two items open, below. |
| S4 | The build cache | Open. Content-addressed by (package version, number mode, target, profile, compiler version); invisible to the package author, and the answer to §3's stated cost. `nish run`'s cache is not it: that keeps the linked binary of a whole program and recompiles every run. |
| S5 | Prebuilt distribution | Deferred, possibly permanently (§7). |

**S3 is the stage to resist over-building**: §6 already talked one manifest out
of existence, and everything left in it is a message rather than a file. What
remains:

- **A builtin with no runtime on the target.** A whole-program diagnostic,
  decided after every module is checked rather than at the import, naming the
  package that reached the builtin. WP34 N3 has since covered part of the
  ground at the call site: the host builtins (`Date.now`,
  `crypto.getRandomValues`, `statMtimeSync`, the ownership checks) and
  `nish:net` are refused on `--target wasm32` with "reaches the operating
  system, and a wasm32 build has none to reach" (NL2404), but that message
  names the call, not the package, and the `nish:fs` builtins such as
  `readFileSync` are not refused there at all.
- **A compile error attributed to the dependency** (§6's obligation): an error
  located in `node_modules/<pkg>/…` should say it is the dependency's.

Each is a diagnostic for a program that already fails, so neither withdraws
anything, and neither is on any release's critical path.

## 9. S1 as built: package-scoped symbols

**The root package's prefix is empty.** Qualifying every symbol (as
`pkg@version.symbol` or a content hash) would have moved every golden `.ll`, the
`--emit-header` asm labels and the interop sidecars to buy nothing for
single-package programs. Instead, a module under `node_modules/<name>/` (or
`@scope/<name>/`) belongs to that package, and each function, method and
constructor it declares is emitted as `<mangled package name>.<name>` — the `.`
`Point.shifted` already uses, so `--emit-header` declares it with an asm label
as it always declared a method. A one-package program emits byte for byte the IR
it always did; a prefix appears only where a second package does.

The qualification happens in one place, `Checker.qualifySymbols` at the end of
pass 1, so a free function, a method and a constructor are scoped by the same
line and `analyzeFunctions` did not change: the key it used stopped being a bare
name. Generic instantiations are minted after that walk, so their symbols carry
the prefix from the moment they are minted — the *template's* package, not the
instantiating module's, since importing a generic was allowed in 0.4.0
([#111](https://github.com/amritk/nish/pull/111);
`tests/link/package_generic`, `package_generic_class`,
`package_generic_import`).

A module's package is read off its path, and the entry's own package directory
*is* the root package — comparing directories rather than looking for
`node_modules` in the path is what stops an entry that itself lives inside
`node_modules/<pkg>` from being taken for a dependency. Since S2 a module
reached by a bare specifier is in the package whose manifest the resolver read;
the path rule still answers relative imports into `node_modules` and a
dependency's own relative imports (`src/packages.ts`).

### 9c. Where S1 deliberately stops

- **Struct names are program-wide.** `%struct.<name>` is a module-level LLVM
  type and `StaticType` equality compares names, so two packages declaring
  `Node` would silently share one type. Rather than half-scope that, the
  compiler refuses it, naming both packages (`tests/link/two_packages_struct`).
  [#197](https://github.com/amritk/nish/pull/197) closed the same hole inside
  one package (NL3028, `tests/link/class_clash_fields`,
  `class_clash_after_package`), and an instantiated generic's name is held to
  the same rule (`tests/link/package_generic_class_clash`,
  `generic_class_clash_after_package`). Scoping the layouts is §7's question.
- **Versions are not in the identity**: reading one means reading a manifest,
  which §6 refused.
- **The mangling is not injective** (`@scope/hash` and `scope_hash` share a
  prefix), which is harmless because the clash check runs over the *qualified*
  symbols and refuses by name.

`tests/link/two_packages/` is the proof: two packages and the root each keep a
private `helper()`, two export `scale()`, every `helper` computes something
different, and the binary exits 7 only if each call reached its own.

## 10. S2 as built: bare specifiers and the `nish` condition

### 10a. What resolves, and what it resolves to

A specifier is split into a package name and an `exports` subpath
(`@scope/hash/blake3` is `@scope/hash` and `./blake3`). `node_modules/<name>` is
looked for in the importing file's directory and every directory above it, and
the file compiled is the one the `exports` map offers for the condition list of
§6, mode-qualified first whatever the declaration order. Downstream of
resolution the module is compiled like any other — §3 in one sentence.

**The walk is spelled, not computed.** The compiler has no `process.cwd()`
(module identity is the path as written, WP19 §A3), so above the entry's
directory it climbs as `..`, `../..`, and lets the operating system resolve
those (`parentDirectory` in `src/compilation.ts`). It cannot recognise the
filesystem root (`/..` is `/`), so a limit of 256 levels ends it; that keeps a
failed resolution near 10 ms, where probing PATH_MAX's worth of levels cost
1.8 s of kernel time. `tests/link/package_above` is the ordinary npm layout
compiled from the subdirectory.

**Node steps over a directory already called `node_modules`**, and the compiler
does so wherever the module's *name* spells one, including every dependency's
own imports. Above the name's own root it cannot tell that `..` is a
`node_modules` (there is no `getcwd`, and `nish:fs` has no `statSync`), so it
searches it. That changes an answer only where `node_modules/node_modules/<pkg>`
exists, which npm does not produce (`tests/link/package_doubled`: found from
inside, refused from the root).

### 10b. The manifest reader

`src/manifest.ts` is a narrow scan, not a JSON parser — the compiler compiles
itself and has no `JSON.parse`, and the scan's limits are written down rather
than left to be discovered: only the `nish` conditions are honoured (`default`,
`import` and `node` are JavaScript), a subpath is an exact key rather than a
`"./*"` pattern, a target is a string beginning with `./` with no `..` segment
and no escape, and Node's one-entry shorthand (a condition map with no
`.`-prefixed key) is read. The scan answers with what it found before the first
thing it cannot read past; only when that is nothing does a second, complete
walk of the same grammar decide whether the manifest is malformed (§11). The
root package's `"nish"` policy field is read strictly and separately (#458).

### 10d. What S2 deliberately stops short of

- **Package identity is the real directory** ([#202](https://github.com/amritk/nish/pull/202)),
  as Node and `tsc` (`preserveSymlinks: false`) decide it. A module is the file
  `realpathSync` names, so a symlinked package — pnpm's layout, and npm's when
  it cannot hoist — is one package (`tests/link/package_symlink`), and a
  workspace package's relative imports stay in it
  (`tests/link/package_workspace`). A directory no link leads through keeps the
  spelling the walk found it by, so programs without links name every module as
  before. One name at two real directories is `NL3029`, naming both directories
  and versions; that covers npm's duplicate copies and §7's diamond alike.
  Identity by manifest (`name@version`) is left for later on purpose: it would
  only turn that refusal into an acceptance for two copies of one version.
  What stays lexical is a relative specifier: `./x` is joined to its importer's
  *name*, not its real directory.
- **No cache** (S4).
- **A target that names a directory is a missing module**, at the specifier
  (`tests/link/package_dir_target`); a `package.json` that is a directory is
  stepped past (`tests/link/package_dir_manifest`). The second needed a runtime
  fix: `nish_read_file_or_null` now guards with `S_ISREG`, since `open` accepts
  a directory and `lseek` answers `LONG_MAX`.
- **A dependency's exports are not the program's C ABI.** `--emit-header`,
  `--emit-dts` and `--emit-napi` declare the root package's functions (§4); a
  dependency's function reaches a host through a re-export from the root
  package, which waits on `export { f } from "pkg"` — refused today by
  [LANGUAGE.md](LANGUAGE.md) — rather than on a stage here.

## 11. S3 as built

S2 answered every failure to find a Nish entry point with one sentence. S3
gives each cause its own message and its own `--json` code, so a tool can tell
them apart without reading prose:

| Code | Cause | Case |
| --- | --- | --- |
| `NL3017` | The entry offers only the other mode's condition, named with both modes. | `tests/link/package_other_mode`, `package_other_mode_f64` |
| `NL3018` | `engines.nish` is a floor above this compiler, named with both versions. | `tests/link/package_engines_floor` |
| `NL3019` | `engines.nish` is not a range this compiler reads. | `tests/link/package_engines_range` |
| `NL3020` | No Nish condition in any spelling — §6's `lodash` case. | `tests/link/package_not_nish`, `package_no_condition` |
| `NL3021` | The manifest is not well-formed JSON *and* no entry could be read from it; named with path, line and column. | `tests/link/package_malformed` |
| `NL3029` | One package name at two real directories (§10d). | `tests/link/package_two_dirs`, `package_two_dirs_unversioned` |
| `NL3014` | Anything else: no `exports`, no such subpath, a shape the reader does not follow (a nested condition object included). | `tests/link/package_no_subpath`, `package_nested_condition` |

The reasoning that still governs the code:

- **The order is part of the rule.** The floor is read first, whether or not an
  entry resolves — a package that names a newer compiler has said this one
  should not be trusted with its source. Then the entry; and only when there is
  none, whether the manifest is JSON at all, because the narrow reader stops at
  the first break and any other answer about a broken manifest is a guess.
- **The floor is `>=X.Y.Z` or `>=X.Y` and nothing else.** A caret, a tilde, an
  upper bound, a `||` or a bare version is refused rather than read as met: a
  floor the compiler cannot read is one it cannot claim to meet. It is compared
  with `VERSION` in `src/branding.ts`, prerelease tag ignored, and
  `tests/nish/cli.ts` tests the boundary at the compiler's own version so the
  test moves with each release.
- **A mode mismatch is recognised by the other mode's condition alone**, after
  this mode's and plain `nish` are both absent — so `nish` beside `nish-f64`
  compiles in i32.
- **NL3014's wording is what the compiler came away with** — "its `exports`
  gave this compiler no file to compile for `.`" — rather than "declares no
  `nish` condition", which the mode ranking can make false.

What S3 still owes is in §8.
