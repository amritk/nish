# WP43: The HTTP application layer — the router first

**Status: in progress.** Stage 1, the router (`std/net/router.ts`), and
stage 2's HTTP/1.1 half, the handler (`std/net/handler.ts`) with the example
server `examples/http-app`, are built. The handler over HTTP/2 and HTTP/3,
static files and compression are planned and unbuilt.

Issue #485 asks for the pieces every HTTP server on `nish/net` would otherwise
rebuild: one handler interface across HTTP/1.1, 2 and 3, routing, static
files, compression, logging and configuration, and graceful shutdown. This
note says what goes into `std/net`, what stays an example, and the order.
[LANGUAGE.md](LANGUAGE.md) stays normative; nothing here changes the language.

## 1. The split

`std/net` gets the parts a server cannot get wrong cheaply and that do not
depend on how a program is laid out:

1. **The router** (`nish/net/router`), now. Method and path to a route index,
   with parameters as byte ranges.
2. **The handler interface**, now over HTTP/1.1 (§5). One request view (method, path, query,
   fields, a body reader) and one response writer over `http1-server`,
   `http2-tls` and `http3-server`, with Alt-Svc advertising h3.
3. **Static files**, later. MIME types, `ETag` and `Last-Modified`, `Range`,
   and a path normalisation that refuses traversal, on WP36's `fs.read` policy.
4. **Compression**, later. gzip and deflate for responses, and a
   decompression-bomb limit for request bodies.

A full application server, with logging, configuration and graceful shutdown,
stays an example under `examples/`. Those three are policy, and they depend on
work filed elsewhere: request deadlines (G2 in
[wp39-http-server.md](wp39-http-server.md)) and signal handling (N12 in
[wp34-hosting-cs.md](wp34-hosting-cs.md)). A program copies the example and
changes it. A library would have to guess.

## 2. The router

### API

```ts
const router = new Router(new RouterLimits())
const answer: i32 = router.add("GET", "/users/:id")      // the index, or a ROUTER_* code
const route: i32 = router.match(method, mStart, mEnd, target, tStart, tEnd, params)
const length: i32 = routerDecode(target, params[0], params[1], out)
```

Nish has no function values, so a route is an index. `add` answers 0 for the
first route and one more for each after it. A program names each index as a
module constant, checks that `add` answered it, and dispatches with `switch`,
whose labels must be constants (NL2284). `router.paramCount(route)`,
`routes()`, `nodeCount()` and `lastVisited()` answer what the table holds and
what the last match cost.

### Matching rules

- The path is the target up to its first `?`. It must start with `/`, so
  `OPTIONS *` and `CONNECT`'s authority form answer `ROUTER_NOT_FOUND`, and the
  program answers them before it routes. The query is not parsed.
- A path splits on `/` into segments, and `/a/` has two, the second empty. A
  trailing slash is significant. Matching is on raw bytes, so `%2F` never
  splits a segment. The router decodes nothing: `routerDecode` decodes one
  parameter, after the split.
- A pattern segment is a literal, a parameter `:name` (one non-empty segment;
  the name is `[A-Za-z0-9_]+`), or `*` as the last segment (the rest of the
  path, possibly empty, as one more pair).
- Precedence is literal, then parameter, then `*`, segment by segment from the
  left, with backtracking when a branch fails further down. The table is a
  tree whose edges are segments, with one parameter child and one `*` child
  per node. Every edge consumes a segment, so a lookup enters each node at most
  once: the lookup bound is `nodeCount()`, whatever the target.
- A path that reaches routes only of other methods answers
  `ROUTER_METHOD_NOT_ALLOWED` (405); otherwise `ROUTER_NOT_FOUND` (404).
  Methods compare exactly (RFC 9110 §9.1).
- Parameters are `[start, end)` offsets into the target, in the pattern's
  order, two `i32` slots each, in `params`, which the caller owns. If `params`
  is too short the answer is `ROUTER_TOO_MANY_PARAMS`, and nothing is written.

### Limits and refusal codes

`RouterLimits`: `maxPatternBytes` 1024 (1–65536), `maxSegments` 32 (1–256),
`maxParams` 16 (0–256, a final `*` counted), `maxRoutes` 4096 (1–1048576),
and `maxMethods` 16 (1–64). A value outside its range panics in the
constructor. `match` splits the path no further than one segment past the
deepest route, into scratch the constructor sized, so a long or deeply nested
target costs one scan and no allocation.

| Code | From | Meaning |
| --- | --- | --- |
| `ROUTER_BAD_PATTERN` -1 | `add` | empty, not `/`-rooted, a bad or repeated `:` name, `*` beside other bytes, `%`, `?`, or a byte outside `!`–`~` |
| `ROUTER_BAD_METHOD` -2 | `add` | not a token of 1–32 bytes |
| `ROUTER_TOO_LONG` -3 | `add` | over `maxPatternBytes`, `maxSegments` or `maxParams` |
| `ROUTER_AMBIGUOUS` -4 | `add` | `*` that is not the last segment |
| `ROUTER_DUPLICATE` -5 | `add` | the same shape and method, whatever the parameter names |
| `ROUTER_FULL` -6 | `add` | `maxRoutes` or `maxMethods` reached |
| `ROUTER_NOT_FOUND` -7 | `match` | no route's pattern matches, or the target is not `/`-rooted |
| `ROUTER_METHOD_NOT_ALLOWED` -8 | `match` | only routes of other methods match |
| `ROUTER_TOO_MANY_PARAMS` -9 | `match` | `params` is shorter than the route's pairs |
| `ROUTER_BAD_ESCAPE` -10 | `routerDecode` | `%` without two hex digits |
| `ROUTER_NO_ROOM` -11 | `routerDecode` | the decoded bytes do not fit `out` |

A refused `add` adds nothing. Whether a pattern is refused never depends on
the order the routes were added in: a duplicate is the same tree path and
method, and an ambiguity is a property of the one pattern.

### Carrier independence

`match` takes the method and the target as windows into arrays the caller
already holds: `Http1Parser.head` with its `methodStart`/`targetStart` spans
on HTTP/1.1, and `HttpFields.method` and `.path` on HTTP/2 and HTTP/3. It
imports nothing from `nish/net`, reads no socket and allocates nothing per
match. One table and one `switch` therefore serve every version, and a test
drives it with plain arrays.

### At compile time

The issue asks for routing "decided at compile time where possible". Today
nothing can be. Module constants fold only scalars and strings, and an array
constant is refused (`tests/cases/reject_const_array`). There is no comptime
evaluation. The only precedent for a checker reading a literal table is
`static readonly json` in `src/json-typed.ts`. So the table is built at
start-up, and every refusal is a code a program checks before it serves.

A later stage could add a `static readonly routes = [...]` literal that the
checker validates with these same rules, turning a duplicate or an ambiguity
into a compile error. It is not built, and it would be a language change with
its own LANGUAGE.md rule.

## 3. Measured

`bench/router.ts` builds a table of 112 routes (77 nodes, the root among
them, as `nodes` in its output counts): statics, 14 REST resources of six
routes each, and nested routes up to nine segments deep.
It looks up four deep targets 200,000 times per round, for 15 rounds, against
a linear scan over the same patterns. A byte-identical copy of the scan gives
the noise band. Each lookup's route and all four parameter pairs are folded
into a printed checksum, and the target rotates every iteration.

On this head, each a median over the 15 rounds on one x86-64 core:

| Run | Router | Linear scan | Linear copy | Noise band | Linear / router |
| --- | ---: | ---: | ---: | ---: | ---: |
| `nish run` | 458.8 ns | 3,495.0 ns | 3,316.0 ns | 51‰ | 7.6x |
| `nish run --profile speed` | 154.5 ns | 1,028.3 ns | 1,076.4 ns | 46‰ | 6.7x |

The router's lead is far outside the band: it reads each segment once and
visits at most the table's 77 nodes, where the scan compares every one of 112
patterns that shares a method. The checksum, 971760048750000, is the same in
both runs.

## 4. Later stages of #485

- **Stage 2, the handler interface:** `nish/net/handler`. Its HTTP/1.1 half
  is built (§5); the same `HttpRequest` and answers over `http2-tls` and
  `http3-server`, with Alt-Svc advertising h3, are the follow-up §5 explains.
- **Stage 3, static files:** `nish/net/static`.
- **Stage 4, compression:** `nish/net/compress`.
- **The example server:** `examples/http-app`, with logging, configuration and
  graceful shutdown, is built (§5).

## 5. The handler over HTTP/1.1

`nish/net/handler` turns `Http1Server`'s events into whole requests and takes
their answers back. A program builds a `Router`, hands it and a listener to
`HttpHandler`, and loops on `wait`, `ready` and `take`, switching on
`req.route`. The user guide is
[An API server](guide/using-nish/api-server.md); the security record is
[handler.md](security/handler.md).

### Decisions

- **The program pulls.** Nish has no function values, so there is no handler
  callback per route. `wait` runs one turn of the readiness loop and queues
  the requests it made whole; the program takes them and dispatches on the
  route index the router answered, exactly as stage 1 describes.
- **A request is whole before it is handed over.** The handler gathers the
  body, up to `http.maxBody`, which `HandlerLimits` lowers to one MiB from the
  carrier's default because it holds a body whole. A program that streams
  large uploads drives `Http1Server` itself. Streaming *responses* are
  provided (`start`, `write`, `end`).
- **An answer may come later, and a late one is dropped.** A taken request
  is the program's until it answers, in that turn or a later one. Each slot
  carries a generation bumped on close, so an answer whose connection has gone
  answers `HANDLER_DROPPED` and never reaches a new connection on the same
  slot.
- **Order and back-pressure are the carrier's.** It reads a connection's
  next request only once the one before is answered, and the handler parks a
  whole request while more than half an output of the answer before it is
  unsent, so pipelined answers go out in order and a peer that never reads
  holds one answer in flight.
- **Nothing is allocated per request once warm.** The head is copied into
  the request's own buffer at `H1_REQUEST`, bodies and the free list grow to
  the largest seen, and JSON goes into one scratch writer.
- **Refusals are problems.** `refuse` answers 404, or 405 with an `Allow`
  built once per set of methods, as RFC 9457 `application/problem+json`; a
  `HEAD` that only a `GET` route matches takes that route.
- **A graceful stop is a drain, not a policy.** `watch` adds the program's
  own descriptors to the loop (`signalFd()` among them), and `drain` stops
  accepting, closes idle connections and closes busy ones once answered.
  Deadlines, logging and configuration stay in `examples/http-app`, as §1
  says.

### Why HTTP/2 and HTTP/3 are a follow-up

The request view and the answers are written against nothing HTTP/1-specific
except where the bytes come from, but the two other carriers differ in what
the handler would own. `http2-tls` multiplexes streams over one TLS
connection, so a request's lifetime is a stream's, flow control decides when
a body may be read and written, and its decoded fields live in the
connection's HPACK state only until the next header block
([HTTP routing](guide/using-nish/http-router.md#from-http11-http2-and-http3)).
`http3-server` runs over QUIC on UDP, with its own readiness loop and timers.
Each needs its own copy-out point, its own back-pressure rule and its own
late-answer test, and each is a security-relevant change to its own record.
Landing HTTP/1.1 first gives the API a real user (`examples/http-app`) before
it is fixed across three carriers.

### Measured

`bench/http-app.ts` answers `bench/http1-server.ts`'s contract — plaintext,
JSON, echo, query, deep parameters and the same 342-route table, which both
import from `bench/http-app-routes.ts` — through `HttpHandler`.
`bench/http1-server.ts` stays the carrier's own load test, driving
`Http1Server` by hand; `bench/http.mjs`, given both builds, reads what the
request and response layer costs on top. A byte-identical copy of the
carrier gives the noise band.

`node bench/http.mjs --rounds 5 --duration 3 carrier=… copy=… handler=…`,
server on one CPU, `wrk -t3` on three more, in a 4-core cloud session. Each
cell is the median of five rounds and its change against the carrier; user
time is CPU microseconds a request.

| Scenario | carrier req/s | copy (noise) | handler | carrier user µs | handler user µs |
| --- | ---: | ---: | ---: | ---: | ---: |
| ping, c=500 | 121,983 | +17.7% | −16.4% | 1.44 | 1.61 |
| query, c=500 | 132,807 | −26.0% | −9.5% | 1.50 | 1.64 |
| body, c=500 | 122,351 | −43.4% | +3.6% | 2.15 | 2.23 |
| plaintext, c=256 | 163,869 | +3.2% | −3.7% | 1.22 | 1.40 |
| json, c=256 | 165,330 | −6.3% | −4.8% | 1.44 | 1.55 |
| post-json, c=256 | 57,705 | +11.2% | n/a (no route) | 8.36 | n/a |
| post-json-doc, c=256 | 50,164 | −6.4% | +12.1% | 10.17 | 8.82 |
| deep-route, c=256 | 153,670 | −24.2% | +0.9% | 1.60 | 1.72 |
| plaintext, c=4096 | 89,343 | +2.8% | +16.0% | 1.98 | 2.22 |
| plaintext close, c=64 | 58,670 | +0.7% | +5.5% | 2.22 | 2.30 |
| close, c=64 + 8000 idle | 62,118 | −2.9% | −0.3% | 2.02 | 2.37 |

The copy, the same bytes as the carrier, moves −43% to +18% at c=500 and
−6% to +11% elsewhere, so no throughput difference here is outside the noise
band. What the handler does cost shows in user time: 0.1 to 0.35 µs a
request more than the carrier driven by hand (the head copy, the routing
before the body and the queue) — less on `post-json-doc`, within its own
spread — against 4.5 to 14 µs of kernel time. Its
peak RSS matches the carrier's or is below it in every scenario. `post-json`
names a route the handler bench does not add, so it answers 404 and is not
compared; `post-json-doc` covers a JSON body.
