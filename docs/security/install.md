# Security record: `nish install`

The record of `nish install`, the command that fetches a Nish package from a
git repository into `node_modules`, records it in `package.json` in the
spelling npm reads, and keeps its commit in `nish.lock`. It says what the
command trusts, what an attacker who controls the repository, the network or
the command line can do with it, and the test that pins each property. It is
written with the code, at base commit `0bf1ddbb`, rather than after an audit.
It names functions rather than lines, so it holds at any commit that has them.

**Result.** Nothing fetched runs: `git` fetches one commit into a fresh
repository, the tree is listed before it is checked out, and no script in the
package's manifest is read, let alone run. A source must be https, ssh, or a
local repository before `git` is asked anything; `git://` and `http://`
(plaintext), `ext::` (a command), and a source or ref that `git` could read
as a flag are usage errors. A package's `name` becomes a directory only when
it is a plain npm name, so it cannot name a path outside `node_modules`. A
tree holding a symbolic link or a submodule is refused. Every refusal leaves
`node_modules` as it was, and a package replaced by a newer install is put
back if the move fails. A dependency recorded in `nish.lock` is installed at
its locked commit, so a tag moved upstream does not change what a second
checkout compiles.

One finding was fixed while the code was written (INS-1, Low); three are open,
accepted (INS-2 to INS-4, Low).

## Scope

| File | Functions |
| --- | --- |
| `src/install.ts` | `parseGitSource`, `validPackageName`, `install`, and the private helpers they call (`isScpLike`, `validRef`, `latestReleaseTag`, `fetchInto`, `installSource`, `placePackage`, `projectRoot`, `withDependency`, `readLock`, `formatLock`) |
| `src/manifest.ts` | `manifestString`, `manifestOffersNish` (the reads of a fetched manifest) |
| `src/compile.ts` | `commandMain`'s dispatch to `install` |

Read but not owned: `git` itself, which does every network read and every
write inside the staging directory; the resolver that later compiles the
package from `node_modules` (recorded in [`cli.md`](cli.md)); and npm, which
can install the same recorded line.

## Threat model

The attacker may control:

- **The repository**: its tags, its tree, its `package.json`, and what it
  answers for a ref. A package author is the obvious one; so is whoever takes
  over a renamed or deleted repository.
- **The network** between the user and the host, where TLS or SSH does not
  stop it.
- **The command line**: a source or a ref pasted into `nish install`, and the
  dependency lines of a `package.json` someone else wrote.

Out of scope: the user's own git configuration (a `core.hooksPath`, a
`url.<base>.insteadOf`, an LFS filter), which runs as the user already; and a
local user who can write into the project directory, who can edit
`node_modules` directly.

## What is defended

### Nothing fetched runs

`fetchInto` runs `git init` on a fresh staging directory, `git fetch --depth 1
-- <url> <ref>`, then `git ls-tree` on the fetched commit, and only then `git
checkout`. A fresh repository has no hooks from the remote, and the package's
`scripts` are never read: the only fields of a fetched manifest the command
reads are `name`, `version` and `exports`. `.git` is removed before the tree is
moved into `node_modules`.

Tests: `nish install <dir>: the newest vX.Y.Z tag, into node_modules, recorded as npm writes it and locked to its commit`
(which also asserts no `.git` and no staging directory is left).

### A source or ref that is not one

`parseGitSource` accepts `https://`, `ssh://`, `file://` (each optionally
`git+`), git's scp-like `[user@]host:path`, and a local directory, and
refuses everything else before `git` is started: a space or a control
character, a leading `-`, a plaintext scheme, and a scp-like form whose part
before the colon is not a host. `validRef` holds a ref to letters, digits and
`._/-+`, not starting with `-` or `/`, with no `..`. Every argument after the
options reaches `git` behind `--`.

Tests: `nish install ${JSON.stringify(bad)}: a usage error, exit 2, nothing changed`
(for `http://`, `git://`, `ext::sh -c id`, `ext::id`, `--upload-pack=id`, a ref
of `--upload-pack=id`, a ref with `..`, a word that is not a source, and a
missing directory).

### A name that is a path

The package's `name` becomes `node_modules/<name>`, so `validPackageName`
accepts only `name` or `@scope/name`, each part npm's lower-case alphabet and
not starting with `.` or `_`. `../../escape` is refused, and nothing is
written outside `node_modules`.

Tests: `nish install: ${what} is refused (exit 1) and node_modules keeps what it had`
(its "a name that is a path" case, which also asserts the escape directory
does not exist).

### A tree that reaches outside the package

A symbolic link in a package could name any file on the machine, and the
compile that follows reads what it names; a submodule is a second fetch this
command does not make. `fetchInto` reads the commit's tree with `git ls-tree
-r` before checking anything out and refuses a mode 120000 or 160000 entry.

Tests: `nish install: ${what} is refused (exit 1) and node_modules keeps what it had`
(its "a tree with a symbolic link" case).

### A failed install

Every refusal removes the staging directory. `placePackage` renames the
installed package aside before moving the new one in and renames it back if
the move fails, so a failure leaves the previous install rather than none.

Tests: `nish install: ${what} is refused (exit 1) and node_modules keeps what it had`
(each case asserts the previous `hash` 1.0.0 is still installed and nothing
else is in `node_modules`).

### A tag that moves

`nish.lock` holds the commit each package was installed at, beside the source
it came from. `nish install` with no operand fetches that commit by its hash;
a host that will not serve a hash is asked for the ref, and the install is
refused when the ref now names another commit. Installing by name is the only
way to move the lock.

Tests: `nish install with no operand: every git dependency, at its locked commit after its tag moved`,
`nish install <dir>#<tag>: that tag, and the dependency and the lock move to it`.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| INS-1 | Low | `src/install.ts` (`isScpLike`) | The scp-like form was recognised by a colon before any slash, so `ext::<command>` was accepted as a source and handed to `git`, whose `ext` transport runs the command. Git's default `protocol.ext.allow=never` refused it, but a user who had allowed it would have run it. | **Fixed** before the command shipped: the part before the colon must be a host, with an optional `user@`, and `::` is refused. Before, `nish install "ext::id": a usage error, exit 2, nothing changed` failed (git was asked and refused the transport, exit 1); after, it exits 2 before `git` starts. |
| INS-2 | Low | `src/install.ts` (`projectRoot`) | The manifest edited is the nearest `package.json` at or above the working directory, as npm finds it, so `nish install` run in a directory of an unrelated project with no manifest of its own edits the enclosing project's. | **Open, accepted.** It is npm's rule, and the line it prints names what it installed; the test that makes a project with no manifest does so under the system's temporary directory for this reason. |
| INS-3 | Low | `src/install.ts` (`fetchInto`) | A package is trusted on the strength of the transport (TLS or SSH) and the repository's own history: no signature is checked, so a compromised repository installs what it says. | **Open, accepted.** The same trust as `npm install` of a git dependency. The lock narrows it to the first install: after that, a changed tag is not followed. |
| INS-4 | Low | `nish.lock` | The lock pins a commit by git's hash, which is SHA-1 for most repositories, so integrity rests on git's collision detection rather than on a hash of the unpacked tree. | **Open, accepted.** Git hardens SHA-1 against the known collision attacks, and a SHA-256 repository's commits are recorded and checked the same way. |
