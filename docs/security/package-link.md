# Security record: a package's C link

The record of `nish.link` (WP66 S7,
[wp66-c-headers.md](https://github.com/amritk/nish/blob/main/docs/roadmap/wp66-c-headers.md)):
a `package.json` names C `libraries`, each passed to the linker as `-l<name>`,
and C `sources`, each compiled with clang beside the runtime, for `nish run`
and `--link`. A dependency's link takes effect only once the root package's
`nish.link.dependencies` grants it that library or source, as WP40 grants a
capability.

It says what the check covers, what it cannot reach, and the test that pins
each property. It is written with the code rather than after an audit.

Anchors are function names in the files below at the squash merge of the pull
request that adds `nish.link` (part of #1793).

**Result.** What a `package.json` puts on the clang command line is a name
from an allowlist of characters, or the real path of a `.c` file inside that
package. Nothing it writes becomes a flag. A dependency adds nothing the root
does not name, entry by entry, and a key the reader does not know is refused
rather than skipped. The run cache key holds the link set and each source's
bytes, so a changed source links again. Six properties are pinned by tests
(PL-1 to PL-6). Three limits are inherent to linking C and are accepted:
PL-7 (the C runs with every power the program has), PL-8 (`-l` takes whatever
the system linker finds) and PL-9 (a source's `#include`s are not confined).

## Scope

| File | Functions |
| --- | --- |
| `src/manifest.ts` | `manifestNish` (the `link` key), `manifestLink`, `manifestReadLinkObject`, `manifestReadLinkList`, `manifestReadLinkGrants`, `manifestLinkLibrary`, `manifestLinkSourceProblem` (NL3059, NL3060) |
| `src/compile.ts` | `readLinkSet`, `linkPackages`, `refuseUngranted` (NL3061), `addLinkRequest`, `linkProgram` (the `--link-lib` and `--link-source` arguments) |
| `src/run-cache.ts` | `LinkSet`, `linkSetLines`, `runCacheKey` |
| `scripts/build.sh` | `--link-lib`, `--link-source` |

## What the check covers

### PL-1: a library name is never a flag

`manifestLinkLibrary` accepts 1 to 255 characters of
`[A-Za-z0-9_][A-Za-z0-9_.+-]*`: a first character that is not `-`, and no
`,`, `=`, `/`, space or quote, so `-Wl,…`, `-shared` and `-fplugin=…` are all
NL3060. `scripts/build.sh` matches the same pattern again before it writes
`-l<name>`, so a caller other than the compiler cannot pass one either. The
length cap refuses a longer name; it never truncates one into another.

Tests: `link/pkg_link_flag_library` (expected.err `` `-Wl,-rpath,/tmp` is not a library name ``).

### PL-2: a source path stays in its package

`manifestLinkSourceProblem` refuses a source that is empty, absolute, starts
with `-`, holds a backslash, climbs out with `..`, or does not end in `.c`
(NL3060). `addLinkRequest` then resolves each one with `realpathSync` and
refuses it (NL3060) unless the real path sits under the package's own real
directory. A symbolic link written inside the package cannot carry a source
out of it. `scripts/build.sh` takes a source only as an absolute path to an
existing `.c` file.

Tests: `link/pkg_link_source_escape`;
`package-link: a granted source that is a symbolic link out of its package is refused, and nothing runs`.

### PL-3: a dependency links only what the root grants

A dependency's `nish.link` is read from each package the program loaded a
module of. That covers packages found by the resolver (`packageCopies`) and
packages reached by a relative path (`linkPackages`). Each library and each
source it names that the root's `nish.link.dependencies.<name>` does not
also name is NL3061, written at the entry. A grant of a source but not a
library refuses the library. Only the root may grant: `dependencies` inside a
dependency's `nish.link` is an unknown key (PL-4). A dependency that calls
its C still needs the WP40 `ffi` grant (`capabilities.md`). The two grants
are separate.

Tests: `link/pkg_link_ungranted`; `link/pkg_link_dep_granted` (the granted link runs).

### PL-4: the reader fails closed

`manifestReadLinkObject` reads `libraries`, `sources` and, for the root
only, `dependencies`. Any other key is NL3059, as is a value of the wrong
type, a repeated key or a repeated package. There is no pkg-config, so a
`pkgConfig` key is refused, not ignored. A dependency `nish` field the reader
cannot parse at all is refused when its text mentions `link`. Read as
"nothing linked", it could hide a request. No count or length cap drops a
distinct entry: each refused entry is its own diagnostic.

Tests: `link/pkg_link_unknown_key`.

### PL-5: SQLite is one entry of the same set

`LinkSet.sqlite` is the standard library's built-in entry. It is set from
the IR exactly as before (`anyCallsSqlite`), and its objects and cache
fingerprint are unchanged, so `nish/sqlite` programs link as they did. A
package cannot ask for it or turn it off through `nish.link`.

Tests: the existing `sqlite-link:` checks in `tests/run.js`.

### PL-6: the run cache key holds the link set

`linkSetLines` adds one `link-library` line per library and one
`link-source <length> <path> <fingerprint>` line per source to the key
`runCacheKey` hashes. A program whose IR is unchanged but whose source or
library list changed is a miss and links again.

Tests: `package-link: \`nish run\` links the package's own source and library, and a change to the source alone links again`.

## Accepted limits

### PL-7: the C runs with every power the program has

A granted library or source is native code in the same process. Nothing
confines it at run time. WP40 accepts the same of the C behind a granted
`ffi` (CAPS-6). The grant is the review point: the root names each library
and each file by hand.

### PL-8: `-l` takes what the system linker finds

A library name is resolved by the system linker's search path, not by Nish.
The name is checked; the file it finds is not.

### PL-9: a source's includes are not confined

A granted source is compiled with clang's default include paths. Its
`#include` may read any header the compiler can open, inside or outside the
package. Only the source file itself is held to the package.
