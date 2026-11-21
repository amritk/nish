---
name: WP76 — an HTTP/2 client, sans-IO first, then under both fetch clients
overview: std/net speaks HTTP/2 only as a server; nish/net/fetch is HTTP/1.1, so a Nish client cannot multiplex requests on one connection, reach an h2-only endpoint, or carry a gRPC call (WP72 D3). Build a sans-IO client connection on the existing frame and HPACK code (S1), negotiate h2 by ALPN under both fetch clients by default, with an option to turn it off (S2), and multiplex the async fetch's concurrent requests over one pooled connection (S3).
priority: 140
labels: [ready]
stages:
  - id: s1-connection
    title: WP76 S1 — nish/net/http2-client, a sans-IO HTTP/2 client connection, with its security record
    goal: std/net/http2-client.ts opens streams, sends requests and bodies under both flow-control windows, and answers response heads, data, trailers, resets and GOAWAY as events, driven in-process against the existing Http2Connection server and refusing every protocol error of RFC 9113 a client can see with a code.
    verification: node tests/run.js net_http2_client && node tests/run.js net_http2 && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s1-module
        content: Add std/net/http2-client.ts with Http2ClientConnection (feed, next, request, writeData, writeTrailers, reset, goaway, output window) and Http2ClientConfig, registered in stdModuleNames — see WP76 S1
        status: pending
      - id: s1-protocol
        content: Implement the preface and SETTINGS exchange, odd stream ids, both flow-control windows, CONTINUATION, PING and SETTINGS acks, push refused and GOAWAY's last-stream-id with unprocessed streams reported retryable — see WP76 S1
        status: pending
      - id: s1-fields
        content: Decode response heads and trailers with HpackDecoder and HttpFields.readResponse and readTrailers, and encode requests with HpackEncoder after httpFieldsCheckOutgoing — see WP76 S1
        status: pending
      - id: s1-tests
        content: Add tests/link/net_http2_client driving the client against Http2Connection in memory, plus a scripted server provoking each connection and stream error — see WP76 S1
        status: pending
      - id: s1-record
        content: Write docs/security/http2-client.md with its README row and add the module to std/README.md and standard-library.md — see WP76 S1
        status: pending
  - id: s2-fetch-h2
    title: WP76 S2 — h2 negotiated by ALPN under fetchSync, FetchSyncClient and fetch, on by default
    goal: Unless HttpOptions.http2 is cleared, an https fetch offers h2 and http/1.1 by ALPN and, when the server picks h2, sends the request as one stream and answers the same HttpResponse or FetchResponse an HTTP/1.1 fetch would, with redirects, proxies, timeouts and the body limit unchanged.
    verification: node tests/run.js net_http_fetch && node tests/run.js net_http2_client && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s2-option
        content: Add HttpOptions.http2, default true, to std/net/fetch.ts and offer ALPN h2 and http/1.1 in httpClientTlsStart unless it is cleared — see WP76 S2
        status: pending
      - id: s2-sync
        content: Run a fetch over Http2ClientConnection when ALPN picks h2, with HttpBodyReader reading DATA frames and FetchSyncClient keeping the connection for the next fetch to the same origin — see WP76 S2
        status: pending
      - id: s2-async
        content: Run the async fetch over the same connection type when ALPN picks h2, one stream per fetch — see WP76 S2
        status: pending
      - id: s2-tests
        content: Add h2 cases to tests/link/net_http_fetch_tls against Http2TlsServer and a tests/run.js check against a Node http2.createSecureServer — see WP76 S2
        status: pending
      - id: s2-record
        content: Update docs/security/fetch.md and docs/guide/using-nish/http-client.md for the h2 path — see WP76 S2
        status: pending
  - id: s3-multiplex
    title: WP76 S3 — concurrent async fetches multiplexed over one pooled h2 connection
    goal: Async fetches to one origin share one h2 connection from a FetchPool, up to the server's SETTINGS_MAX_CONCURRENT_STREAMS, so awaitAll of N fetches opens one TLS connection, and a GOAWAY or a dead connection retries only the streams the server did not process.
    verification: node tests/run.js net_http_fetch && node tests/run.js net_http2_client && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s3-pool
        content: Let FetchPool in std/net/fetch.ts hold one h2 connection per origin and hand a stream to each fetch, parking a fetch past the concurrent-stream cap until one closes — see WP76 S3
        status: pending
      - id: s3-retry
        content: Retry a fetch on a fresh connection only when GOAWAY or REFUSED_STREAM says its stream was not processed, never a POST that may have been — see WP76 S3
        status: pending
      - id: s3-tests
        content: Add cases for one connection under awaitAll, the stream cap, GOAWAY mid-flight and a refused stream, with the arena flat over many fetches — see WP76 S3
        status: pending
      - id: s3-docs
        content: Update docs/security/fetch.md and the http-client guide page for pooled h2 connections — see WP76 S3
        status: pending
---

# WP76 — an HTTP/2 client

## Context

HTTP/2 in `std/net` is a server: [`Http2Connection`](../../std/net/http2.ts) (sans-IO), [`Http2TlsServer`](../../std/net/http2-tls.ts) and h2c ([`http2-cleartext.ts`](../../std/net/http2-cleartext.ts)). Nothing implements the client role. [`nish/net/fetch`](../../std/net/fetch.ts) offers only `http/1.1` by ALPN (`httpClientTlsStart`, fetch.ts:1740–1756).

The pieces a client needs are already direction-neutral:

| Piece | Where |
| --- | --- |
| Frame parse and write (`http2ParseFrame`, `http2WriteHeaders`, `http2WriteData`, `http2WriteSettings`, …) and the `H2_*` constants | [`std/net/http2-frame.ts`](../../std/net/http2-frame.ts) |
| `HpackEncoder`, `HpackDecoder` | [`std/net/hpack.ts`](../../std/net/hpack.ts) |
| `HttpFields.readResponse`, `readTrailers`, `httpFieldsCheckOutgoing` | [`std/net/http-fields.ts`](../../std/net/http-fields.ts) |
| The client connection preface | `http2-cleartext.ts`:92–103 |
| A scripted client that drives the server in memory | `tests/link/net_http2/peer.ts` |

WP72 ([#2008](https://github.com/amritk/nish/issues/2008)) left a gRPC client out (D3) because "a client needs an HTTP/2 client first". This plan is that client. A gRPC client itself stays out of scope.

S2 needs S1. S3 needs S2.

## Approach

- **Sans-IO, like the server.** `Http2ClientConnection` takes bytes and answers events, so S1 is tested against the real `Http2Connection` in memory, with no sockets, and S2 and S3 wire it to the two fetch clients' transports.
- **The fetch API does not change shape.** An h2 fetch answers the same `HttpResponse` or `FetchResponse`, so callers need no change, and one that must stay on HTTP/1.1 clears one option.
- **No h2c and no prior knowledge.** h2 is negotiated by ALPN on https only. Plain-text h2 is out of scope.

## WP76 S1 — nish/net/http2-client, a sans-IO HTTP/2 client connection, with its security record

```ts
export class Http2ClientConfig { maxConcurrentStreams; initialWindow; maxFrameSize; maxHeaderListSize; headerTableSize }
export class Http2ClientConnection {
  constructor(config: Http2ClientConfig)
  start(): void                          // preface + SETTINGS into output
  feed(buf: readonly u8[], off: i32, len: i32): void
  next(): i32                            // H2C_RESPONSE, H2C_DATA, H2C_TRAILERS, H2C_RESET, H2C_WINDOW, H2C_GOAWAY, H2C_NEED_MORE or the final H2C_ERROR
  request(names: string[], values: string[], endStream: boolean): i32   // the new stream id, or a negative code
  writeData(stream: i32, buf: readonly u8[], off: i32, len: i32, endStream: boolean): i32  // bytes taken under both windows
  writeTrailers(stream: i32, names: string[], values: string[]): void
  reset(stream: i32, code: i32): void
  goaway(code: i32): void
  output: u8[]; outputStart: i32; outputEnd: i32; consume(n: i32): void
}
```

- **Protocol (RFC 9113).** Odd stream ids, increasing. `SETTINGS_ENABLE_PUSH = 0` is sent, and a PUSH_PROMISE is a connection `PROTOCOL_ERROR`. Connection and stream windows are honoured both ways, with WINDOW_UPDATE sent as DATA is consumed. Header blocks across CONTINUATION are decoded by `HpackDecoder`. PING and SETTINGS are acknowledged. A GOAWAY reports its last stream id, and every stream above it is answered `H2C_RESET` with a "not processed" flag S3 uses for retries.
- **Refusals** are codes, never panics: every connection and stream error a client can observe (§5.4), a header list past `maxHeaderListSize`, a response on a stream the client never opened, DATA past the window, and a malformed pseudo-header (through `HttpFields.readResponse`).
- **Tests.** `tests/link/net_http2_client`: the client against `Http2Connection` in memory (GET, POST with a body larger than the initial window, trailers, 100 concurrent streams, a reset stream, GOAWAY), and a scripted server (built from `peer.ts`'s pieces) for each error class.
- **Record.** `docs/security/http2-client.md` (scope `std/net/http2-client.ts`, findings with before/after tests) and its row in [`docs/security/README.md`](../../docs/security/README.md). `std/net/**` files need a record from the first commit (`node scripts/security-scope.mjs`).

## WP76 S2 — h2 negotiated by ALPN under fetchSync, FetchSyncClient and fetch, on by default

- `HttpOptions.http2: boolean`, default `true`. Unless it is cleared, `httpClientTlsStart` offers `["h2", "http/1.1"]`, and when ALPN picks `h2` the fetch runs over an `Http2ClientConnection` on the TLS record client.
- **Blocking clients.** One stream per fetch. `HttpBodyReader.read` reads DATA as it arrives, so event streams (WP74 S3) still work. `FetchSyncClient` keeps the h2 connection for the next fetch to the same origin, where it keeps an HTTP/1.1 connection today.
- **Async client.** One stream per fetch on its own connection. Pooling is S3.
- **Unchanged.** Redirects, proxies (CONNECT through an HTTP/1.1 proxy, then h2 inside the tunnel), timeouts, `maxBodyBytes` and `OutboundPolicy` behave as on HTTP/1.1.

### Decided: on by default

`HttpOptions.http2` defaults to **true** (owner's decision), as in curl and browsers. Every https fetch to a server that picks h2 takes the new path as soon as S2 ships, so:

- S2 lands only after S1's full error-class suite and the Node interop check pass;
- the PR's commit is a `feat` whose body says that https fetches now negotiate HTTP/2 and how to clear `http2` to stay on HTTP/1.1;
- [`docs/security/fetch.md`](../../docs/security/fetch.md) records the h2 path as the default one, and [`docs/guide/using-nish/http-client.md`](../../docs/guide/using-nish/http-client.md) says how to opt out.

Tests: h2 cases in `tests/link/net_http_fetch_tls` against `Http2TlsServer`, and a check in `tests/run.js` against Node's `http2.createSecureServer` (GET, POST, a streamed body, trailers ignored, a 3xx followed).

## WP76 S3 — concurrent async fetches multiplexed over one pooled h2 connection

- `FetchPool` keeps one h2 connection per origin. Each fetch takes a stream. A fetch past the server's `SETTINGS_MAX_CONCURRENT_STREAMS` parks on `nish:async` until a stream closes.
- **Retries.** A stream reported "not processed" (above GOAWAY's last id, or `REFUSED_STREAM`) is retried once on a fresh connection, whatever its method, because RFC 9113 §8.7 guarantees the server did nothing with it. Any other failure is answered as an error, and a POST is never resent.
- Tests: `awaitAll` of 50 fetches opens one connection (counted by the test server), the cap parks and resumes, GOAWAY mid-flight retries only the unprocessed streams, and `Arena.used()` stays flat over thousands of fetches.

## Out of scope

- h2c and prior-knowledge HTTP/2 over plain TCP.
- HTTP/3 as a client.
- A gRPC client (WP72 D3 can now be revisited).
- Server push (refused by setting).
- Stream priorities (RFC 9218 headers are sent as ordinary fields if the caller sets them).

## Tests

| Stage | Cases | Mirror |
| --- | --- | --- |
| S1 | in-memory against `Http2Connection`; every error class from a scripted server | `tests/link/net_http2`, `tests/link/net_http2_errors` |
| S2 | h2 through all three clients against `Http2TlsServer` and Node's http2 server | `tests/link/net_http_fetch_tls` |
| S3 | one connection under `awaitAll`, the stream cap, GOAWAY retry, arena flat | the pool cases in `tests/link/net_http_fetch` |

## Verification

Per stage, its `verification:` line, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node scripts/security-scope.mjs`, the goldens regenerated with `node tests/self/goldens.js --update` for any `std/` change, `node tests/nish-cmp.js` with `DECLARED` entries if a corpus program's IR moves, and every CI test shard green on the PR head.
