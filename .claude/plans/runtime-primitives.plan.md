---
name: Three runtime primitives — process priority, a socket option setter, Unix-domain sockets
overview: Three small, general-purpose runtime builtins, one PR each so each is one changelog line. Every one follows runtime/nish.d.ts's contract — i32, >= 0 on success, a negative Linux errno otherwise, -95 where the platform has no such thing; descriptors non-blocking and close-on-exec; a throw under Node like the other net calls; Linux and Darwin unless noted. The three touch the same registration files (src/nish-modules.ts, src/runtime.ts, runtime/nish.mjs, runtime/nish.d.ts, docs/LANGUAGE.md, docs/AI.md, llms.txt, tests/run.js), so they run one after another, smallest first.
stages:
  - id: process-priority
    title: "feat(runtime): setNice and setIdlePriority in nish:process"
    goal: A program can lower its own scheduling priority with setNice(n) (setpriority(PRIO_PROCESS, 0, n)) and move itself to SCHED_IDLE with setIdlePriority() on Linux (-95 on Darwin), each failure a negative errno and never a crash
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/run.js <the new cases' filter> && node tests/run.js wasi && node tests/run.js performance; every CI test shard green and undegraded
    status: pending
    todos:
      - id: pp-decl
        content: Declare setNice(n: i32): i32 and setIdlePriority(): i32 in runtime/nish.d.ts's "nish:process" module (and the global form, if the neighbours have one), with doc comments — setIdlePriority says an unprivileged process can never leave SCHED_IDLE and that an idle process can starve on a saturated machine, so callers keep a normal-priority fallback
        status: pending
      - id: pp-c
        content: Implement both in runtime/runtime-os.c (setpriority, sched_setscheduler with SCHED_IDLE under __linux__, -95 elsewhere), returning -errno; register them in src/runtime.ts and src/nish-modules.ts the way spawn/kill are, a wasm/wasi refusal like the other process calls, and a throwing stub in runtime/nish.mjs
        status: pending
      - id: pp-tests
        content: Native round trip (setNice(1) returns 0 and getpriority reads the new value, or the program prints what it read; setNice(-20) unprivileged is a negative errno, not a crash; setIdlePriority on Linux returns 0 in a spawned child so the test runner is not demoted), golden .ll, llvm-as pass, a negative test (wasm refusal or Node throw), registered in the differential and checked goldens
        status: pending
      - id: pp-docs
        content: docs/LANGUAGE.md table rows, docs/AI.md, llms.txt, the docs/guide page that lists nish:process (docs/guide/using-nish/standard-library.md or its neighbour), and a security record row if security-scope.mjs requires one
        status: pending
  - id: net-set-option
    title: "feat(runtime): netSetOption with a whitelist of socket options"
    goal: netSetOption(fd, option, value) sets one of NET_TCP_NODELAY, NET_TCP_QUICKACK (Linux only, -95 elsewhere), NET_SO_KEEPALIVE, NET_SO_SNDBUF, NET_SO_RCVBUF on a socket; any other option is -22; no raw level/optname passthrough
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/run.js net_ && node tests/run.js wasi && node tests/run.js performance; every CI test shard green and undegraded
    status: pending
    todos:
      - id: so-decl
        content: Declare netSetOption and the option constants in runtime/nish.d.ts's "nish:net" module; the NET_TCP_QUICKACK doc comment says Linux does not keep quick-ACK mode (the kernel leaves it on its own), so a server that wants a mode has to set it after every response. If nish: modules cannot export integer constants yet, add that in the narrowest way and say so in the PR
        status: pending
      - id: so-c
        content: Implement it in runtime/runtime-net.c as a switch over the whitelist mapping to (level, optname), -22 for unknown options, -95 for TCP_QUICKACK off Linux, -errno from setsockopt; register in src/runtime.ts, src/nish-modules.ts, a throwing stub in runtime/nish.mjs, a wasm/wasi refusal
        status: pending
      - id: so-tests
        content: Native tests — each option returns 0 on a TCP socket and getsockopt (or an observable effect) agrees where the platform allows; an unknown option is -22; NET_TCP_QUICKACK on an accepted socket returns 0 on Linux; a closed descriptor is -9; a negative test (wasm refusal / Node throw); goldens registered
        status: pending
      - id: so-docs
        content: docs/LANGUAGE.md nish:net table and module list, docs/AI.md, llms.txt, docs/guide/using-nish/networking.md, docs/security/runtime.md scope note for the new function
        status: pending
  - id: unix-sockets
    title: "feat(runtime): Unix-domain stream sockets in nish:net"
    goal: unixListen(path, backlog) and unixConnect(path) give AF_UNIX SOCK_STREAM descriptors that tcpAccept, netRead, netWrite, netClose, netShutdown, pollAdd and connectResult use unchanged; "@" paths are Linux's abstract namespace (-95 on Darwin); an existing socket file is unlinked before bind; a path longer than sun_path is -22
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/security-scope.mjs && node tests/run.js net_ && node tests/run.js wasi && node tests/run.js performance; every CI test shard green and undegraded
    status: pending
    todos:
      - id: ux-decl
        content: Declare unixListen and unixConnect in runtime/nish.d.ts's "nish:net" module with doc comments (abstract namespace, unlink-before-bind only for an existing socket file — any other file type is -98 or the bind's errno, too-long path is -22). Decide whether a netAccept alias reads better than tcpAccept; if added, tcpAccept keeps working unchanged
        status: pending
      - id: ux-c
        content: Implement in runtime/runtime-net.c — SOCK_NONBLOCK|SOCK_CLOEXEC (fcntl on Darwin), lstat + S_ISSOCK before unlink, abstract path leading NUL and exact addrlen on Linux, non-blocking connect with EINPROGRESS/EAGAIN as tcpConnect does; tcpAccept leaves peer zeroed for AF_UNIX and never sets TCP_NODELAY on it; audit every other AF_INET6 assumption (netLocalPort, getpeername users, netSetOption's TCP options on AF_UNIX answer the kernel's errno or -95, consistently and documented)
        status: pending
      - id: ux-register
        content: Register in src/runtime.ts and src/nish-modules.ts, throwing stubs in runtime/nish.mjs, wasm/wasi refusals
        status: pending
      - id: ux-tests
        content: Native tests — a filesystem-path echo round trip through pollAdd, tcpAccept (peer zeroed), netRead/netWrite/netShutdown/netClose and connectResult; abstract namespace on Linux; a stale socket file is replaced; a regular file at the path is not unlinked; a 109-byte path is -22; connect to a missing path answers a negative errno; descriptors are close-on-exec; negative tests (wasm refusal, Node throw); goldens registered
        status: pending
      - id: ux-docs-security
        content: docs/LANGUAGE.md, docs/AI.md, llms.txt, docs/guide/using-nish/networking.md (a section on Unix sockets for same-machine processes), and docs/security/runtime.md — the new function in scope with its findings (path length, unlink race / symlink, abstract-namespace exposure) fixed with a test or recorded open, plus its index row
        status: pending
---

# Three runtime primitives

## Why one after another

All three add builtins, and a builtin is registered in the same eight files
(`src/nish-modules.ts`'s module list and arity table, `src/runtime.ts`'s
declarations, `runtime/nish.mjs`'s Node stubs, `runtime/nish.d.ts`,
`docs/LANGUAGE.md`'s module table, `docs/AI.md`, `llms.txt`, `tests/run.js`)
plus the generated goldens. Two stages that edit the same table rows at once
conflict by construction, so each stage starts when the previous one merges.
Each is worth merging alone, and the repo's changelog is one squash commit per
PR, which is why they are three PRs rather than one with three commits.

Order is smallest first: `process-priority` (`runtime-os.c`), then
`net-set-option`, then `unix-sockets`, which is last because it is the largest
and because it audits the accept path that `net-set-option` touches.

Every stage reads `.claude/selfhost.md`, `.claude/testing.md` and
`.claude/architecture.md` first, and follows the definition of done in
`CLAUDE.md`: the rolling freeze (no `src/` *use* of the new builtins),
regenerated goldens, the `wasi` and `performance` sections for a `src/`
change, and the CI shards as the full-suite gate. The PR title is the
changelog line; its squash body is the release-note prose.

Open PR #912 (`--sandbox` capability sets) may need to classify new builtins;
whichever lands second adds the new names to its capability table.

## process-priority

**Owns:** `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/runtime-os.c`, `runtime/nish.h`, `src/runtime.ts`, `src/nish-modules.ts`, `src/**` (registration only), `tests/cases/**`, `tests/link/**`, `tests/run.js`, `tests/runtime-budgets.js`, `tests/differential/**`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/guide/**`, `docs/security/**`, `llms.txt`, `scalar.config.json`

## net-set-option

**Owns:** the same globs as `process-priority`, with `runtime/runtime-net.c` in place of `runtime/runtime-os.c`. Starts after `process-priority` merges.

## unix-sockets

**Owns:** the same globs as `net-set-option`. Starts after `net-set-option` merges.
