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
from an allowlist of characters, or the real path of an entry ending in `.c`
inside that package (`scripts/build.sh` refuses one that is not a file). Nothing it writes becomes a flag. A dependency adds nothing the root
does not name, entry by entry, and a key the reader does not know is refused
rather than skipped. The run cache key holds the link set, each source's
bytes and every file `clang -M` lists for the compile of that source, so a
changed source, or anything it `#include`s, links again. Each property PL-1
to PL-6 names the tests that pin it; a claim with no test beside it is stated
from the code alone. Two findings were fixed before merge (PL-F1 and PL-F2,
Low). Four limits are accepted: PL-7 (the C runs with every power the
program has), PL-8 (`-l` takes whatever the system linker finds), PL-9 (a
source's `#include`s are not confined) and PL-10 (a file `clang -M` does not
list is not in the run cache key).

`readLinkSet` runs on every compile that emits IR, so the link diagnostics
(NL3059, NL3060, NL3061) are reported by a compile to IR and by `--json` as
well as under `nish run` and `--link`. `--fix`, `--emit-ast`, `--emit-ts` and
`--emit-checked` stop before it and link nothing.

NL3063 is reported after a failed link. `linkProgram` copies the link's stderr,
through `tee`, to `<output>.link-errors` beside the output and removes the
file once it is read. `undefinedSymbols` takes from it only the names lld
(`undefined symbol: `) or GNU ld (``undefined reference to ` ``) reports
that are also the C name of a `declare function` in the program
(`Compilation.foreignNames`), so the report names only declarations the
program already has: a library's own undefined symbols stay a failed link
(exit 3).

## Scope

| File | Functions |
| --- | --- |
| `src/manifest.ts` | `manifestNish` (the `link` key), `manifestLink`, `manifestReadLinkObject`, `manifestReadLinkList`, `manifestReadLinkGrants`, `manifestLinkLibrary`, `manifestPrintableAscii`, `manifestLinkSourceProblem` (NL3059, NL3060) |
| `src/compile.ts` | `readLinkSet`, `linkPackages`, `refuseUngranted` (NL3061), `addLinkRequest`, `readLinkIncludes`, `linkProgram` (the `--link-lib` and `--link-source` arguments, the copy of the link's stderr), `undefinedSymbols`, `reportMissingLink` (NL3063) |
| `src/compilation.ts` | `foreignNames`, `reportMissingForeign` (NL3063) |
| `src/run-cache.ts` | `LinkSet`, `makeRulePaths`, `linkSetLines`, `runCacheKey` |
| `scripts/build.sh` | `--link-lib`, `--link-source`, `--link-depends` |

## What the check covers

### PL-1: a library name is never a flag

`manifestLinkLibrary` accepts 1 to 255 characters of
`[A-Za-z0-9_][A-Za-z0-9_.+-]*`: a first character that is not `-`, and no
`,`, `=`, `/`, space or quote, so `-Wl,…`, `-shared` and `-fplugin=…` are all
NL3060. `scripts/build.sh` checks the name again (without the length cap)
and refuses one starting with `-` before it writes `-l<name>`, so a caller
other than the compiler cannot pass a flag either; its bracket ranges follow
the shell's locale, so its set is not claimed to equal the compiler's, only
that it is never a flag. The
length cap refuses a longer name; it never truncates one into another.

A name in `libraries` reaches the linker: the program that calls a symbol
only a test-built shared library defines links with the entry and does not
link without it.

Tests: `link/pkg_link_flag_library` (expected.err `` `-Wl,-rpath,/tmp` is not a library name ``);
`package-link: a library named in \`libraries\` is passed to the linker, and without it the link fails on the unresolved symbol`.
The length cap and the refusal of a leading `.` or `+` are stated from the
code; no test provokes them.

### PL-2: a source path stays in its package

`manifestLinkSourceProblem` refuses a source that is empty, holds a
character outside printable ASCII (PL-F1), is absolute, starts with `-`,
holds a backslash, climbs out with `..`, or does not end in `.c` (NL3060). `addLinkRequest` then resolves each granted
entry (every one of the root's) with `realpathSync` and
refuses it (NL3060) unless the real path sits under the package's own real
directory. A symbolic link written inside the package cannot carry a source
out of it. `scripts/build.sh` takes a source only as an absolute path to an
existing `.c` file; an entry that ends in `.c` but resolves to a directory
passes NL3060 and is refused there (exit 2).

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
safe: a package that is not read adds nothing to the link. Its C symbols
resolve only against what the link already holds, such as the source granted
to the first copy of that name, and nothing beyond the root's grants is
linked for it. Each library and each
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
cannot parse at all is refused when its `package.json` mentions `link`
anywhere. Read as "nothing linked", it could hide a request. No count or
length cap drops a distinct entry: each refused entry is its own diagnostic,
except that a value that is not an object, a repeated key or a repeated
package refuses its whole object with one diagnostic and links nothing from
it.

A known leniency: `manifestReadList` on its own steps over a missing comma
(`["a" "b"]` reads as two entries) and a trailing one (`["a",]` as one). It
is reached only through `manifestNish`, which first checks the whole manifest
with `manifestMalformedAt`: a manifest that is not JSON is refused where it
breaks when it spells `nish` or holds a `\u` escape, the root's as NL3036 and
a dependency's as NL3059 (`` `package.json` stops being JSON here ``), the
latter only when its text also spells `link`. Each entry it reads is then
checked on its own, so the leniency adds no entry the text does not spell. A
new caller that reads a list without that check would inherit it.

Tests: `link/pkg_link_unknown_key` (`pkgConfig`), `link/pkg_link_wrong_type`,
`link/pkg_link_repeated_key`, `link/pkg_link_repeated_package`,
`link/pkg_link_dep_unreadable` (a dependency `nish` field that is an array
and mentions `link`), `link/pkg_link_dep_list_not_json` (a dependency's list
missing its comma), `link/pkg_link_dep_key_nonascii` (a granted package name
spelled `"pkg_m\u00fcl"`), `link/pkg_link_dep_source_collision` (the grant
`"c/\u00e9.c"` against the ask `"c/\u00ea.c"`; its expected.json pins both
refusals, the grant's in the root `package.json` and the ask's in the
dependency's). That no cap
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
`link-include <length> <path> <fingerprint>` line per file `clang -M` lists
for the compile of a source, to the key `runCacheKey` hashes. `readLinkIncludes` asks
`scripts/build.sh --link-depends` for that list: clang's `-M` make rule for
the source, under the same profile, CPU and flags the link will compile it
with, so headers, `.inc` files, an included `.c` file and system headers are
all in it, wherever they live, by name or not. What clang does not list is
not keyed (PL-10). `makeRulePaths` reads the rule, undoing clang's escapes
(`\#`, `$$`, a backslash run before a blank). A list that cannot be had (the
preprocessor fails) or read (no rule, or a path that is not absolute), or
that names a file that cannot be read, sets `includesUnlisted`, and
`cachedBinary` then links again on every run rather than trust a key that
misses a file. Clang lists a backslash in a directory name as `/`, so a
package under such a directory links on every run. A
program whose IR is unchanged but whose source, an included file or library
list changed is a miss and links again.

Tests: `package-link: \`nish run\` links the package's own source and library, and a change to the source alone links again`;
`package-link: a change to a header the linked source includes, and nothing else, links again`;
`package-link: a change to a \`.inc\` file, or a \`.c\` file, the linked source includes, and nothing else, links again`.
`package-link: under a directory named with \`#\`, \`$\` and a blank, an unchanged run is a hit and a change to the included header alone links again`
pins the escapes;
`package-link: under a directory named with a backslash, which clang lists as \`/\`, every run links afresh, so a change to the included header takes effect`
pins the unreadable name.
With `addInclude` disabled, the second, third and fourth fail and the first
and fifth pass.
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

Before (the first version): the `.inc`/`.c` check fails, each run printing
the first binary's output. With `addInclude` disabled, the header check fails
as well. After: both pass.

## Accepted limits

### PL-7: the C runs with every power the program has

A granted library or source is native code in the same process. Nothing
confines it at run time. WP40 accepts the same of the C behind a granted
`ffi` (CAPS-6). The grant is the review point: the root names each library
and each file by hand.

### PL-8: `-l` takes what the system linker finds

A library name is resolved by the system linker's search path, not by Nish.
The name is checked; the file it finds is not. The run cache key (PL-6) holds
the name, not that file: a rebuilt `lib<name>.a` or a changed `LIBRARY_PATH`
reuses the binary already cached until the cache is cleared or a keyed input
changes.

### PL-9: a source's includes are not confined

A granted source is compiled with clang's default include paths. Its
`#include` may read any header the compiler can open, inside or outside the
package. Only the source file itself is held to the package. What it reads
does key the run cache when `clang -M` lists it (PL-6), so a header it
includes from outside the package is still rebuilt on.

### PL-10: a file `clang -M` does not list is not keyed

The key holds the files `clang -M` lists, which are the files the
preprocessor opened. Two kinds of change it does not see:

- a file the compile reads after preprocessing, such as one an inline
  assembler `.incbin` directive pulls in;
- a header created later in a directory searched ahead of the one a listed
  header was found in, which the next compile would read instead.

A name clang cannot spell back (a backslash in a directory, which it lists
as `/`, or a name ending in a backslash, which `makeRulePaths` reads together
with the path after it) is not this limit: the name read cannot be opened,
so the run links afresh every time (PL-6). After either change above
`nish run` takes the cached
binary until the source, a listed file or the IR changes, or the cache is
cleared. A granted source is the root's own review point (PL-7), and a source
that reads such a file is visible in it. Stated from the code.
