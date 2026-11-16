---
name: WP63 S3–S4 — restricted rings under --sandbox, and the handler past the limit
overview: S2 put io_uring slot handles in nish:net behind NET_LISTEN_RING (9d5c50b6, #1658). S3 lets a --sandbox program granted net keep the ring bit, through rings the runtime makes and restricts before the seccomp filter loads. S4 lets nish/net/handler hold connections past RLIMIT_NOFILE and re-measures the entry with SQLite on top, one ring process against five epoll processes, for a verdict on D1.
stages:
  - id: s3-sandbox-rule
    title: WP63 S3 — restricted io_uring rings under --sandbox
    goal: Under --sandbox with net granted and process.spawn not, a program that reaches NET_LISTEN_RING gets restricted rings made before the filter, the filter kills io_uring_setup and io_uring_register and allows io_uring_enter, and every refused path is pinned by a negative test and recorded in sandbox.md and net-uring.md.
    verification: npm run check && npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/run.js sandbox && node tests/run.js net_ring && node tests/run.js uring && node tests/run.js capabilities && node tests/run.js c-symbols && node tests/run.js runtime-budget && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js
    todos:
      - id: s3-ring-count-setting
        content: Add the build-time ring count to the root package.json nish field (netRings, default 1, range-checked, diagnosed like noPanic) and carry it into the options — see S3 — D2, the setting and the record
        status: pending
      - id: s3-reachable-ring-bit
        content: Record in the binary whether main reaches tcpListenFlags with NET_LISTEN_RING, and pass it with the ring count to nish_sandbox from emitSandboxApply — see S3 — D2, the setting and the record
        status: pending
      - id: s3-restricted-rings
        content: Make the restricted rings in the sandbox step before nish_sb_seccomp (R_DISABLED, REGISTER_RESTRICTIONS, sparse table and buffer ring, ENABLE_RINGS) and hand them to the ring layer for the first tcpListenFlags that sets the bit — see S3 — the restricted rings
        status: pending
      - id: s3-filter-rows
        content: Change the seccomp rows in runtime/runtime-sandbox.c to the three-way rule of design §6.2 item 4 — see S3 — the filter rows
        status: pending
      - id: s3-negative-tests
        content: Add the sandbox checks — each refused opcode and flag answers -EACCES, setup and register from nish:ffi die of SIGSYS with net granted, the bit falls back without net, a sandboxed ring listener serves — see S3 — Tests
        status: pending
      - id: s3-security-records
        content: Update docs/security/sandbox.md (scope, mapping row, Tests) and docs/security/net-uring.md (scope, new findings, the io_uring CVE list since 5.10) — see S3 — Records and guide
        status: pending
      - id: s3-guide-and-roadmap
        content: Update docs/guide/using-nish/sandbox.md's net row and the setting's guide entry, tick S3 in docs/roadmap/wp63-iouring-net.md, and close D2 in the design note's §11 — see S3 — Records and guide
        status: pending
  - id: s4-handler-entry
    title: WP63 S4 — nish/net/handler past the descriptor limit, and the entry re-measured
    goal: HandlerLimits takes the ring bit and a connection cap that is not RLIMIT_NOFILE, -23 from tcpAccept waits for a close as -24 does, BENCH_RING=1 runs the entry on rings, and the entry with SQLite is measured one ring process against five epoll processes with a verdict against design §4 and its meaning for D1.
    verification: npm run check && npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node tests/run.js net_handler && node tests/run.js net_ring && node tests/run.js net_fd_limit && node tests/nish-cmp.js
    todos:
      - id: s4-handler-limits
        content: Add the ring bit and a connection cap to HandlerLimits in std/net/handler.ts, with the slot table sized by the cap rather than RLIMIT_NOFILE — see S4 — the handler
        status: pending
      - id: s4-enfile-wait
        content: Make -23 from tcpAccept on a ring listener wait for a close the way -24 does, with no accepted connection dropped — see S4 — the handler
        status: pending
      - id: s4-handler-tests
        content: Add link tests for the handler past the limit (ring bit, cap above prlimit nofile) and the -23 wait, each behind the kernel it needs — see S4 — Tests
        status: pending
      - id: s4-bench-ring
        content: Add BENCH_RING=1 to bench/http1-server.ts and to the entry's run script — see S4 — the measurement
        status: pending
      - id: s4-measure
        content: Measure the entry with SQLite, one ring process against five epoll processes, at 18k connections and at the box's C, interleaved with a noise band, and write the verdict and its meaning for D1 into docs/BENCHMARKS.md — see S4 — the measurement
        status: pending
      - id: s4-records-and-guide
        content: Update docs/security/handler.md for the cap and the -23 wait, and the http-server and networking guide pages — see S4 — Records and guide
        status: pending
      - id: s4-roadmap-last
        content: In the last commit, after S3 merges, tick S4 in docs/roadmap/wp63-iouring-net.md and record the measurement and the D1 verdict in the design note — see S4 — Records and guide
        status: pending
---

# WP63 S3–S4

## Context

S1 (#1648's run) landed the ring layer in [runtime/runtime-uring.c](../../runtime/runtime-uring.c) and S2 (#1658, 9d5c50b6) landed slot handles in `nish:net`: `NET_LISTEN_RING` (flag 8), `netRingState`, `pollWait` over rings, and the record [docs/security/net-uring.md](../../docs/security/net-uring.md) (NURING-1 to 29). Two gaps remain.

- Under `--sandbox`, [runtime/runtime-sandbox.c](../../runtime/runtime-sandbox.c) kills all three io_uring syscalls unless both `net` and `process.spawn` are granted, so a sandboxed server loses the ring bit (it falls back to descriptors).
- [std/net/handler.ts](../../std/net/handler.ts)'s `HandlerLimits` cannot set the bit, and its slot table and full-table behaviour assume the descriptor limit. The entry has not been measured on rings with SQLite on top, so D1 (opt-in or default) is still open.

Design: [docs/wp63-iouring-net.md](../../docs/wp63-iouring-net.md) §5.3, §6, §8, §10, §11. Roadmap: [docs/roadmap/wp63-iouring-net.md](../../docs/roadmap/wp63-iouring-net.md).

## Approach

- **Two parallel stages, S3 merges first.** They touch different code (the sandbox and the compiler; the handler and the bench). The only shared files are `tests/run.js` (each stage edits its own sections), `tests/nish-cmp.js` (append-only `DECLARED` entries), the generated goldens and reference pages, and the roadmap page and design note. S4 takes those last two only in its last commit, after S3 has merged and S4 has merged `main` into its branch. Any conflict there is S4's to resolve, and it regenerates generated files rather than merging them.
- **D2 is decided**: a build-time ring count, default 1, read from the root package's `"nish"` field (the repo's project-settings home, beside `noPanic`, `capabilities`, `host` and `compat`; there is no `nish.json` file). The compiler records a reachable `NET_LISTEN_RING` in the binary as it records other capability use.
- **The state-machine rule from S2.** Every fix to ring state lists in the PR body every write to the state it touches and every entry point that reaches it. Rounds 2 to 6 on #1658 each found a fix applied to one path and not its twin.

## S3 — ownership

**Owns:** `runtime/runtime-sandbox.c`, `runtime/runtime-uring.c`, `runtime/runtime-net.c`, `runtime/nish.h`, `src/**`, `tests/run.js` (the `sandbox`, `net_ring`, `uring`, `capabilities`, `c-symbols` and runtime-budget sections only), `tests/link/sandbox_fixtures/**`, `tests/link/net_ring_*/**`, `tests/runtime-test.c`, `tests/runtime-budgets.js`, `tests/nish-cmp.js` (append-only `DECLARED` entries), `tests/capabilities.js`, `docs/security/sandbox.md`, `docs/security/net-uring.md`, `docs/security/README.md`, `docs/guide/using-nish/sandbox.md`, `docs/guide/using-nish/cli.md`, `docs/LANGUAGE.md`, `docs/roadmap/wp63-iouring-net.md`, `docs/wp63-iouring-net.md`, and the generated `tests/self/goldens/checked/**`, `docs/reference/**`, `docs/IR_COOKBOOK.md` and `docs/cookbook/**`, regenerated and never hand-edited.

## S3 — D2, the setting and the record

- The setting: `"nish": { "netRings": N }` in the root `package.json`, an integer from 1 to a small ceiling the worker states with its reason (the ring layer's own maximum). It is read where `noPanic` is read ([src/compilation.ts](../../src/compilation.ts) `readNoPanic`), and refused with a diagnostic like the existing `nish`-field ones ([src/codes.ts](../../src/codes.ts) lists the field's keys; the list gains `netRings`). If the worker finds a reason the setting cannot live there, it says so in the PR body. It does not invent a `nish.json` reader.
- The record: whether `main` reaches a `tcpListenFlags` call whose flags may hold `NET_LISTEN_RING`. Be conservative: a flags argument that is not a compile-time constant counts as reaching the bit. Use the capability analysis's reachability ([src/capabilities.ts](../../src/capabilities.ts), `propagateCapabilities` in [src/attributes.ts](../../src/attributes.ts)) rather than a new walk.
- The hand-off: `emitSandboxApply` ([src/emit.ts](../../src/emit.ts):975) passes the ring count (0 when the bit is unreachable or `net` is not granted) to `nish_sandbox`. Its declaration moves in [src/runtime.ts](../../src/runtime.ts):235 and [runtime/nish.h](../../runtime/nish.h). The rolling freeze applies: `src/` may emit the new argument, but it may not *use* a construct the seed lacks.

## S3 — the restricted rings

- In `nish_sandbox` ([runtime/runtime-sandbox.c](../../runtime/runtime-sandbox.c):820), before `nish_sb_seccomp`, when the count is above 0 and `net` is granted without `process.spawn`, make that many rings. For each ring:
  1. `io_uring_setup` with S1's flags plus `IORING_SETUP_R_DISABLED`;
  2. `IORING_REGISTER_RESTRICTIONS` with `SQE_OP` set to ACCEPT, RECV, SEND, CLOSE, ASYNC_CANCEL and NOP; `SQE_FLAGS_ALLOWED` set to FIXED_FILE, BUFFER_SELECT and CQE_SKIP_SUCCESS; and no `REGISTER_OP`;
  3. the sparse file table and the buffer ring, and any eventfd the layer registers;
  4. `IORING_REGISTER_ENABLE_RINGS`.
- Check every opcode the S1/S2 layer submits against that list before writing it (`runtime-uring.c`'s accept, recv, send, close, cancel and any wake). An opcode outside the list is either removed from the sandboxed path or named in the PR body as a blocker. The list is not widened without the design note's say-so.
- A ring that fails any step is closed, and the process falls back for good, as design §5.4 describes. `netRingState` then answers that step's errno. Rings left unused (the program never sets the bit) cost the memory of their mapping and nothing else.
- The ring layer takes the premade rings on the first `tcpListenFlags` that sets the bit, instead of calling `io_uring_setup`. Without `--sandbox`, rings are made on demand as now. A program that needs more rings than were made answers -23 from `tcpAccept` once they are full, the S2 behaviour.

## S3 — the filter rows

- Without `net`: all three syscalls stay killed (as now).
- With `net` and `process.spawn`: unchanged (all three allowed).
- With `net` and without `process.spawn`: `io_uring_setup` (425) and `io_uring_register` (427) are killed, and `io_uring_enter` (426) is allowed.
- This holds in both strict and best-effort modes. The x32 and arch kills do not change.

## S3 — Records and guide

- [docs/security/sandbox.md](../../docs/security/sandbox.md): the scope (the ring-making step), the mapping row (the three-way rule above), and the Tests list (each new check by its exact `tests/run.js` name). The existing `io_uring_setup from ffi without net dies of SIGSYS (strict)` and `(best-effort)` checks stay.
- [docs/security/net-uring.md](../../docs/security/net-uring.md): scope adds the sandbox rows; a finding per new risk, fixed with a before/after test or recorded open; and **the kernel's record**, the io_uring CVEs since 5.10, each with its fix version and whether a restricted ring of these six opcodes and three flags reaches it. Name the sources (NVD and the kernel CVE list). Any CVE the worker cannot classify is listed as unclassified, never dropped. Keep the [docs/security/README.md](../../docs/security/README.md) index rows in step.
- [docs/guide/using-nish/sandbox.md](../../docs/guide/using-nish/sandbox.md): the `net` row's io_uring sentence, and the `netRings` setting with its default. Mention it in the networking page's ring section only if that page states the sandbox falls back today (S4 owns the rest of that page).
- Tick S3 on the roadmap page, update its "Next" and "Open questions" (D2 decided). Update design note §11 D2 to *Decided in S3* with the setting's name.

## S4 — ownership

**Owns:** `std/net/handler.ts`, `bench/**`, `docs/BENCHMARKS.md`, `docs/security/handler.md`, `docs/guide/using-nish/http-server.md`, `docs/guide/using-nish/networking.md`, `tests/run.js` (only the checks it adds for the handler), `tests/link/net_handler*/**`, `tests/nish-cmp.js` (append-only `DECLARED` entries), and the generated `tests/self/goldens/checked/**` and `docs/reference/**`, regenerated. In its last commit only, after S3 merges: `docs/roadmap/wp63-iouring-net.md` and `docs/wp63-iouring-net.md`.

## S4 — the handler

- `HandlerLimits` gains `listenFlags` (or the name the worker justifies) carrying `NET_LISTEN_RING`, and a connection cap. The slot table is sized by that cap, not by `RLIMIT_NOFILE`. The default stays 256 slots and no ring bit, so existing programs do not change.
- A listener the handler makes, or the one it is given, keeps the bit. Read how `HttpHandler`'s constructor takes `listener` ([std/net/handler.ts](../../std/net/handler.ts):570) and say in the PR body which path sets the bit.
- At the limit: -24 already pauses accepting until a close (#1548, line ~526 and ~762). -23 from a full set of rings takes the same path, and a test shows no accepted connection is dropped.
- The state-machine rule applies to the accept pause.

## S4 — the measurement

- `bench/http1-server.ts` reads `BENCH_RING=1` and sets the bit. The entry's run script ([bench/techempower/](../../bench/techempower/) or whatever drives the entry with SQLite; the worker names it) gains the same switch.
- Contestants: one process with rings against five epoll processes (the entry's prefork shape), both with SQLite on top. Levels: 18,000 connections, and the box's C (the highest connection count this box reaches, under its hard nofile limit of 20,000 for the epoll side, stated with how it was found).
- Method: interleaved rounds (at least 3), a byte-identical copy of one build as the noise band, and median and per-round readings, as in design §3 and `.claude/testing.md` → "A `Measured:` trailer". Every figure comes from a run logged in the PR.
- Verdict: read against design §4's rule (cheaper by more than the noise band at the highest C, and past the limit). State what it means for D1: whether the bit should become the default for Linux listeners, stay opt-in, or wait for more data. The verdict is the data's. A no-go is a valid result.
- Record it in [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) (the run command, the box, the table, the band).

## S4 — Records and guide

- [docs/security/handler.md](../../docs/security/handler.md): the cap and the -23 wait, as a finding with a test if they change what a peer can make the handler hold.
- [docs/guide/using-nish/http-server.md](../../docs/guide/using-nish/http-server.md) (the `HandlerLimits` fields) and [docs/guide/using-nish/networking.md](../../docs/guide/using-nish/networking.md) (the handler line in the descriptor-limit section).
- The last commit only, after S3 is on `main` and merged into this branch: tick S4 on the roadmap page and update its Next. Add the measurement and the D1 verdict to design note §10 and §11.

## Tests

| check | stage | where |
|---|---|---|
| each refused opcode (SOCKET, CONNECT, OPENAT, at least one more) and refused flag (IO_LINK, IO_DRAIN, ASYNC) answers -EACCES on a sandboxed ring | S3 | `sandbox` section, a fixture in `tests/link/sandbox_fixtures/` |
| `io_uring_setup` and `io_uring_register` from `nish:ffi` die of SIGSYS with `net` granted (strict and best-effort) | S3 | `sandbox` |
| without `net` the bit falls back and `netRingState` answers the refusal | S3 | `sandbox` |
| a sandboxed ring listener serves loopback connections | S3 | `sandbox` |
| `netRings` out of range is diagnosed; a binary that never reaches the bit makes no ring | S3 | `capabilities` or the options tests |
| the handler holds more connections than `prlimit --nofile` allows, with the bit | S4 | `tests/link/` |
| -23 pauses accepting and resumes on a close, with nothing dropped | S4 | `tests/link/` |

Every check sits behind the kernel it needs and prints a skip line otherwise. It proves behaviour by a helper's exit status, never by message text or the test process's descriptor count (`.claude/testing.md` → "Checks that spawn a process"). Show the exact LLVM IR for any TypeScript snippet a test adds.

## Out of scope

- io_uring for connects, files or timers, SQPOLL, zero-copy send, and macOS or wasi rings.
- `ceil(hard limit × k / limit)` ring sizing (D2's other candidate).
- S5 (`PRAGMA mmap_size`, `nish/sync/shm`).
- Making the ring bit the default. S4 gives the verdict; flipping D1 is a later change.

## Verification

Each stage's `verification` line, plus the lint job's full list (`npm ls --package-lock-only --all >/dev/null`, `shellcheck -S warning scripts/*.sh docs/cookbook/regen.sh install.sh .github/*.sh .claude/hooks/*.sh`, `node docs/check-links.mjs`) and the test job's extra steps (`node scripts/gen-diagnostic-codes.mjs --check`, `bash docs/cookbook/regen.sh --check`, `bash scripts/smoke.sh`). CI's eight shards are the full-suite gate.
