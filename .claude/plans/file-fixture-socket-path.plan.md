---
name: Socket fixture independent of the checkout path
overview: Make the file_open_errors socket fixture that tests/run.js prepares bind by a relative name from inside build/test, so a checkout whose build/test path exceeds sun_path (108 bytes on Linux) still gets its socket, and make a fixture that cannot be made fail loudly and say why. Fixes #1405. Test harness only; no src/, std/ or tests/cases change.
stages:
  - id: socket-fixture
    title: "test: bind the file_open_errors socket by a relative name (#1405)"
    goal: node tests/run.js file_open_errors passes in a checkout whose build/test path is longer than 107 bytes, and a socket that cannot be bound fails a named check with the reason
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js file_open_errors && node tests/run.js file-server
    status: pending
    todos:
      - id: relative-bind
        content: In tests/run.js prepareFileCases, run the `node -e` listen with `cwd` set to buildDir and listen on the bare name `file_open_errors.sock` (and mkfifo by the bare name too), so only a short relative string reaches bind — see Design
        status: pending
      - id: loud-check
        content: Keep the existing `file fixtures` check and make its message say what went wrong — the bind's exit status and stderr, and when the socket is missing, the length of the path that was attempted — so a failure is not a bare `socket: -2` diff later
        status: pending
      - id: long-path-regression
        content: Add one check to tests/run.js that prepares the fixtures in a scratch directory under build/test whose absolute path is over 108 bytes and asserts the socket and FIFO exist there (factor prepareFileCases to take the directory). It must fail on main and pass after the fix; say so in the PR body with both outputs
        status: pending
      - id: nish-runner
        content: Confirm tests/nish/run.ts prepareFileCases already binds relatively (`cd "$0"`, `listen("file_open_errors.sock")`, `test -S`) and so needs no behaviour change; touch it only if it does not, and say which in the PR body
        status: pending
---

# Socket fixture independent of the checkout path

## Problem

`prepareFileCases` in `tests/run.js` binds a Unix-domain socket at the absolute
path `build/test/file_open_errors.sock` under the checkout. `sun_path` is 108
bytes on Linux including the NUL. In a long checkout path the bind fails (#1405),
and under Node 22.23.4 (CI's pin) it can instead *silently truncate* the path and
bind a stray socket somewhere above `build/test`. Reproduced in the lead session:
a 130-byte `build/test` dir gave `listen` exit 0, no socket in `build/test`, and a
socket file named by the first 107 bytes of the path. Either way the
`file fixtures` check and `file_open_errors`' golden (`socket: -6`) fail with no
useful reason.

`tests/nish/run.ts`'s twin already runs `cd "$0"` and listens on the bare name,
then `test -S`, so it is path-independent today.

## Design

Bind with `spawnSync("node", ["-e", ...listen("file_open_errors.sock")...], { cwd: buildDir })`.
The kernel limit applies only to the string passed to `bind`, and a relative name
is resolved against the process's cwd, which has no length limit of its own.
No temp directory and no symlink: `fileOpen` in the case opens
`build/test/file_open_errors.sock` and must see a real socket there (`-6`), and
a symlink to a socket would change what `open` answers.

## socket-fixture

**Owns:** `tests/run.js`, `tests/nish/run.ts`

Out of scope: `src/`, `std/`, `tests/cases/`, goldens of any kind, CI config.
