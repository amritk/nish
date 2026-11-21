---
name: WP78 — linking a Nish program for another target, and a recipe for releasing one
overview: nish --link builds only for the machine it runs on. --target stamps the IR's triple and data layout, but scripts/build.sh has no --target passthrough and lets clang fill in the host, so a program's author needs one runner per platform even for Linux on two architectures. Pass the target through to the runtime and the link with a sysroot (S1 for Linux to Linux, S2 for the other macOS architecture on a macOS host), refuse what cannot work with a clear error, and document a four-platform release workflow for a Nish program (S3); a macOS binary is built on a macOS host, by the owner's decision.
priority: 150
labels: [ready]
stages:
  - id: s1-linux-cross
    title: WP78 S1 — nish --link --target for the other Linux architecture, with a sysroot
    goal: On a Linux host, nish --link --target aarch64-unknown-linux-gnu (or x86_64 from aarch64) with a glibc sysroot compiles the runtime and SQLite for that triple, links with lld, and the binary runs under qemu-user with the same output as a native build; a cross link without a sysroot or lld is a usage error naming what is missing.
    verification: node tests/run.js cross_link && node tests/run.js link && node tests/run.js wasi && node tests/run.js performance && node scripts/gen-diagnostic-codes.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s1-build-sh
        content: Add --target and --sysroot to scripts/build.sh, passing --target= and --sysroot= to every clang compile and link, and requiring lld for a foreign Linux triple — see WP78 S1
        status: pending
      - id: s1-compile
        content: Pass a non-host --target from src/compile.ts to build.sh with the sysroot from NISH_SYSROOT, and refuse a foreign triple with no sysroot under a new usage diagnostic — see WP78 S1
        status: pending
      - id: s1-cache
        content: Add the triple and sysroot to the runtime and SQLite object cache key in src/compile.ts so a cross build never links host objects — see WP78 S1
        status: pending
      - id: s1-refusals
        content: Refuse --link with a darwin triple on a Linux host and a Linux triple on a macOS host until S2 and S3 say otherwise, and keep the existing --cpu and --sandbox refusals — see WP78 S1
        status: pending
      - id: s1-tests
        content: Add a tests/run.js cross_link section that builds an aarch64 program against the Debian arm64 cross sysroot, runs it under qemu-aarch64, and compares stdout with a native build, plus a tests/link negative per refusal — see WP78 S1
        status: pending
      - id: s1-docs
        content: Document cross linking in docs/guide/using-nish/cli.md and a new docs/guide/using-nish/cross-compiling.md routed in scalar.config.json, and regenerate docs/reference/diagnostics — see WP78 S1
        status: pending
  - id: s2-macos-arch
    title: WP78 S2 — the other macOS architecture on a macOS host
    goal: On a macOS host, nish --link --target x86_64-apple-darwin or aarch64-apple-darwin builds a Mach-O binary for that architecture against the SDK xcrun reports, with the runtime's CPU-feature kernels compiled for it.
    verification: node tests/run.js cross_link && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s2-sdk
        content: Resolve the SDK with xcrun --show-sdk-path in scripts/build.sh for a darwin triple and pass --target= and -isysroot to every compile and the ld64 link — see WP78 S2
        status: pending
      - id: s2-kernels
        content: Check that runtime-sha256.c, runtime-aes.c, runtime-checksum.c and runtime-chacha20.c pick their kernels from the target, not the host, and fix any host test — see WP78 S2
        status: pending
      - id: s2-tests
        content: Add a cross_link case for the macOS lane that builds x86_64 on arm64 and checks the architecture by lipo -verify_arch's exit status — see WP78 S2
        status: pending
  - id: s3-release-recipe
    title: WP78 S3 — a four-platform release recipe for a Nish program
    goal: Linking for macOS from Linux stays refused with a diagnostic that points to a macOS runner, and docs/guide/using-nish/releasing-binaries.md gives a working GitHub Actions workflow that builds a Nish program for the four prebuilt platforms, checksums and attests the archives, exercised by a CI check on a sample program.
    verification: node docs/check-links.mjs && npm run lint && npm run lint:dead
    todos:
      - id: s3-refusal-wording
        content: Make the darwin-triple-on-Linux refusal from S1 say that macOS binaries are built on a macOS host and name the guide page — see WP78 S3
        status: pending
      - id: s3-guide
        content: Write docs/guide/using-nish/releasing-binaries.md with a Linux job for both Linux targets and a macOS job for both Mach-O targets, sha256 sums and gh attestation, routed in scalar.config.json — see WP78 S3
        status: pending
      - id: s3-check
        content: Add an examples/ program built by the recipe's commands in an existing scoped CI lane, proving each archive runs on its runner by exit status — see WP78 S3
        status: pending
---

# WP78 — linking a Nish program for another target, and a recipe for releasing one

## Context

`nish --link` hands the IR to `bash scripts/build.sh` (src/compile.ts:3023), which runs `$CC` (default `clang`) with "our IR is target-neutral; clang fills the triple in" (build.sh:444):

- **The host decides everything.** `uname -s` chooses ld64 on Darwin or lld/GNU ld on Linux (build.sh:455, 480–490). There is no `-target` and no `--sysroot` on any line.
- **`--target <triple>` only stamps the IR** (src/compile.ts:967–985; [`src/target.ts`](../../src/target.ts):45–52 lists the four native triples and two wasm ones). [The CLI guide](../../docs/guide/using-nish/cli.md) says "`--link` does not need it". Linking a foreign triple is neither refused nor supported. It runs the host toolchain against foreign IR.
- **The runtime is compiled from source** per recipe and cached (`--runtime-objects` / `--runtime-from`, build.sh:145; cache key at compile.ts:3185–3300 holds the recipe and `cc --version`, not a triple).
- **The one cross-link precedent** is the WASI profile: `WASI_SYSROOT` and `wasm-ld` found through `$CC -print-prog-name` (build.sh:1183–1211).
- **Nish's own releases** use a native runner per platform, "nothing cross-compiled" ([`docs/wp12-release.md`](../../docs/wp12-release.md):204), because bootstrap needs stage1 to run. That reason applies to the compiler, not to a user's program.

A generated CLI is shipped as one binary per platform. Today its author needs four runners for four archives. With S1 and S2, two runners (one Linux, one macOS) produce all four.

S2 needs S1's build.sh flags. S3's guide uses whatever S1 and S2 deliver.

## Approach

- **Sysroot-driven, like WASI.** The caller supplies the target's libc headers and libraries (`NISH_SYSROOT`, or `--sysroot` to build.sh); Nish ships none. Debian and Ubuntu package them (`crossbuild-essential-arm64` and `-amd64` install `/usr/aarch64-linux-gnu` and `/usr/x86_64-linux-gnu`).
- **lld is required for a cross link**, where it is optional for a native one, because GNU ld is per-target.
- **Refuse, don't guess.** Every pairing this plan does not support is a usage error (exit 2) with a code from `src/codes.ts`, its `tests/link` negative and its page under `docs/reference/diagnostics/`.
- **This is a `src/` change.** It runs `node tests/run.js wasi` and `node tests/run.js performance` and stays inside the rolling freeze: `src/` uses no construct or builtin the seed lacks.

## WP78 S1 — nish --link --target for the other Linux architecture, with a sysroot

- `scripts/build.sh` gains `--target <triple>` and `--sysroot <dir>`. When given, every `$CC -c` and the link get `--target=<triple>` and `--sysroot=<dir>`, plus `-fuse-ld=lld`, which is required: no `ld.lld` is a usage error. The runtime objects and SQLite are compiled the same way.
- `src/compile.ts` passes a non-host `--target` through, with the sysroot from `NISH_SYSROOT`. A foreign Linux triple without a sysroot is a new usage diagnostic naming `NISH_SYSROOT`.
- The runtime cache key (compile.ts:3185–3300) gains the triple and the sysroot path, so a cross build never picks up host objects.
- **Refused:** a darwin triple on a Linux host (permanently, by the owner's decision in S3) and a Linux triple on a macOS host (for now; it can follow S1 once it is proven on Linux). The existing refusals stay: `--cpu x86-64-v3` with a non-x86-64 target (compile.ts:1281), `--sandbox` with darwin (compile.ts:1405).
- Tests: a `cross_link` section in `tests/run.js`. On an x86_64 Linux runner with `crossbuild-essential-arm64` and `qemu-user`, it builds a program that prints, reads a file and uses SQLite for `aarch64-unknown-linux-gnu`, runs it with `qemu-aarch64 -L /usr/aarch64-linux-gnu`, and compares stdout and exit status with the native build. Skipping when the sysroot or qemu is absent prints a SKIP line, and CI installs both so it never skips there. One `tests/link` negative per new refusal.
- Docs: the `--target` entry in [`docs/guide/using-nish/cli.md`](../../docs/guide/using-nish/cli.md) and a new `docs/guide/using-nish/cross-compiling.md`, routed in `scalar.config.json`.

## WP78 S2 — the other macOS architecture on a macOS host

- For a darwin triple on a Darwin host, `scripts/build.sh` takes the SDK from `xcrun --show-sdk-path` and passes `--target=<triple>` and `-isysroot <sdk>` to every compile and to the ld64 link. One SDK holds both architectures, so no download is needed.
- The CPU-feature runtime files (`runtime-sha256.c`, `runtime-aes.c`, `runtime-checksum.c`, `runtime-chacha20.c`) must choose their kernels by the target's predefined macros, not a host probe. Read each one and fix any that decides by the host.
- Tests: in the macOS lane (`sha256-macos` today, or WP75 S2's `macos-keychain` job), build for `x86_64-apple-darwin` on `macos-latest` (arm64) and check the result with `lipo -verify_arch x86_64` by exit status. Running it needs Rosetta, which the runner may lack, so the test only checks the binary.
- Universal binaries (`lipo -create`) are documented in the guide as one command over the two builds, not a Nish flag.

## WP78 S3 — a four-platform release recipe for a Nish program

### Decided: no Linux-to-macOS linking

Apple's SDK licence permits its use only on Apple-branded hardware, so Nish does not tell users to fetch an SDK onto Linux. The owner has decided that macOS binaries are built on a macOS runner, which with S2 covers both macOS architectures. S1's refusal of a darwin triple on a Linux host stays, and its message points to the guide page below.

The recipe, `docs/guide/using-nish/releasing-binaries.md` (routed in `scalar.config.json`):

- A GitHub Actions workflow: a Linux job building x86_64 and aarch64 (S1) and a macOS job building both Mach-O architectures (S2). Each job archives the binary, writes `sha256` sums, and runs `actions/attest-build-provenance`, the way Nish's own `release.yml` does.
- A note on glibc: a binary linked on `ubuntu-latest` needs that glibc or newer at run time. A musl or static target is out of scope here.
- A CI check builds a small `examples/` program with the recipe's exact commands in an existing scoped lane, and proves each archive runs by exit status.

## Out of scope

- Windows targets (WP79).
- musl or fully static Linux binaries (a new triple in `src/target.ts`, its own plan).
- Shipping sysroots or SDKs with Nish.
- Cross-building the compiler itself. Its release chain stays native per platform.

## Tests

| Stage | Cases | Mirror |
| --- | --- | --- |
| S1 | aarch64 build run under qemu matches native output; SQLite program; each refusal | the `wasi` section of `tests/run.js` (sysroot discovery and SKIP lines) |
| S2 | x86_64 Mach-O built on arm64, checked by `lipo -verify_arch` | the `sha256-macos` job |
| S3 | the recipe's commands on an `examples/` program, each archive run by exit status | `.github/workflows/release.yml`'s staging steps |

## Verification

Per stage, its `verification:` line, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-diagnostic-codes.mjs --check` for a new code, `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and `node tests/run.js performance` for the `src/` change, the goldens regenerated with `node tests/self/goldens.js --update`, a `ci-scope` per-command test for any lane whose commands change, and every CI test shard green on the PR head.
