---
name: WP63 S1 — the io_uring ring layer in runtime/runtime-uring.c, no surface
overview: Port bench/fd-limit/uring-server.c into a runtime unit, runtime/runtime-uring.c, that sets up io_uring rings with direct descriptors (a sparse RLIMIT_NOFILE-slot table per ring, a provided-buffer ring, one eventfd per ring), bounds single-shot accepts by free slots on one accepting ring at a time, runs multishot recv and send/close on fixed files, handles the IORING_SQ_TASKRUN re-entry and CQ overflow, and probes for a fallback to epoll. Raw syscall() only, no liburing. Nothing in nish:net calls it yet. Lands with docs/security/net-uring.md, C tests of the layer under prlimit, the runtime budget, and the WP63 roadmap tick.
stages:
  - id: s1-ring-layer
    title: "feat(runtime): WP63 S1 — the io_uring ring layer, with no surface"
    goal: runtime/runtime-uring.c exists, is built into every Linux runtime beside runtime-net.c, is called by nothing in nish:net, and is proven by C tests (3,000 connections under a 1,024 descriptor limit, the accept bound, the TASKRUN re-entry, the seccomp-refused fallback), with its security record, its c-symbols reservations and its runtime budget.
    verification: npm run check && npm run lint && npm run lint:dead && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && node tests/run.js c-symbols && node tests/run.js uring && node tests/run.js runtime-budget && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: ring-unit
        content: "runtime/runtime-uring.c — ring setup (SINGLE_ISSUER|DEFER_TASKRUN|TASKRUN_FLAG|SUBMIT_ALL, COOP_TASKRUN as the kernel requires), sparse file table of RLIMIT_NOFILE slots per ring, provided-buffer ring, one eventfd per ring; raw syscall() only — see S1"
        status: pending
      - id: accept-bound
        content: "Single-shot accepts into IORING_FILE_INDEX_ALLOC, never more in flight on a ring than its free slots, on exactly one accepting ring at a time (moving the job is a fresh submission) — see S1"
        status: pending
      - id: io-ops
        content: "Multishot recv with -ENOBUFS re-armed, send and close on fixed files, a short or failed send's remainder re-queued — see S1"
        status: pending
      - id: taskrun-overflow
        content: "The IORING_SQ_TASKRUN re-entry (enter again while the flag is set) and the CQ-overflow drain (FEAT_NODROP, IORING_SQ_CQ_OVERFLOW) — see S1"
        status: pending
      - id: fallback-probe
        content: "The fallback probe: io_uring_setup answering ENOSYS, EPERM or EINVAL, or a missing feature/opcode, selects epoll and never kills the process — see S1"
        status: pending
      - id: wiring
        content: "Pair the unit in scripts/build.sh halves and src/run-cache.ts runtimeUnits() in one commit, the unit lists in tests/run.js and the other runtime-unit lists, and a non-Linux / wasi stub so every profile still links — see S1"
        status: pending
      - id: c-tests
        content: "C tests in tests/run.js: 3,000 loopback connections under prlimit --nofile=1024:1024 with the helper's own /proc/self/fd under 64 by exit status; the accept bound; the TASKRUN re-entry; the fallback with io_uring_setup refused by a harness seccomp filter; each prints a skip line on a kernel without io_uring 6.1 — see S1"
        status: pending
      - id: symbols-budget
        content: "node tests/run.js c-symbols green, any new libc name (eventfd, mmap, munmap, ...) reserved in src/c-symbols.ts; a budget for runtime-uring.c in tests/runtime-budgets.js with its reason — see S1"
        status: pending
      - id: security-record
        content: "docs/security/net-uring.md (scope, threat model, findings fixed with before/after tests or recorded open, the kernel CVE record) and its row in docs/security/README.md; security-scope passes — see S1"
        status: pending
      - id: roadmap
        content: "Tick S1 on docs/roadmap/wp63-iouring-net.md, Done 2 of 6, Next → S2, its row in docs/roadmap/index.md — see S1"
        status: pending
---

# WP63 S1 — the io_uring ring layer, with no surface

Read first: `docs/wp63-iouring-net.md` §2 (the four kernel behaviours), §3.1,
§7, §8, §10 S1; `docs/roadmap/wp63-iouring-net.md`;
`bench/fd-limit/uring-server.c` (the prototype this ports);
`.claude/selfhost.md` → "Changing the runtime"; `.claude/testing.md` →
"Checks that spawn a process"; `docs/security/README.md` → "Writing a record";
`AGENTS.md` → "Picking up a work package".

## S1 — the ring layer

**Owns:** `runtime/runtime-uring.c`, `scripts/build.sh`, `scripts/fuzz.sh`,
`src/run-cache.ts`, `src/c-symbols.ts`, `tests/run.js`,
`tests/runtime-budgets.js`, `tests/nish/run.ts`,
`tests/differential/soundness.js`, `tests/runtime/**`, `tests/link/**`
(new helper sources only), `tests/self/goldens/checked/**` (regenerated),
`tests/shard-costs.json`, `docs/security/net-uring.md`,
`docs/security/README.md`, `docs/roadmap/wp63-iouring-net.md`,
`docs/roadmap/index.md`, `docs/wp63-iouring-net.md` (corrections only),
`AGENTS.md` (the runtime-unit list line only), `THIRD_PARTY_NOTICES.md` (only
if code is copied in).

Not in scope: `runtime/runtime-net.c`, `runtime/nish.d.ts`, `std/**`,
`runtime/runtime-sandbox.c`, `docs/security/sandbox.md`, `docs/guide/**`,
`.github/workflows/**` — those are S2 and S3. No `nish:net` path calls the
ring layer; a grep of `runtime/runtime-net.c` and `std/` for its symbols is
empty.

The four kernel behaviours of §2 are each a rule of the unit and each has a
check that fails without it: the table capped at `RLIMIT_NOFILE` (rings sized
from the limit, `ceil(C / limit)` rings); the multishot-accept overrun
(single-shot only, in flight ≤ free slots); exclusive accept waiters (one
accepting ring, moved by a fresh submission); the 20-completion `DEFER_TASKRUN`
batch (enter again while `IORING_SQ_TASKRUN` is set).

The 3,000-connection check builds its own C helper, runs it under
`prlimit --nofile=1024:1024`, and asserts on its exit status. The helper reads
its own `/proc/self/fd` (the claim is its own count, before and after, per
`.claude/testing.md`), never the test process's. The fallback check installs a
seccomp filter in the helper that answers `io_uring_setup` with each of
`ENOSYS`, `EPERM` and `EINVAL`, and asserts the probe picks epoll; a missing
feature bit is forced the same way.

The unit is Linux-only; every other target and the wasi profile compile a stub
that answers "unavailable", so `node tests/run.js wasi` and the runtime unit
test still link. Raw `syscall()` with no liburing; `syscall` is already
reserved (`src/c-symbols.ts`).
