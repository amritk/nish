---
name: nish:net raises the descriptor limit
overview: A native Nish server is held to the soft RLIMIT_NOFILE it inherits, often 1024, though the hard limit is usually far higher, because nothing in runtime/, src/ or std/ calls setrlimit. Go and Node raise the soft limit to the hard one at start-up. This makes nish:net do the same, once, the first time a program creates a descriptor through it, so a server can hold as many connections as the operator's hard limit allows. Past the hard limit stays the operator's call (ulimit, the container's settings), as in every runtime.
stages:
  - id: raise-nofile
    title: "fix(runtime): raise the soft descriptor limit to the hard limit in nish:net"
    goal: The first nish:net call that creates a descriptor raises the process's soft RLIMIT_NOFILE to its hard limit (on Darwin, to the hard limit capped at OPEN_MAX), once per process, ignoring a failure; a native test started under a lowered soft limit holds more descriptors than that limit, and the existing descriptor-exhaustion test still meets a limit quickly
    verification: npm run check && npm run lint && node tests/run.js c-symbols && node tests/run.js net_ && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check
    status: pending
    todos:
      - id: runtime-raise
        content: In runtime/runtime-net.c add one static helper that raises the soft RLIMIT_NOFILE to the hard limit (on Darwin, min(hard, OPEN_MAX), since setrlimit there refuses RLIM_INFINITY), at most once per process with an atomic once-flag (scope() tasks may race), ignoring any error. Call it from every runtime-net.c entry point that creates a descriptor (tcpListen/tcpListenFlags, tcpConnect, udpBind, unixListen/unixListenMode, unixConnect, unixSocketPair, pollCreate). Native only; wasm's runtime-net.c stays empty. No new builtin, no src/ emit change
      - id: c-symbols
        content: Reserve getrlimit and setrlimit in src/c-symbols.ts so node tests/run.js c-symbols passes (.claude/selfhost.md, "Changing the runtime")
      - id: budget
        content: If runtime-net.c's .text moves past NET_TEXT_BUDGET in tests/runtime-budgets.js, raise the ceiling to the measured figure and give the figure in the commit body
      - id: test-raise
        content: Add a tests/link case (and its registration in tests/run.js if link cases need one) that starts the program under a lowered soft limit with the hard limit left higher (bash -c 'ulimit -S -n 64 && exec "$0"', as the thread_stack check does), calls tcpListen, then opens 200 pollCreate descriptors and prints that all succeeded. It must fail on the base (EMFILE near 61) and pass with the fix; prove that in the PR body. Skip with a reason, not fail, where the hard limit is below 256. CI's runners are not this container — judge by the program's exit status and output, never a tool's message text
      - id: test-exhaustion
        content: tests/link/net_handler_descriptors exhausts descriptors up to the soft limit, which after this change is the hard limit (65536 or more on some hosts). Run it under a lowered hard limit too (ulimit -n 1024 in its harness) so it still meets the limit fast, and keep its four PASS lines unchanged
      - id: security-record
        content: Add the raise to runtime/runtime-net.c's row in docs/security/runtime.md's scope table, and record it as a finding or note — why it is safe (only the process's own soft limit, never above hard, no new attacker input), that children started by spawn inherit the raised soft limit, and that the sandbox's seccomp filter does not deny prlimit64 — so node scripts/security-scope.mjs passes
      - id: guide
        content: Add a short section to docs/guide/using-nish/networking.md (near "A server") saying a native program's first nish:net call raises the soft descriptor limit to the hard limit, that going past the hard limit is the operator's (ulimit -Hn, LimitNOFILE=, the container's nofile), that spawned children inherit the raised limit, and that Node already does this
      - id: goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update (src/ changed) and docs/reference with node scripts/gen-reference.mjs if any doc comment in runtime/nish.d.ts changed; read both diffs
---

# nish:net raises the descriptor limit

## What exists

- `runtime/runtime-net.c` creates every socket and epoll/kqueue descriptor
  nish:net hands out. Nothing in `runtime/`, `src/` or `std/` calls
  `setrlimit`, so a server is held to whatever soft `RLIMIT_NOFILE` it
  inherits: 1024 under many shells and systemd units, 256 on macOS.
- `std/net/handler.ts` already survives `EMFILE` (HANDLER-10 in
  `docs/security/handler.md`), pinned by `tests/link/net_handler_descriptors`,
  which exhausts the process's descriptors with `pollCreate`.
- The sandbox (`runtime/runtime-sandbox.c`) is a seccomp denylist. It does not
  deny `prlimit64`, so a raise works under `--sandbox`.
- `tests/ffi-struct.js` already reads `RLIMIT_NOFILE` through FFI
  `getrlimit`, a model if a test wants to read the soft limit back.

## What changes

One helper in `runtime/runtime-net.c` raises the soft limit to the hard limit,
once, on the first nish:net call that creates a descriptor. Why there, and not
at start-up for every program as Go does:

- It is what was asked: nish:net's ceiling. A program that never touches
  nish:net keeps the limit it was given, and pays nothing.
- No `src/` emit change and no new builtin. Under the rolling freeze, a
  start-up hook would need a new call in the `@main` wrapper. Here the only
  `src/` change is reserving the two libc names.
- Every server creates a listener or a poller before it accepts, so the raise
  always lands before it is needed.

Children started by `spawn` inherit the raised soft limit. Go puts the old
limit back in the child, and `posix_spawn` offers no way to. Node leaves the
raised limit too. This is documented, not fixed.

Not in scope: the extra descriptor `nish:async` duplicates for every pending
wait (ASYNC-4). It halves an async server's headroom and deserves its own
change, since removing it reopens the descriptor-reuse bug ASYNC-4 fixed.

## raise-nofile

**Owns:** `runtime/runtime-net.c`, `runtime/nish.h`, `runtime/nish.d.ts`,
`src/c-symbols.ts`, `tests/runtime-budgets.js`, `tests/run.js`,
`tests/link/net_fd_limit/**`, `tests/link/net_handler_descriptors/**`,
`tests/self/goldens/checked/**`, `docs/security/runtime.md`,
`docs/guide/using-nish/networking.md`, `docs/reference/**`

One PR. Every todo above, in that order. The test that proves the raise must
fail on the base; the PR body shows both runs.

## Acceptance criteria

1. On Linux, a native Nish program started with `ulimit -S -n 64` (hard limit
   left higher) that calls `tcpListen` can then hold at least 200 more open
   descriptors from nish:net, where the same program built from the base fails
   with `-24` (EMFILE) before 64.
2. The hard limit still binds: a program that exhausts its descriptors through
   nish:net gets `-24`, and `nish/net/handler` keeps waiting out its timeout
   rather than spinning (`net_handler_descriptors`'s four PASS lines).
3. `docs/guide/using-nish/networking.md` tells a user that the soft limit is
   raised, how to go past the hard limit, and that spawned children inherit
   the raised limit.
4. `docs/security/runtime.md` covers the raise, and `node scripts/security-scope.mjs`
   passes on `main` after the merge.
5. CI is green on `main` after the merge, every `test (…, shard N/8)` row
   included.
