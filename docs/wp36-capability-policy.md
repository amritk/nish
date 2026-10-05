# WP36: The capability policy — refusing what a program was not granted

**Status: built** in #452 (2026-10-04), compile time only; #458 then made the
manifest's `"nish"` field strict. WP35 ([wp35-capabilities.md](wp35-capabilities.md))
works out which capabilities every function can reach. This work package acts
on that answer: a program compiled with `--allow` or `--deny`, or whose root
`package.json` carries a capability policy, is refused (NL2459) when what it
exposes reaches a capability the policy does not grant. Nothing at run time
changes and no byte of the IR moves: a program the policy accepts is the
program the build would have compiled without one.

**The living reference is [LANGUAGE.md](LANGUAGE.md#the-capability-policy)**,
under "Capabilities"; where this note disagrees with it, LANGUAGE.md wins.
**Holding a running process to the same set is WP37's**, which has no note
yet: `--sandbox`, where the native `main` wrapper confines the process with
Landlock and seccomp to the set the compiler computed, and which is where the
`fs.read=<dir>` scopes this package refuses (§2) would be accepted, because
there something can enforce them.

## 1. Semantics

A policy is two masks over WP35's eleven capabilities. A denied capability is
refused when it is reached; giving `--allow` at all makes the policy an
allowlist, so anything it does not list is refused, `exit` and `signal`
included. Both flags repeat and take comma lists. **The command line can only
narrow the manifest**: denials union and allowlists intersect, so a build
script cannot widen what the package says about itself.

**What is judged is every function code outside the program can call**,
exactly what `hostVisible` (`src/visibility.ts`) calls host-visible, so no
build mode lets a denied capability through: `main` alone in a closed build
(`--link` or `nish run`, with no sidecar, `declare function` or wasm target);
`main` and every exported function of every module in an open one; every
function under `--no-strict-exports` in an open build. Per-dependency policy
is out of scope (§6).

**`unsafe` can be denied and never allowed.** WP36 wired WP35's reserved bit
(§4), so `--deny unsafe` refuses a program that reaches a `nish:unsafe` export
anywhere in its closure, the standard library included. The import is the
opt-in, so an allowlist never refuses `unsafe`, and allowing it is refused as
a contradiction rather than accepted as a no-op.

## 2. The flags

`--allow <list>` and `--deny <list>` take the next argv entry. `nish run`
takes both and refuses before it links; `--fix` and `--emit-ast` refuse them.
A usage error (exit 2) is: a name that is not one of WP35's, `--allow unsafe`,
a capability both allowed and denied, either flag with no value, and **a
directory scope, `fs.read=<dir>`**. The compiler cannot prove which path a
program opens — a path is a runtime string, and WP35 rules out argument-level
precision — and nothing at run time holds the program to it yet, so a scope
accepted here would be a promise nobody keeps. WP37 accepts the suffix together
with `--sandbox`. The policy is not part of `nish run`'s cache key: a refused
program writes no entry, and an accepted one writes the IR it would without
the policy.

## 3. The manifest

```json
{ "nish": { "noPanic": ["src/parse.ts"],
            "capabilities": { "allow": ["fs.read", "exit"], "deny": ["net"] } } }
```

It is read from the root package only, the `package.json` nearest above the
entry, where `noPanic` is read. An `allow` that is present but empty allows
nothing; an absent one allows everything. Since #458 the `"nish"` field is
read strictly (`manifestNish`, `manifestCapabilities` in `src/manifest.ts`):
keys and entries decode as `JSON.parse` decodes them, so a policy behind an
escape is honoured, and anything the reader cannot vouch for is refused where
`package.json` writes it, because a typo that quietly widened a policy is the
worst outcome there is: NL3036 (the `"nish"` field's shape, a second one, an
unknown key such as `capabilites`), NL3032 (the shape of `capabilities`, or
`allow`/`deny` written twice), NL3033 (no such capability), NL3034 (`unsafe`
under `allow`), NL3035 (a capability under both).

## 4. The `unsafe` bit

`builtinCapability` answers `CAP_UNSAFE` for `uncheckedGet`, `uncheckedSet`,
`wrappingAdd`, `wrappingSub` and `wrappingMul`, and the bit propagates like any
other: `--emit-capabilities` and `--capabilities` name it, and it is not one
of `deterministic`'s eight. Unlike WP35's capabilities it can come out of a
parallel body, since `uncheckedGet` writes nothing shared.

## 5. The refusal

`Compilation.refuseCapabilities` runs at the tail of `check()`, after the
no-panic scope, so NL2459 goes through the diagnostic sink and `--json` like
every other: one error per refused capability, in source order, spanned at the
first call of the witness chain of the first judged function that reaches it,
and naming every hop as `--emit-capabilities` writes them (`witnessChain` in
`src/capability-report.ts`, which both read). The chain is in the message
because a `--json` object is flat and its keys are a contract. A parenthesis
names which part of the policy refuses it. The masks are computed on every
compile anyway, so a policy costs only the walk over the refused bits.

## 6. Out of scope

- **Enforcement at run time**: WP37's `--sandbox`, confining the process to
  `main`'s *computed* set. A policy narrower than that set has already been
  refused here.
- Directory scopes (`fs.read=<dir>`), refused as §2 says until WP37.
- Per-dependency policies, and argument-level checks such as a literal path.
- What C behind `ffi` does: that is `ffi`, and nothing finer.
