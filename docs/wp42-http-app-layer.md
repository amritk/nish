# WP42: The HTTP application layer — the router first

**Status: in progress.** Stage 1, the router (`std/net/router.ts`), is built.
The handler interface, static files and compression are planned and unbuilt.

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
2. **The handler interface**, later. One request view (method, path, query,
   fields, a body reader) and one response writer over `http1-server`,
   `http2-tls` and `http3-server`, with Alt-Svc advertising h3.
3. **Static files**, later. MIME types, `ETag` and `Last-Modified`, `Range`,
   and a path normalisation that refuses traversal, on WP36's `fs.read` policy.
4. **Compression**, later. gzip and deflate for responses, and a
   decompression-bomb limit for request bodies.

A full application server, with logging, configuration and graceful shutdown,
stays an example under `examples/`. Those three are policy, and they depend on
deadlines and signals that are filed separately (N10, N11). A program copies
the example and changes it. A library would have to guess.

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

`bench/router.ts` builds a table of 112 routes (77 nodes): statics, 14 REST
resources of six routes each, and nested routes four to seven segments deep.
It looks up four deep targets 200,000 times per round, for 15 rounds, against
a linear scan over the same patterns. A byte-identical copy of the scan gives
the noise band. Each lookup's result is folded into a printed checksum, and the
target rotates every iteration.

On this head, each a median over the 15 rounds on one x86-64 core:

| Run | Router | Linear scan | Linear copy | Noise band | Linear / router |
| --- | ---: | ---: | ---: | ---: | ---: |
| `nish run` | 426.3 ns | 3,386.2 ns | 3,290.7 ns | 28‰ | 7.9x |
| `nish run --profile speed` | 150.3 ns | 1,065.9 ns | 1,095.2 ns | 27‰ | 7.1x |

The router's lead is far outside the band: it reads each segment once and
visits at most the table's 77 nodes, where the scan compares every one of 112
patterns that shares a method. The checksum, 951787444500000, is the same in
both runs.

## 4. Later stages of #485

- **Stage 2, the handler interface:** `nish/net/handler`, one request and
  response pair over the three carriers, with `bench/http1-server.ts` routing
  through the router.
- **Stage 3, static files:** `nish/net/static`.
- **Stage 4, compression:** `nish/net/compress`.
- **The example server:** `examples/http-app`, with logging, configuration and
  graceful shutdown.
