---
name: WP79 — Windows as a target for Nish programs, cross-linked from Linux
overview: Nish has no Windows support at all. There is no Windows triple in src/target.ts and no _WIN32 code in runtime/, and the guide sends Windows users to WSL. So a Nish CLI cannot ship a Windows binary. Settle the ABI and scope in a design note (S1), then port the runtime in layers a program can use as each lands, cross-linked from Linux and run under Wine and on a real Windows runner. The layers are the core with console, clock and entropy (S2), files, environment and processes (S3), then sockets, the async executor and fetch with Windows' root store (S4). Running the compiler itself on Windows stays out of scope.
priority: 160
labels: [ready]
stages:
  - id: s1-design
    title: WP79 S1 — the design note, the mingw-w64 target and what Windows refuses
    goal: docs/wp79-windows-target.md records the owner's decisions (mingw-w64 cross-linked from Linux, x86_64 only, programs not the compiler), which builtins and std modules Windows supports or refuses at compile time, how each runtime file is ported, and how CI tests it, so S2 to S4 build to a written contract.
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: s1-decisions
        content: Write the owner's decisions into docs/wp79-windows-target.md (x86_64-w64-windows-gnu through the mingw-w64 sysroot, x86_64 only, the compiler stays on Linux and macOS) — see WP79 S1
        status: pending
      - id: s1-inventory
        content: List every runtime/*.c file and every builtin in runtime/nish.d.ts as ported, ported with different semantics, or refused on Windows, with the refusal diagnostic for each — see WP79 S1
        status: pending
      - id: s1-semantics
        content: Specify paths (UTF-8 to UTF-16, separators, drive letters), file modes against ACLs, argv quoting for CreateProcessW, console UTF-8 and exit codes in the note — see WP79 S1
        status: pending
      - id: s1-ci
        content: Specify the test lanes, Wine on the ubuntu shards for every Windows case and a scoped windows-latest job for what Wine cannot prove — see WP79 S1
        status: pending
  - id: s2-core
    title: WP79 S2 — the triple, a cross link through WP78's sysroot path, and the core runtime
    goal: nish --link --target x86_64-w64-windows-gnu on Linux produces a .exe whose arena, strings, console output, process.exit, clock and entropy work, and every positive tests/cases program that uses only those runs under Wine with the same stdout as on Linux.
    verification: node tests/run.js windows && node tests/run.js link && node tests/run.js wasi && node tests/run.js performance && node tests/run.js c-symbols && node scripts/security-scope.mjs && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s2-triple
        content: Add x86_64-w64-windows-gnu and its data layout to src/target.ts and its link recipe against the mingw-w64 sysroot to scripts/build.sh, reusing WP78 S1's --target and --sysroot path — see WP79 S2
        status: pending
      - id: s2-arena
        content: Port runtime.c's fixed arena reservation from mmap to VirtualAlloc reserve and commit, behind _WIN32 — see WP79 S2
        status: pending
      - id: s2-host
        content: Port runtime-host.c's wall clock, monotonic clock and entropy to GetSystemTimePreciseAsFileTime, QueryPerformanceCounter and BCryptGenRandom, and set the console to UTF-8 — see WP79 S2
        status: pending
      - id: s2-refusals
        content: Refuse on the Windows triple, at compile time and with a diagnostic, every builtin S1 lists as refused, each with a tests/link negative — see WP79 S2
        status: pending
      - id: s2-tests
        content: Add a tests/run.js windows section that cross-links the eligible tests/cases programs and runs them under wine64, comparing stdout and exit status with the Linux build — see WP79 S2
        status: pending
      - id: s2-records
        content: Update the docs/security records whose scope names each ported runtime file, and docs/guide/getting-started/installation.md and cross-compiling.md for Windows targets — see WP79 S2
        status: pending
  - id: s3-os
    title: WP79 S3 — files, environment, terminal and processes on Windows
    goal: The file, directory, environment, terminal and spawn builtins work on the Windows triple with the semantics S1 wrote down, including spawnPiped with argv quoted for CreateProcessW, and their tests/link programs pass under Wine and on the windows-latest job.
    verification: node tests/run.js windows && node tests/run.js c-symbols && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s3-files
        content: Port runtime-os.c's file and directory builtins to the wide Win32 API with UTF-8 paths, mapping the mode arguments as S1 specifies and refusing a reparse point where the POSIX build refuses a symlink — see WP79 S3
        status: pending
      - id: s3-spawn
        content: Port spawnSync, spawnPiped and spawnPipedWithin to CreateProcessW with pipes, quoting argv by the MSVCRT rules and never through cmd.exe — see WP79 S3
        status: pending
      - id: s3-term
        content: Port runtime-term.c's terminal detection and raw mode to the console API, and getenv to GetEnvironmentVariableW — see WP79 S3
        status: pending
      - id: s3-ci-job
        content: Add a scoped windows-latest job to .github/workflows/ci.yml with its scripts/ci-scope.mjs lane and per-command test, running the windows section's built .exe files natively — see WP79 S3
        status: pending
      - id: s3-tests
        content: Run the std_ file, spawn and credential-builtin tests/link programs on the triple under Wine and natively, adding an argv quoting case with spaces, quotes and trailing backslashes — see WP79 S3
        status: pending
  - id: s4-net
    title: WP79 S4 — sockets, the async executor and fetch with Windows' root store
    goal: nish:net and the async executor run on Winsock, so fetchSync and fetch reach an https server from a Windows binary that trusts the roots in Windows' certificate store, proven against a local server under Wine and on the windows-latest job.
    verification: node tests/run.js windows && node tests/run.js net_http_fetch && node tests/run.js c-symbols && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s4-sockets
        content: Port runtime-net.c's sockets to Winsock with WSAPoll or IOCP as S1 chooses, translating errors to the Linux numbers the std code already expects — see WP79 S4
        status: pending
      - id: s4-async
        content: Port runtime-async.c's readiness wait to the same mechanism so the async fetch works — see WP79 S4
        status: pending
      - id: s4-roots
        content: Read the ROOT store through CertOpenSystemStoreW in a Windows-only runtime function and merge it in pkiLoadSystemRoots when SSL_CERT_FILE and SSL_CERT_DIR are unset — see WP79 S4
        status: pending
      - id: s4-tests
        content: Run the net_http_fetch and net_http_fetch_tls programs on the triple under Wine and natively against a local server — see WP79 S4
        status: pending
      - id: s4-records
        content: Update docs/security/runtime-net, fetch and crypto-pki records for the Windows paths, with before/after tests for every finding — see WP79 S4
        status: pending
---

# WP79 — Windows as a target for Nish programs, cross-linked from Linux

## Context

Windows is absent end to end:

- [`src/target.ts`](../../src/target.ts):45–52 lists four native triples and two wasm ones. None is Windows.
- `runtime/` is about 14,000 lines of C. There is no `_WIN32` code in it. Only the vendored SQLite has any.
- The runtime leans on POSIX throughout: `mmap` for the arena (runtime.c:251–272), `fork`/`posix_spawn` and pthreads (runtime-os.c), epoll, kqueue and io_uring (runtime-net.c, runtime-async.c, runtime-uring.c), Landlock and seccomp (runtime-sandbox.c), and `mmap`-backed shared memory (runtime-shm.c).
- [`docs/INSTALL.md`](../../docs/INSTALL.md):104–109, [`installation.md`](../../docs/guide/getting-started/installation.md):12–18 and [`docs/FAQ.md`](../../docs/FAQ.md):261 send Windows users to WSL. [`docs/wp12-release.md`](../../docs/wp12-release.md):329 left native support out, and `install.sh` dies on any OS but Linux and Darwin.

A CLI written in Nish therefore cannot ship a Windows binary, which most API CLIs are expected to. This plan makes Windows a **target**: a program cross-linked on Linux runs on Windows. The compiler itself keeps running on Linux and macOS, so its bash `build.sh` and its bootstrap chain are untouched.

S1 decides. S2 needs WP78 S1's `--target`/`--sysroot` path through `scripts/build.sh`. S3 needs S2, and S4 needs S3.

## Approach

- **Layered, each layer usable.** S2 is enough for a program that computes and prints. S3 adds files and processes. S4 adds the network. Each refuses what is not yet ported at compile time, as a `wasm32` build refuses `readFileSync`, never at run time.
- **Tested under Wine on every shard, and natively in one scoped job.** Wine runs on the ubuntu shards CI already has. A `windows-latest` job proves what Wine might hide (console code pages, CreateProcess quoting, Winsock edge cases).
- **Refused on Windows:** `--sandbox` (Landlock and seccomp), io_uring, `nish:sync` shared memory, the HTTP/3 and prefork servers, and anything else S1's inventory lists. Each is a diagnostic from `src/codes.ts` with its `tests/link` negative.
- **Every ported runtime file keeps its record current.** `node scripts/security-scope.mjs` covers `runtime/*.c`, and `node tests/run.js c-symbols` fails on each new C call until [`src/c-symbols.ts`](../../src/c-symbols.ts) reserves it.

## WP79 S1 — the design note, the mingw-w64 target and what Windows refuses

### Decided

The owner settled all three questions:

1. **ABI and toolchain: mingw-w64, cross-linked from Linux.** The triple is `x86_64-w64-windows-gnu`. Debian and Ubuntu package the sysroot (`mingw-w64`), so CI installs it, WP78 S1's sysroot path reuses it, and Wine runs the result. winpthreads covers the pthread code, and clang and lld support the target. The MSVC ABI was rejected because its SDK and CRT cannot be fetched onto Linux CI.
2. **Scope: Windows is a target only.** The compiler keeps running on Linux and macOS, and WSL stays the way to develop on Windows. A native Windows compiler is not planned here.
3. **x86_64 only in this pass.** aarch64 Windows follows once S4 lands.

The note, `docs/wp79-windows-target.md`, records those decisions and:

- **Inventory.** Every `runtime/*.c` file and every builtin in [`runtime/nish.d.ts`](../../runtime/nish.d.ts) marked ported, ported with different semantics, or refused, with the stage that ports it.
- **Semantics.**
  - Paths: UTF-8 at the Nish surface, UTF-16 to the API, with both separators accepted and drive letters and UNC paths taken as absolute.
  - `mode` arguments: `0o600` and `0o700` mapped to an owner-only DACL, or documented as ignored. S1 picks one.
  - `writeFileSyncMode`'s symlink refusal mapped to reparse points.
  - argv quoting for `CreateProcessW` by the MSVCRT parsing rules, never through `cmd.exe`.
  - The console code page set to UTF-8 at start.
  - Exit codes beyond 255 and how `128 + n` signal statuses read.
- **CI.** Wine on the shards for the `windows` section; a `windows-latest` job, scoped through `scripts/ci-scope.mjs` with its per-command test, for native runs.

## WP79 S2 — the triple, a cross link through WP78's sysroot path, and the core runtime

- `src/target.ts` gains `x86_64-w64-windows-gnu` and its data layout. `scripts/build.sh` links it with lld against the mingw sysroot through WP78 S1's `--target`/`--sysroot` path, and emits `.exe`.
- `runtime.c` reserves its fixed arena range with `VirtualAlloc(MEM_RESERVE)` and commits as it grows, where Linux uses `mmap` with `MAP_NORESERVE`.
- `runtime-host.c`: the wall clock from `GetSystemTimePreciseAsFileTime`, the monotonic clock from `QueryPerformanceCounter`, entropy from `BCryptGenRandom`, and the console output code page set to UTF-8.
- The text, bytes, SIMD and CPU-feature runtime files need no OS calls and compile as they are. Each is checked under Wine.
- Every builtin S1 lists as not yet ported is a compile-time diagnostic on this triple, each with a `tests/link` negative.
- Tests: a `windows` section in `tests/run.js` cross-links every positive `tests/cases` program that uses only S2's builtins, runs it under `wine64`, and compares stdout and exit status with the Linux build. It SKIPs without the sysroot or Wine, and CI installs both.

## WP79 S3 — files, environment, terminal and processes on Windows

- `runtime-os.c`'s file and directory builtins on the wide API (`CreateFileW`, `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING` for `renameSync`, `CreateDirectoryW`), with the mode mapping S1 chose. `createFileExclusiveSync` uses `CREATE_NEW`.
- `spawnSync`, `spawnPiped` and `spawnPipedWithin` on `CreateProcessW` with anonymous pipes, with argv quoted by the MSVCRT rules. The quoting needs a test with spaces, embedded quotes and trailing backslashes, because a mistake there is argument injection.
- `runtime-term.c`: `isTerminal` through `GetConsoleMode`, raw mode through `SetConsoleMode`. `getenv` through `GetEnvironmentVariableW`.
- CI: a scoped `windows-latest` job runs the `.exe` files the `windows` section built (uploaded as an artifact from the Linux shard, or built in-job under WSL if that proves simpler) and checks each by exit status.

## WP79 S4 — sockets, the async executor and fetch with Windows' root store

- `runtime-net.c` on Winsock, with readiness through `WSAPoll` or completion through IOCP, as S1 decides. Winsock errors are translated to the Linux errno values `std/net` already reads, as the Darwin branch does today.
- `runtime-async.c`'s wait on the same mechanism, so `await fetch(...)` works.
- Roots: a Windows-only runtime function reads the `ROOT` system store through `CertOpenSystemStoreW` and `CertEnumCertificatesInStore`. `pkiLoadSystemRoots` merges it when `SSL_CERT_FILE` and `SSL_CERT_DIR` are unset, as WP75 S2 does for the macOS Keychain.
- Tests: the `net_http_fetch` and `net_http_fetch_tls` programs on the triple, under Wine and natively, against a local server.
- Records: the network runtime record, [`docs/security/fetch.md`](../../docs/security/fetch.md) and [`crypto-pki.md`](../../docs/security/crypto-pki.md) gain the Windows paths, each finding with its before/after test.

## Out of scope

- Running the compiler on Windows, and a Windows `install.sh` or npm platform package for it (owner's decision, S1).
- aarch64 Windows in this pass (owner's decision, S1).
- `--sandbox`, io_uring, shared memory, the HTTP/3 server and prefork on Windows: refused at compile time.
- Windows Credential Manager for WP77's store. It is a follow-up once S3's spawn works, through `CredWriteW` in the runtime or a helper.
- Code signing and Authenticode.

## Tests

| Stage | Cases | Mirror |
| --- | --- | --- |
| S2 | eligible `tests/cases` programs under Wine against Linux output; one negative per refused builtin | the `wasi` section of `tests/run.js` |
| S3 | file, spawn and terminal programs under Wine and natively; argv quoting edge cases | `tests/link/std_*` spawn and file programs |
| S4 | fetch over http and https to a local server under Wine and natively | `tests/link/net_http_fetch`, `net_http_fetch_tls` |

## Verification

Per stage, its `verification:` line, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node scripts/security-scope.mjs`, `node tests/run.js c-symbols` for every `runtime/*.c` change, `node tests/run.js wasi` and `node tests/run.js performance` for the `src/` change in S2, the goldens regenerated with `node tests/self/goldens.js --update`, a `ci-scope` per-command test for each new lane, and every CI test shard green on the PR head.
