---
name: Run runtime-net.c's Darwin branch in CI
overview: Add one macOS job to .github/workflows/ci.yml that builds and runs tests/runtime-test.c and runs node tests/run.js net_, so the kqueue, SO_NOSIGPIPE, errno and -95 paths of runtime/runtime-net.c run somewhere, and fix whatever that job finds in the Darwin branch (#358).
stages:
  - id: macos-net
    title: "ci: run runtime-net.c's Darwin branch on a macOS runner"
    goal: A green macOS CI job that compiles and runs tests/runtime-test.c and runs the net_ sections of tests/run.js, with every Darwin bug it surfaces fixed and pinned
    verification: npm run check && npm run lint && node tests/run.js net_ (Linux, 0 failed) and the new macOS job green on the PR head, with npm test undegraded before the PR opens
    todos:
      - id: macos-net-job
        content: Add the runtime-net macOS job to .github/workflows/ci.yml — see The job
      - id: macos-net-iterate
        content: Push, read the macOS job's log, and reproduce each failure from it — see Iterating without a mac
      - id: macos-net-fix
        content: Fix each Darwin-branch defect in runtime/runtime-net.c and pin it in tests/runtime-test.c or a net_ check — see Fixing what it finds
      - id: macos-net-comments
        content: Update the ci.yml comments that call the test row the one macOS gap left, and docs/wp10-ci.md if it lists the jobs — see Pointers
---

## Context

[#358](https://github.com/amritk/nish/issues/358): WP34 N5 (#333) shipped a Darwin branch of [`runtime/runtime-net.c`](../../runtime/runtime-net.c) — `kqueue` readiness loop, `SO_NOSIGPIPE`, the errno translation, `-95` for GSO, GRO and ECN, and `pollModify`'s delete-then-add (where #349 fixed a bug found by reading). CI's `bootstrap (aarch64-darwin)` / `bootstrap (x86_64-darwin)` rows *compile* it through `scripts/build.sh`; nothing *runs* it. The `test` job's `macos-latest` row is commented out for six named checks unrelated to the network runtime, and restoring that row is out of scope.

## The job

One new job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), e.g. `runtime-net (macos-latest)`:

- `runs-on: macos-latest` (aarch64), `timeout-minutes` set, actions pinned by SHA as the file's other jobs are.
- Toolchain: the same `brew install llvm@18` step the `bootstrap` job's macOS row uses; `npm ci`.
- Seed: `bash scripts/fetch-seed.sh` (the darwin seed has been attached since 0.4.0), so `tests/run.js` can link its compiler under test.
- Step 1 — the runtime unit test: compile `tests/runtime-test.c` with the full `RUNTIME_C` list from [`tests/run.js`](../../tests/run.js) (`-std=c11 -Wall -Wextra -Werror -O2`) and run it; then the same with `-DNISH_THREADS=1 -pthread`, as `buildRuntimeTestThreads` does. `tests/run.js` only runs these under no filter, so the job runs them itself. `test_net`, `test_udp` and `test_poll` are what cover the Darwin branch directly.
- Step 2 — `node tests/run.js net_`, which covers the `net_tcp`, `net_tcp_connect`, `net_udp`, `net_dual_stack`, `net_loop`, `net_tls_tcp` sections and the `net_*` golden and link programs.
- Read the run's summary line and skip count and put them in the step summary; a skip is named with its reason, never silent.

## Iterating without a mac

The worker's container is Linux, so the macOS job is the only mac. Each push is a CI cycle: push, read the job log with the GitHub tools, reproduce a failure by reading the Darwin branch against the log's exact output, fix, push. Keep the Linux side green locally (`node tests/run.js net_`, `npm run check`, `npm run lint`). Batch fixes per push; do not push one guess at a time.

## Fixing what it finds

- A defect in `runtime-net.c`'s Darwin branch: fix it, and pin it with an assertion in `tests/runtime-test.c` (or a `net_` check) that fails before the fix on Darwin.
- A `net_` check that reads a Linux fact rather than the property it exists for (as the `test` row's comment describes for the ELF checks): port the check so it asserts the property on both platforms, as `lineTableOf` was ported. Never skip, disable or platform-gate a check to get green.
- A failure that is neither — a compiler bug, or a runtime defect outside `runtime-net.c` — is not widened into this PR: open the PR as a draft and name the failing check, its log line and the cause in the body.

## Pointers

The `test` matrix comment and the comment above `seeds` both say the `test` row is the one macOS gap left; say what the new job now covers. If `docs/wp10-ci.md` lists the CI jobs, add this one there.

**Owns:** `.github/workflows/ci.yml`, `runtime/runtime-net.c`, `tests/runtime-test.c`, `tests/run.js`, `tests/cases/net_*`, `tests/link/net_*/**`, `docs/wp10-ci.md`, `docs/security/runtime.md`

## Out of scope

- Restoring the `test` job's `macos-latest` row, or any of its six named checks.
- `src/` (the compiler). A change there is a different PR.
- A second macOS job (x86_64) — one job, as asked.

## Verification

- `npm run check`, `npm run lint`, `node tests/run.js net_` (Linux) — exit 0, read bare.
- `npm test` undegraded (read the skip count) before the PR opens.
- The new macOS job green on the PR head, with its log showing `runtime_test` and `runtime_test_threads` exit 0 and the `net_` sections' PASS lines rather than skips.
