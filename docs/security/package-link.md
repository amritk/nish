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
rather than skipped. The run cache key holds the link set, each source's
bytes and every file the compile of that source reads, as clang lists them,
so a changed source, or anything it includes, links again. Each property PL-1
to PL-6 names the tests that pin it; a claim with no test beside it is stated
from the code alone. Two findings were fixed before merge (PL-F1 and PL-F2,
Low). Three limits are accepted: PL-7 (the C runs with every power the
program has), PL-8 (`-l` takes whatever the system linker finds) and PL-9 (a
source's `#include`s are not confined).

The link diagnostics (NL3059, NL3060, NL3061) are reported only when the
program is linked, under `nish run` or `--link`. A compile to IR alone does
not read the entries of `nish.link` and refuses none of them.

## Scope

| File | Functions |
| --- | --- |
| `src/manifest.ts` | `manifestNish` (the `link` key), `manifestLink`, `manifestReadLinkObject`, `manifestReadLinkList`, `manifestReadLinkGrants`, `manifestLinkLibrary`, `manifestPrintableAscii`, `manifestLinkSourceProblem` (NL3059, NL3060) |
| `src/compile.ts` | `readLinkSet`, `linkPackages`, `refuseUngranted` (NL3061), `addLinkRequest`, `readLinkIncludes`, `linkProgram` (the `--link-lib` and `--link-source` arguments) |
| `src/run-cache.ts` | `LinkSet`, `makeRulePaths`, `linkSetLines`, `runCacheKey` |
| `scripts/build.sh` | `--link-lib`, `--link-source`, `--link-depends` |

## What the check covers

### PL-1: a library name is never a flag

`manifestLinkLibrary` accepts 1 to 255 characters of
`[A-Za-z0-9_][A-Za-z0-9_.+-]*`: a first character that is not `-`, and no
`,`, `=`, `/`, space or quote, so `-Wl,…`, `-shared` and `-fplugin=…` are all
NL3060. `scripts/build.sh` matches the same pattern again before it writes
`-l<name>`, so a caller other than the compiler cannot pass one either. The
length cap refuses a longer name; it never truncates one into another.

A name in `libraries` reaches the linker: the program that calls a symbol
only a test-built shared library defines links with the entry and does not
link without it.

Tests: `link/pkg_link_flag_library` (expected.err `` `-Wl,-rpath,/tmp` is not a library name ``);
`package-link: a library named in \`libraries\` is passed to the linker, and the program does not link without it`.
The length cap and the refusal of a leading `.` or `+` are stated from the
code; no test provokes them.

### PL-2: a source path stays in its package

`manifestLinkSourceProblem` refuses a source that is empty, holds a
character outside printable ASCII (PL-F1), is absolute, starts with `-`,
holds a backslash, climbs out with `..`, or does not end in `.c` (NL3060). `addLinkRequest` then resolves each one with `realpathSync` and
refuses it (NL3060) unless the real path sits under the package's own real
directory. A symbolic link written inside the package cannot carry a source
out of it. `scripts/build.sh` takes a source only as an absolute path to an
existing `.c` file.

Tests: `link/pkg_link_source_escape` (`..`), `link/pkg_link_source_absolute`,
`link/pkg_link_source_backslash`, `link/pkg_link_source_not_c`,
`link/pkg_link_source_nonascii` (the escape `"c/\u00e9.c"`),
`link/pkg_link_source_nonascii_raw` (a raw UTF-8 `é`),
`link/pkg_link_source_control` (`\u0001`), `link/pkg_link_source_nul`
(`\u0000`);
`package-link: a granted source that is a symbolic link out of its package is refused, and nothing runs`.
The empty path and the leading `-` are stated from the code; no test
provokes them.

### PL-3: a dependency links only what the root grants

A dependency's `nish.link` is read from each package the program loaded a
module of, as `linkPackages` lists them: a module whose file sits under a
package directory names that package, read once per package name. A module
outside any package directory names none, so no manifest is read for it, and
a second copy of a package under the same name is not read again. Both fail
safe: a package that is not read adds nothing to the link, and its C symbols
then do not resolve. Each library and each
source it names that the root's `nish.link.dependencies.<name>` does not
also name is NL3061, written at the entry. A grant of a source but not a
library refuses the library. Only the root may grant: `dependencies` inside a
dependency's `nish.link` is an unknown key (PL-4). A dependency that calls
its C still needs the WP40 `ffi` grant (`capabilities.md`). The two grants
are separate.

Tests: `link/pkg_link_ungranted` (an ungranted source),
`link/pkg_link_dep_library_ungranted` (a source granted, the library it also
asks for not); `link/pkg_link_dep_granted` (the granted link runs). That a
dependency's own `dependencies` key is refused is stated from the code.

### PL-4: the reader fails closed

`manifestReadLinkObject` reads `libraries`, `sources` and, for the root
only, `dependencies`. Any other key is NL3059, as is a value of the wrong
type, a repeated key or a repeated package. A package name under
`dependencies` that is not printable ASCII is NL3060 (PL-F1). There is no
pkg-config, so a
`pkgConfig` key is refused, not ignored. A dependency `nish` field the reader
cannot parse at all is refused when its text mentions `link`. Read as
"nothing linked", it could hide a request. No count or length cap drops a
distinct entry: each refused entry is its own diagnostic.

A known leniency: `manifestReadList` on its own steps over a missing comma
(`["a" "b"]` reads as two entries) and a trailing one (`["a",]` as one). It
is reached only through `manifestNish`, which first checks the whole manifest
with `manifestMalformedAt`, and a manifest that is not JSON and spells
`link` (or holds a `\u` escape) is refused where it breaks (NL3059,
`` `package.json` stops being JSON here ``). Each entry it reads is then
checked on its own, so the leniency adds no entry the text does not spell. A
new caller that reads a list without that check would inherit it.

Tests: `link/pkg_link_unknown_key` (`pkgConfig`), `link/pkg_link_wrong_type`,
`link/pkg_link_repeated_key`, `link/pkg_link_repeated_package`,
`link/pkg_link_dep_unreadable` (a dependency `nish` field that is an array
and mentions `link`), `link/pkg_link_dep_list_not_json` (a dependency's list
missing its comma), `link/pkg_link_dep_key_nonascii` (a granted package name
spelled `"pkg_m\u00fcl"`), `link/pkg_link_dep_source_collision` (the grant
`"c/\u00e9.c"` against the ask `"c/\u00ea.c"`, both refused). That no cap
drops an entry is stated from the code.

### PL-5: SQLite is one entry of the same set

`LinkSet.sqlite` is the standard library's built-in entry. It is set from
the IR exactly as before (`anyCallsSqlite`), and its objects and cache
fingerprint are unchanged, so `nish/sqlite` programs link as they did. A
package cannot ask for it or turn it off through `nish.link`.

It stays a flag, not a `libraries` entry, on purpose. SQLite is compiled from
the amalgamation in `runtime/sqlite/` and cached as objects keyed by those
files, not found by `-lsqlite3` on the system search path, so a `libraries`
entry would change which file is linked (PL-8). It is chosen by what the
program calls, not by a manifest, so no grant reviews it and no package may
remove it.

Tests: the existing `sqlite-link:` checks in `tests/run.js`.

### PL-6: the run cache key holds the link set

`linkSetLines` adds one `link-library` line per library, one
`link-source <length> <path> <fingerprint>` line per source, and one
`link-include <length> <path> <fingerprint>` line per file the compile of a
source reads, to the key `runCacheKey` hashes. `readLinkIncludes` asks
`scripts/build.sh --link-depends` for that list: clang's `-M` make rule for
the source, under the same profile, CPU and flags the link will compile it
with, so headers, `.inc` files, an included `.c` file and system headers are
all in it, wherever they live, by name or not. `makeRulePaths` reads the
rule; a list that cannot be had (the preprocessor fails) or read (no rule, or
a path that is not absolute) sets `includesUnlisted`, and `cachedBinary` then
links again on every run rather than trust a key that misses a file. A
program whose IR is unchanged but whose source, an included file or library
list changed is a miss and links again.

Tests: `package-link: \`nish run\` links the package's own source and library, and a change to the source alone links again`;
`package-link: a change to a header the linked source includes, and nothing else, links again`;
`package-link: a change to a \`.inc\` file, or a \`.c\` file, the linked source includes, and nothing else, links again`.
With `addInclude` disabled, the second and third fail and the first passes.
That a changed library list is a miss, and that an unlisted source links on
every run, are stated from the code.

## Findings fixed

### PL-F1 (Low): non-ASCII escapes collapsed distinct entries

The manifest's string decoder turns every `\uXXXX` escape above 127 into
the one byte 127, so `"c/\u00e9.c"` and `"c/\u00ea.c"` were the same source
and a grant of one matched a request for the other. The collapsed text is
also the path opened, so both spellings named the one file `c/<DEL>.c` and no
grant reached a file it did not name; but the entry the user reviewed was not
the entry checked. `manifestPrintableAscii` now refuses a source path or a
granted package name holding any character outside 32 to 126 (NL3060), and
`manifestLinkLibrary`'s allowlist already refused one in a library name.

Before (`manifestPrintableAscii` made to accept everything):
`link/pkg_link_dep_source_collision`'s ask `"c/\u00ea.c"` matched the grant
`"c/\u00e9.c"`, so no NL3061 was raised, and it failed only because no file
`c/<DEL>.c` exists (`is no file inside the package`); a package shipping that
file would have linked. `link/pkg_link_dep_key_nonascii` linked.
`link/pkg_link_source_nonascii` was refused only as `is no file inside the
package`. After: each entry is refused as written (NL3060, `the path holds a
character that is not printable ASCII`, or for the key `a package name in
\`dependencies\` holds a character that is not printable ASCII`), and each of
the three expected.err files fails against the before build.
`link/pkg_link_source_nonascii_raw` writes the raw character, which the
decoder keeps as it is and which never collided; it pins the refusal, not the
finding.

### PL-F2 (Low): an included file that was not a package `.h` did not key the run cache

The first version keyed only the `.h` files under each source's package
directory, found by walking that tree. An edit to any other file a source
includes, a `.inc`, a `.hpp`, an included `.c`, a header reached by `..` or
a system header, was a run-cache hit, and `nish run` ran the old binary. The
walk was also unbounded in a large package. The key now holds what the
compile reads, as PL-6 says, and the walk is gone.

Before (`addInclude` disabled): the `.inc`/`.c` check and the header check
fail, each run printing the first binary's output. After: both pass.

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
package. Only the source file itself is held to the package. What it reads
does key the run cache (PL-6), so a file it reads outside the package is
still rebuilt on.
