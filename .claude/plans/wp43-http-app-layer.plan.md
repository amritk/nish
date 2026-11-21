---
name: WP43 — the HTTP application layer
overview: The router, the handler over all three HTTP versions and gzip responses are built. Left are static files (now with WP71's static-h2 and static-h3 needs), deflate and br as response codings, request bodies decoded under a decompression-bomb limit, and middleware, whose shape is still open.
spec: docs/wp43-http-app-layer.md
priority: 20
labels: [ready]
issue: 1857
stages:
  - id: s3-static
    title: WP43 S3 — static files, nish/net/static with MIME types, ETag, Range and traversal refused
    goal: nish/net/static serves a directory through the handler and the nish/net/http-server façade on HTTP/1.1, 2 and 3 with MIME types, ETag and Last-Modified, Range, a path check that refuses traversal, a cache of its own that follows the disk and a precompressed .br or .gz sibling when Accept-Encoding offers it, with its guide page and security record.
    verification: node tests/run.js static && node tests/run.js net && node tests/run.js net_http_server && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 485
    todos:
      - id: static-module
        content: Add std/net/static.ts with MIME lookup, ETag and Last-Modified through statMtimeSync, Range and path normalisation that refuses traversal — see WP43 S3
        status: pending
      - id: static-content-types
        content: Map .css .js .html .woff2 .svg .webp and .json to their Content-Type in std/net/static.ts, pinned by a test per extension — see WP43 S3, WP71 needs
        status: pending
      - id: static-cache
        content: Keep a file cache in std/net/static.ts that is the module's own and follows the disk, so a changed file is served changed — see WP43 S3, WP71 needs
        status: pending
      - id: static-precompressed
        content: Send a file's .br or .gz sibling when Accept-Encoding offers that coding, with Content-Encoding, Vary and a per-variant ETag — see WP43 S3, WP71 needs
        status: pending
      - id: static-every-version
        content: Serve through HttpServer in std/net/http-server.ts on HTTP/1.1, HTTP/2 over TLS and cleartext, and HTTP/3, not only HttpHandler — see WP43 S3, WP71 needs
        status: pending
      - id: static-capability
        content: Scope the file reads by the fs.read capability policy of WP36 — see WP43 S3
        status: pending
      - id: static-tests
        content: Add a tests/link case over loopback per version and a curl interop check, with traversal, bad-Range and changed-file negatives — see WP43 S3
        status: pending
      - id: static-record
        content: Write the docs/security record and index row for nish/net/static, and the user-guide page and reference — see WP43 S3
        status: pending
      - id: static-example
        content: Serve a directory from examples/http-app through the new module — see WP43 S3
        status: pending
  - id: s4-deflate
    title: WP43 S4 — deflate as a response coding
    goal: nish/net/http-compress answers an Accept-Encoding of deflate with a deflate body, alongside gzip, and the guide and reference say so.
    verification: node tests/run.js std_http_compress && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 1906
    todos:
      - id: deflate-coding
        content: Add deflate to HttpCompressor and httpAcceptEncoding in std/net/http-compress.ts on nish/compress/deflate — see WP43 S4 deflate
        status: pending
      - id: deflate-test
        content: Extend tests/link/std_http_compress with deflate round trips and q-value negotiation — see WP43 S4 deflate
        status: pending
  - id: s4-bomb-limit
    title: WP43 S4 — a request body decoded under a decompression-bomb limit
    goal: A request body with Content-Encoding gzip or deflate is decoded by the handler under a size limit, and a body that inflates past it is refused with 413.
    verification: node tests/run.js std_http_compress && node tests/run.js net_handler && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 1931
    todos:
      - id: bomb-limit
        content: Decode a compressed request body in std/net/handler.ts or std/net/http-compress.ts under a configurable output limit — see WP43 S4 bomb limit
        status: pending
      - id: bomb-test
        content: Add a tests/link negative with a bomb that inflates past the limit and expect the refusal — see WP43 S4 bomb limit
        status: pending
      - id: bomb-record
        content: Record the limit in docs/security/compress.md and the handler record — see WP43 S4 bomb limit
        status: pending
  - id: s4-br
    title: WP43 S4 — br as a response coding, on WP73's encoder
    goal: nish/net/http-compress answers an Accept-Encoding that prefers br with a Brotli body from WP73's nish/compress/brotli encoder, alongside gzip and deflate, and the guide and reference say so.
    verification: node tests/run.js std_http_compress && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 2006
    todos:
      - id: br-coding
        content: Add br to HttpCompressor and httpAcceptEncoding in std/net/http-compress.ts on nish/compress/brotli — see WP43 S4 br
        status: pending
      - id: br-test
        content: Extend tests/link/std_http_compress with br round trips through an independent decoder and q-value negotiation among br, gzip and deflate — see WP43 S4 br
        status: pending
      - id: br-docs
        content: Update the http-compress guide page and reference to list br — see WP43 S4 br
        status: pending
  - id: s5-middleware
    title: WP43 S5 — middleware, steps that run before and after route bodies
    goal: A program registers steps that run before and after its route bodies on every version the façade serves; a step reads the request and may only refuse it or add answer fields, and a route with no step pays nothing.
    verification: node tests/run.js net_handler && node tests/run.js net_http_server && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 2007
    todos:
      - id: middleware-decide
        content: Settle what a step may see and change, and whether a route that uses no step pays anything — see WP43 S5 middleware, Decision
        status: completed
      - id: middleware-api
        content: Add read-only step registration, bound per route at router build time, and the before and after calls to std/net/handler.ts and std/net/http-server.ts — see WP43 S5 middleware
        status: pending
      - id: middleware-tests
        content: Add tests/link cases for a request id, a header check that refuses, and a field added to every answer, on each version — see WP43 S5 middleware
        status: pending
      - id: middleware-bench
        content: Measure a route with no step against main on bench/http1-server.ts, interleaved, and record the figure — see WP43 S5 middleware
        status: pending
      - id: middleware-docs
        content: Write the guide section, reference and handler security record rows for steps — see WP43 S5 middleware
        status: pending
---

# WP43 — the HTTP application layer

## Context
Stages 1 and 2 (router, handler over HTTP/1.1, 2 and 3, `examples/http-app`) and gzip responses of stage 4 have landed; see [the design note](../../docs/wp43-http-app-layer.md). Spec: [design note](../../docs/wp43-http-app-layer.md), [§4 later stages](../../docs/wp43-http-app-layer.md#4-later-stages-of-485).

Stage 2's handler over HTTP/2 and HTTP/3 needs no stage: the `nish/net/http-server` façade (#1473, WP39 G7) is `HttpHandler`'s pull loop over HTTP/1.1, HTTP/2 over TLS and cleartext, and HTTP/3, with Alt-Svc advertising h3, pinned by the `tests/link/net_http_server*` cases. The design note's §4 and §5 still call it a follow-up.

[WP71](../../docs/wp71-httparena.md) (HttpArena) and [WP73](../../docs/wp73-brotli.md) (Brotli), which arrive with PR #1809, add to three stages here: static files gain what `static-h2` and `static-h3` need, `br` becomes a response coding once WP73's encoder lands, and middleware becomes a stage because HttpArena scores it.

## WP43 S3 — static files, nish/net/static with MIME types, ETag, Range and traversal refused
Issue #485 is the umbrella request for the application layer (handler interface, routing, static files, compression, logging, configuration, graceful shutdown); its remaining unbuilt part is this stage plus the two compression stages below, so closing #485 waits for all three. The issue asks for MIME types, `ETag` and `Last-Modified` (via `statMtimeSync`), `Range`, path normalisation that refuses traversal, the `fs.read` capability scoped by WP36's policy, and loopback tests plus a `curl` interop check. Large files want WP44's streaming reads, so the first cut may serve whole files. A new `std/net` module reading the filesystem for a network peer needs its `docs/security/` record in the same PR.
### WP71 needs
[WP71](../../docs/wp71-httparena.md)'s `static-h2` and `static-h3` profiles serve 20 files from one directory, br or gzip when offered, over HTTP/2 and HTTP/3. A benchmark entry needs four things of this module beyond the list above:

| Need | What it means here |
| --- | --- |
| A cache of the module's own that follows the disk | The module, not the program, keeps file bytes in memory; a file changed on disk is served changed, so each hit checks the file's mtime and size (`statMtimeSync`) or an equivalent, never a fixed snapshot. HttpArena's rules forbid an entry to precompute a response body or cache one by URL; the cache must be the framework's and follow the disk. |
| A precompressed sibling | For `name`, send `name.br` or `name.gz` when it exists and `Accept-Encoding` offers that coding (q-values through `httpAcceptEncoding`, ties broken by the module's offer order, `br` first), with `Content-Encoding`, `Vary: Accept-Encoding` and an `ETag` that differs per variant. No sibling, or no offer, sends the file as is. Range on a coded variant applies to the coded bytes. |
| Content-Type | At least `.css`, `.js`, `.html`, `.woff2`, `.svg`, `.webp` and `.json`, each with a test. |
| Every version | The module answers through `HttpServer` in [`std/net/http-server.ts`](../../std/net/http-server.ts) on HTTP/1.1, HTTP/2 over TLS and cleartext, and HTTP/3, as well as through `HttpHandler`; the tests run each version over loopback. |

Likely files: `std/net/static.ts`, `std/net/http-server.ts`, `tests/link/`, `docs/security/`, `docs/guide/`, `examples/http-app/`.

**Owns:** `std/net/static.ts`, `tests/link/net_static*/**`, `tests/link/net_http_app/**`, `examples/http-app/**`, `src/std-modules.ts`, `docs/security/static.md`, `docs/guide/using-nish/static-files.md`, `docs/guide/using-nish/standard-library.md`, `scalar.config.json`, `tests/run.js`¹, `tests/nish-cmp.js`¹, `docs/security/README.md`¹, `docs/wp43-http-app-layer.md`¹

The module serves through the public `start`/`write`/`end`/`sendFields` of `HttpServer` and `HttpHandler`, so this stage does not own `std/net/handler.ts` or `std/net/http-server.ts` (s5-middleware does). If static files cannot be served without changing either, the worker opens its PR as a draft and says what it needs; the lead adds a merge-order edge behind s5-middleware.

## WP43 S4 — deflate as a response coding
Spec: [§4](../../docs/wp43-http-app-layer.md#4-later-stages-of-485). Gzip is built as `nish/net/http-compress` (`HttpCompressor`, `httpAcceptEncoding`) on `nish/compress/deflate`, pinned by `tests/link/std_http_compress`; this adds `deflate` as a coding.
Likely files: `std/net/http-compress.ts`, `tests/link/std_http_compress/`.

**Owns:** `std/net/http-compress.ts`, `tests/link/std_http_compress*/**`, `docs/guide/using-nish/compression.md`, `docs/security/compress.md`, `tests/nish-cmp.js`¹, `docs/security/README.md`¹, `docs/wp43-http-app-layer.md`¹

## WP43 S4 — a request body decoded under a decompression-bomb limit
Spec: [§4](../../docs/wp43-http-app-layer.md#4-later-stages-of-485). Issue #485 names a decompression-bomb limit on request bodies. Not built today. Reads attacker-controlled network input, so the security record moves with it.
Likely files: `std/net/handler.ts`, `std/net/http-compress.ts`, `docs/security/compress.md`.

**Owns:** `std/net/http-compress.ts`, `std/net/handler.ts`, `std/net/http-server.ts`, `tests/link/std_http_compress*/**`, `tests/link/net_handler*/**`, `tests/link/net_http_server*/**`, `docs/security/compress.md`, `docs/security/handler.md`, `docs/security/http-server.md`, `docs/guide/using-nish/compression.md`, `docs/guide/using-nish/http-server.md`, `tests/run.js`¹, `tests/nish-cmp.js`¹, `docs/security/README.md`¹, `docs/wp43-http-app-layer.md`¹

**Depends on:** s4-deflate and s5-middleware. It edits the files both of them own, so it is spawned only after both have merged, not merely merged after them.

## WP43 S4 — br as a response coding, on WP73's encoder
Spec: [§4](../../docs/wp43-http-app-layer.md#4-later-stages-of-485), [WP73](../../docs/wp73-brotli.md) §3. Waits on WP73 S2, the encoder `nish/compress/brotli`, which itself waits on WP73 S1's measurement saying go; if S1 says no, this stage is retired with `not_planned`. WP73's S3 ([plan](wp73-brotli.plan.md)) is this same deliverable and points at this issue; its section lists the negotiation cases and the `docs/security/compress.md` scope change this PR also owes. Adds `br` to `HttpCompressor` and `httpAcceptEncoding` beside gzip and deflate, at the quality WP73 S1 picked; the test decodes each body with an independent decoder (Node's `zlib.brotliDecompressSync`) since nish has none (WP73 S4 is deferred). Feeds [WP71](../../docs/wp71-httparena.md)'s `json-comp` profile.
Likely files: `std/net/http-compress.ts`, `tests/link/std_http_compress/`, `docs/guide/`.

**Not in this run:** blocked on WP73 S2 (#2036); `std/compress/` has no Brotli encoder yet.

## WP43 S5 — middleware, steps that run before and after route bodies
Spec: [§4](../../docs/wp43-http-app-layer.md#4-later-stages-of-485). A step is code a program registers once to run before and after its route bodies: a request id, a check on a header that refuses the request, a field added to every answer. Nothing in `std/net` has one today. HttpArena scores a framework entry's completeness on routing, middleware, request and response, and takes 2.5% off a family's score for each one the entry declares missing ([composite score](https://www.http-arena.com/docs/scoring/composite-score/)); [WP71](../../docs/wp71-httparena.md) D5 declares middleware missing until this lands. Nish has no function values, so a step cannot be a callback; the shape follows the pull loop the handler already has.

### Decision
Settled by the owner on [#2007](https://github.com/amritk/nish/issues/2007) (2026-11-20, via `/decide`):
1. **What a step may see and change.** Read-only access to the request (method, path, fields), and the right to refuse it or add answer fields. A step does not rewrite the request or the answer body; a later stage can widen what a step may do.
2. **What a route that uses no step pays.** Nothing. Steps are bound per route at router build time, so a route with no step takes today's path unchanged, proved by an interleaved bench on `bench/http1-server.ts`.

Applies to `HttpHandler` and `HttpServer` alike, so one rule serves every version. Measured on `bench/http1-server.ts` against `main`, interleaved, before it lands.
Likely files: `std/net/handler.ts`, `std/net/http-server.ts`, `std/net/router.ts`, `tests/link/`, `docs/guide/`, `docs/security/handler.md`.

**Owns:** `std/net/handler.ts`, `std/net/http-server.ts`, `std/net/router.ts`, `tests/link/net_handler*/**`, `tests/link/net_http_server*/**`, `tests/link/net_router*/**`, `bench/http1-server.ts`, `docs/guide/using-nish/http-server.md`, `docs/guide/using-nish/http-router.md`, `docs/guide/using-nish/api-server.md`, `docs/security/handler.md`, `docs/security/http-server.md`, `docs/security/router.md`, `docs/BENCHMARKS.md`, `tests/run.js`¹, `tests/nish-cmp.js`¹, `docs/security/README.md`¹, `docs/wp43-http-app-layer.md`¹

`tests/run.js` pins `std/net/http-server.ts:219:14` in the compact-layout check, so a line move above it updates that string here.

¹ Shared by concurrent stages. Each stage only appends its own section, entry or row (or, in `tests/run.js`, the one line its source moves); a conflict there is resolved by merging `main`, never by editing another stage's lines. Generated files (`docs/reference/**`, `tests/self/goldens/checked/**`, `tests/link/*/expected.caps.json`, the `/reference` routes in `scalar.config.json`) are regenerated, never owned.
