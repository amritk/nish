# Security record: a dependency's capabilities

The record of the dependency policy
([wp40-dependency-capabilities.md](../wp40-dependency-capabilities.md)): a
dependency that reaches `unsafe`, `ffi`, `fs.read`, `fs.write`, `net` or
`process.spawn` the root package does not grant it is refused at compile time
with NL2576, naming the dependency, the capability and the function; of the
capability lockfile after it, which refuses a dependency that reaches a
capability `nish-capabilities.lock.json` does not record for it with NL2577;
and of the arguments a grant may carry (a directory, a program, a host),
which refuse a literal outside them with NL2586 and a lockfile row they
outgrow with NL2587. It says what the check covers,
what it cannot reach, and the test that pins each property. It is written
with the code rather than after an audit.

Anchors are function names in the files below at the commit that adds the
check, the squash merge of #905, and, for the lockfile, at the squash merge
of #923 (reviewed at its head `6fd3b6f`), and, for the grant arguments
(CAPS-14 to CAPS-20), at the squash merge of the pull request that adds them
(part of #1114).

**Result.** Every function a dependency's modules define counts toward that
dependency, so a capability it reaches through the standard library, another
dependency or a private helper is its own, and is refused unless the root's
`package.json` grants it by name. A grant comes only from the root manifest:
no flag and no dependency's own manifest adds one, and a grant
never widens the root's own policy. The standard library is told apart by
where a module was resolved, not by its package name, so a package named
`nish` is a dependency like any other. The lockfile refuses any capability a
dependency's row does not record, whether the root grants it or not, and a
file it cannot read whole stops the build rather than reading as a wider one.
Nothing was found to fix or left open.
Four limits are inherent to a compile-time check of the call graph and are
recorded as accepted: install scripts (CAPS-5), the C behind a granted `ffi`
(CAPS-6), function arguments blamed on the template that calls them (CAPS-7),
and nothing confined at run time (CAPS-8). Two more are the lockfile's and
are accepted too: a row is never tightened (CAPS-12), and the check holds only
while a readable lockfile does (CAPS-13).
A grant's arguments are checked at build time against the literals a
dependency hands the builtins that reach them, and held at run time by
`--sandbox` for directories and programs; two limits are accepted (CAPS-17,
CAPS-18) and one is open: a `net=<host>` grant binds no computed host at run
time, since seccomp cannot read a socket's address (CAPS-19).

## Scope

| File | Functions |
| --- | --- |
| `src/compilation.ts` | `readCapabilityPolicy` (the `dependencies` grants, NL3041 and NL3042), `grantMask`, `refuseDependencyCapabilities`, `reportDependencyRefusal` |
| `src/capability-report.ts` | `DependencyReach`, `dependencyPackages`, `dependencyMasks`, `dependencyWitness` |
| `src/manifest.ts` | `manifestReadGrants` |
| `src/capability-lock.ts` | `readCapabilityLock` (NL3043), `capabilityLockText` |
| `src/compilation.ts` | `checkCapabilityLock`, `reportLockGrowth` (NL2577) |
| `src/compilation.ts` | `grantArgument` (NL3045 to NL3048), `grantArguments`, `refuseNarrowGrants`, `reportNarrowGrant` (NL2586), `reportArgumentGrowth` (NL2587), `narrowSandbox` |
| `src/capability-report.ts` | `literalReaches`, `reachArguments`, `numericHost` |
| `src/capability-lock.ts` | `recorded` |

Out of scope: the capability analysis itself, the sets and witness chains
`src/capabilities.ts` computes (WP35), and the root's own policy (WP36), which
this check reads but does not change.

## Threat model

The attacker writes a dependency, or takes over one the program already
uses: its source is theirs, and so are its `package.json`, its package name
and the names of its modules and functions. The root package's source and
manifest are the program author's and are trusted, as are the compiler and
the standard library. A win is a dependency that reaches one of the six gated
capabilities while the build succeeds without a grant naming it, or a
refusal that names something other than the dependency, the capability and
a function of that dependency, so the author grants or audits the wrong
thing. For the lockfile, the attacker publishes an upgrade of a dependency
the author already locked, and the lockfile in the root is the author's: a
win is the upgrade reaching a capability its row does not record while the
build succeeds. For a grant with arguments, a win is the dependency reaching
past them — a file outside the granted directories, a program not granted, a
host not granted — while the build succeeds and, under `--sandbox`, while the
program runs.

## Findings

Rows CAPS-1 to CAPS-4 are the ways a dependency could try to hide a
capability, each checked and found to hold; CAPS-5 to CAPS-8 are accepted;
CAPS-9 to CAPS-11 are the lockfile's, each found to hold, and CAPS-12 and
CAPS-13 its accepted limits.
CAPS-14 to CAPS-20 are the grant arguments': CAPS-14 to CAPS-16 and CAPS-20
hold, CAPS-17 and CAPS-18 are accepted, and CAPS-19 is open, the one row the
index counts.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| CAPS-1 | High if it failed | `dependencyMasks` | A capability reached indirectly must count: through a private helper, an unexported function, another dependency, or the standard library. | **Holds.** A dependency's set is the union of every function its modules define, exported or not, and each set already holds what its callees reach, so a dependency that calls another is refused for what the other reaches. A capability is only ever set together with the call that sets it (`offerCapability` in `src/attributes.ts`), so every refused capability has a witness to span its error at, and none is dropped for want of one. |
| CAPS-2 | High if it failed | `dependencyPackages` | A dependency must not pass as the standard library, by naming itself `nish` or otherwise. | **Holds.** A module is the library's when it was resolved from the library (`isLibrary`), never by its `packageName`, so a package named `nish` is refused like any other. |
| CAPS-3 | High if it failed | `readCapabilityPolicy`, `grantMask` | A grant must come from the root alone: not a command-line flag, not a dependency's own manifest. | **Holds.** Only the root's `nish.capabilities.dependencies` is read. `--allow net` widens nothing here, and the root's `deny` still refuses its own reach of a capability it granted a dependency (NL2459). |
| CAPS-4 | Medium if it failed | `readCapabilityPolicy`, `manifestReadGrants` | A malformed grant must not be read as a wider one. | **Holds.** A `dependencies` that is not an object, a grant that is not an array, an entry that is not a string or a dependency named twice is NL3041; an unknown capability is NL3033; a capability that is not gated is NL3042. Each stops the build. |
| CAPS-5 | Low | outside the compiler | A package's install scripts (`postinstall` and its kin) run when the package manager installs it, before the compiler sees it. | **Accepted.** The check reads source; it cannot see what an installer runs. Install with `--ignore-scripts` for a dependency that has not been audited. |
| CAPS-6 | Low | `ffi` | A granted `ffi` is all of C: a dependency may then do anything its C does, `net` and `process.spawn` included, and none of it is seen. | **Accepted.** The analysis stops at a `declare function`. Grant `ffi` only to a dependency whose C has been read. |
| CAPS-7 | Low | `dependencyMasks` | A function argument is over-approximated: the root's function passed to a dependency's template makes that template's instantiation, which is the dependency's, reach what the root's function reaches, and the dependency is refused for it. | **Accepted.** The error is a refusal, never a miss: it errs towards asking for a grant. The root can grant it, or call its own function itself. |
| CAPS-8 | Low | — | Nothing is confined at run time: the check is of the source the compiler was given. | **Accepted.** Confining the process to the computed set is WP37's ([wp37-os-sandbox.md](../wp37-os-sandbox.md), [sandbox.md](sandbox.md)), and holds only under `--sandbox`; a grant's directories and programs narrow it there (CAPS-17). |
| CAPS-9 | High if it failed | `checkCapabilityLock` | Every capability a dependency reaches beyond its row must be refused: gated or not, granted or not, and for a dependency with no row at all. | **Holds.** The comparison is of the same masks the policy reads, after it, and a dependency with no row is held to an empty one. Each refused capability is spanned at the first call of its witness chain, as NL2576 is. |
| CAPS-10 | Medium if it failed | `readCapabilityLock` | A malformed lockfile must not be read as a wider one. | **Holds.** Text that is not JSON, a `version` other than 1, an unknown key, an unknown capability, and a key or capability written twice are NL3043, spanned in the lockfile, and stop the build. |
| CAPS-11 | Medium if it failed | `checkCapabilityLock`, the driver | `--update-capability-lock` must not record a reach the policy refuses, and must not be skipped by the run cache. | **Holds.** The driver writes the file only after the check, so a refused build writes none; `nish run` checks before its cache lookup, so a cache hit is held to the lockfile. |
| CAPS-12 | Low | `checkCapabilityLock` | A row is never tightened: a dependency that drops a capability in one release and regains it in a later one builds without a word, since the row still records it. | **Accepted.** Only growth is refused, by design, so that a lockfile written once does not fail every build a dependency shrinks in. Rerun `--update-capability-lock` after an upgrade that shrinks a dependency, and review the diff. |
| CAPS-13 | Low | `checkCapabilityLock` | The check exists only while the lockfile does: an absent lockfile turns it off with no warning, and so does a path that cannot be read (a directory of that name), which `readFileSyncOrNull` reports as absent. A refusal is also reported only where a witness chain is found to span it; none was found to be missing, but there is no spanless fallback. | **Accepted.** Deleting the file has the same effect as making it unreadable, so the extra exposure is small; the lockfile is committed, so its removal shows in review. Telling an unreadable path from an absent one would fail closed, and is left for a later change. |
| CAPS-14 | High if it failed | `refuseDependencyCapabilities` | A dependency that reads or writes a file must need a grant, as one that dials does: files are where secrets live. | **Holds.** `fs.read` and `fs.write` are gated, refused by NL2576 like the other four; a grant of either, whole or with a directory, admits it. A root grant that already named either as ungated (NL3042 until now) is now taken. |
| CAPS-15 | Medium if it failed | `grantArgument` | A malformed argument must not be read as a wider grant: a directory that does not exist, a program that is not found, a host that is a name to look up, an argument on a capability that takes none. | **Holds.** Each is refused, NL3047, NL3046, NL3045 and NL3048, and stops the build. A directory and a program are resolved to their real paths when the program is built, so a symlink named in the grant is followed once, by the compiler, and the scope is what it pointed at then. |
| CAPS-16 | High if it failed | `refuseNarrowGrants`, `literalReaches` | A literal a dependency hands `readFileSync`, `writeFileSync`, `spawnSync`, `netAddress` and their kin outside its grant's arguments must be refused. | **Holds** for string literals. An absolute path is normalized (`..` and `.` folded) before it is compared, then compared by its real path and its parent's, so `data/../../etc/passwd` is outside `data`; a program by its name and by what `PATH` finds; a host as written. |
| CAPS-17 | Medium | `literalReaches`, `narrowSandbox` | A computed path or program, a relative path, and a literal routed through a variable are not seen at build time; and the sandbox narrows only when it can: the root itself reaching the capability, an `--allow fs.read=<dir>` or `--allow fs.write=<dir>` scope on the command line, `ffi` in `main`, or a reaching dependency granted the capability whole leaves the capability whole at run time. Without `--sandbox`, an argument binds nothing at run time. A literal path inside a granted directory that is a symlink out of it passes the build check (its normalized path is inside); Landlock refuses it at run time, since it checks the file opened. | **Accepted.** The build check is the early, readable refusal; the sandbox is the enforcement, and the program author asks for it with `--sandbox`. Each case that leaves the capability whole keeps the confinement the program had before arguments, never a looser one. |
| CAPS-18 | Low | `narrowSandbox` | Run-time scopes are per program, not per package: under `--sandbox`, every package that reaches `fs.read` may read every directory any dependency is granted, and a granted program may be run by any dependency that reaches `process.spawn`. | **Accepted.** The kernel confines a process, not a package. The build check (CAPS-16) is per package. |
| CAPS-19 | Medium | `refuseNarrowGrants`, the sandbox's seccomp filter | A `net=<host>` grant binds only literal hosts: a host computed at run time is not checked, with or without `--sandbox`, since seccomp sees a pointer to the socket address and cannot read it, and Landlock's network rules scope ports, not addresses. | **Open.** A grant with a host is a review aid, not a confinement. Closing it needs the runtime's `netAddress` to check the granted list itself, or a network namespace; recorded for a later change. |
| CAPS-20 | Medium if it failed | `reportArgumentGrowth`, `recorded` | An upgrade must not widen a grant's arguments past what the lockfile records without review. | **Holds.** The lockfile records each grant's arguments (`"pkg_conf": ["fs.read=data"]`, the directory relative to the root package); a grant naming a directory, program or host the row does not record, or granting whole a capability the row records narrowed, is NL2587, while a row that records the capability whole accepts any argument. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding.
Every negative link fixture is also held whole, so a fixture that grew a
second error, or lost one, fails:
`link/${name}: --json reports every diagnostic in expected.json, and no other`.

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
needs no grant: `link/caps_dep_ungated: exits with 5 and stdout matches expected.out`;
nor does the root's own reach, which is not blamed on a dependency it calls:
`link/caps_dep_root_net: exits with 0 and stdout matches expected.out`.
A chain whose every package is granted compiles:
`link/caps_dep_transitive_granted: exits with 0 and stdout matches expected.out`.

**The library is told by where it was resolved** (CAPS-2):
`link/caps_dep_std_not_refused: exits with 5 and stdout matches expected.out`
(the library's own `net` is not refused) and
`link/caps_dep_named_nish: rejected with "the dependency `nish` reaches `net` through `dial`"`.
A scoped package is named whole:
`link/caps_dep_scoped: rejected with "the dependency `@acme/http` reaches `net` through `dial`"`,
and granted by that name it compiles:
`link/caps_dep_scoped_granted: exits with 0 and stdout matches expected.out`.

**Only the root grants** (CAPS-3):
`link/caps_dep_cli_cannot_grant: rejected with "the dependency `pkg_http` reaches `net` through `dial`"`
(under `--allow net`),
`link/caps_dep_self_grant: rejected with "the dependency `pkg_http` reaches `net` through `dial`"`
(the dependency's own manifest allows and grants `net`),
`link/caps_dep_partial_grant: rejected with "the dependency `pkg_b` reaches `unsafe` through `fetchMixed`"`
(granted `net` alone, it reaches `net` and `unsafe`: its `expected.json` holds
the one `unsafe` error and no `net` one), and
``link/caps_dep_root_deny_wins: rejected with "`main` reaches `net`, which the capability policy does not grant (the root package's `deny`)"``.

**A malformed grant stops the build** (CAPS-4):
``link/caps_dep_manifest_not_object: rejected with "`dependencies` is not an object"``,
`link/caps_dep_manifest_not_array: rejected with "the grant of `pkg_http` is not an array"`,
``link/caps_dep_manifest_non_string: rejected with "`7` in the grant of `pkg_http` is not a string"``,
``link/caps_dep_manifest_repeated: rejected with "`pkg_http` is named twice"``,
``link/caps_dep_manifest_unknown: rejected with "`network` is no capability"``,
``link/caps_dep_manifest_ungated: rejected with "`env` is not a gated capability"``.
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

**The lockfile refuses growth** (CAPS-9):
`link/caps_lock_growth: rejected with "the dependency `pkg_http` reaches `net` through `dial`, which `nish-capabilities.lock.json` does not record for it"`
(the root grants the `net` its row leaves out) and
`link/caps_lock_no_row: rejected with "the dependency `pkg_http` reaches `net` through `dial`, which `nish-capabilities.lock.json` does not record for it"`.
A capability the policy does not gate is held to the row as well:
`link/caps_lock_ungated: rejected with "the dependency `pkg_mix` reaches `env` through `config`, which `nish-capabilities.lock.json` does not record for it"`
(its row records `net`), and the writer records it: "capability lock:
--update-capability-lock records a capability the dependency policy does not
gate", "capability lock: the build after recording an ungated capability
passes".
Only growth: `link/caps_lock_matches: exits with 0 and stdout matches expected.out`,
`link/caps_lock_shrink: exits with 0 and stdout matches expected.out`,
`link/caps_lock_stale: exits with 0 and stdout matches expected.out`,
`link/caps_lock_no_row_pure: exits with 3 and stdout matches expected.out`.

**A malformed lockfile stops the build** (CAPS-10):
`link/caps_lock_bad_json: rejected with "the file stops being JSON here: the capability lockfile is one object"`,
``link/caps_lock_bad_version: rejected with "`version` is not 1: the capability lockfile is one object"``,
``link/caps_lock_bad_key: rejected with "`comment` is no key of the file: the capability lockfile is one object"``,
``link/caps_lock_bad_capability: rejected with "`network` in the row of `pkg_http` is no capability: the capability lockfile is one object"``,
``link/caps_lock_bad_repeated: rejected with "`pkg_http` is named twice: the capability lockfile is one object"``.

**The update writes only what the policy passed** (CAPS-11):
"capability lock: a build the dependency policy refuses writes no lockfile under --update-capability-lock",
"capability lock: --update-capability-lock rewrites the lockfile it would refuse, sorted, two-space, one trailing newline",
"capability lock: a second --update-capability-lock writes the same bytes",
"capability lock: --update-capability-lock replaces a malformed lockfile instead of reading it", and
"capability lock: `nish run` takes --update-capability-lock, and a run cache hit is still held to the lockfile".

**The documented error is the printed one**: "capability lock: the refusal
docs/IR_COOKBOOK.md shows is the one tests/link/caps_lock_growth prints";
"capability policy: the
dependency refusal docs/IR_COOKBOOK.md shows is the one
tests/link/caps_dep_net_refused prints".

**Files are gated** (CAPS-14):
`link/caps_dep_fs_read_refused: rejected with "the dependency `pkg_conf` reaches `fs.read` through `load`"`,
`link/caps_dep_fs_write_refused: rejected with "the dependency `pkg_log` reaches `fs.write` through `save`"`.
Before this change both built; `link/caps_package`, a dependency that reads a file, builds again once its `package.json` grants `fs.read`.

**A malformed argument stops the build** (CAPS-15):
`link/caps_dep_manifest_arg_refused`, whose `expected.json` holds NL3045
(`net=example.com`), NL3046 (`process.spawn=nish-no-such-program`), NL3047
(`fs.read=./missing`) and NL3048 (`unsafe=yes`), and no other error.

**A literal outside the grant is refused** (CAPS-16):
`link/caps_dep_arg_fs_too_narrow: rejected with "which its `fs.read` grant does not cover: it is granted fs.read=data"`,
`link/caps_dep_arg_spawn_too_narrow: rejected with "hands `spawnSync` "sh", which its `process.spawn` grant does not cover"`,
`link/caps_dep_arg_net_too_narrow: rejected with "hands `netAddress` "10.0.0.1", which its `net` grant does not cover"`;
the grants that cover each build and run:
`link/caps_dep_arg_granted: exits with 0 and stdout matches expected.out`.

**The sandbox holds what the build cannot see** (CAPS-17): "sandbox
dependency grants: a dependency granted fs.read=<dir> reads inside it and not
/etc/passwd" (the path is computed, so the build passes it, and Landlock
refuses it), "sandbox dependency grants: the wrapper passes the grant's real
directory as the fs.read scope", "sandbox dependency grants: a dependency
granted process.spawn=true runs true and cannot exec echo" (unsandboxed, the
same program runs `echo`), and "sandbox dependency grants: the exec allowlist
names the granted program by its absolute path".

**The lockfile records the arguments** (CAPS-20):
`link/caps_lock_args: rejected with "is granted `fs.read=more`, past the arguments `nish-capabilities.lock.json` records for its `fs.read`"`.
