---
name: Ring in place — write a record into ring memory, send it from ring memory
overview: Let an SpscRing producer reserve a contiguous window of ring memory as a u8[] and commit it, and let a consumer peek a record as a readonly u8[] and hand it to Http1Connection, which sends head and body in one gather write — removing the producer's copy into the ring and the worker's copy into the output buffer, measured by a new benchmark.
stages:
  - id: window-builtins
    title: "feat(runtime): shared-region windows and a two-buffer netWrite"
    goal: A SharedRegion can lend a u8[] that aliases a byte range of the region, invalidated on return or close, and nish:net can write two buffers in one system call
    verification: npm run check && npm run lint && node tests/run.js sync_shm && node tests/run.js net_write && node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs
    todos:
      - id: shm-window-runtime
        content: Add the window runtime to runtime/runtime-shm.c — a runtime-owned nish_array header per lent window, data pointing into the mapping, zeroed on return and on close — see Window builtins
      - id: shm-window-builtin
        content: Make the window reachable from std/sync/shm.ts as SharedRegion.lend and SharedRegion.giveBack through a compiler-known intrinsic, since FFI may not return u8[] — see Window builtins
      - id: net-write2
        content: Add netWrite2(fd, a, aOff, aLen, b, bOff, bLen) to nish:net (src builtin tables, runtime/runtime-net.c writev, runtime/nish.d.ts, runtime/nish.mjs refusal) — see Two-buffer write
      - id: window-tests
        content: Add golden .ll, llvm-as pass, native round trips and negative tests (use after giveBack, use after close, a grown window) — see Tests
      - id: window-docs
        content: Write the docs/LANGUAGE.md rules, IR cookbook entries, guide text in docs/guide/using-nish/shared-memory.md and networking.md, and the docs/security/shm.md and runtime-net records — see Window builtins
  - id: ring-reserve-peek
    title: "feat(runtime): reserve, commit, peek and release on SpscRing"
    goal: An SpscRing producer writes a record in place through reserve and commit, and a consumer reads one in place through peek and release, both always contiguous
    verification: npm run check && npm run lint && node tests/run.js sync_ring && node tests/run.js sync_shm && node scripts/security-scope.mjs && node docs/check-links.mjs
    todos:
      - id: ring-skip-marker
        content: Add the skip marker to the SPSC record format in std/sync/ring.ts so a window that does not fit the tail starts at data offset 0, and teach every pop path to step over it — see Ring format
      - id: ring-reserve-commit
        content: Add SpscRing.reserve(n) and commit(len) (and abandon) returning the lent u8[] window, failing without blocking when there is no room — see Producer API
      - id: ring-peek-release
        content: Add SpscRing.peek() and release() lending the next record as a readonly u8[], with tryPop as the answer for a record that wraps — see Consumer API
      - id: ring-tests
        content: Extend tests/link/sync_ring with in-place cases across processes, wraparound over many laps of 1–10 KB records, mixed tryPush and reserve, and negative tests — see Tests
      - id: ring-docs
        content: Document the API in docs/guide/using-nish/shared-memory.md, docs/wp47-shared-memory.md section 5, and the ring rows of docs/security/shm.md — see Producer API
  - id: http1-direct-body
    title: "feat(runtime): send an Http1Connection body from a caller's buffer"
    goal: Http1Connection can send a content-length body straight from a caller's u8[] range, gathered with the queued head in one netWrite2, keeping no reference to the caller's bytes once the call returns
    verification: npm run check && npm run lint && node tests/run.js net_http1_server && node tests/run.js net_http1 && node scripts/security-scope.mjs && node docs/check-links.mjs
    todos:
      - id: http1-send-body
        content: Add Http1Connection.sendBody(buf, off, len) to std/net/http1-server.ts — gather write of output and the body, copy only the unsent remainder, fall back to write for chunked, compressed or TLS — see Direct body
      - id: http1-tests
        content: Add tests/link cases for full send, partial send (small SO_SNDBUF), pipelined responses ahead in output, and the fallback framings — see Tests
      - id: http1-docs
        content: Document sendBody in docs/guide/using-nish/standard-library.md (nish/net section) and the docs/security/http1-codec.md record — see Direct body
  - id: ring-inplace-bench
    title: "perf(runtime): benchmark ring records copied versus in place"
    goal: A benchmark pushes 1–10 KB records producer to ring to HTTP consumer to socket, with and without the in-place path, and reports ns per message and bytes copied
    verification: npm run lint && node bench/ring-inplace/run.mjs --quick && node docs/check-links.mjs
    todos:
      - id: bench-program
        content: Write bench/ring-inplace (a Nish program in two processes plus run.mjs) covering the copy path and the in-place path at 1, 4 and 10 KB — see Benchmark
      - id: bench-report
        content: Record the results with their noise band in docs/wp47-shared-memory.md section 7 and the ring row of docs/guide/using-nish/standard-library.md — see Benchmark
---

# Ring in place

## Context

The multicore-server-challenge read service renders each JSON answer (1–10 KB) into a private `u8[]`, copies it into a per-worker 16 MB [`SpscRing`](../../std/sync/ring.ts), and the HTTP worker copies it out of the ring into `Http1Connection.output` before `netWrite`. `__memmove_avx512_unaligned_erms` is 19% of the read service's samples. Two copies per message exist only because nothing can address ring memory as a `u8[]`.

Facts the plan rests on:

- A region deliberately has no array over it ([wp47 §2](../../docs/wp47-shared-memory.md)); every access is a checked `nishshm_*` call. FFI may not return `u8[]` (`reject_ffi_string_array_return`, [LANGUAGE.md](../../docs/LANGUAGE.md) FFI section). So a `u8[]` window needs a compiler-known intrinsic.
- A `u8[]` is a pointer to a 24-byte header `{len, cap, data}` ([nish.h](../../runtime/nish.h)). Arenas never free `data`; `nish_array_grow` repoints `data` to a fresh arena block. Array params get `readonly`/`nocapture`/`dereferenceable(24)` but never `noalias` ([attributes.ts](../../src/attributes.ts)).
- [`Http1Connection.write`](../../std/net/http1-server.ts) always copies into `output`; `Http1Server.send` is one `netWrite` of `output[outputStart, outputEnd)`. There is no gather write.
- `netWrite` is a `nish:net` builtin (`src/nish-modules.ts`, `src/builtins.ts`, `src/emit-builtins.ts`, `runtime/runtime-net.c`), so a two-buffer write is a builtin too.

## Approach

**The window is a real `u8[]`.** A view type would force every writer the read service uses (`copyBytes`, the `std/json.ts` position writers) to be ported, and each byte would be a checked runtime call. An aliased `u8[]` keeps them unchanged. Soundness is kept by these rules:

| Hazard | Rule |
|---|---|
| Use after commit or release | The header is owned by the runtime, not the arena. `giveBack` stores `len = cap = 0`, so every later index fails its bounds check. The same holds for every copy of the reference, because a `u8[]` value is the header pointer. |
| Use after `close` | `close` zeroes every header it lent and sets `data = NULL` before `munmap`. A stale window is empty, never dangling. |
| `push` past `cap` | `cap == len`, so a push grows the array and detaches it into the arena. `giveBack`/`commit` sees `data` is no longer the lent address and panics with a named message, so a write that went nowhere is never published silently. |
| Arena rewind frees the header | Headers come from a per-region runtime pool (malloc'd, reused, freed only at close). They are never arena-allocated. |
| A peer racing the bytes | Same as `read`/`write` today: torn bytes, never out of bounds. Bounds come from the private header, not from the shared memory. |

**Lifetime is a reuse rule, not an allocation.** Each ring keeps one producer window and one consumer window, and `reserve`/`peek` answer the same array object each time, re-pointed. So the busy path makes no allocation and no system call. A reference kept across `commit` sees the next window or an empty one, never memory outside the region. The docs say so.

**The consumer never lends ring bytes past a call.** `Http1Connection.sendBody` makes the send attempt immediately: one `netWrite2` of the queued output and the body. It copies only an unsent remainder into `output`, then returns. The caller `release`s right after, so records are released in FIFO order and http1-server needs no knowledge of `nish/sync`. `sendBody` takes any `readonly u8[]`, so a private buffer gets the same saving.

**Memory ordering is unchanged.** `commit` is the same `RELEASE` (or `SEQ_CST` + doorbell) store of the tail that `tryPush` makes after its copy. `peek` is the same `ACQUIRE` load of the tail that `tryPop` makes. `release` is the same `RELEASE` store of the head. The bytes the program wrote into the window are plain stores ordered before that store, the way `region.write`'s are today. An opaque runtime call receives the header pointer, so LLVM cannot sink them past it.

## Window builtins

Stage `window-builtins`.

**Owns:** `src/**`, `runtime/**`, `std/sync/shm.ts`, `tests/cases/**`, `tests/ir/**`, `tests/link/sync_shm*/**`, `tests/link/net_write2*/**`, `tests/nish/**`, `tests/differential/**`, `tests/self/**`, `tests/run.js`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/AI.md`, `llms.txt`, `docs/guide/using-nish/shared-memory.md`, `docs/guide/using-nish/networking.md`, `docs/security/shm.md`, `docs/security/runtime.md`, `docs/security/README.md`, `THIRD_PARTY_NOTICES.md`

```ts
// std/sync/shm.ts
class SharedRegion {
  /** A u8[] of `len` bytes aliasing the region at `at`; empty after giveBack or close. */
  lend(at: i32, len: i32): u8[]
  /** Ends a window: panics if it grew away from the region; answers its length. */
  giveBack(window: u8[]): i32
}
// nish:net
declare function netWrite2(fd: i32, a: readonly u8[], aOff: i32, aLen: i32, b: readonly u8[], bOff: i32, bLen: i32): i32
```

- The worker picks how std reaches the intrinsic: a builtin `nish:` export, or an intrinsic the checker allows only for `std/sync/shm.ts`. Either way, a user program cannot make a `u8[]` over arbitrary memory. The choice and its reason go in LANGUAGE.md.
- Pick a `lend` signature that lets a ring re-point one header instead of taking a new one per call. One way is `lend(at, len, reuse: u8[] | null)`. Write the reuse rule down.
- `netWrite2` checks both ranges as `netWrite` does and answers bytes written (≤ aLen + bLen) or the same error codes. It is native only. `--emit-ts`, Node and wasi refuse or answer as `netWrite` does there.
- The `src/` rolling freeze holds: `src/` must not call either builtin. `node tests/run.js wasi` (`WASI_SYSROOT=/usr`) and `node tests/run.js performance` run before every push. Regenerate goldens with `node tests/self/goldens.js --update`, and register new positive `tests/cases/*` with `node tests/differential/goldens.js --update`.
- Security: `runtime-shm.c` and `runtime-net.c` changes land with their records (findings fixed with a before/after test, or recorded open). `node scripts/security-scope.mjs` stays green.

## Two-buffer write

Part of stage `window-builtins`, listed above. One `writev` (Linux and Darwin) with `MSG_NOSIGNAL` semantics matching `netWrite`'s SIGPIPE handling. A short write is answered as a count. Retrying is the caller's job, as with `netWrite`.

## Ring format

Stage `ring-reserve-peek`.

**Owns:** `std/sync/ring.ts`, `tests/link/sync_ring*/**`, `docs/guide/using-nish/shared-memory.md`, `docs/wp47-shared-memory.md`, `docs/security/shm.md`, `examples/prefork-jobs.ts`

- A skip marker is a length word with a reserved value at a 4-aligned position, meaning "the rest of this lap is padding". Positions are 4-aligned, so at least 4 bytes always remain for it. `tryPop`, `popBatch`, `popWait`, `peek` and `lengthAt`'s corruption check all step over it.
- `reserve(n)` is limited to `n ≤ capacity / 2 - 4` and panics above. With that limit, an empty ring always has room for a padded window, so `reserve` can never fail forever on an empty ring. `tryPush` keeps its current limit and its wrapping behaviour.
- Decide whether the format change needs a new magic. A peer built against the old format would panic on a marker. Record the decision in the module doc.

## Producer API

```ts
const w: u8[] = ring.reserve(n)  // empty (length 0) when there is no contiguous room now; never blocks
copyBytes(w, 0, body, 0, k)      // any u8[] writer, within w.length
ring.commit(len)                 // publishes w[0, len) as one record; len ≤ n
ring.abandon()                   // drops the reservation, publishing nothing
```

- "Fails" is an empty window, so the busy path allocates nothing. Use the module's own convention (`RING_EMPTY`) if a code is needed.
- `reserve` while a reservation is open, `commit` without one, or `len > n` panics.
- Cross-process: the consumer in another process sees exactly `w[0, len)`.

## Consumer API

```ts
const r: readonly u8[] = ring.peek()  // the next record in place; empty when none
conn.sendBody(r, 0, r.length)
ring.release()                        // frees it for the producer
```

- A record that `tryPush` wrapped across the end cannot be lent contiguously. In that case `peek` answers `RING_WRAPPED` (or an equivalent the worker documents), and the caller uses `tryPop`. Records written by `reserve` never wrap.
- `peek` on an empty ring makes no system call. A waiting variant (`peekWait`) goes through the same doorbell as `popWait`. Include it only if it adds no system call on the busy path.

## Direct body

Stage `http1-direct-body`.

**Owns:** `std/net/http1-server.ts`, `tests/link/net_http1_server*/**`, `docs/guide/using-nish/standard-library.md`, `docs/security/http1-codec.md`

- `sendBody(buf, off, len)` is valid after `respond(..., bodyLength)` under content-length framing. It sends `output[outputStart, outputEnd)` and the body in one `netWrite2`, advances `consume`, copies any unsent body remainder into `output` (the existing `write` path, including `H1_AGAIN` semantics), and keeps no reference to `buf`.
- Chunked framing, a compressed response, `Http1TlsServer`, or output already blocked behind an earlier `H1_AGAIN`: it degrades to `write(buf, off, len)`. The result is identical bytes, with today's copy. The doc says which cases copy.
- Answers the same codes as `write`. A second `sendBody` past `bodyLength` panics as `write` does.

## Benchmark

Stage `ring-inplace-bench`.

**Owns:** `bench/ring-inplace/**`, `docs/wp47-shared-memory.md`, `docs/guide/using-nish/standard-library.md`, `bench/README.md`

- Two processes, one region, one 16 MB `SpscRing`, pinned with `taskset` like [`bench/ring-latency/run.mjs`](../../bench/ring-latency/run.mjs). The producer renders a JSON body of 1, 4 and 10 KB with `std/json.ts` writers. The consumer frames an HTTP/1.1 response through `Http1Connection` and sends it into a socketpair drained by a third reader.
- Two modes: **copy** (render into `u8[]`, `tryPush`, `tryPop`, `write`) and **in place** (`reserve`, render, `commit`, `peek`, `sendBody`, `release`).
- Report ns per message (median and p99 over ≥5 rounds, with the noise band from two runs of the same mode) and bytes copied per message. Bytes copied are counted by the program, not estimated: the bytes the copy path moves through `write`/`tryPush`/`tryPop`, and the in-place path's remainder copies.
- `--quick` runs a few thousand messages so the verification line finishes in seconds. The results table goes in wp47 §7.

Generated files every stage may rewrite with the repo's tooling, never by hand: `tests/self/goldens/checked/**` (`node tests/self/goldens.js --update`) and `tests/differential/*known*.txt`. They are outside every `Owns` set, and a conflict in one is regenerated.

Merge-order edges: `ring-reserve-peek` and `http1-direct-body` start after `window-builtins` merges (they consume its interface) and are disjoint from each other. `ring-inplace-bench` starts after both merge.

## Out of scope

- `MpscRing` in place (fixed slots make it a separate design).
- Porting the external submission (`submissions/nish-std-amritk`). It is not in this repo. The benchmark stands in for it.
- HTTP/2, HTTP/3 and the TLS server's zero-copy path.
- `sendfile`/`splice` or other kernel zero-copy.

## Tests

- `window-builtins`:
  - golden `.ll` for each intrinsic in `tests/cases/`, with an `llvm-as` pass
  - native round trip in `tests/link/sync_shm*` (lend, write with `copyBytes`, another process reads)
  - negative tests: index after `giveBack`, index after `close`, `push` then `giveBack` panics, `lend` outside the region panics
  - a `tests/link/net_write2` round trip over a socketpair, including a partial write
- `ring-reserve-peek`: cross-process in-place records across ≥3 laps of mixed 1–10 KB sizes; mixed `tryPush` and `reserve`; `peek` of a wrapped `tryPush` record; a full ring makes `reserve` answer empty; the existing `sync_ring` expectations unchanged.
- `http1-direct-body`: full send, partial send under a small `SO_SNDBUF`, a pipelined response already queued, the chunked/compressed fallbacks byte-identical to `write`.

## Verification

Per stage, the `verification` line. A `src/` stage also runs `node tests/run.js wasi` (read its skip line) and `node tests/run.js performance`. The full suite is CI's eight `test` shards, each read for its skip count.
