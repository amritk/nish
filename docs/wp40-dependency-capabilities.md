# WP40: A dependency's capabilities — the root package grants them

**Status: built**, compile time only. WP35
([wp35-capabilities.md](wp35-capabilities.md)) works out which capabilities
every function can reach; WP36
([wp36-capability-policy.md](wp36-capability-policy.md)) refuses a program
whose exposed functions reach what its policy does not grant. This work
package does the same for each dependency on its own: a package loaded from
`node_modules` that reaches `unsafe`, `ffi`, `net` or `process.spawn` is
refused (NL2574) unless the root `package.json` grants it that capability by
name. A program the check accepts compiles to the IR it compiled to before.

**The living reference is [LANGUAGE.md](LANGUAGE.md#a-dependencys-capabilities)**;
where this note disagrees with it, LANGUAGE.md wins. The security record is
[security/capabilities.md](security/capabilities.md).

(The number 40 is shared with
[wp40-ffi-buffers-handles.md](wp40-ffi-buffers-handles.md), an unrelated
work package; the two are told apart by their names.)

## 1. Why

A program's own policy says what the program may do. It cannot say which
code does it: a JSON parser that opens a socket, or a string helper that
calls `nish:unsafe`, passes any policy that grants `net` or `unsafe` to the
program it is in. The four gated capabilities are the ones a library has
least reason to need and an attacker most use for: they leave the language's
guarantees (`unsafe`, `ffi`) or the machine (`net`, `process.spawn`). The
rest — files, the environment, the clock, `exit` — stay ungated, so a
dependency that reads a file needs nothing.

## 2. The grant

```json
{ "nish": { "capabilities": { "dependencies": { "pkg_http": ["net"] } } } }
```

`dependencies` maps a package name to the gated capabilities it is granted.
It is read only from the root manifest, as strictly as the rest of the
`"nish"` field (#458): a value that is not an object, a package named twice,
a grant that is not an array and an entry that is not a string are NL3041; a
name that is no capability is NL3033 and one that is not gated NL3042. A
grant to a package the program does not load is no error, so a manifest
stays valid when a dependency goes. No flag grants anything here, and a
dependency's own manifest is not read for it.

## 3. What a dependency reaches

A dependency is every package but the root and the standard library, told
apart by where a module was resolved (`isLibrary`), never by its package's
name. Its set is the union of WP35's set over every function its modules
define, exported or not, called or not: each set already holds what its
callees reach, so what a dependency reaches through the standard library or
another dependency is its own. A template's instantiation is defined in the
template's module, so a function the root passes to a dependency's template
counts for the dependency — an over-approximation, recorded as CAPS-7.

## 4. The refusal

One error per dependency and capability, after the root's own policy has
been applied, spanned at the first call of the witness chain from the
dependency's first function, in source order, that reaches it, and naming
the package, the capability, that function, the grant to add and the chain:

```text
node_modules/pkg_http/src/index.ts:6:10: error: the dependency `pkg_http` reaches `net` through `dial`, which the root package does not grant it; grant it with "nish": { "capabilities": { "dependencies": { "pkg_http": ["net"] } } } — the chain that reaches it: node_modules/pkg_http/src/index.ts:6:10 calls netAddress
```

A grant never widens the root's policy: a capability the root denies is
still refused for the root (NL2459), whoever it is granted to.

## 5. Migration

This is a breaking change: a program whose dependency reaches a gated
capability stopped building. Add the grant each error names to the root
`package.json`; nothing else changes.

## 6. Out of scope

- **Enforcement at run time**: WP37's `--sandbox`
  ([wp37-os-sandbox.md](wp37-os-sandbox.md)).
- **Install scripts**, which the package manager runs before the compiler
  sees a package (CAPS-5).
- What C behind a granted `ffi` does (CAPS-6).
- A lockfile of the granted sets, refusing a dependency whose set grows on
  an upgrade: a later stage.

## 7. Tests

`tests/link/caps_dep_*`: one refused and one granted program per gated
capability, and the transitive, unexported, standard-library, `nish`-named,
command-line, self-grant, root-deny, function-argument, ordering and
manifest cases. Each negative fixture holds its whole `--json` output.
`tests/run.js` holds the refusal `docs/IR_COOKBOOK.md` shows to what the
compiler prints.
