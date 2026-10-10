---
name: Cache the compiled C runtime between links
overview: nish run and --link recompile the six runtime C files on every link (about 480 ms of a 520 ms hello build). Compile them once per key into a private cache entry, reuse the objects (or LTO bitcode for speed and size) on later links, and compile the user's .ll modules in parallel, with output identical to today's recipe.
stages:
  - id: runtime-cache
    title: perf(cli) — cache the compiled runtime between links
    goal: nish run and --link reuse a cached, keyed, private runtime object set and compile user modules in parallel, with binaries identical in behaviour (and size, for speed and size) to the uncached recipe
    verification: npm run check && npm run lint && node docs/check-links.mjs && npm test (LLVM 18 on PATH, no DEGRADED line, skip count read and reported)
    todos:
      - id: build-sh-modes
        content: Add opt-in runtime-object modes to scripts/build.sh (compile the six runtime files in parallel to an output dir; link against a given runtime object dir with modules compiled in parallel) reusing each profile's exact flags — see build.sh modes
        status: pending
      - id: cache-key
        content: Add runtimeCacheKey and runtimeCacheRoot to src/run-cache.ts, reusing fileFingerprint and sha256Hex, covering compiler name and version, every runtime file and nish.h, build.sh, CC and its version string, profile, -g and --threads — see Cache key and location
        status: pending
      - id: cache-lifecycle
        content: Add the miss and hit path in src/compile.ts (chmod 700 root, scratch dir inside the entry, one rename, key written last, byte-equal hit, concurrent misses both succeed) and route linkProgram for debug, speed and size through it for both nish run and --link — see Cache lifecycle
        status: pending
      - id: tests
        content: Add the runtime-cache checks to tests/run.js beside the nish run section — see Tests
        status: pending
      - id: docs-security
        content: Record the cache in docs/security/cli.md as a new CLI row and in every doc that describes the nish run cache — see Docs
        status: pending
      - id: measure-ship
        content: Measure before and after on examples/hello.ts and bench/awfy (debug and speed, cold and warm), regenerate goldens if src moved them, and ship one conventional commit with a Measured trailer — see Measurement and commit
        status: pending
---

# Cache the compiled C runtime between links

## Context

[`linkProgram`](../../src/compile.ts) hands every `.ll` plus `runtime/runtime.c` to [`scripts/build.sh`](../../scripts/build.sh), which adds `runtime-os.c`, `runtime-parallel.c`, `runtime-host.c`, `runtime-net.c`, `runtime-simd.c` and compiles everything in one serial clang call on every link. Measured (LLVM 18, 4 cores): `hello.ts` debug link ~520 ms, ~480 ms of it the runtime (`runtime-simd.c` alone 236 ms); against prebuilt runtime objects ~66 ms. `bench/awfy` debug ~1,200 ms → ~200 ms with a prebuilt runtime and parallel module compiles; speed ~1,900 ms → ~830 ms with the runtime prebuilt as `-O3 -flto` bitcode.

One stage, because the task asks for one conventional commit and one PR.

## perf(cli) — cache the compiled runtime between links

**Owns:** `scripts/build.sh`, `src/run-cache.ts`, `src/compile.ts`, `tests/run.js`, `tests/nish/cli.ts`, `tests/self/goldens/**`, `docs/**`, `README.md`, `AGENTS.md`

The stage's detail is the sections below.

## Approach (recommended split — the worker may justify another)

- **Flags stay in `build.sh`.** It is the only place that knows each profile's compile flags, `uname`, ld64 vs lld, `-fno-plt`, gc and strip. The cached objects must be compiled with *exactly* those flags, so `build.sh` gains opt-in modes rather than `src/` duplicating flags. `build.sh` has no rolling-freeze limit.
- **Key, location and lifecycle live in `src/`**, next to the existing run cache: the task says to reuse `fileFingerprint` / `sha256Hex` in `src/run-cache.ts`, and the security properties (CLI-3, CLI-4, CLI-5, CLI-8, CLI-10) are already implemented there and in `buildIntoCache`. `src/` may only use what the seed in `build/seed/` compiles (rolling freeze) — check every builtin used (`spawnSync`, `spawnSyncTo`, `readFileSyncOrNull`, `writeFileSync`, `getenv`, `makeDirectory`, `monotonicNanos`) against the seed, and build `src/` with the seed before pushing.
- **Parallelism without a new builtin.** `src/` has only `spawnSync`; parallel compiles are `&` + `wait` inside `build.sh` (bash 3.2 compatible; check every job's exit status, not just `wait`'s last).

## build.sh modes

Two opt-in flags (names are the worker's choice; suggested):

- `--runtime-objects <dir>`: compile `runtime.c` and its five siblings, one `$CC -c` each in parallel, into `<dir>/<name>.o`, with the profile's compile flags only (debug: `common` incl. `-g`/`--threads` macros; speed: `-O3 -flto -DNDEBUG -ffunction-sections -fdata-sections -fomit-frame-pointer -fno-asynchronous-unwind-tables -fno-unwind-tables` + `elf`; size: the speed set with `-Oz` plus `-fno-stack-protector -fvisibility=hidden`). Refuse `wasm`, `wasi`, `napi` and any `--pgo-*` with exit 2. A failed job fails the mode.
- `--runtime-from <dir>`: the normal link, but instead of expanding `runtime.c` into six sources, link `<dir>/*.o` (the six, named explicitly, in today's order); compile each `.ll` with `$CC -c` in parallel into a scratch dir with the same compile flags, then one link with the same link flags (`-flto`, opt level, `gc`, `strip_flag`, `-fuse-ld=lld`, `-lm`). Same refusals as above.
- Without either flag, `build.sh` behaves byte-for-byte as today. `wasm`, `wasi`, `napi` and PGO builds never take the new path. Keep `${arr[@]+"${arr[@]}"}` spelling for every possibly-empty array, no `mapfile`/`declare -A`/`wait -n`, and Apple ld64 on Darwin.
- Speed/size link: LTO must still see the runtime as bitcode so it inlines runtime functions into user code — compare binary sizes against the uncached recipe and explain any byte difference.

## Cache key and location

- **Root:** `runtimeCacheRoot()` = `runCacheRoot()`'s sibling, `…/nish/runtime` (`$XDG_CACHE_HOME/nish/runtime` or `$HOME/.cache/nish/runtime`; absolute only, empty otherwise — never relative, never `/tmp`).
- **Key text** (one header line per input, like `runCacheKey`): `CLI VERSION`; `runtime-objects`; profile with ` -g` / ` --threads`; `cc <CC>`; `cc-version <first line(s) of $CC --version>` (captured with `spawnSyncTo` to a file in the private root, read back); fingerprints of `scripts/build.sh`, the six runtime `.c` files and `nish.h`; `uname -s`/arch if it changes flags; anything else that changes the objects. Factor the fingerprint lines so `runCacheKey` and the new key share one helper rather than two lists.
- **Entry:** `<root>/<sha256Hex(key)>/` holding the six objects and `key`.

## Cache lifecycle

- **Hit:** `<entry>/key` read and equal to the computed key byte for byte → pass `--runtime-from <entry>` to `build.sh`.
- **Miss:** `makeDirectory(root)`; `chmod 700 root`, refuse (fall back or exit 3, see below) if it fails, reported apart from mkdir failure as CLI-10 does; scratch `<entry>/tmp-<hex>/`; `build.sh --runtime-objects <scratch>/objs`; empty any existing key; move the object directory into place with **one** `rename` (`mv -f --` of a directory, or move each finished object then write key — the worker must make "key present ⇒ all six objects complete and from this key" hold, and concurrent misses both succeed: a loser whose rename fails because the winner's objects are already there re-reads the key and uses the winner's entry if it matches); write `key` last; `rm -rf --` the scratch dir.
- **No root or private root unavailable:** `nish run` keeps its existing refusal (it already needs a root). `--link` falls back to today's uncached recipe rather than failing a link that works today — say so in the docs.
- **Profiles:** debug, speed, size use the cache for both `nish run` (`buildIntoCache` → `linkProgram`) and `--link`. wasm, wasi, napi, and any PGO path keep calling `build.sh` exactly as today.
- The existing `nish run` binary cache stays keyed as it is (it already fingerprints the runtime); a runtime-cache hit or miss must not change that key.

## Tests

In [`tests/run.js`](../../tests/run.js) beside `// ---- nish run` (~line 13121), each with its own `XDG_CACHE_HOME`, skipping only where the existing section skips:

- a miss creates exactly one runtime entry (64 hex digits, six objects + key, nothing else);
- a second link of a *different* program reuses it: a `CC` wrapper on `PATH` (script that logs each `.c` argument then execs clang) logs no runtime `.c` on the second link;
- a changed fingerprint input (a copied package root with an edited `runtime.c`, or `CC` naming a different wrapper), `--threads`, `-g`, and each profile give distinct entries;
- an entry with no key, and one with a mismatched key (plus a planted bogus object), are rebuilt and never linked — the planted object's marker symbol or bytes are absent from the result;
- `--threads` and `-g` binaries link and run with expected stdout;
- for speed (and size) on a set of golden programs, stdout `cmp`-equal to the uncached `build.sh` recipe and binary size equal (or the difference explained);
- the root is mode 700; a relative `XDG_CACHE_HOME` is ignored as CLI-3 does;
- two concurrent `--link`s on a cold cache both exit 0 and run.

`build.sh` direct calls without the flag are already covered by existing tests; add one asserting a wasm or napi or `--pgo-generate` request with the new flag exits 2.

## Docs

- `docs/security/cli.md`: a new row (next free `CLI-n`) describing the runtime cache's threat (cached code linked into user binaries) and each guarantee with its test name; anchors at the commit the record is written against.
- Every place that describes `nish run`'s cache (`docs/LANGUAGE.md`, `README.md`, `docs/INSTALL.md`, `AGENTS.md`, `docs/AI.md` — grep `\.cache/nish` and `nish run`) mentions `…/nish/runtime/`; the `build.sh` header comment documents the new flags.
- `node docs/check-links.mjs` passes.

## Measurement and commit

- Time, before (main) and after, `examples/hello.ts` and `bench/awfy/main.ts` with `--link --profile debug` and `--profile speed`, cold and warm runtime cache, interleaved rounds, with the noise band (baseline vs byte-identical copy of itself) stated.
- `node tests/self/goldens.js --update` if `src/` moved `checked.txt` / `checked-self.txt`; read the diff.
- One commit: `perf(cli): cache the compiled runtime between links`, body for release-notes readers, `Measured:` trailer with the figures, `Refs: docs/security/cli.md`, `Tests:` naming the new checks.

## Out of scope

- Per-module object caching (later work).
- wasm, wasi, napi, PGO builds; `build.sh` calls that do not opt in.
- CLI-7 / CLI-9 (owner checks need `lstat`), and open PR #546, which touches the run cache root and `src/compile.ts` — merge `main` and regenerate goldens if it lands first.

## Verification

```bash
npm run check
npm run lint
node docs/check-links.mjs
npm test            # LLVM 18 on PATH; no DEGRADED line; report the skip count
```
