---
name: Server pools borrow their buffers
overview: The HTTP/1.1, TLS, HTTP/2 and QUIC/HTTP/3 server pools stop preallocating every buffer per slot and borrow them from a pool their server shares, so the interop server serves 1,024 slots of all four protocols under 1 GB and listens within a second, with throughput, flat-arena guarantees and wiping unchanged.
stages:
  - id: interop-slots
    title: "test(interop): --slots sizes every pool, and the harness that measures memory and throughput"
    goal: Make the cost measurable without editing source — one flag sizes all four pools, one script reports resident memory and time to listen, two scripts report throughput with a noise band — and record the baseline on main.
    verification: node tests/run.js net_interop_server && npm run check && npm run lint && node bench/pool-rss.mjs --slots 16,64
    todos:
      - id: slots-flag
        content: Add --slots to parseServe in tests/link/net_interop_server/cli.ts, bounded 1 to 4096, with its usage line in main.ts and refusal checks in checks.ts and expected.out — see Interop slots
      - id: slots-all-pools
        content: Size the HTTP/1.1, HTTPS/1.1 and HTTP/2 pools from options.slots in server.ts as HTTP/3 already is, and correct the stale cost comment at server.ts:58 — see Interop slots
      - id: pool-rss
        content: Add bench/pool-rss.mjs, which starts the interop server per slot count, times exec to all four ports listening, and reads VmRSS and VmHWM — see Measurement harness
      - id: http-bench
        content: Add bench/http.mjs (HTTP/1.1 keep-alive load against the h1 port) and bench/h2load.mjs (h2load against HTTPS/1.1, HTTP/2 and HTTP/3), both with interleaved A/A rounds for the noise band — see Measurement harness
      - id: baseline
        content: Record the baseline on main in bench/README.md — RSS and time to listen at 16, 64, 256 and 1024 slots, per-pool attribution, and throughput with its noise band — see Measurement harness
  - id: http1-pool
    title: "perf(std): HTTP/1.1 slots borrow their output buffer from a pool"
    goal: Introduce the shared byte-buffer pool and apply it to HTTP/1.1, which sets the borrow, give-back and wipe rules the other three stages copy.
    verification: node tests/run.js net_http1 && node tests/run.js net_buffer_pool && npm run check && npm run lint
    todos:
      - id: buffer-pool
        content: Add std/net/buffer-pool.ts, a pool of fixed-size byte buffers that lends on borrow, zeroes the used extent on give-back, grows to its high-water mark and then allocates nothing — see Buffer pool
      - id: http1-output-pool
        content: Add Http1OutputPool to std/net/http1-server.ts and make Http1Server and Http1TlsServer slots borrow their output buffer when they first need room and give it back once it is flushed — see HTTP/1.1
      - id: http1-tests
        content: Add tests/link/net_buffer_pool and extend tests/link/net_http1_server with the pool checks (flat arena on a warm slot, lent count, zeroed reuse) — see Tests
      - id: http1-docs
        content: Update docs/security/http1.md and the HTTP/1.1 server entry in docs/guide/using-nish/standard-library.md — see HTTP/1.1
  - id: tls-pool
    title: "perf(std): TLS record buffers are borrowed per connection and wiped when given back"
    goal: TlsTcpServer slots borrow their record output, plaintext, scratch and reader buffers from pools the server owns, so an idle or empty slot holds none of them.
    verification: node tests/run.js net_tls && node tests/run.js net_http2_tls && node tests/run.js net_http1_server && npm run check && npm run lint
    todos:
      - id: tls-borrow
        content: Make TlsRecordServer borrow output, plain, scratch and the TlsRecordReader buffer from pools owned by TlsTcpServer, keeping the public constructors unchanged — see TLS
      - id: tls-giveback
        content: Give each buffer back when the slot is idle (output flushed, no partial record held) or closed, with secureZero over its used extent first — see TLS
      - id: tls-tests
        content: Extend tests/link/net_tls_memory, net_tls_record_tcp and net_tls_wipes with the pool checks, and update the recorded per-slot figures — see Tests
      - id: tls-docs
        content: Add the buffers that move between connections to docs/security/tls.md — see TLS
  - id: http2-pool
    title: "perf(std): HTTP/2 connections borrow their frame buffers from the server's pool"
    goal: Http2Connection borrows its input, output and header-block buffers, so a slot with no connection or an idle connection holds none of them.
    verification: node tests/run.js net_http2 && npm run check && npm run lint
    todos:
      - id: h2-borrow
        content: Make Http2Connection borrow input, output and block from pools owned by Http2TlsServer, with a private pool for a standalone Http2Connection so its constructor is unchanged — see HTTP/2
      - id: h2-giveback
        content: Give each back when it is empty (no partial frame, output flushed, no header block in progress) or the connection ends, zeroing the used extent — see HTTP/2
      - id: h2-tests
        content: Extend tests/link/net_http2 and net_http2_tls with the pool checks — see Tests
      - id: h2-docs
        content: Add the buffers that move between connections to docs/security/http2.md — see HTTP/2
  - id: quic-h3-pool
    title: "perf(std): QUIC streams borrow their buffers on first use and give them back once acknowledged"
    goal: Remove the 80 × 147,456 bytes of stream buffers every QUIC slot preallocates (98% of the interop server's footprint) and pool the Http3Connection buffers beside them.
    verification: node tests/run.js net_quic && node tests/run.js net_http3 && node tests/run.js net_webtransport && node tests/run.js net_interop_server && npm run check && npm run lint
    todos:
      - id: quic-stream-borrow
        content: Make QuicStream borrow recvBuf and recvHave when it first receives data and sendBuf and sendAcked when it first sends, from a pool Http3Server owns and shares across its QuicConnections — see QUIC and HTTP/3
      - id: quic-stream-giveback
        content: Give the receive side back once the application has read to the final size or the stream is reset, and the send side once every byte is acknowledged or the stream is reset, zeroing the used extent — see QUIC and HTTP/3
      - id: h3-conn-borrow
        content: Make Http3Connection borrow data and section from pools on Http3Server and give them back between requests — see QUIC and HTTP/3
      - id: quic-tests
        content: Extend net_quic_stream, net_quic_memory, net_http3, net_http3_server and net_webtransport with the pool checks — see Tests
      - id: quic-docs
        content: Add the buffers that move between connections to docs/security/http3.md and docs/security/quic.md — see QUIC and HTTP/3
---

# Server pools borrow their buffers

## Context

The interop server (`tests/link/net_interop_server`) is resident at 222 MB with 16 slots, 821 MB with 64, and 3.2 GB with 256. With 1,024 slots it still has not started listening after 30 s. A read of the constructors puts **98% of that in QUIC stream buffers**. Each QUIC slot builds 80 `QuicStream`s ([quic-stream.ts:262-266](std/net/quic-stream.ts)), and each stream preallocates recvBuf 65,536 B + recvHave 8,192 B + sendBuf 65,536 B + sendAcked 8,192 B = 147,456 B. That is 11.8 MB per slot whether the slot is used or not.

The other estimated per-slot costs (read from the code, not measured; stage `interop-slots` measures them):

| Pool | Largest buffers per slot | Per slot |
|---|---|---|
| QUIC + HTTP/3 | stream buffers 11.8 MB; key slots ~28 KB; `cryptoIn` 18 KB; datagram rings 19 KB; `Http3Connection` ~43 KB; `WebTransport` ~10 KB | ~12.1 MB |
| HTTP/2 over TLS | TLS `output` 33 KB, `plain` 32 KB, `scratch` 16 KB, reader 16 KB; H2 `output` 64 KB, `input` 16 KB, `block` 16 KB | ~226 KB |
| HTTP/1.1 over TLS | TLS ~110 KB; `output` 8 KB (interop config) | ~121 KB |
| HTTP/1.1 | `output` 8 KB; parser and WebSocket ~3 KB | ~11 KB |

Two facts the request assumed are not true on `main` at 99b81d2:
- **`Http1OutputPool` does not exist.** No branch or PR has it, and [http1-server.ts:1016](std/net/http1-server.ts) still allocates every slot's buffers in the constructor. Stage `http1-pool` builds it first, and the other stages copy its pattern.
- **`--slots` sizes only HTTP/3.** `options.slots` ([server.ts:62](tests/link/net_interop_server/server.ts)) feeds the `Http3Server` alone. HTTP/2 is a literal 64 (`:158`), and both HTTP/1.1 pools are a literal 16 (`:156`). `bench/http.mjs` does not exist, and nothing in the repo runs h2load. Stage `interop-slots` adds both.

## Approach

**One pool primitive, one rule set, four consumers.** `std/net/buffer-pool.ts` lends fixed-size `u8` buffers. Every pool in this plan is an instance of it, owned by the *server* (`Http1Server`, `TlsTcpServer`, `Http2TlsServer`, `Http3Server`) and shared by that server's slots. The rules:

1. **Borrow when the slot first needs room.** A slot or stream that has not written or received anything holds no buffer.
2. **Give back once its bytes are done.** Output goes back when it has been sent, or, for QUIC send data, acknowledged. Input goes back when it has been consumed and no partial unit (record, frame, header block) is held. Everything goes back when the connection ends.
3. **Zero what was used before giving it back.** The pool tracks how far into the buffer the borrower wrote, and the give-back zeroes `[0, used)`. TLS buffers use `secureZero` (they hold decrypted plaintext, and handshake bytes under handshake keys). The others use a plain fill. The cost scales with bytes moved, not with buffer size. **Nothing a connection wrote is readable by the next connection that borrows the buffer.**
4. **The pool grows to its high-water mark, then allocates nothing.** It never shrinks. After warm-up a borrow pops a free list. That keeps `Arena.used()` flat on a warmed slot and keeps every record and datagram allocation-free: the existing 0-byte checks keep passing unchanged, and each stage adds one that runs *after* warm-up.
5. **The pool never runs dry.** Its ceiling is what preallocation would have cost (slots × buffers per slot), so behaviour under full load is the old behaviour, and only idle capacity stops costing memory. A borrow therefore cannot fail, and no new error path or flow-control stall is introduced.
6. **Public constructors keep their signatures.** A standalone `Http2Connection` or `QuicConnection` (as the unit tests build them) gets a private pool of its own. Only the server types share one. No guide page moves except the HTTP/1.1 one, if `Http1Config` gains anything.
7. **Small key-bearing arrays stay per slot.** Traffic secrets, AES schedules and `TlsServer`'s secret pools are a few KB each, are already wiped by `wipeKeys` / `wipeHandshake` / `wipeAll`, and do not move between connections.

## Interop slots

**Owns:** `tests/link/net_interop_server/**`, `bench/pool-rss.mjs`, `bench/http.mjs`, `bench/h2load.mjs`, `bench/README.md` (stage `interop-slots`, with Measurement harness below)

- `cli.ts`: `--slots <n>` becomes another `else if` branch in `parseServe` (`cli.ts:44-76`). It parses with `decimal()`. A value outside 1 to 4096 is refused after the loop with `"--slots wants a count from 1 to 4096"` (exit 2, as the port refusals). The usage header in `main.ts:4-8` gains the line.
- `server.ts`: `options.slots` sizes all four pools. The stale comment at `:58-61` is rewritten with the figures the `baseline` todo measures.
- `checks.ts` and `expected.out`: a refusal check for `--slots 0` and `--slots x`. The carrier checks keep `options.slots = 4`.

## Measurement harness

All of it lives in `bench/` and drives the interop server binary. Build the binary first with `build/nish tests/link/net_interop_server/main.ts -o build/interop.ir/ --link build/interop`; the scripts take the binary's path with `--bin`.

- **`bench/pool-rss.mjs --slots 16,64,256,1024 [--timeout 30]`**: for each count it starts `serve --slots N` on free ports and polls the four ports until each accepts (TCP connect for HTTP/1.1, HTTPS/1.1 and HTTP/2; for QUIC, either a UDP probe answered by Version Negotiation or a bind on the port that fails). It reports exec-to-listening time, then `VmRSS` and `VmHWM` from `/proc/<pid>/status`, and kills the server. A count that misses the timeout is reported as such, not dropped.
- **Per-pool attribution**: the same script with `--only h1|h1s|h2|h3`, which passes `serve --only <pool>`. The interop CLI gains `--only` beside `--slots`: it builds just that pool, appears in the usage header, and refuses any other value with exit 2.
- **`bench/http.mjs`**: HTTP/1.1 keep-alive load from Node's `http.Agent` against the h1 port, with C connections for D seconds (defaults 64 and 10), requests per second as the result. With `--against <bin2>` it interleaves rounds of two binaries. With the same binary on both sides it is the noise band, per CLAUDE.md's `Measured:` rule.
- **`bench/h2load.mjs`**: the same interleaving around `h2load` for HTTPS/1.1 (`--h1`), HTTP/2, and HTTP/3 (`--alpn-list=h3`). `h2load` comes from `nghttp2-client` (`sudo apt-get install -y nghttp2-client`). If the installed `h2load` was built without HTTP/3, the script says so on stderr and drives HTTP/3 with the interop server's own client (`tests/link/net_interop_server/client.ts`) in a request loop instead. `bench/README.md` records which load generator produced each figure.
- **`baseline`**: run all three on `main` at 99b81d2 and record the tables in `bench/README.md`. Later stages copy figures from there, never from a PR body.

## Buffer pool

**Owns:** `std/net/buffer-pool.ts`, `std/net/http1-server.ts`, `tests/link/net_buffer_pool/**`, `tests/link/net_http1_server*/**`, `docs/security/http1.md`, `docs/guide/using-nish/standard-library.md` (stage `http1-pool`, with HTTP/1.1 below)

```ts
// std/net/buffer-pool.ts — sketch; the stage settles names against .claude/typescript.md
export class BufferPool {
  constructor(bufferSize: i32, ceiling: i32)  // ceiling = most buffers ever lent at once
  borrow(): i32                               // index of a lent buffer; grows the pool below the ceiling
  bytes(index: i32): u8[]                     // the buffer itself
  giveBack(index: i32, used: i32, secret: boolean): void  // zeroes [0, used), secureZero when secret
  lent(): i32                                 // buffers out now
  highWater(): i32                            // buffers ever allocated
}
```

Indices rather than array references, so a slot holds an `i32` (-1 for none) and a double give-back or a use after give-back can be caught by a debug check. Sizes are fixed per pool. A server that needs two sizes owns two pools.

## HTTP/1.1

- `Http1OutputPool` wraps a `BufferPool` sized by `config.outputSize`, with the ceiling set to the pool's slot count. `Http1Server` and `Http1TlsServer` each own one.
- A slot borrows `output` on its first write that needs room. It gives it back when every byte has been flushed to the socket and the connection is waiting for a next request, or when the connection ends. `data` stops aliasing a permanent buffer.
- The parser and WebSocket buffers (~3 KB) stay per slot.
- `docs/security/http1.md` "What is and is not wiped" says the output buffer is now zeroed over its used extent when it goes back. `standard-library.md` notes that a slot's output memory is lent, not reserved.

## TLS

**Owns:** `std/net/tls-tcp.ts`, `std/net/tls.ts`, `std/net/tls/**`, `tests/link/net_tls_*/**`, `docs/security/tls.md` (stage `tls-pool`)

- `TlsTcpServer` owns four `BufferPool`s: record output (33,290 B), plaintext (32,768 B), scratch (16,384 B), reader (16,645 B). `TlsRecordServer` borrows at the first byte of a handshake. It gives a buffer back when the slot is idle (output flushed, reader holding no partial record, no plaintext unread by the application) or closed, always with `secureZero` over the used extent.
- The 2,048 B `TlsServer` input and its handshake flight buffer are measured. Pool them too if they are more than 5% of the slot after the four above, else leave them and say so.
- `Http1TlsServer` and `Http2TlsServer` need no change: the pools sit inside `TlsTcpServer`.
- `docs/security/tls.md` gains a section "What moves between connections" naming each pooled buffer, what it held, and the wipe. The slot-reuse text at `:50-60` and `:322-343` points to it, and "No key reaches another connection" (`:338`) stays true and is restated with the new evidence.

## HTTP/2

**Owns:** `std/net/http2.ts`, `std/net/http2-tls.ts`, `tests/link/net_http2*/**`, `docs/security/http2.md` (stage `http2-pool`)

- `Http2TlsServer` owns pools for `input` (maxFrameSize + 9), `output` (65,536) and `block` (16,384). `Http2Connection` borrows each when it first needs it and gives it back when it is empty. A standalone connection makes a private pool of ceiling 1.
- The 100 `Http2Stream`s and the HPACK tables stay per slot. The stage records their size in the PR, and they are left for a later change.
- `docs/security/http2.md` "What is and is not wiped" (`:179-187`) gains the moved buffers.

## QUIC and HTTP/3

**Owns:** `std/net/quic*.ts`, `std/net/http3*.ts`, `std/net/webtransport.ts`, `tests/link/net_quic_*/**`, `tests/link/net_http3*/**`, `tests/link/net_webtransport*/**`, `docs/security/http3.md`, `docs/security/quic.md` (stage `quic-h3-pool`)

Every stage that touches `std/` also regenerates the generated goldens, `tests/self/goldens/checked.txt` and `checked-self.txt`, with `node tests/self/goldens.js --update`. These are not owned; on a conflict they are regenerated after merging `main`.

- `Http3Server` owns four stream pools: recvBuf, recvHave, sendBuf and sendAcked, each sized by `maxStreamData` and its bitmap. The ceiling is slots × streams per slot. It hands them to each `QuicConnection` → `QuicStreams`. A `QuicConnection` built alone makes a private pool with the old per-connection ceiling.
- **Receive side**: borrowed on the first STREAM frame carrying data. Given back once the application has read to the final size, or on RESET_STREAM / STOP_SENDING closure.
- **Send side**: borrowed on the first write. Given back once every sent byte is acknowledged (the `sendAcked` bitmap is full to the final size), or on reset. **Retransmission reads from sendBuf, so the send buffer must not go back before acknowledgement.** That is the rule the user named, and the one most likely to be got wrong.
- `QuicStream.open` today clears only the bitmaps (`quic-stream.ts:311-315`), so a reused data buffer holds the previous stream's plaintext. The zero-on-give-back rule closes that, across connections as well as within one.
- `Http3Connection`'s `data` and `section` (16,384 B each) go into pools on `Http3Server` and are given back between requests. `cryptoIn`, the datagram rings and the key slots stay per slot. The stage records their total, which is small next to the 11.8 MB.
- `docs/security/http3.md` "What is and is not wiped" (`:248-262`) and `docs/security/quic.md` Q4 (`:215-285`, "every buffer a peer fills is fixed") are updated: buffers are still fixed in size, but are now lent, and are zeroed when given back.

## Tests

Each pooled stage adds, in its own `tests/link/` directories:
- **Flat after warm-up**: on a warmed slot, N more requests or connections through the pool move `Arena.used()` by 0 bytes. The existing 0-byte checks (`net_http1_server/checks.ts:423`, `net_tls_record_tcp/checks.ts:134`, `net_http2/checks.ts:527`, `net_http3/arena.ts`, `net_quic_memory/checks.ts:323`, `net_webtransport/arena.ts:211`) must pass unchanged.
- **Idle holds nothing**: a server whose connections have all ended reports `lent() == 0`.
- **Zeroed reuse**: connection A writes a known pattern, ends; connection B borrows the same index and reads zeros over A's used extent. This check must fail if the give-back's zeroing is removed. Run it once with zeroing disabled and say so in the PR.
- **Memory at size**: a server built with 1,024 slots and no connections holds no pooled buffers (`highWater() == 0`).
- QUIC only: **no give-back before ack**. A stream whose last segment is lost and retransmitted still holds its send buffer until the ack arrives, and the retransmitted bytes match.

Each stage records in its PR body the `bench/pool-rss.mjs --only <pool>` figures before and after, and the throughput delta with its noise band from `bench/http.mjs` or `bench/h2load.mjs`. The commit body carries the same figures as `Measured:`.

## Out of scope

- HPACK and QPACK table memory, `Http2Stream` structs, QUIC key slots and recovery tables: per-slot, small, measured and reported, not pooled.
- Shrinking a pool after a peak.
- The interop app's own per-stream `InteropStream` input (80 × 1,024 B per slot, `app.ts:68`).
- Any `src/` change. This is all `std/`, `tests/` and `bench/`.

## Verification

Per stage, as in its `verification` line, plus the repo's definition of done: `npm run check` and an undegraded `npm test` (zero toolchain skips). `std/` changes move `tests/self/goldens/checked.txt`, which is regenerated with `node tests/self/goldens.js --update`, never edited.

Merge order: `interop-slots` and `http1-pool` first, in either order. `tls-pool`, `http2-pool` and `quic-h3-pool` start once `http1-pool` has merged (they use `std/net/buffer-pool.ts`) and merge in any order.
