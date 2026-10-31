# WP40: A dependency's capabilities — the root package grants them

**Status: built**, compile time only. WP35
([wp35-capabilities.md](wp35-capabilities.md)) works out which capabilities
every function can reach; WP36
([wp36-capability-policy.md](wp36-capability-policy.md)) refuses a program
whose exposed functions reach what its policy does not grant. This work
package does the same for each dependency on its own: a package loaded from
`node_modules` that reaches `unsafe`, `ffi`, `fs.read`, `fs.write`, `net` or
`process.spawn` is refused (NL2576) unless the root `package.json` grants it
that capability by name. A grant may carry an argument that narrows it (§2a):
checked at build time where the compiler sees the value, and held at run time
by `--sandbox` for directories and programs. A program the check accepts
compiles to the IR it compiled to before.

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
program it is in. The gated capabilities are the ones a library has
least reason to need and an attacker most use for: they leave the language's
guarantees (`unsafe`, `ffi`), the machine (`net`, `process.spawn`) or reach
the files where secrets live (`fs.read`, `fs.write`; ungated until §2a gave a
grant a directory to name). The rest — the environment, the clock, `exit`,
the terminal — stay ungated.

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

### 2a. Arguments

```json
{ "nish": { "capabilities": { "dependencies": {
  "pkg_tool": ["fs.read=./data", "process.spawn=git", "net=127.0.0.1"]
} } } }
```

An entry `capability=argument` grants the capability narrowed to the
argument; an entry without one grants it whole, as before, and a capability
may be named once per argument. When the program is built:

| Capability | Argument | Resolved | Refused |
| --- | --- | --- | --- |
| `fs.read`, `fs.write` | a directory | from the root package's directory, to its real path | NL3047, when it is not a directory |
| `process.spawn` | a program | on `PATH`, or as a path from the root package's directory, to its real path | NL3046, when nothing is found |
| `net` | a host | kept as written: an IPv4 or IPv6 address, the form `nish:net` takes | NL3045, for a name to look up |
| any other | — | — | NL3048 |

**At build time** (`refuseNarrowGrants`), each string literal a dependency's
module hands a builtin that reaches the capability — `readFileSync` and its
kin for a path, `spawnSync` and its kin for the program (an array's first
element), `netAddress` for the host — is held to the arguments, and one
outside them is NL2586, spanned at the literal. An absolute path is
normalized and compared by its real path and its parent's; a relative path
and a computed value are not seen.

**At run time** (`narrowSandbox`), under `--sandbox`, the granted directories
become the `fs.read` and `fs.write` scopes and the programs, with their ELF or
`#!` interpreters, the exec allowlist
([wp37-os-sandbox.md §2a](wp37-os-sandbox.md#2a-scopes-from-a-dependencys-grants)).
A capability is narrowed only when every dependency that reaches it is
granted it with arguments, the root does not reach it itself, the command line
gives it no scope and `main` does not reach `ffi`; otherwise it stays whole,
the confinement it had before. Hosts are not enforced at run time: seccomp
cannot read the address a socket call is given (CAPS-19, open).

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

§2a gates `fs.read` and `fs.write` as well, which breaks again: a dependency
that reads or writes a file stops building with NL2576 until the root grants
it, whole (`["fs.read"]`, the old behaviour) or narrowed
(`["fs.read=./data"]`). A grant that named `fs.read` or `fs.write`, an NL3042
error until now, is taken. A lockfile row is unchanged by the gate.

## 6. The capability lockfile

A grant says what a dependency may reach; it does not say what it reached
when someone last looked. `--update-capability-lock` writes
`nish-capabilities.lock.json` beside the root `package.json` (beside the entry
when there is none): one row per loaded dependency, every capability it
reaches, gated or not, packages sorted and capabilities in the report's order,
so the bytes depend on the program alone (`src/capability-lock.ts`).

While the file exists, `Compilation.check` compares each dependency's reach
with its row after both policies have passed, and a capability the row does not
record is NL2577, in the dependency, in NL2576's order and with its witness
chain. Only growth is an error: a row that records more, a row for a package
no longer loaded, and a dependency with no row that reaches nothing are
accepted. The file is read strictly (NL3043, spanned in the lockfile): the
point of it is a review, and a file the compiler half-reads is one nobody can
trust.

The flag skips the comparison, and the driver writes the file only once the
check has passed, so a build the grants refuse writes nothing. It changes no
byte of the IR. `nish run` runs the check before its cache lookup, so the file
is not in the cache key and a cache hit is held to it too. `--fix` and
`--emit-ast` refuse the flag, as they refuse `--allow`.

A grant with arguments is recorded with them, one entry per argument, a
directory relative to the root package's directory: `"pkg_conf":
["fs.read=data"]`. A row that records a capability whole accepts any grant of
it; one that records it narrowed refuses a grant naming an argument it does
not record, or granting the capability whole, with NL2587, until the lock is
updated.

## 7. Out of scope

- **Enforcement at run time**: WP37's `--sandbox`
  ([wp37-os-sandbox.md](wp37-os-sandbox.md)).
- **Install scripts**, which the package manager runs before the compiler
  sees a package (CAPS-5).
- What C behind a granted `ffi` does (CAPS-6).

## 8. Tests

`tests/link/caps_dep_*`: one refused and one granted program per gated
capability, and the transitive and scoped (each refused and granted),
unexported, standard-library, `nish`-named, root-reach, command-line,
self-grant, partial-grant, root-deny, function-argument, ordering and manifest
cases.
Each negative fixture holds its whole `--json` output.

`tests/link/caps_dep_fs_*` and `caps_dep_arg_*` (§2a): the two file
capabilities refused, a grant with all three kinds of argument that builds,
a literal outside each kind refused, and the four malformed arguments
(`caps_dep_manifest_arg_refused`). `tests/link/caps_lock_args`: a grant past
the lock's arguments. `tests/link/sandbox_dep_*` and `tests/run.js`'s
"sandbox dependency grants": the run-time half, each a computed value the
build passes and the sandbox refuses. `tests/run.js` holds
the refusal `docs/IR_COOKBOOK.md` shows to what the compiler prints.

`tests/link/caps_lock_*`: a lockfile that matches, records more, has a stale
row, has no row (for a dependency that reaches `net` and one that reaches
nothing), records less (refused), and five malformed files (each refused),
and the dependency policy's refusal, which `--update-capability-lock` writes no file for.
`tests/run.js` copies a fixture out to rewrite its lockfile, holds the bytes
and the rebuild, and pins the cache-hit behaviour of `nish run`.
