---
name: GNU build-id on linked ELF binaries
overview: Make every native ELF link through scripts/build.sh carry a deterministic NT_GNU_BUILD_ID note (-Wl,--build-id=sha1), replacing the explicit --build-id=none, so perf, gdb and debuginfod can match a stripped binary to its debug build. wasm/wasi and Mach-O are left alone.
stages:
  - id: build-id
    title: "build(cli): link ELF binaries with a GNU build-id note"
    goal: Every ELF profile (debug, speed, size, napi) links with -Wl,--build-id=sha1, pinned by a test that checks the note exists and is reproducible, and documented.
    verification: node tests/run.js build_id && npm run check && npm run lint && bash scripts/build-id-smoke.sh
    todos:
      - id: build-sh-flag
        content: Replace --build-id=none with --build-id=sha1 in the ELF branch of scripts/build.sh so it reaches all native profiles — see Link flag
      - id: codegen-unchanged
        content: Show the compile step is untouched and a -g and a plain link differ only in debug/symbol sections and the note — see Codegen unchanged
      - id: build-id-test
        content: Add a build_id section to tests/run.js that links a small program twice and asserts one identical NT_GNU_BUILD_ID — see Tests
      - id: mirror-flags
        content: Update the copies of the profile flags in docs/ARCHITECTURE.md and bench/sqlite/run.mjs, bench/postgres/run.mjs — see Link flag
      - id: guide-docs
        content: Document the note and the strip-the-debug-build workflow in docs/guide/using-nish/cli.md and the scripts/build.sh header — see Docs
---

**Owns:** `scripts/build.sh`, `scripts/build-id-smoke.sh` (new), `tests/run.js`, `tests/link/build_id/**` (new), `tests/shard-costs.json`, `docs/ARCHITECTURE.md`, `docs/guide/using-nish/cli.md`, `bench/sqlite/run.mjs`, `bench/postgres/run.mjs`

## Context

`nish app.ts --link app` shells out to [scripts/build.sh](scripts/build.sh). Its non-Darwin branch (line ~297) passes `-Wl,--build-id=none` inside `gc`, which only the `speed`, `size` and `napi` links use; the `debug` link passes neither. So no profile emits `.note.gnu.build-id`, and `perf buildid-cache -a`, gdb's `/usr/lib/debug/.build-id/` lookup and debuginfod have nothing to key on.

`--build-id=none` arrived in the squash of #878 with no recorded rationale. The reproducibility the repo cares about (bootstrap `stage3 == stage2`, [scripts/verify-binaries.sh](scripts/verify-binaries.sh)) is kept by `sha1`: lld, GNU ld and gold all compute it as a hash of the output's own bytes, so identical inputs give an identical note.

## Approach

- **`sha1`, not the default `fast`/`uuid`.** `uuid` is random (breaks reproducibility); `sha1` is what distros ship and what debuginfod indexes.
- **One place.** Move the flag out of `gc` into the ELF-only flags so the `debug` profile gets it too. Keep it on the native ELF links only.
- **wasm/wasi untouched.** wasm-ld 18 accepts `--build-id` and writes a `build_id` custom section, but none of perf/gdb/debuginfod read it, and it would change every wasm module's bytes for no consumer.
- **Matching a stripped binary to its debug build** works by stripping the `-g` build (`objcopy --only-keep-debug` + `strip -g`, both preserve the note), not by linking twice: a `-g` link and a plain link hash different bytes, so their ids differ. The docs say this.

## Link flag

In [scripts/build.sh](scripts/build.sh): drop `-Wl,--build-id=none` from `gc`, add `-Wl,--build-id=sha1` to the flags every native ELF link passes (debug, speed, size, napi). Darwin branch unchanged. Keep `scripts/build.sh` passing shellcheck's existing disables. Update the copies of the flag list: the profile table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (~line 679) and the C-reference builds in [bench/sqlite/run.mjs](bench/sqlite/run.mjs), [bench/postgres/run.mjs](bench/postgres/run.mjs), which mirror nish's flags so the comparison stays like for like.

## Codegen unchanged

The flag is link-only. Demonstrate, and record in the PR body: (a) the `.ll` and the compiled objects for a sample program are byte-identical before and after; (b) a `-g` link and a plain link of the same source, after `strip -g` of both, have identical allocated sections apart from `.note.gnu.build-id` (compare with `llvm-objcopy --dump-section` or `cmp` on `readelf -x`). If (b) does not hold on `main` already, say what differs and that it predates this change.

## Tests

A new section in [tests/run.js](tests/run.js), filterable as `build_id`, gated on `ld.lld`/clang presence the way neighbouring link sections are (and read its skip line): link a small program (new [tests/link/build_id/main.ts](tests/link/build_id/main.ts)) with `--profile speed` twice to two output paths, plus once with `--profile debug`, and assert for each an `NT_GNU_BUILD_ID` note of 20 bytes (parse the ELF notes in JS, or `readelf -n`), and that the two speed links give the same id. Also add `scripts/build-id-smoke.sh`, a few lines a human can run, doing the same with `readelf -n`. Register the section's cost in [tests/shard-costs.json](tests/shard-costs.json) if the runner requires it.

## Docs

[docs/guide/using-nish/cli.md](docs/guide/using-nish/cli.md), under `--profile`: every native binary carries a GNU build-id; the recipe to keep a debug file beside a stripped binary (`nish app.ts --link app -g`, `objcopy --only-keep-debug app app.debug`, `strip -g app`, `objcopy --add-gnu-debuglink=app.debug app`) and that `perf buildid-cache -a app.debug` then resolves symbols for the stripped binary. One line in the `scripts/build.sh` header comment.

## Out of scope

`src/` help text (keeps the change out of the rolling freeze and the goldens), Mach-O `LC_UUID`, wasm/wasi, `build/seed/`.

## Verification

`npm run check`, `npm run lint`, `node tests/run.js build_id`, `node tests/run.js std_sqlite` and `node tests/run.js napi` (existing links through the changed flags; the runner's filter is a program-name substring), `bash scripts/build-id-smoke.sh`. Full suite: CI's four `test` shards on the PR head.
