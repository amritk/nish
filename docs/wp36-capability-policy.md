# WP36: The capability policy — refusing what a program was not granted

**Built in one pull request, compile time only.** WP35
([wp35-capabilities.md](wp35-capabilities.md)) works out which capabilities
every function can reach and reports them. This work package acts on that
answer: a program compiled with `--allow` or `--deny`, or whose root
`package.json` carries a capability policy, is refused when its entry reaches a
capability the policy does not grant. Nothing at run time changes, and no byte
of the IR moves: a program the policy accepts is the program the build would
have compiled without one. Holding a running process to the same set is WP37's
(`--sandbox`), and is not here.

[LANGUAGE.md](LANGUAGE.md) stays normative. Its "The capability policy" rule,
under "Capabilities", is the short form of §1–§4.

## 1. Semantics

A policy is two masks over WP35's eleven capabilities: what it **allows** and
what it **denies**.

| Policy given | A reached capability is refused when |
| --- | --- |
| none | never, which is the behaviour before this work package |
| `--deny c` | `c` is reached |
| `--allow c` | `c` is not in the allowlist: giving `--allow` at all turns the policy into an allowlist |
| both | it is denied, or it is not allowed |

- **Both flags are repeatable and take comma lists.** `--allow fs.read,exit
  --allow clock` is one allowlist of three. Denials union the same way.
- **The manifest and the command line combine, and the command line can only
  narrow.** The deny sets union, and when both give an allowlist the two
  intersect. A capability the package refuses cannot be granted back by a
  flag, so a build script cannot quietly widen what the package says about
  itself.
- **What is judged is every function code outside the program can call**,
  in every module — exactly what `hostVisible` (`src/visibility.ts`) calls
  host-visible for the build, so that no build mode lets a denied capability
  through:
  - a closed build (`--link` or `nish run`, with no sidecar, no
    `declare function` and no wasm target): `main` alone, since nothing but
    the runtime calls in, and a dependency's capability that `main` never
    reaches is not refused;
  - an open build (`-o` without `--link`, any of `--emit-header`,
    `--emit-dts`, `--emit-napi`, `--emit-napi-async`, a program that declares
    a C function, wasm and WASI): `main` and every exported function of every
    module, a second root and every imported module included, because a host
    may call any of them;
  - under `--no-strict-exports` every function has external linkage, so in an
    open build every function of every module is judged, exported or not.

  Per-dependency policy is out of scope (§6).
- **`exit` and `signal` are capabilities like the others.** Under an
  allowlist, a program that calls `process.exit` needs `--allow exit`. What
  WP35 §1 calls ambient — printing, argv, `panic`, arena control — has no
  capability, so no policy can refuse it.
- **`unsafe` can be denied and not allowed.** A call to one of the five
  `nish:unsafe` exports now carries the `unsafe` bit (§4), and `--deny unsafe`
  refuses a program that gives up a check anywhere in its closure, the
  standard library included. The import is the opt-in, so an allowlist never
  refuses `unsafe`, and `--allow unsafe` (or `"unsafe"` under `allow`) is
  refused as a contradiction in terms rather than accepted as a no-op.

## 2. The flags

`--allow <list>` and `--deny <list>` take the next argv entry, as every value
flag does; there is no `=` form. `nish run` accepts both, and the program is
refused before anything is linked or run. `--fix`, which answers before the
program is analysed, and `--emit-ast`, which stops before the checker, refuse
them, as they refuse `--capabilities`.

Each of these is a usage error: exit 2, uncoded, on stderr, as every usage
error is (orientation rule 7):

- a name that is not one of WP35's, exactly as `--emit-capabilities` prints it
  (`fs.reads`, an empty name in `net,,exit`);
- `--allow unsafe`;
- a capability given to both `--allow` and `--deny`;
- a directory scope, `fs.read=<dir>`. The compiler cannot prove which path a
  program opens — a path is an ordinary runtime string, and WP35 §7 rules out
  argument-level precision — and nothing at run time holds the program to it
  yet, so a scope it accepted would be a promise nobody keeps. WP37 accepts
  the suffix together with `--sandbox`, which can enforce it;
- either flag with no value.

The policy is not part of `nish run`'s cache key: the IR names the cache entry,
a refused program writes none, and an accepted one writes the IR it writes
without the policy.

## 3. The manifest

```json
{
  "name": "my-tool",
  "nish": {
    "noPanic": ["src/parse.ts"],
    "capabilities": { "allow": ["fs.read", "exit"], "deny": ["net"] }
  }
}
```

The policy is read from the root package's manifest only — the
`package.json` nearest above the entry, the one `noPanic` is read from — and
sits beside `noPanic` in the same `"nish"` object
(`manifestCapabilities` in `src/manifest.ts`, through the `manifestFieldAt`
reader #443 added). `allow` and `deny` are both optional. An `allow` that is
present but empty allows nothing; an absent one allows everything.

A policy the compiler cannot honour is refused where `package.json` writes it,
because a typo that quietly widened a policy would be the worst outcome there
is:

| Code | Refused |
| --- | --- |
| NL3032 | `capabilities` is not an object, `allow` or `deny` is not an array or is written twice (reading both would union them and widen the policy), a second `capabilities` key in `"nish"` or a second top-level `"nish"` in a manifest that carries a policy (the reader takes the first, and would drop the other's policy in silence), or a `"nish"` or `capabilities` key written with a JSON escape (the reader does not decode escapes, so the policy behind one would be invisible; an escaped key that cannot decode to either is read as it always was). Every top-level `"nish"` is walked for these, whether or not the plain word `capabilities` appears, and a second `"nish"` that holds a `capabilities` of its own is refused too, a key other than those two, or a manifest that mentions `"capabilities"` and stops being JSON before the reader reaches it |
| NL3033 | an entry that is no capability, a non-string entry included |
| NL3034 | `"unsafe"` under `allow` |
| NL3035 | a capability under both `allow` and `deny` |

## 4. The `unsafe` bit

WP35 reserved index 10 for `nish:unsafe`, labelled its five exports none, and
left the wiring to this work package. `builtinCapability` now answers
`CAP_UNSAFE` for `uncheckedGet`, `uncheckedSet`, `wrappingAdd`, `wrappingSub`
and `wrappingMul`, and the bit propagates like any other. So:

- `--emit-capabilities` lists `unsafe` for every function that reaches one of
  them, and `nish run --capabilities` names it;
- `deterministic` is unchanged: `unsafe` is not one of its eight;
- `tests/capabilities.js` still holds the table to one row per builtin: the
  `isUnsafeExport(name)` row now answers the bit instead of none.

Unlike the capabilities of WP35 §4, `unsafe` is not barred from a parallel
body by the shared-write rule: `uncheckedGet` writes nothing, so a body that
reads with it carries the bit to the instance that runs it.

## 5. The refusal

`Compilation.refuseCapabilities` runs at the tail of `check()`, after the
no-panic scope, so the diagnostic goes through the sink like every other and
`--json` carries it. NL2459, one error per refused capability, reported in
source order like every diagnostic:

```
main.ts:4:16: error: `main` reaches `fs.read`, which the capability policy does not grant (`--deny fs.read`); the chain that reaches it: main.ts:4:16 calls load, lib.ts:1:47 calls readFileSync
```

- The span is the first call of the witness chain of the first judged
  function that reaches the capability — `main` first, then each module's
  host-visible functions in load and declaration order — `capSite[c]` on its
  facts.
- The message names the whole chain, one `path:line:col calls <callee>` per
  hop, exactly as `--emit-capabilities` writes `"at"` and `"calls"`
  (`witnessChain` in `src/capability-report.ts`, which both read): relative to
  the entry's directory, so a chain reads the same from any working directory.
  The chain is in the message rather than in notes of its own because a
  `--json` object is flat and its keys are a contract (AGENTS.md).
- The parenthesis says which part of the policy refuses it, the first of four
  that does: `` `--deny c` ``, `` the root package's `deny` ``,
  `` `--allow …` does not list it ``, `` the root package's `allow` does not
  list it ``.

The masks are computed for every compile anyway — `check()` runs the
attribute fixpoint unconditionally — so a policy costs the walk over the
refused bits and nothing for a program without one.

## 6. Out of scope

- **Enforcement at run time**: that is WP37's `--sandbox`, which confines the
  process to `main`'s *computed* set. If the policy is narrower, this work
  package has already refused the program.
- Directory scopes (`fs.read=<dir>`), refused here as §2 says.
- Per-dependency policies, and argument-level checks such as a literal path.
- A capability the analysis cannot see: what C code behind `ffi` does is
  `ffi`, and nothing finer.
