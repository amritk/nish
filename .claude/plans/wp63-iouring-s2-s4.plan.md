---
name: WP63 S2–S4 — io_uring slot handles in nish:net, the sandbox rule, and the handler past the limit
overview: S1 landed the ring layer in runtime/runtime-uring.c with no surface. These three stages give it one. S2 puts slot handles behind a tcpListenFlags bit in nish:net, with netRingState, pollWait over both kinds and the descriptor fallback. S3 lets --sandbox grant io_uring under `net` alone, through restricted rings made before the filter loads. S4 moves nish/net/handler past RLIMIT_NOFILE and re-measures the entry, one ring process against five epoll processes, with SQLite on top. The design is docs/wp63-iouring-net.md §5, §6, §8 and §10, and these stages follow it.
stages:
  - id: s2-slot-handles
    title: "feat(runtime): WP63 S2 — io_uring slot handles in nish:net"
    goal: A listener opened with `tcpListenFlags(..., NET_LISTEN_RING)` on Linux with io_uring accepts into ring slots. It serves 3,000 loopback connections under `prlimit --nofile=1024:1024` through `netRead`, `netWrite`, `netClose` and `pollWait`, with fewer than 64 entries in /proc/self/fd. Where rings are refused it falls back to descriptors and `netRingState()` reports why.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js uring && node tests/run.js net && node tests/run.js c-symbols && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node docs/check-links.mjs
    todos:
      - id: s2-encoding
        content: The handle encoding of §5.1 (below 2^20 a descriptor, 2^20 + ring × 2^20 + slot a slot) with a generation, so a closed handle answers -9 and never reaches the next connection in that slot; `sendFd` on a slot answers -9 — see S2
        status: pending
      - id: s2-surface
        content: "`NET_LISTEN_RING` (bit 4) and `netRingState(): i32` in nish:net: src/nish-modules.ts, runtime/nish.d.ts with doc comments, runtime/nish.mjs; bit 4 accepted and inert on macOS, and refused or inert on wasm as the other bits are — see S2"
        status: pending
      - id: s2-io
        content: "`tcpAccept`, `netRead`, `netWrite`, `netClose`, `netSetOption`, `netLocalPort` on slot handles in runtime/runtime-net.c over runtime-uring.c, keeping the readiness contract: -11 when nothing is queued, a bounded per-connection send area whose full state is -11 (NURING-2), -23 at a full set of rings — see S2"
        status: pending
      - id: s2-poll
        content: "`pollWait` over both kinds: ring eventfds in the loop's epoll set, sleep bounded by `nish_uring_sleep_ms`, reap on wake and on `IORING_SQ_TASKRUN`, level-triggered readiness reported in arrival order — see S2"
        status: pending
      - id: s2-fallback
        content: The process-wide fallback of §5.4 on the first bit-setting listen, with `netRingState()` = 1 or the negative errno — see S2
        status: pending
      - id: s2-tests
        content: "`net_ring_beyond_limit` (3,000 under prlimit 1,024, verdict by exit status), plus the fallback under a harness seccomp filter (`netRingState() === -1`), stale handle, accept bound and -23 checks, each skipping with a counted skip line where io_uring is absent; a negative tests/cases case; runtime budgets — see S2"
        status: pending
      - id: s2-docs
        content: The networking guide page (the bit, what a slot handle is and is not, netRingState, the fallback, -23), docs/reference regenerated, net-uring.md scope and findings for the slot paths, the goldens regenerated, the S2 box ticked — see S2
        status: pending
  - id: s3-sandbox-rule
    title: "feat(runtime): WP63 S3 — restricted io_uring rings under --sandbox with net"
    goal: Under `--sandbox` with `net` granted and `process.spawn` not, a program that uses `NET_LISTEN_RING` gets rings the runtime made and restricted before the filter loaded, and runs past the descriptor limit. `io_uring_setup` and `io_uring_register` from nish:ffi die of SIGSYS. Every opcode outside the six allowed answers -EACCES. Without `net`, the existing kills stand and the bit falls back with `netRingState()` = -1.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js sandbox && node tests/run.js uring && node tests/run.js net && node tests/run.js capabilit && node tests/run.js c-symbols && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node docs/check-links.mjs
    todos:
      - id: s3-know
        content: "How the runtime knows before main (D2): the compiler records a reachable `NET_LISTEN_RING` in the binary the way it records other capability use, and the ring count is a build-time `nish.json` setting with 1 as the default — see S3"
        status: pending
      - id: s3-rings
        content: "Restricted rings in the sandbox step before `nish_sb_seccomp`: IORING_SETUP_R_DISABLED, REGISTER_RESTRICTIONS (SQE_OP = ACCEPT, RECV, SEND, CLOSE, ASYNC_CANCEL, NOP; SQE_FLAGS_ALLOWED = FIXED_FILE, BUFFER_SELECT, CQE_SKIP_SUCCESS; REGISTER_OP = none), sparse table and buffer ring registered, then ENABLE_RINGS; runtime-net.c takes these rings instead of making its own — see S3"
        status: pending
      - id: s3-filter
        content: "The three-way filter rule of §6.2: with `net` and the bit, kill io_uring_setup and io_uring_register and allow io_uring_enter; without `net`, all three stay killed; with `net` and `process.spawn`, nothing changes — see S3"
        status: pending
      - id: s3-tests
        content: "Negative tests under --sandbox: each refused opcode answers -EACCES; setup and register from nish:ffi die of SIGSYS with `net` granted; without `net` the bit falls back; the existing `io_uring_setup from ffi without net` checks stay; a ring program past the limit under --sandbox net — see S3"
        status: pending
      - id: s3-docs
        content: "docs/security/sandbox.md (scope, the mapping row, Tests), net-uring.md's restriction findings and the CVE list since 5.10, the sandbox guide page's `net` row, the S3 box ticked — see S3"
        status: pending
  - id: s4-handler-entry
    title: "feat(std): WP63 S4 — nish/net/handler past the descriptor limit, and the entry re-measured"
    goal: "`HandlerLimits` takes the ring bit and a connection cap that is no longer RLIMIT_NOFILE, so an HttpHandler serves HTTP/1.1 keep-alive connections past the limit, and waits instead of dropping when a full set of rings answers -23. `bench/http1-server.ts` gains `BENCH_RING=1`, and the entry is re-measured with SQLite: one ring process against five epoll processes at 18k connections and at the box's C. The measurement has its noise band and a verdict against §4's rule."
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js handler && node tests/run.js net && node tests/run.js http && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    todos:
      - id: s4-limits
        content: "`HandlerLimits` takes the listener flag and a connection cap; the handler's slot table may exceed RLIMIT_NOFILE; -23 from tcpAccept waits for a close, the same way -24 does today (#1548) — see S4"
        status: pending
      - id: s4-tests
        content: "A tests/link program and a run.js check: an HttpHandler with the bit serves 3,000 keep-alive connections under prlimit 1,024 and reports by exit status; the -23 wait; skip lines where io_uring is absent — see S4"
        status: pending
      - id: s4-bench
        content: "`BENCH_RING=1` in bench/http1-server.ts; the re-measurement (ring vs five epoll processes, SQLite on top, 18k and the box's C) with interleaved runs and a noise band, recorded in docs/BENCHMARKS.md and the design note's §4/§10, with the verdict and what it means for D1 — see S4"
        status: pending
      - id: s4-docs
        content: The HTTP server guide page's limit section, docs/reference regenerated, the S4 box ticked once S3 has merged — see S4
        status: pending
---

# WP63 S2–S4

Design: `docs/wp63-iouring-net.md` §5 (surface), §6 (sandbox), §7 (security
record), §8 (guide pages and tests) and §10 (stages). Where this plan and the
note disagree, the note governs, except on the decisions recorded under
"Decisions" below.

Order: **S2 → (S3 ∥ S4)**. S3 and S4 both consume S2's surface, so they start
once S2 merges. They then run in parallel, and merge S3 first, then S4.

## Decisions (taken at sign-off)

- **D1:** the ring bit stays opt-in. S4's measurement reports whether it could
  become the default. That change is not made here.
- **D2:** a build-time ring count from a `nish.json` setting, with 1 as the
  default. The compiler records a reachable `NET_LISTEN_RING` in the binary,
  as it records other capability use, so the sandbox step knows before `main`.
  Without `--sandbox`, rings are made on demand as in S2.
- **D3:** one thread with N rings, as the note designs it.

## S2 — slot handles in `nish:net`

Owns: `runtime/runtime-net.c`, `runtime/runtime-uring.c`, `runtime/nish.d.ts`,
`runtime/nish.mjs`, `src/nish-modules.ts`, `src/c-symbols.ts`,
`src/capability-report.ts`, `tests/run.js`, `tests/runtime-budgets.js`,
`tests/runtime/uring-test.c`, `tests/link/net_ring_*/**`,
`tests/cases/net_ring_*`, `tests/cases/reject_net_ring_*`, `tests/nish-cmp.js`,
`docs/guide/using-nish/networking.md`, `docs/security/net-uring.md`,
`docs/security/README.md`, `docs/LANGUAGE.md`, `docs/roadmap/wp63-iouring-net.md`,
`docs/wp63-iouring-net.md`, `docs/roadmap/index.md`, and the generated
`docs/reference/**`, `scalar.config.json`, `tests/self/goldens/checked/**`,
`tests/differential/**` goldens.

The handle encoding, the slot-handle paths, `pollWait` over both kinds, and
the fallback, all per §5. The bounded send area answers NURING-2, the open
finding the roadmap names. A slot's generation is how a stale handle answers
-9 (§7). The tests are those §8 names for S2, each gated on the kernel and
counted in the section's skip line. CI's runners are not this container, so
checks set their own `prlimit` and read the program's exit status
(`.claude/testing.md`, "Checks that spawn a process").

## S3 — the sandbox rule

Owns: `runtime/runtime-sandbox.c`, `runtime/runtime-uring.c`,
`runtime/runtime-net.c`, `src/**` (only what D2's record needs),
`tests/run.js` (its sandbox and uring sections), `tests/link/sandbox_ring_*/**`,
`docs/security/sandbox.md`, `docs/security/net-uring.md`,
`docs/guide/using-nish/sandbox.md`, `docs/roadmap/wp63-iouring-net.md`,
`docs/wp63-iouring-net.md`, and generated goldens.

§6.2 in full: rings made and restricted before the filter loads, the filter's
three-way rule, and the negative tests of §8. The security record lists the
io_uring CVEs since 5.10, and for each says whether a ring restricted to
these six opcodes reaches it.

## S4 — the handler and the entry

Owns: `std/net/handler.ts`, `bench/http1-server.ts`, `bench/**` (new
measurement scripts only), `docs/BENCHMARKS.md`,
`docs/guide/using-nish/http-server.md`, `tests/link/net_handler_ring_*/**`,
`tests/run.js` (one new check, appended in its own section), and generated
`docs/reference/net/**` and goldens. `docs/roadmap/wp63-iouring-net.md` and
`docs/wp63-iouring-net.md` are edited only in S4's last commit, after S3 has
merged and S4 has updated from `main`.

§5.3 and §10, item 4. The measurement follows §3's method: interleaved runs on
the same machine, with a noise band. If the result fails §4's rule, S4 says so
plainly and still lands the handler change.
