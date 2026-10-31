# WP48: Fast rebuilds for `nish run`

**Status: built.** `nish run` keeps every module's object between links, so a
rebuild compiles only the modules whose IR changed. The goal was a rebuild under
2 s after a one-line edit to an HTTP + SQLite + JSON program on a 4-core
container. It is met: the median rebuild is about 1.45 s, and the slowest of
eleven was 1.88 s. Tracking issue #1114.

## 1. The program and how it was timed

The program is an HTTP/1.1 server with a SQLite store and JSON bodies: 674
lines of its own over `nish/net/http1-server`, `nish:sqlite` and `nish:json`.
It compiles to 42 modules; the TLS, P-256 and P-384 code that the server
imports is most of them. It lived under `build/` and is not committed. Its
`--once` flag answers no request, so a run times the build and the start.

Every figure is the wall clock of `nish run app.ts --once`, read with
`date +%s%N` around the command, on a 4-core cloud container with its own
`XDG_CACHE_HOME`. The edit rewrote one `console.log` line in `app.ts`. The
container is shared and noisy: two runs of the same command differ by up to
0.5 s, so every row gives its range.

## 2. Where a rebuild spent its time, before

| Step | Time |
| --- | ---: |
| Cold run: empty cache, runtime compiled too | 4.85 s |
| Rebuild after a one-line edit | 2.0–2.5 s |
| Cache hit: nothing changed | about 1.0 s |
| — front end: parse, check and emit 42 modules | about 0.8 s |
| — hash and compare the run cache's 10 MB key | about 65 ms |
| — fingerprint `sqlite3.c` for the key | about 70 ms |
| `scripts/build.sh`, debug profile, on a miss | 759 ms |
| — `clang -c` of 42 modules, four at a time | 587 ms |
| — the link, with lld | 55 ms |
| — preamble before the first compile | about 0.1 s |

The four slowest modules were P-256 and P-384 (133 ms each), the HTTP/1.1
server (79 ms) and the program itself (59 ms). An edit to the program changes
the IR of that one module, yet a miss compiled all 42.

`strace -f` of a miss found two smaller costs. `build.sh` ran one `grep` per
module to ask whether the program calls SQLite: 42 processes, about a third of
a second under `strace` and a few tens of milliseconds without it. And
`clang --version` runs twice per miss, once to check that a toolchain is there
and once for the runtime cache's key.

## 3. What changed

**A module cache.** In the debug profile, the link keeps each module's object
in `$XDG_CACHE_HOME/nish/module/<sha256 of the key>/` beside its key
(`src/build-cache.ts`, `stageModules` and `keepModules` in `src/compile.ts`).
The key is the runtime entry's key — the compiler's version, the profile and
its flags, `CC` and what `$CC --version` printed, `scripts/build.sh` and the
runtime's files — then the module's stem and the SHA-256 of its IR. Before a link, every
module whose entry holds an equal key has its object copied beside its `.ll`;
`scripts/build.sh --module-objects <dir>` links an object it finds there and
compiles the rest. After a successful link, the new objects move into their
entries. An entry is trusted on the run and runtime caches' terms: the root is
`0700` and refused when another user owns it, a hit needs the stored key equal
byte for byte, and the key is written last (docs/security/cli.md, CLI-12).

**One grep.** `build.sh` asks every `.ll` about SQLite with a single `grep`.

**Speed and size are untouched.** Those recipes compile a module to LTO
bitcode, and most of their time is the whole-program link after it, so a
cached module would save little. Their binaries stay exactly what `build.sh`
links without a cache, and the release build, which uses the speed recipe, is
byte for byte what it was. `--link` builds no module cache either.

## 4. The result

| Program | Cold | Rebuild after a one-line edit | Hit |
| --- | ---: | ---: | ---: |
| 674-line HTTP + SQLite + JSON, 42 modules | 5.27 s | 1.01–1.88 s, median 1.45 s (n = 11) | 1.04–1.37 s |
| 5,030 lines: the same plus seven generated modules of 620 lines | 5.23 s | 1.07–1.60 s (edit to `app.ts`, n = 5) | 1.04–1.09 s |
| the same, edit to one generated module | | 1.07–1.52 s (n = 3) | |

A rebuild is now a hit plus the edited module's compile and the link: about
0.15–0.3 s over a hit. The 5,000-line program takes no longer than the small
one, because its extra lines are in modules an edit elsewhere does not touch.

## 5. What is left

Most of a rebuild is now the front end, which runs on every `nish run`, hit or
miss: about 0.8 s of the program's 1.0–1.4 s. Caching it means keeping each
module's checked form between runs, which is a change to the checker's
inputs and outputs rather than to the run driver; it is not done here.

Two smaller costs stay: the second `clang --version` (about 30 ms; the first
one is what reports a missing toolchain, and the second is in the key), and
the `sqlite3.c` fingerprint (about 70 ms, read only by programs that link
SQLite). Neither is near the gap a front-end cache would close.

The module cache grows by one entry each time a module's IR changes: the
object and a key of a few hundred bytes, so tens of kilobytes for the
program's own module. Nothing prunes it, the same as the run cache.
Deleting `nish/module` costs one full compile of every module.
