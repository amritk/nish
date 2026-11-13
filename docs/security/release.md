# Security record: the update notice, `nish upgrade` and `nish/release`

The record of the release check (issue #1523): `nish/release`, the standard
library module that asks GitHub for the newest release; the update notice
a command that exits 0 or 1 (a compile, `nish --version`, `nish --help`) may
print; and `nish upgrade`, which
installs a release. It says what each one trusts, what an attacker who
controls the answer, the cache or the command line can do with it, and the test
that pins each property. It is written with the code, at base commit
`ac813b5d`, rather than after an audit. It names functions rather than lines,
so it holds at any commit that has them.

**Result.** A version must be a semantic version, which also passes
`install.sh`'s own rule, before it reaches a URL, a command line or a
terminal, so `1.0.0/../x`, `0.40.0?x` or `1.2` is refused with exit 2 before
any request. The latest release is read only from a
`/releases/latest` redirect to exactly `<repository>/releases/tag/v<version>`;
every other answer names no version and prints no notice. Without a version on
the command line nothing older than the running compiler, or the same, is ever
installed. The cache that decides the notice is believed only when it is a
regular file this user owns in a directory this user owns, and nobody else
can write either; a cache directory someone else can write is made 0700
before anything is kept in it. `install.sh` is fetched from the release's tag into a
private directory and run as `sh <file>`; nothing fetched is piped into a
shell.

Four findings were fixed while the code was written (REL-1, REL-4, REL-5 and
REL-6, Low); two are open, accepted (REL-2 and REL-3, Low).

## Scope

| File | Functions |
| --- | --- |
| `std/release.ts` | `releaseValidVersion`, `releaseParseVersion`, `releaseCompare`, `releaseIsNewer`, `releaseTagFromLocation`, `releaseBaseAllowed`, `releaseLatest`, `releaseFetchInstaller`, `releaseFileTrusted`, `releaseCacheRead`, `releaseCacheParse`, `releaseCacheFresh`, `releaseCacheWrite`, `releaseCheckCached`, and the private helpers they call |
| `src/upgrade.ts` | `noticeOffByEnvironment`, `validVersion`, `baseAllowed`, `releaseBase`, `rawBase`, `installChannel`, `wrapperBeside`, `noticeCachePath`, `parseNoticeCache`, `noticeFresh`, `writeNoticeCache`, `NOTICE_PROBE`, `updateNotice`, `startNoticeCheck`, `RELEASE_HELPER_SOURCE`, `planUpgrade`, `runUpgrade` |
| `src/compile.ts` | `main`'s call into the notice, `noticeSuppressed`, `selfPath`, `upgrade`, and `cachedTool` (the run cache's builder for the release helper, shared with `--watch`'s supervisor) |

Read but not owned: `std/net/fetch.ts` (the client both fetches use, recorded in
[`fetch.md`](fetch.md)), `install.sh` (what runs once it is fetched, recorded in
[`supply-chain.md`](supply-chain.md)), and the run cache the helper is built
into (recorded in [`cli.md`](cli.md)).

## Threat model

The attacker may control:

- **The network answer.** The server reached for `/releases/latest` and
  `install.sh`, or anything on the path to it that TLS does not stop: a captive
  portal, a proxy that answers for every host, a repository that was renamed.
- **The command line**: a version typed or pasted into `nish upgrade`.
- **Another local user** who can write into a directory on the cache's path.

Out of scope: a compromised GitHub account or release, which signs nothing
the client could check (REL-2), and a user who sets `NISH_RELEASE_URL` (where
the latest version is asked) or `NISH_RELEASE_RAW_URL` (whose `install.sh` is
fetched and run) to a server of their own. Both are test seams, held to https
or http to loopback (`baseAllowed`); whoever sets this user's environment can
already run code as this user, so choosing the installer's host gives them
nothing new.

## What is defended

### A downgrade

`releaseIsNewer` (and the helper's `newer`) is true only when both versions
parse as semantic versions and the candidate is strictly newer, so a server
naming an older release, the same release, or something that does not parse
installs nothing and prints no notice. `nish upgrade` with no version installs
the latest only when it is newer; an older version is installed only when the
user names it, and then with a line that says it is a downgrade.

Tests: `nish upgrade: with no version, an older latest installs nothing`,
`nish upgrade 0.1.0: an explicit older version says it is a downgrade and installs it`,
`nish/release: versions, ordering, redirects and bases` (which also orders
prereleases, numbers by value, and refuses a garbage candidate or current).

### A redirect that is not a release

`releaseLatest` does not follow the redirect. It reads its `Location` and
`releaseTagFromLocation` takes a version only from exactly
`<base>/releases/tag/v<version>`, and only one that parses. A redirect to another repository, a login page, the releases list, or
with a query or fragment names none, and neither does a 200, a 500, garbage
or silence: the check exits 3 and the notice prints nothing.

Tests: `nish upgrade --check: a server that is ${name} gives exit 3 within the lookup's time`
(for `elsewhere`, `login`, `refuse`, `garbage`, `slow` and `down`; each server
but `down` is shown to be asked, and `slow` to be ended by the two-second limit),
`nish/release: versions, ordering, redirects and bases`.

### A version that escapes its URL

`releaseValidVersion` ports `install.sh`'s `nish_valid_version`: a digit
first, then only `[0-9A-Za-z.+-]`, no `..`, at most 64 bytes.
`validVersion`, which `nish upgrade` applies to what is typed, and
`releaseParseVersion` are stricter: a semantic version, `MAJOR.MINOR.PATCH`
of numbers with no leading zero, then an optional `-prerelease` (a numeric
identifier with no leading zero) and `+build`. No `/`, `?`, `#`, `%`,
whitespace or escape gets through, so a
version cannot leave `/releases/tag/` or `/v<version>/install.sh`, cannot
add an argument to `install.sh`'s command line, and cannot write a control
sequence to the terminal. `planUpgrade` refuses a bad version with exit 2
before the helper is built, and a release URL override that is plain http to
anything but loopback is refused the same way; after the loopback host only a
port of digits and a path may follow, so `http://localhost:@host` is refused
(REL-6).

Tests: `nish upgrade ${bad}: exit 2, before any network access` (for
`1.0.0/../x`, `0.40.0?x`, `1.0.0#x`, a space, tab or newline, `1.0.0%2e`,
`1.0.0%2f`, `1.2`, `01.2.3`, `1.2.3.4`, `1.2.3-`, `1.0.0-01` and others; the
server's log shows no request), `nish/release: versions, ordering, redirects
and bases` (the same characters against `releaseValidVersion`, and a tag with
`?x` or `#x` after it),
`nish upgrade: a release URL that is plain http to another host is refused (exit 2)`,
`nish upgrade: a loopback release URL that names another host after the colon is refused (exit 2)`.

### A planted cache

The notice reads one file, `$XDG_CACHE_HOME/nish/release/notice-<version>`
(else under `$HOME/.cache`). Whoever can write it chooses the line printed to
this user's terminal and whether a check runs, so `NOTICE_PROBE` believes it
only when it is a regular file (a symbolic link is not followed) that this
user owns, and it and its directory are writable by nobody else. A cache that
is not believed is treated as missing: no line, and a check in the background
that replaces it. The cache is written to a new file of mode 0600 and renamed
over the old one, in a directory made 0700 (by `chmod` when it is already
there; one `chmod` cannot change is another user's, and then nothing is kept
and no check starts, REL-5), so a link planted at the path is replaced, never
followed. `releaseCacheRead` holds the library's cache to the same rule, its
directory included (REL-4). A check that learns nothing leaves the cache as it
was, so a newer release it already names is still announced. A version in the cache is printed only when it
passes `validVersion` (pinned by review: no test plants one).

A cache dated in the future, which a clock set back or a planted file gives,
counts as stale, so it cannot silence the check for longer than a day.

Tests: `update notice: a cache that is a symlink is not believed`,
`update notice: a group-writable cache is not believed`,
`update notice: a cache in a world-writable directory is not believed`,
`update notice: a world-writable cache directory is made 0700, so the next run believes it`,
`nish upgrade --check: a failed check keeps the newer release the cache names`,
`nish/release: versions, ordering, redirects and bases` (its cache line),
`nish/release: the cache is written 0600 in a 0700 directory, and over a planted link without following it`,
`nish/release: a cache is fresh for less than its age, never at it, and never when dated ahead`,
`nish/release: a cache parses only as its two lines, with a valid or empty version`,
`nish/release: a cache that is a symlink, group-writable, garbage or missing is not believed`,
`nish/release: the cached check asks once, then answers from the cache; a failed one is kept as none`,
`nish/release: a cache file, or its directory, owned by another user is not believed`
(run where the test can make another user's file: as root or with
passwordless `sudo`, as on CI's runners; elsewhere it is a skip that says so),
`update notice: a cache ${what} is refreshed by exactly one check` (stale and
future), `update notice: two runs on a fresh cache make no network check`.

### What runs

`install.sh` is fetched from `<raw>/v<version>/install.sh`, the release's own
tag and never a branch, into a directory under the run cache only this user
can write, and is run as `sh <file> <version> --dir <dir>` with `<dir>` the
install the running compiler came from. An npm install is not touched: the
`npm install -g` line is printed and the command exits 2. A build from a
checkout is refused with exit 2. Neither changes a file.

Tests: `nish upgrade: a curl install runs the tag's install.sh with the latest version and its directory`,
`nish upgrade: an npm install prints the npm line and exits 2`,
`nish upgrade: a build from a checkout refuses, exit 2`.

### The notice's reach

The notice never changes stdout or the exit status, and is off when stderr is
not a terminal, with `--json`, `CI` set, `NISH_NO_UPDATE_CHECK` set, in
`nish run` (whose stderr is the program's) and after a usage error. The check
runs detached with its output discarded and the hangup ignored, so it cannot
hold the terminal or delay the command's exit, and its time is written to the
cache before it starts, so a server that is down is asked at most once a day.

Tests: `update notice: nish --version on a terminal prints the line once, exit unchanged`,
`update notice: a compile on a terminal prints the line once`,
`update notice: not shown when stderr is not a terminal`,
`update notice: not shown with ${what}`.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| REL-1 | Low | `src/upgrade.ts` (`startNoticeCheck`) | The background check, started from a terminal, was killed by the hangup the terminal sent when the command that started it exited, so it never reached the server and the cache never learned of a newer release. | **Fixed** before the module shipped: the shell that detaches it runs `trap "" HUP` first. Before, `update notice: a cache ${what} is refreshed by exactly one check` failed (the server saw no lookup); after, it passes. |
| REL-2 | Low | `install.sh`, `releaseFetchInstaller` | The release is trusted on the strength of TLS to GitHub and the tag's name: no signature is checked, so a compromised release installs what it says. | **Open, accepted.** The same trust as the documented `curl \| sh` install ([`supply-chain.md`](supply-chain.md)), with a pinned tag rather than `main`. |
| REL-3 | Low | `src/upgrade.ts` (`NOTICE_PROBE`, `updateNotice`) | The probe checks the cache's owner and mode, then the compiler reads it: a file swapped between the two is read unchecked. | **Open, accepted.** Swapping it needs write access to its directory, which the probe has already required to be this user's alone. |
| REL-4 | Low | `std/release.ts` (`releaseCacheRead`) | The file's owner and mode were checked but not its directory's, so in a directory another user can write the file could be swapped between the check and the read, and the swapped one believed. | **Fixed** before the module shipped: the directory must be a directory (not a link) this user owns that no one else can write. Before, `nish/release: versions, ordering, redirects and bases` read a cache in a 0775 directory (its last line printed `false true`); after, it is refused (`true true`). |
| REL-5 | Low | `src/upgrade.ts` (`writeNoticeCache`) | A cache directory already there and writable by its group (a umask of 002) was never made private, so the probe refused the cache on every run and every run on a terminal started a network check. | **Fixed** before the module shipped: an existing directory is made 0700 with `chmod`, and when that fails nothing is kept and no check starts. Before, `update notice: a world-writable cache directory is made 0700, so the next run believes it` failed (mode 777); after, it passes. |
| REL-6 | Low | `src/upgrade.ts` (`baseAllowed`), `std/release.ts` (`releaseBaseAllowed`) | A release URL override was accepted when it began `http://localhost:`, so `http://localhost:@host/` — whose host is `host` — passed the loopback rule, and a release could be asked of another host over plain http. | **Fixed** before the module shipped: after the host only `:<digits>` then `/` or the end may follow. Before, `nish upgrade: a loopback release URL that names another host after the colon is refused (exit 2)` ran the check; after, it exits 2. |
