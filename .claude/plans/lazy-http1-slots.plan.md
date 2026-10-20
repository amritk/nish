---
name: Build Http1Server's connections lazily
overview: Http1Server's constructor builds an Http1Connection for every slot before the first accept, so a 16,384-slot pool takes 51.7 ms and 65.3 MB to its first answer. Build each slot's connection on its first accept instead, so the slot count is a cap rather than a cost paid at start-up.
stages:
  - id: lazy-slots
    title: "perf(std): build Http1Server's connections on first accept"
    goal: Http1Server allocates a slot's Http1Connection on the first accept into it and keeps it, with accept order, O(1) slot finding, size() and H1_POOL_FULL unchanged
    verification: npm run check && npm run lint && node tests/run.js net_http1_server && node tests/run.js net_loopback && node tests/run.js runtime-budget && node tests/run.js wasi && node tests/run.js performance && npm test
    todos:
      - id: lazy-constructor
        content: Make Http1Server's constructor build no Http1Connection, and build a slot's on its first accept with a high-water mark plus the free stack — see Lazy slots
        status: pending
      - id: lazy-readers
        content: Make every reader of connections, fds and armed safe on a slot never built (connection, holds, fd, busy, expire, close, next, flush, rearm, and callers in std/net) — see Readers
        status: pending
      - id: lazy-tests
        content: Add construction-bytes, first-accept, reaccept, warmed-slot and negative checks to tests/link/net_http1_server, with the construction ceiling in tests/runtime-budgets.js — see Tests
        status: pending
      - id: lazy-measure
        content: Measure startup at 16,384 slots and ping, query and body against nish-copy for the noise band, once the bench PR is on main — see Measure
        status: pending
      - id: lazy-docs
        content: Update the header comment, the constructor JSDoc, the guide pool text, std/README.md, docs/wp39-http-server.md, bench/README.md and docs/security/http1.md — see Docs
        status: pending
      - id: lazy-goldens
        content: Regenerate tests/self/goldens/checked.txt and checked-self.txt with node tests/self/goldens.js --update and read the diff — see Verification
        status: pending
---

## Context

[`std/net/http1-server.ts`](../../std/net/http1-server.ts) `Http1Server` (around line 1222) pushes one `Http1Connection` per slot in its constructor and seeds `free` with every slot index. With `bench/http1-server.ts`'s default of 16,384 slots, `node bench/http.mjs --only startup` measured 51.7 ms and 65.3 MB to the first answer. At `--slots 1024` it measured 7.4 ms and 5.8 MB, and Go net/http measured 7.9–9.6 ms and 7.4 MB. Almost all of the start-up cost is preallocation.

**Merge-order edge:** the `startup` scenario lives on `claude/lucid-pasteur-n9t5md`, which is being taken to a merged pull request in parallel. This stage can be written and tested now. Its measurement, its `bench/README.md` paragraph and its PR wait for that branch to be on `main`. The lead messages the worker when it lands.

## Lazy slots

**Owns:** `std/net/http1-server.ts` (the `Http1Server` class, its header comment and the constants it uses only), `tests/link/net_http1_server/**`, `tests/runtime-budgets.js`, `tests/run.js`, `tests/self/goldens/checked.txt`, `tests/self/goldens/checked-self.txt`, `docs/security/http1.md`, `docs/security/README.md`, `docs/guide/using-nish/standard-library.md`, `std/README.md`, `docs/wp39-http-server.md`, `bench/README.md`

- The constructor records `size` and builds nothing per slot. Each slot's `Http1Connection` is built on the first `accept` into it and kept for good, so a warmed slot serves request after request with `Arena.used()` flat, as the header comment requires.
- Accept order stays 0, 1, 2, …, and finding a free slot stays O(1). The suggested shape is a high-water mark `built` for slots never used, plus the existing `free` stack for released ones. `accept` pops `free` if it is non-empty, else takes `built` while `built < size`, else answers `H1_POOL_FULL`. The arrays grow by `push` as `built` advances. The commit body says why this shape and not another. For example, a stack seeded with every index costs `size` words at start-up, which is the thing being removed.
- `size()` still answers the cap, not `built`. `H1_POOL_FULL` still comes at exactly `size` busy slots.
- `Http1TlsServer`, which sits in the same file, is not changed.

## Readers

Check each reader of `connections`, `fds` and `armed` for a slot that was never built: `connection(slot)` (today it falls back to slot 0 when out of range, and there may be no slot 0 now), `holds`, `fd`, `busy`, `expire`, `close`, `next`, `flush`, `rearm`, `readable`/`writable` and any other method. Also check callers elsewhere in `std/net/`, `bench/http1-server.ts` and `tests/link/net_interop_server/server.ts`. Read those callers, but change them only if a caller depends on a slot-0 fallback that no longer exists. Report that in the PR body rather than widening scope. `connection(slot)` on a slot never built must not panic or read out of bounds. It answers a defined value, which the JSDoc names. Peak memory stays bounded by `size` × the per-connection caps. Confirm that `docs/security/http1.md`'s bound still stands.

## Tests

Read [`.claude/testing.md`](../testing.md) first. In `tests/link/net_http1_server`:

- Constructing a 16,384-slot `Http1Server` allocates a small, fixed number of bytes (`Arena.used()` before and after). The figure is pinned as a ceiling in `tests/runtime-budgets.js`, with a measurement comment in that file's style, and `tests/run.js` enforces it, so start-up cannot regress silently.
- The first accept into a slot allocates. Closing it and accepting into it again allocates nothing.
- A warmed slot stays flat over many requests (the existing two-hundred-request check, or one alongside it).
- Negative cases: `H1_POOL_FULL` at exactly `size` busy slots, and `connection`, `fd` and `holds` on a slot never built.
- The existing `net_http1_server*`, `net_loopback*` and `net_interop_server` link tests stay green without changes to their expected output, beyond lines this stage adds.

## Measure

Once the bench PR is on `main`, merge `main` and run `node bench/http.mjs --only startup` at the default 16,384 slots against a byte-identical `nish-copy` to get the noise band. Then run `--only ping,query,body` the same way, to show throughput has not moved outside the band. The figures go in the commit's `Measured:` trailer and in `bench/README.md`'s startup paragraph, replacing the text that blames preallocation. Follow CLAUDE.md's rules on measured claims.

## Docs

- `std/net/http1-server.ts`: the header comment ("Every buffer is allocated by the constructor…") and the constructor's JSDoc.
- The pool description in `docs/guide/using-nish/standard-library.md`.
- `std/README.md`'s `net/http1-server.ts` row and `docs/wp39-http-server.md`, for any claim that slots are preallocated.
- `docs/security/http1.md`: confirm the memory bound, and re-anchor the rows whose `file:line` anchors move, naming the commit the new anchors are at, per CLAUDE.md's Security rules. Grep each cited `check(...)` name against `tests/run.js`.

## Out of scope

`Http1TlsServer`, `std/net/tls-tcp.ts`, `http2*.ts`, `quic*` and `http3*`. Issue #681 (pooled server buffers) owns those files and is in flight (#711, #713, #715). The PR body says a follow-up can apply the same idea to them once #681 has merged.

## Verification

`npm run check`, `npm run lint` (bare, read the exit status), the targeted sections `node tests/run.js net_http1_server`, `net_loopback`, `runtime-budget`, then `node tests/run.js wasi` (with `WASI_SYSROOT` set if the sysroot is installed, and read its skip line) and `node tests/run.js performance`, because the change is to `std/`. Then `node tests/self/goldens.js --update`, with its diff read, and one undegraded `npm test` with the skip count read. Commit as `perf(std): …`, with `Measured:`, `Refs:` and `Tests:` trailers.
