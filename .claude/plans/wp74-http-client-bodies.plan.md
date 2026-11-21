---
name: WP74 — HTTP client bodies an API client needs, form and multipart uploads, server-sent events, decoded responses
overview: nish/net/fetch sends a whole u8[] body and hands back the response's bytes as sent, so a Nish API client cannot percent-encode a query or form, upload a file as multipart/form-data, read a text/event-stream, or read a gzip-encoded answer without hand-rolled code. Add percent-encoders and a form writer to nish/net/url (S1), a multipart/form-data writer (S2), a sans-IO event-stream parser (S3) and opt-in Content-Encoding decoding in both fetch clients (S4), each with its security record.
priority: 110
labels: [ready]
issue: 2070
stages:
  - id: s1-url-encode
    title: WP74 S1 — percent-encoding and application/x-www-form-urlencoded bodies in nish/net/url
    goal: std/net/url.ts gains percent-encoders for a URL component, a path segment and a form value, and a form-body writer, each the exact inverse of the decoders the module already has and byte-identical to the WHATWG URL Standard's encode sets.
    verification: node tests/run.js net_url && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2071
    todos:
      - id: s1-encoders
        content: Add percentEncode(s, set) with URL_ENCODE_COMPONENT, URL_ENCODE_PATH_SEGMENT and URL_ENCODE_FORM sets to std/net/url.ts, doc-commented — see WP74 S1
        status: pending
      - id: s1-form-writer
        content: Add urlEncodeForm(names, values) to std/net/url.ts, writing name=value pairs joined by an ampersand with space as plus — see WP74 S1
        status: pending
      - id: s1-tests
        content: Add tests/link/net_url_encode, checking every byte against Node's encodeURIComponent and URLSearchParams output and round-tripping through percentDecode and urlDecode — see WP74 S1
        status: pending
      - id: s1-docs
        content: Update docs/guide/using-nish/http-client.md (building a query and a form body), regenerate docs/reference, and extend the security record whose scope names std/net/url.ts — see WP74 S1
        status: pending
  - id: s2-multipart
    title: WP74 S2 — nish/net/multipart, a multipart/form-data writer, with its security record
    goal: std/net/multipart.ts writes a multipart/form-data body (RFC 7578) of text fields and file parts into a u8[] that fetch sends, with a random boundary checked against every part and every caller string escaped or refused.
    verification: node tests/run.js net_multipart && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2072
    todos:
      - id: s2-module
        content: Add std/net/multipart.ts with MultipartWriter (field, file, finish, contentType) and multipartBoundary, registered in src/std-modules.ts stdModuleNames — see WP74 S2
        status: pending
      - id: s2-escaping
        content: Escape a double quote, CR and LF in part names and filenames as WHATWG's form encoding does and refuse a content type holding CR or LF — see WP74 S2
        status: pending
      - id: s2-boundary
        content: Draw the boundary from crypto.getRandomValues and draw again when any part's bytes contain it — see WP74 S2
        status: pending
      - id: s2-tests
        content: Add tests/link/net_multipart (byte-for-byte body with a pinned boundary) and a tests/run.js check that Node's Response.formData reads every field and file back — see WP74 S2
        status: pending
      - id: s2-record
        content: Write docs/security/multipart.md with its docs/security/README.md row, add std/README.md and standard-library.md rows, and regenerate docs/reference — see WP74 S2
        status: pending
  - id: s3-sse
    title: WP74 S3 — nish/net/sse, a sans-IO text/event-stream parser, with its security record
    goal: std/net/sse.ts turns bytes read from HttpBodyReader.read into events exactly as the WHATWG HTML event-stream interpretation does, under line and event size caps, and the guide shows a fetchSync client reading a stream event by event.
    verification: node tests/run.js net_sse && node tests/run.js net_http_fetch && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2073
    todos:
      - id: s3-parser
        content: Add std/net/sse.ts with SseParser (feed, next answering SSE_EVENT, SSE_NEED_MORE or an SSE_ERR code; event, data, lastEventId, retry) and SseLimits, registered in stdModuleNames — see WP74 S3
        status: pending
      - id: s3-spec-rules
        content: Implement the interpretation rules (BOM once, CR, LF and CRLF endings, comments, one leading space, data joined by LF, an id holding NUL ignored, retry digits only) — see WP74 S3
        status: pending
      - id: s3-tests
        content: Add tests/link/net_sse with a case per rule, input split at every byte, and each cap refused, plus an end-to-end case in tests/link/net_http_fetch over a scripted event-stream server — see WP74 S3
        status: pending
      - id: s3-record
        content: Write docs/security/sse.md with its index row and add a reading-an-event-stream section to docs/guide/using-nish/http-client.md — see WP74 S3
        status: pending
  - id: s4-content-coding
    title: WP74 S4 — gzip and deflate response bodies decoded by both fetch clients, opt-in, under the body limit
    goal: With HttpOptions.decodeContent set, fetchSync, FetchSyncClient and the async fetch send Accept-Encoding gzip and deflate, decode a gzip or deflate response as it is read with the decoded size held to maxBodyBytes, and refuse a coding they did not offer.
    verification: node tests/run.js net_http_fetch && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2074
    todos:
      - id: s4-option
        content: Add HttpOptions.decodeContent, default false, and RequestInit's matching field in std/net/fetch.ts, sending Accept-Encoding only when the caller has not set one — see WP74 S4
        status: pending
      - id: s4-decode
        content: Decode gzip and x-gzip through GzipReader and deflate through the zlib reader with a raw-deflate fallback inside HttpBodyReader.read and the async whole-body read — see WP74 S4
        status: pending
      - id: s4-errors
        content: Add HTTP_E_CONTENT_CODING for an unoffered or stacked coding and map a decoded overrun to HTTP_E_BODY_TOO_LARGE, both named by httpErrorName — see WP74 S4
        status: pending
      - id: s4-tests
        content: Add cases to tests/link/net_http_fetch for gzip, deflate, raw deflate, identity, an unoffered br, a corrupt stream and a gzip bomb refused at the limit with the arena flat — see WP74 S4
        status: pending
      - id: s4-record
        content: Update docs/security/fetch.md (scope, the decompression-bomb finding with its test) and the content-coding section of docs/guide/using-nish/http-client.md — see WP74 S4
        status: pending
---

# WP74 — HTTP client bodies an API client needs

## Context

[`nish/net/fetch`](../../std/net/fetch.ts) is the client a generated API client or CLI would be built on: `fetchSync` and `FetchSyncClient` block, `fetch` is async. What it sends and reads today:

- **Request bodies** are a whole `u8[]` (`HttpRequest.body`, fetch.ts:262; `RequestInit.body`, fetch.ts:2385). `http1RequestHead` frames them with `Content-Length`; nothing builds a body for the caller.
- **URL building**: [`std/net/url.ts`](../../std/net/url.ts) parses, resolves and *decodes* (`percentDecode`, `urlDecode` with `URL_DECODE_FORM`) but has no encoder, so a query value or form field is percent-encoded by hand.
- **Response bodies**: `HttpBodyReader.read` (fetch.ts:408) already answers as soon as one byte arrives, "so an event stream is read event by event", and `readTimeoutMs = 0` disables the per-read timeout for one. There is no parser for the stream itself; `text/event-stream` appears only in a scripted server reply in `tests/link/net_http_fetch/checks.ts`.
- **Content codings**: neither client sends `Accept-Encoding` or reads `Content-Encoding`; a gzip answer reaches the caller as gzip bytes. The decoders exist: `GzipReader` (std/compress/gzip.ts:662) is sans-IO with a total-decoded limit, and `ZlibDecompressor` and `Inflater` cover deflate.
- **multipart/form-data**: no code anywhere in the repository.

The four stages are independent; any order works. S4 is the only one that changes an existing module's behaviour, and only behind an option.

## Approach

- **Writers, not parsers, for bodies.** A client sends forms and multipart; reading them is a server's job (WP43's application layer). Each writer produces a `u8[]`, which is what both fetch clients take.
- **Sans-IO for the event stream.** `SseParser` takes bytes and answers events, as `Http1ResponseParser` and `GzipReader` do, so it works under `fetchSync`'s reader today and under any later streaming async body without change.
- **Decoding is opt-in.** A caller that reads `Content-Encoding` itself today keeps getting the bytes as sent; see the decision in S4.
- **Every new `std/net` file lands with its record.** `node scripts/security-scope.mjs` refuses a `std/net/**` file no record's scope names, and its "Not yet audited" list only shrinks.

## WP74 S1 — percent-encoding and application/x-www-form-urlencoded bodies in nish/net/url

Add to [`std/net/url.ts`](../../std/net/url.ts):

```ts
export const URL_ENCODE_COMPONENT: i32   // WHATWG component percent-encode set (what encodeURIComponent leaves alone, plus its reserved set)
export const URL_ENCODE_PATH_SEGMENT: i32 // path percent-encode set plus "/" and "%"
export const URL_ENCODE_FORM: i32         // application/x-www-form-urlencoded set; space becomes "+"
export const percentEncode = (s: string, set: i32): string
export const urlEncodeForm = (names: string[], values: string[]): string // panics on unequal lengths
```

- The input is UTF-8 bytes (a Nish `string`); each byte outside the set's unreserved bytes is written `%XX` in uppercase hex, as the URL Standard does.
- `percentDecode(percentEncode(s, set)) === s` for every set, and `urlDecode(urlEncodeForm(...), URL_DECODE_FORM)` reads back the pairs.
- Tests: every byte 0x00–0xFF and a set of multi-byte strings, compared against the output Node prints for `encodeURIComponent` and `URLSearchParams` (generated once by a script in the test directory and checked in beside it).
- Docs: doc comment with `@param`/`@returns` on each export, `node scripts/gen-reference.mjs`, and a "Building a query or a form body" section in [`docs/guide/using-nish/http-client.md`](../../docs/guide/using-nish/http-client.md). The encoders read no input from a peer, but `url.ts` is in a record's scope; add the new functions to that record's scope table (find it with `grep -l "std/net/url.ts" docs/security/*.md`).

## WP74 S2 — nish/net/multipart, a multipart/form-data writer, with its security record

A new module, `std/net/multipart.ts` (`nish/net/multipart`):

```ts
export class MultipartWriter {
  constructor(boundary: string)
  field(name: string, value: string): void
  file(name: string, filename: string, contentType: string, data: readonly u8[]): void
  finish(): u8[]          // the whole body, closing delimiter included
  contentType(): string   // "multipart/form-data; boundary=..."
}
export const multipartBoundary = (): string // 32 characters from crypto.getRandomValues
```

- **Escaping (RFC 7578 §4.2, WHATWG "multipart/form-data encoding algorithm").** In a `name` or `filename`, `"` is written `%22`, CR `%0D` and LF `%0A`. A `contentType` holding CR or LF panics: it is the program's string, not a peer's.
- **Boundary collision.** `finish` searches every part's bytes for the delimiter; on a hit it draws a new boundary and writes again. A caller-supplied boundary that collides panics.
- **In memory.** The body is one `u8[]`, because both fetch clients send one. Streaming an upload larger than memory is out of scope.
- Register the module in `stdModuleNames` ([`src/std-modules.ts`](../../src/std-modules.ts)); `tests/run.js` checks the list against `std/`.
- Tests: `tests/link/net_multipart` with a pinned boundary and `expected.out` holding the body byte for byte (fields, an empty file, a binary file holding every byte value, names needing escapes, a collision forcing a redraw), and a check in `tests/run.js` that Node's `new Response(body, { headers }).formData()` reads every field and file back.
- Record: `docs/security/multipart.md` (scope `std/net/multipart.ts`; header injection through names and boundary collision, each with its before/after test) and its index row in [`docs/security/README.md`](../../docs/security/README.md). Rows in [`std/README.md`](../../std/README.md) and [`docs/guide/using-nish/standard-library.md`](../../docs/guide/using-nish/standard-library.md); a "Uploading a file" section in the http-client guide page.

## WP74 S3 — nish/net/sse, a sans-IO text/event-stream parser, with its security record

A new module, `std/net/sse.ts` (`nish/net/sse`):

```ts
export const SSE_NEED_MORE: i32 = 0
export const SSE_EVENT: i32 = 1
export const SSE_ERR_LINE_TOO_LONG: i32 = -1
export const SSE_ERR_EVENT_TOO_LARGE: i32 = -2
export class SseLimits { maxLineBytes: i32 = 65536; maxEventBytes: i32 = 1048576 }
export class SseParser {
  constructor(limits: SseLimits)
  feed(buf: readonly u8[], off: i32, len: i32): void
  next(): i32                // SSE_EVENT, SSE_NEED_MORE or an SSE_ERR code (sticky)
  event: string              // "message" when the event set none
  data: string
  lastEventId: string        // persists across events, as the spec says
  retry: i32                 // -1 until a valid retry field
  end(): i32                 // at end of body; an incomplete event is dropped, as the spec says
}
```

- **Rules**, from the WHATWG HTML Standard, "Interpreting an event stream": a UTF-8 BOM skipped once at the start; lines end at CR, LF or CRLF (a CR at the end of one `feed` and an LF at the start of the next are one ending); a line starting with `:` is a comment; a line with no colon is a field with an empty value; one space after the colon is removed; `data` lines join with LF and the final LF is dropped; an event whose data buffer is empty is not dispatched; an `id` containing NUL is ignored; `retry` is taken only when every character is an ASCII digit; unknown fields are ignored.
- **Caps** are codes, never panics: the bytes come from a peer.
- **Reconnection** (`Last-Event-ID`, waiting `retry` ms) is the caller's loop; the guide shows it. A reconnecting client in `std/` is out of scope.
- Tests: `tests/link/net_sse` with one case per rule above, every case also fed one byte at a time and split at every offset, each cap provoked; one end-to-end case added to `tests/link/net_http_fetch` reading a scripted server's stream through `HttpBodyReader.read` with `readTimeoutMs = 0`. Cases come from the spec text; porting web-platform-tests cases follows [`.claude/licensing.md`](../licensing.md).
- Record `docs/security/sse.md` and index row; guide section "Reading an event stream" in the http-client page; std/README.md and standard-library.md rows.

## WP74 S4 — gzip and deflate response bodies decoded by both fetch clients, opt-in, under the body limit

In [`std/net/fetch.ts`](../../std/net/fetch.ts):

- `HttpOptions.decodeContent: boolean` (default `false`) and the same on `RequestInit`'s options. When set and the caller sent no `Accept-Encoding`, the request carries `Accept-Encoding: gzip, deflate`.
- A response whose `Content-Encoding` is `gzip` or `x-gzip` is decoded through `GzipReader`; `deflate` through the zlib reader, falling back to raw DEFLATE when the first two bytes are not a zlib header (what curl and browsers accept). `identity` or no header passes through.
- Decoding happens inside `HttpBodyReader.read`, so incremental reads (S3's event streams) still answer as data arrives, and inside the async client's whole-body read.
- `maxBodyBytes` bounds the **decoded** bytes; an overrun is `HTTP_E_BODY_TOO_LARGE`. This is the client side of the decompression-bomb limit WP43 S4 (#1931) sets for request bodies.
- A coding the request did not offer (`br`, `zstd`, `compress`) or more than one coding is `HTTP_E_CONTENT_CODING` (the next free `HTTP_E_*` number, 19), named by `httpErrorName`. `br` joins once WP73 S4 (#2038) lands a decoder.
- Response headers are left as received; the guide says the body is decoded and `Content-Length` describes the encoded bytes.

### Decided: off by default

`decodeContent` defaults to **false** (owner's decision). Every existing caller gets the same bytes as today, and a generated API client sets the option. The only change `docs/security/fetch.md` records is the new option.

Tests: in `tests/link/net_http_fetch`, a scripted server answering gzip, x-gzip, zlib deflate, raw deflate, identity, an unoffered `br`, stacked `gzip, gzip`, a corrupt CRC, and a 1 GiB run of zeros gzipped (refused at a 1 MiB `maxBodyBytes` with `Arena.used()` flat), each through `fetchSync` and the async `fetch`. Record: [`docs/security/fetch.md`](../../docs/security/fetch.md) scope and a decompression-bomb finding with its before/after test.

## Out of scope

- Streaming request bodies (a chunked upload larger than memory). The codec can frame one (`HTTP1_CHUNKED`); neither client sends one.
- Incremental response bodies in the async `fetch`, which reads the whole body before it answers; event streams use `fetchSync` until that changes.
- Parsing multipart or form bodies (a server concern, WP43).
- A reconnecting EventSource-style client in `std/`.
- `br` and `zstd` decoding (WP73 S4 for `br`).
- HTTP/2 (WP76).

## Tests

| Stage | Cases | Mirror |
| --- | --- | --- |
| S1 | every byte per set against Node's output; round trips through the existing decoders | `tests/link/net_url_parse` |
| S2 | pinned-boundary body byte for byte; escapes; collision redraw; Node's `formData()` reads it back | `tests/link/net_http_fetch` for the server side of a check |
| S3 | one case per interpretation rule, split at every byte; both caps; end to end through `fetchSync` | the `tests/link/net_tls_client_*` sans-IO cases |
| S4 | each coding through both clients; unoffered and stacked codings; corrupt input; the bomb with the arena flat | `tests/link/net_http_fetch` |

## Verification

Per stage, its `verification:` line, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node scripts/security-scope.mjs`, the goldens regenerated with `node tests/self/goldens.js --update` for any `std/` change, `node tests/nish-cmp.js` with `DECLARED` entries if a corpus program's IR moves, and every CI test shard green on the PR head.
