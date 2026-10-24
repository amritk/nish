---
name: Capabilities for dependencies — per-dependency policy and a capability lockfile
overview: Extend the WP36 compile-time capability policy to dependencies. A dependency may not reach `unsafe`, `ffi`, `net` or `process.spawn` unless the root package grants it by name. A committed lockfile records each dependency's reached capabilities, and a build fails when a dependency reaches one the lockfile does not record.
stages:
  - id: dep-policy
    title: "feat(checker)!: refuse a dependency's unsafe, ffi, net and process.spawn unless the root package grants them"
    goal: A dependency that reaches a gated capability the root manifest does not grant it is refused (NL2574), naming the dependency, the capability and the function.
    verification: node tests/run.js caps_ && node tests/run.js link && npm run check && npm run lint && node scripts/gen-diagnostic-codes.mjs --check
    todos:
      - id: dp-manifest
        content: Read `nish.capabilities.dependencies` strictly in `manifestCapabilities` (src/manifest.ts), with shape and name errors spanned in package.json (NL3041, NL3042) — see Per-dependency policy › Manifest
      - id: dp-refusal
        content: Add `Compilation.refuseDependencyCapabilities` (src/compilation.ts) beside `refuseCapabilities`, with the per-package attribution in src/capability-report.ts — see Per-dependency policy › The refusal
      - id: dp-codes
        content: Register NL2574, NL3041 and NL3042 in src/codes.ts and pin a wording for each under tests/wordings/ — see Per-dependency policy › Diagnostics
      - id: dp-fixtures
        content: Add tests/link/caps_dep_* fixtures, one refused and one granted per gated capability, plus std and transitive cases, and grant the capability in every existing link fixture whose dependency now trips the default-deny — see Tests
      - id: dp-docs
        content: Update LANGUAGE.md "The capability policy", docs/IR_COOKBOOK.md, docs/guide/using-nish/cli.md, docs/wp36-capability-policy.md §6, add docs/wp40-dependency-capabilities.md, and add docs/security/capabilities.md with its README row — see Documentation
  - id: cap-lock
    title: "feat(cli): a capability lockfile that fails a build when a dependency reaches a new capability"
    goal: "`nish-capabilities.lock.json` beside the root package.json records each dependency's reached set. A build whose dependency reaches a capability not recorded fails (NL2575) until `--update-capability-lock` rewrites the file."
    verification: node tests/run.js caps_ && node tests/run.js link && npm run test:cli && npm run check && npm run lint && node scripts/gen-diagnostic-codes.mjs --check
    todos:
      - id: cl-format
        content: Add src/capability-lock.ts, which reads (strictly) and writes the lockfile from the per-package masks the capability report already computes — see Capability lockfile › Format
      - id: cl-check
        content: Compare at the tail of `check()` after the policy refusals and refuse a new capability or an unlisted dependency that reaches one (NL2575), and refuse a malformed lockfile (NL3043) — see Capability lockfile › The check
      - id: cl-flag
        content: Add `--update-capability-lock` to src/compile.ts, src/options.ts and `--help` (src/cli-style.ts), accepted by compile and `nish run`, refused by `--fix` and `--emit-ast` — see Capability lockfile › The flag
      - id: cl-tests
        content: Add tests/link/caps_lock_* fixtures for the cases in Tests, and a tests/nish/cli.ts row for the flag
      - id: cl-docs
        content: Extend the LANGUAGE.md section, the cookbook entry, the cli.md guide page, wp40 and docs/security/capabilities.md with the lockfile — see Documentation
---

# Capabilities for dependencies

## Context

WP35 computes the capabilities every function can reach. WP36 refuses a program
whose host-visible functions reach a capability the root manifest or the
`--allow`/`--deny` flags do not grant (NL2459). WP36 §6 leaves policy per
dependency out of scope. Today, a dependency that starts opening sockets or
calling `spawnSync` in a patch release compiles silently unless the root
package has denied that capability for the whole program. This is the npm-worm
case.

The groundwork is already in the compiler:

- Every `ModuleUnit` knows its `packageName`. `packageOf(path)` returns
  `ROOT_PACKAGE` (`""`) for the root package.
- `isStdModule` separates std from a dependency that happens to be named
  `nish`.
- `--emit-capabilities` already computes a mask per package (`packageMask` in
  `src/capability-report.ts`).

## Approach

- **Gated set.** The gated capabilities are `unsafe`, `ffi`, `net` and
  `process.spawn`. A dependency reaches the other eight freely, as it does today.
  The root package's own `allow`/`deny` and the flags still judge the whole
  program exactly as WP36 says.
- **What a dependency "reaches".** This is the same set the report's per-package
  mask gives: the union over every function defined in the dependency's
  modules, including what it reaches *through* std or another dependency.
  - So if dependency A calls dependency B, which opens a socket, both reach
    `net` and both need the grant. A could otherwise use B as a proxy.
  - Std is never a dependency and is never refused. It ships with the compiler,
    so a program that calls `std/net` itself needs no grant.
  - Judging every compiled function, not only host-visible ones, is deliberate.
    A worm's payload is rarely exported.
- **Grants live in the manifest only.** `nish.capabilities.dependencies` maps a
  package name to the gated capabilities it is granted. The command line can
  only narrow, so there is no flag that grants anything. A grant never widens
  the root policy: a root `deny: ["net"]` still refuses a granted dependency's
  `net` through NL2459 when it is reached from a judged function.
- **Default-deny is on from the start (`feat!`).** This is the recommendation
  put to sign-off. An opt-in protects only the projects that already know to
  ask, and it would mean a second breaking change one release later.
- **The lockfile is opt-in by its existence, and the compiler writes it only
  when told.** With no lockfile, nothing is compared. `--update-capability-lock`
  creates or rewrites it. The compiler never writes next to `package.json`
  otherwise (WP21 leaves npm's lockfile to npm; this one records a different
  fact).
- **Codes.** The plan assigns the codes so the two stages never race for a
  number: NL2574 and NL3041–NL3042 go to `dep-policy`, and NL2575 and NL3043 go
  to `cap-lock`. If `main` has taken a number by the time a stage lands, it
  takes the next free one instead. A number is never moved.
- **The two stages are sequential.** They share `src/codes.ts`,
  `src/compilation.ts`, the capability section of `tests/run.js` and the
  LANGUAGE.md section. `cap-lock` starts after `dep-policy` merges.
  `dep-policy` is worth merging on its own if `cap-lock` stalls.

## Per-dependency policy

Stage `dep-policy`.

**Owns:** `src/manifest.ts`, `src/compilation.ts`, `src/capability-report.ts`,
`src/codes.ts`, `tests/wordings/**`, `tests/link/caps_dep_*/**`,
`tests/link/**/package.json` (grants for existing fixtures only),
`tests/run.js`, `tests/capabilities.js`, `tests/self/goldens/checked/**`,
`tests/differential/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`,
`docs/cookbook/builtin-capabilities.ts`, `docs/guide/using-nish/cli.md`,
`docs/wp36-capability-policy.md`, `docs/wp40-dependency-capabilities.md`,
`docs/security/capabilities.md`, `docs/security/README.md`, `.claude/selfhost.md`

### Manifest

```json
{ "nish": { "capabilities": {
    "deny": ["exit"],
    "dependencies": { "pkg_http": ["net"], "@acme/fastmath": ["unsafe"] } } } }
```

`manifestCapabilities` accepts a third key, `dependencies`, written at most
once. It must be an object whose keys are package names and whose values are
arrays of capability names. It is read with the same strict decoding as
`allow`/`deny` (escapes decoded, a repeated key refused).

- **NL3041**: the shape is wrong (not an object, a value that is not an array of
  strings, a package named twice).
- **NL3033** (reused): a name that is no capability.
- **NL3042**: a name that is a capability but not a gated one. For example,
  `fs.read` is never denied to a dependency, so granting it means nothing, and a
  typo for a gated name should not pass silently.
- `unsafe` *may* be granted here. NL3034 applies to the root `allow` only,
  because there the import is the opt-in.
- A grant naming a package that the build does not load is not an error. A
  build compiles one entry, and the manifest serves every entry.
- Every error is spanned where package.json writes it, as NL3032–NL3036 are.

### The refusal

`refuseDependencyCapabilities` runs in `check()` immediately after
`refuseCapabilities`, so it reports through the sink and `--json`. For each
dependency package, in package-name order, and each gated capability in the
fixed order that it reaches and is not granted, it reports one NL2574. The
error is spanned at the first call of the witness chain of the first function
(in source order) of that package that reaches the capability. The function's
own name and its chain are written as NL2459 writes them (`witnessChain`).

Example message:

```
node_modules/pkg_http/src/index.ts:4:10: error: the dependency `pkg_http` reaches `net` through `fetchText`, which the root package does not grant it; grant it with "nish": { "capabilities": { "dependencies": { "pkg_http": ["net"] } } } — the chain that reaches it: node_modules/pkg_http/src/index.ts:4:10 calls dial
```

The fragment registered in `codes.ts` must not collide with NL2459's. Masks are
already computed, so the added cost is one walk over the packages.

### Diagnostics

Each new code gets a wording under `tests/wordings/` (`tests/diagnostic-coverage.js`
requires one). `node scripts/gen-diagnostic-codes.mjs --check` must pass.

## Capability lockfile

Stage `cap-lock`. **Depends on:** `dep-policy` is merged (merge-order edge: the
two stages share files).

**Owns:** `src/capability-lock.ts`, `src/compilation.ts`, `src/compile.ts`,
`src/options.ts`, `src/cli-style.ts`, `src/run-cache.ts`, `src/codes.ts`,
`tests/wordings/**`, `tests/link/caps_lock_*/**`, `tests/run.js`,
`tests/nish/cli.ts`, `tests/self/goldens/checked/**`, `tests/differential/**`,
`docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/builtin-capabilities.ts`,
`docs/guide/using-nish/cli.md`, `docs/wp40-dependency-capabilities.md`,
`docs/security/capabilities.md`, `.claude/selfhost.md`

### Format

The file is `nish-capabilities.lock.json`, in the root package's directory (the
`package.json` nearest above the entry):

```json
{
  "version": 1,
  "packages": {
    "@acme/fastmath": ["unsafe"],
    "pkg_http": ["clock", "net"]
  }
}
```

- It records every dependency the build loads, with **all** twelve
  capabilities the dependency reaches, not just the gated four. A new `fs.read`
  in a dependency is just as much a supply-chain signal.
- A dependency that reaches nothing is listed with `[]`.
- Package names are sorted. Capability lists use the fixed order.
- It is written with two-space indentation and a trailing newline, so the file
  is byte-stable and diff-friendly.
- Std and the root package are not listed.

### The check

When the file exists, it runs at the tail of `check()`, after both policy
refusals.

- **NL2575**: a dependency reaches a capability its row does not list, or a
  dependency with no row reaches any capability. The message names the
  dependency, the capability, the function and the chain, and says to rerun
  with `--update-capability-lock`. There is one error per (dependency,
  capability), in the same order as NL2574.
- A dependency that reaches *fewer* capabilities than recorded, or a row for a
  package the build no longer loads, is accepted. Only growth is the alarm, so
  one lockfile serves several entries.
- **NL3043**: the file is not valid JSON, has the wrong `version`, has unknown
  keys or names an unknown capability. It is spanned in the lockfile and read
  as strictly as the manifest.

### The flag

`--update-capability-lock` makes the build write the lockfile (create or
rewrite) from the computed masks after the policy refusals pass, and skips the
NL2575 comparison.

- A build refused by NL2459/NL2574 writes nothing. The lockfile records what
  the policy accepted, never a way around it.
- `nish run` accepts the flag. `--fix` and `--emit-ast` refuse it, as they
  refuse `--allow`. It is listed in `--help`.
- It is not part of `nish run`'s cache key, as the policy is not.
- A cache *hit* in `nish run` must still run the lock comparison, or must key
  the lockfile's bytes. The worker picks one and says which, with a test.

## Out of scope

- Run-time enforcement: WP37 `--sandbox`, owned by the sibling run
  security-os-sandbox. Keep edits to `src/capabilities.ts`, `src/compile.ts`
  and LANGUAGE.md's Capabilities section minimal, and merge `main` on conflict.
- Directory scopes and argument-level precision (WP36 §2 still applies).
- Pinning dependency *versions* or hashes, which npm's lockfile does.
- Package-root resolution changes (CLI-9 belongs to security-open-findings).

## Tests

Use the `tests/link/<name>/` multi-package format (header at
`tests/run.js:4764`; the `node_modules/` under a fixture is committed). Copy
from `caps_package`, `caps_policy_manifest` and `caps_policy_deny_unsafe`.

`dep-policy`:

- `caps_dep_{net,ffi,spawn,unsafe}_refused`: exit 1 and `expected.err` with
  NL2574 naming the package, the capability and the function.
- `caps_dep_{net,ffi,spawn,unsafe}_granted`: exit 0, with expected stdout from a
  native run where the fixture runs.
- `caps_dep_ungated`: a dependency reaching `fs.read` and `clock` with no grant
  compiles.
- `caps_dep_transitive`: A calls B, which reaches `net`; granting B only refuses
  A.
- `caps_dep_std_not_refused`: the root calls std's net with no grant and
  compiles.
- `caps_dep_unexported`: an unexported dependency function that reaches `net`
  is refused.
- `caps_dep_cli_cannot_grant`: `--allow net` does not grant a dependency.
- `caps_dep_root_deny_wins`: a grant plus a root `deny: ["net"]` is refused by
  NL2459.
- `caps_dep_manifest_*`: NL3041 shapes, NL3033, NL3042, an escaped package name
  honoured, and `unsafe` grantable.
- `caps_package_named_nish`: a dependency named `nish` that reaches a gated
  capability is still a dependency.
- Existing fixtures whose dependency now reaches a gated capability (for
  example `no_panic_unsafe_callee`, the `ffi_package_declare*` family and the
  `nish:unsafe` dependency tests at `tests/run.js:24090`) get the grant in
  their `package.json`. A fixture is never deleted to make the suite pass.

`cap-lock`:

- `caps_lock_match`: the lockfile matches and the build passes.
- `caps_lock_new_capability`: a dependency now reaches `net` (granted) but the
  lockfile records only `clock`, so NL2575 is reported.
- `caps_lock_new_dependency`: a dependency with no row that reaches something
  is refused, and one with no row that reaches nothing passes.
- `caps_lock_shrink_ok`: a dependency reaching fewer capabilities passes.
- `caps_lock_malformed_*`: NL3043.
- `caps_lock_update`: the flag writes the expected bytes, and a policy-refused
  build writes nothing.
- `nish run` with the lockfile, on both a cache miss and a cache hit.

These fixtures need a writable copy for the update case. Follow how
`tests/run.js` already copies fixtures to a temporary directory, or add one
helper.

## Documentation

- **docs/LANGUAGE.md**: in "The capability policy", add a subsection "A
  dependency's capabilities", and later "The capability lockfile". These are
  normative.
- **docs/IR_COOKBOOK.md**: extend "Capabilities: a report, not a lowering" with
  a refused dependency and the lockfile. Keep its checked block green
  (`tests/run.js:18575`).
- **docs/guide/using-nish/cli.md**: add the grant, the error, the lockfile and
  the flag. The page rules are in docs/README.md, and the existing route
  suffices.
- **docs/wp36-capability-policy.md §6**: point per-dependency policy to wp40.
- **docs/wp40-dependency-capabilities.md**: a new record of the design
  decisions above. Status is built in this PR.
- **docs/security/capabilities.md**: a new record. It states the threat
  (a compromised dependency release), what the check covers (compile-time
  reachability), and what it cannot reach:
  - code run by an npm `postinstall` script,
  - C behind a granted `ffi`,
  - a dependency that reaches a capability through a function pointer the
    analysis already over-approximates,
  - run time, which is WP37's job.

  It names its tests by exact `check(...)` strings and gets a row in
  `docs/security/README.md` (sibling security-process also edits that table;
  merge on conflict).
- CHANGELOG comes from commit messages. `dep-policy` is `feat(checker)!` with
  the migration in its body: add the grants that the error message names.

## Verification

Per stage, in this order:

1. `node tests/run.js caps_` and `node tests/run.js link`
2. `npm run check`
3. `npm run lint` (run bare)
4. `node scripts/gen-diagnostic-codes.mjs --check`
5. Regenerate the goldens: `node tests/self/goldens.js --update`
6. `node tests/run.js wasi` (`WASI_SYSROOT=/usr`) and `node tests/run.js performance`
7. The full `npm test`, undegraded (read the skip count), before opening the PR
   and after the last merge of `main`
