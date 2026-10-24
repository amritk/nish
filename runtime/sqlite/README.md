# runtime/sqlite/

The [SQLite](https://sqlite.org/) amalgamation, vendored so that a Nish program
that calls SQLite links it with no library installed on the system.

| | |
| --- | --- |
| Version | 3.54.1 (`SQLITE_SOURCE_ID` `2026-10-16 14:45:20 555e07ef…`) |
| From | <https://sqlite.org/2026/sqlite-amalgamation-3540100.zip> |
| SHA3-256 of the archive | `92281c86e2957f9b9305890f9ac04204caa7b677cc868dc326d942689df28e30` |
| SHA3-256 of `sqlite3.c` | `e2b869d3003b33c942b7dd7063604fbc53553e1b66609570df39b9b7b558ee81` |
| SHA3-256 of `sqlite3.h` | `15ef3f5dbc4a7a980f828fa0d1e473cee5a124e7bb77e9bc70fc0bfa3f9a2af8` |
| Taken | `sqlite3.c` and `sqlite3.h`, byte for byte; not `shell.c` or `sqlite3ext.h` |
| Vendored | 2026-10-24 |
| Licence | public domain ([sqlite.org/copyright.html](https://sqlite.org/copyright.html)); `LICENSE.md` is upstream's, from <https://sqlite.org/src/raw/LICENSE.md?ci=version-3.54.1> |

`sqlite3.c` and `sqlite3.h` are never edited. A change SQLite needs is a
compile-time option in `scripts/build.sh`, or code in a file of our own beside
them.

## How it is linked

`scripts/build.sh` compiles every `*.c` here for a link whose IR declares an
`sqlite3_*` or `nishsqlite_*` function, and for no other link. The options are
in `build.sh`, under "SQLite's compile-time options". `NISH_SQLITE_CFLAGS` adds
to them (`docs/guide/using-nish/cli.md`). `nish --link` and `nish run` compile
these units once per recipe into an entry of the runtime cache of their own
(`src/compile.ts`, `cachedRuntime`). `src/run-cache.ts` reads this directory
for the units and the files the cache key fingerprints (`sqliteUnits`,
`sqliteFingerprint`), so a file added here needs no list updated.
`tests/run.js` ("sqlite-link") checks the two hashes above against the files.

## Updating

1. Download the new `sqlite-amalgamation-<NNNNNNN>.zip` from
   <https://sqlite.org/download.html>. Check its SHA3-256 against the one on
   that page.
2. Copy `sqlite3.c` and `sqlite3.h` over the ones here, unchanged. Replace
   `LICENSE.md` with the one tagged for that version, if it differs.
3. Update the table above, the two file hashes included (`openssl dgst
   -sha3-256 sqlite3.c sqlite3.h`), the version in `THIRD_PARTY_NOTICES.md`, and the
   numbers in `tests/link/sqlite_link*/expected.out`.
4. Run `node tests/run.js link`, `node tests/run.js sqlite-link`,
   `WASI_SYSROOT=/usr node tests/run.js wasi` and the third-party-licence
   section.
