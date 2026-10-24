# Security record: a dependency's capabilities

The record of the dependency policy
([wp40-dependency-capabilities.md](../wp40-dependency-capabilities.md)): a
dependency that reaches `unsafe`, `ffi`, `net` or `process.spawn` the root
package does not grant it is refused at compile time with NL2574, naming the
dependency, the capability and the function. It says what the check covers,
what it cannot reach, and the test that pins each property. It is written
with the code rather than after an audit.

Anchors are function names in the files below at `70f503e`, the commit
that adds the check.

**Result.** Every function a dependency's modules define counts toward that
dependency, so a capability it reaches through the standard library, another
dependency or a private helper is its own, and is refused unless the root's
`package.json` grants it by name. A grant comes only from the root manifest:
no flag and no dependency's own manifest adds one, and a grant
never widens the root's own policy. The standard library is told apart by
where a module was resolved, not by its package name, so a package named
`nish` is a dependency like any other. Nothing was found to fix or left open.
Four limits are inherent to a compile-time check of the call graph and are
recorded as accepted: install scripts (CAPS-5), the C behind a granted `ffi`
(CAPS-6), function arguments blamed on the template that calls them (CAPS-7),
and nothing confined at run time (CAPS-8).

## Scope

| File | Functions |
| --- | --- |
| `src/compilation.ts` | `readCapabilityPolicy` (the `dependencies` grants, NL3041 and NL3042), `grantMask`, `refuseDependencyCapabilities`, `reportDependencyRefusal` |
| `src/capability-report.ts` | `DependencyReach`, `dependencyPackages`, `dependencyMasks`, `dependencyWitness` |
| `src/manifest.ts` | `manifestReadGrants` |

Out of scope: the capability analysis itself, the sets and witness chains
`src/capabilities.ts` computes (WP35), and the root's own policy (WP36), which
this check reads but does not change.

## Threat model

The attacker writes a dependency, or takes over one the program already
uses: its source is theirs, and so are its `package.json`, its package name
and the names of its modules and functions. The root package's source and
manifest are the program author's and are trusted, as are the compiler and
the standard library. A win is a dependency that reaches one of the four gated
capabilities while the build succeeds without a grant naming it, or a
refusal that names something other than the dependency, the capability and
a function of that dependency, so the author grants or audits the wrong
thing.

## Findings

Rows CAPS-1 to CAPS-4 are the ways a dependency could try to hide a
capability, each checked and found to hold; CAPS-5 to CAPS-8 are accepted.
None is counted as fixed or open in the index.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| CAPS-1 | High if it failed | `dependencyMasks` | A capability reached indirectly must count: through a private helper, an unexported function, another dependency, or the standard library. | **Holds.** A dependency's set is the union of every function its modules define, exported or not, and each set already holds what its callees reach, so a dependency that calls another is refused for what the other reaches. A capability is only ever set together with the call that sets it (`offerCapability` in `src/attributes.ts`), so every refused capability has a witness to span its error at, and none is dropped for want of one. |
| CAPS-2 | High if it failed | `dependencyPackages` | A dependency must not pass as the standard library, by naming itself `nish` or otherwise. | **Holds.** A module is the library's when it was resolved from the library (`isLibrary`), never by its `packageName`, so a package named `nish` is refused like any other. |
| CAPS-3 | High if it failed | `readCapabilityPolicy`, `grantMask` | A grant must come from the root alone: not a command-line flag, not a dependency's own manifest. | **Holds.** Only the root's `nish.capabilities.dependencies` is read. `--allow net` widens nothing here, and the root's `deny` still refuses its own reach of a capability it granted a dependency (NL2459). |
| CAPS-4 | Medium if it failed | `readCapabilityPolicy`, `manifestReadGrants` | A malformed grant must not be read as a wider one. | **Holds.** A `dependencies` that is not an object, a grant that is not an array, an entry that is not a string or a dependency named twice is NL3041; an unknown capability is NL3033; a capability that is not gated is NL3042. Each stops the build. |
| CAPS-5 | Low | outside the compiler | A package's install scripts (`postinstall` and its kin) run when the package manager installs it, before the compiler sees it. | **Accepted.** The check reads source; it cannot see what an installer runs. Install with `--ignore-scripts` for a dependency that has not been audited. |
| CAPS-6 | Low | `ffi` | A granted `ffi` is all of C: a dependency may then do anything its C does, `net` and `process.spawn` included, and none of it is seen. | **Accepted.** The analysis stops at a `declare function`. Grant `ffi` only to a dependency whose C has been read. |
| CAPS-7 | Low | `dependencyMasks` | A function argument is over-approximated: the root's function passed to a dependency's template makes that template's instantiation, which is the dependency's, reach what the root's function reaches, and the dependency is refused for it. | **Accepted.** The error is a refusal, never a miss: it errs towards asking for a grant. The root can grant it, or call its own function itself. |
| CAPS-8 | Low | — | Nothing is confined at run time: the check is of the source the compiler was given. | **Accepted.** Confining the process to the computed set is WP37's ([wp37-os-sandbox.md](../wp37-os-sandbox.md)), proposed, not built. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. Every
negative link fixture is also held whole by
`link/${name}: --json reports every diagnostic in expected.json, and no other`,
so a fixture that grew a second error, or lost one, fails.

**Each capability is refused and granted** (CAPS-1):
`link/caps_dep_net_refused: rejected with "the dependency `pkg_http` reaches `net` through `dial`"`,
`link/caps_dep_ffi_refused: rejected with "the dependency `pkg_c` reaches `ffi` through `magnitude`"`,
`link/caps_dep_spawn_refused: rejected with "the dependency `pkg_shell` reaches `process.spawn` through `run`"`,
`link/caps_dep_unsafe_refused: rejected with "the dependency `pkg_fast` reaches `unsafe` through `mix`"`;
and with the grant, `link/caps_dep_net_granted: exits with 0 and stdout matches expected.out`,
`link/caps_dep_ffi_granted: exits with 3 and stdout matches expected.out`,
`link/caps_dep_spawn_granted: exits with 3 and stdout matches expected.out`,
`link/caps_dep_unsafe_granted: exits with 4 and stdout matches expected.out`.

**Indirect reach counts** (CAPS-1):
`link/caps_dep_transitive: rejected with "the dependency `pkg_app` reaches `net` through `fetchPage`"`
(through another dependency),
`link/caps_dep_unexported: rejected with "the dependency `pkg_quiet` reaches `net` through `dial`"`
(a function no one imports). A dependency that reaches no gated capability
needs no grant: `link/caps_dep_ungated: exits with 5 and stdout matches expected.out`.

**The library is told by where it was resolved** (CAPS-2):
`link/caps_dep_std_not_refused: exits with 5 and stdout matches expected.out`
(the library's own `net` is not refused) and
`link/caps_dep_named_nish: rejected with "the dependency `nish` reaches `net` through `dial`"`.

**Only the root grants** (CAPS-3):
`link/caps_dep_cli_cannot_grant: rejected with "the dependency `pkg_http` reaches `net` through `dial`"`
(under `--allow net`),
`link/caps_dep_self_grant: rejected with "the dependency `pkg_http` reaches `net` through `dial`"`
(the dependency's own manifest allows and grants `net`), and
``link/caps_dep_root_deny_wins: rejected with "`main` reaches `net`, which the capability policy does not grant (the root package's `deny`)"``.

**A malformed grant stops the build** (CAPS-4):
``link/caps_dep_manifest_not_object: rejected with "`dependencies` is not an object"``,
`link/caps_dep_manifest_not_array: rejected with "the grant of `pkg_http` is not an array"`,
``link/caps_dep_manifest_non_string: rejected with "`7` in the grant of `pkg_http` is not a string"``,
``link/caps_dep_manifest_repeated: rejected with "`pkg_http` is named twice"``,
``link/caps_dep_manifest_unknown: rejected with "`network` is no capability"``,
``link/caps_dep_manifest_ungated: rejected with "`fs.read` is not a gated capability"``.
A well-formed grant the program has no use for is taken:
`link/caps_dep_manifest_unsafe: exits with 4 and stdout matches expected.out`,
`link/caps_dep_manifest_escaped_name: exits with 0 and stdout matches expected.out`,
`link/caps_dep_manifest_unloaded: exits with 0 and stdout matches expected.out`.

**The function argument** (CAPS-7):
`link/caps_dep_fnarg_callback: rejected with "the dependency `pkg_each` reaches `net` through `apply<dial>`"`.

**The order of the errors**:
`link/caps_dep_order: rejected with "the dependency `pkg_a` reaches `ffi` through `magnitude`"`,
whose `expected.json` holds one error per dependency and capability, in the
order the sink prints them.

**The documented error is the printed one**: "capability policy: the
dependency refusal docs/IR_COOKBOOK.md shows is the one
tests/link/caps_dep_net_refused prints".
