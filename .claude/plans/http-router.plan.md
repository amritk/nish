---
name: An HTTP router in nish/net — the routing stage of #485
overview: Routing is #485's second bullet. This plan covers routing alone, plus the part of #485's design note that routing needs. Patterns are a method and a path, with `:param` segments and an optional trailing `*`. A literal segment wins over a parameter. A duplicate or ambiguous route is refused when the table is built, never settled by registration order. There are no closures. A match returns a route index, plus the parameters' byte ranges written into storage the caller owns, and it allocates nothing per request. Percent-decoding happens only after a match. The router takes bytes, not a connection, so the same table works for HTTP/1, HTTP/2 and HTTP/3. Stage 1 ships the design note, the module and a lookup micro-benchmark. Stage 2 moves the HTTP bench's nish twin onto the router and adds a synthetic deep route table with a scenario that times the lookup.
stages:
  - id: router
    title: "feat(net): an HTTP router in nish/net/router"
    goal: Ship nish/net/router, a carrier-independent, allocation-free method and path router. It refuses duplicate, ambiguous and over-long routes when the table is built. A match returns a route index and the parameters' byte ranges into caller-owned storage. It ships with its design note, link tests (positive and negative), a deep-route micro-benchmark against a linear scan, a guide page, a std/README entry and a security record.
    verification: npm run check && npm run lint && node tests/run.js net_router && node tests/run.js guide && node docs/check-links.mjs && build/nish run bench/router.ts, then an undegraded npm test (read the skip count) before the PR opens
    status: pending
    todos:
      - id: design-note
        content: Write docs/wp42-http-app-layer.md first, keeping it short. Say what of #485 goes in std/net and what stays an example, the router's API and matching rules, the limits, and whether the checker can decide part of routing at compile time and, if not, what it would need. See Stage 1, The design note.
        status: pending
      - id: module
        content: Build std/net/router.ts as the API and rules in Stage 1, The module, describe. Use flat i32/u8 arrays, build the table once, and allocate nothing in match.
        status: pending
      - id: decode
        content: Add the post-match percent-decoder, which decodes one parameter range into a caller-owned u8[]. It refuses malformed escapes, and %2F decodes to '/' only inside the parameter. See Stage 1, Percent-decoding.
        status: pending
      - id: link-tests
        content: Add tests/link/net_router (positive, with an _f64 twin), tests/link/net_router_negative_* (one per refusal), and the tests/nish-cmp.js entries for each new program. See Stage 1, Tests.
        status: pending
      - id: microbench
        content: Add bench/router.ts. It times a deep-route lookup on the router against a hand-written linear scan of the same synthetic table, with a byte-identical copy column for the noise band and a printed checksum. See Stage 1, The measurement.
        status: pending
      - id: docs
        content: Add the guide page docs/guide/using-nish/http-router.md with its route in scalar.config.json, the std/README.md net-table row, the nish/net section of docs/guide/using-nish/standard-library.md, and docs/security/router.md with its row in docs/security/README.md. See Stage 1, Docs.
        status: pending
      - id: goldens
        content: bench/router.ts is in a corpus dir, so regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff. Commit as feat(net) with a Measured trailer. See Stage 1, The commit.
        status: pending
  - id: bench-on-router
    title: "feat(bench): the nish HTTP twin registers its routes on nish/net/router"
    goal: Move bench/http1-server.ts's routes onto nish/net/router, together with a synthetic table of about 112 extra routes. Add a deep-route scenario to bench/http.mjs. Document the route table in bench/http-twins/README.md. Show that plaintext, json and post-json req/s stayed inside the nish/nish-copy noise band.
    verification: npm run check && npm run lint && node bench/http-twins/check.mjs (or its documented invocation) passes for every twin built here && bash bench/http-twins/run.sh --only plaintext,json,post-json,deep runs to completion with nish and nish-copy, then an undegraded npm test before the PR opens
    status: pending
    todos:
      - id: server-on-router
        content: Replace the targetIs/methodIs chains in bench/http1-server.ts (begin, answer, finish) with one router table built at start-up and a switch on the route index. Answers stay byte-identical. See Stage 2, The server.
        status: pending
      - id: extra-routes
        content: Register the synthetic extra-route table (about 112 routes, static and :param, several levels deep, a wildcard among them) in the nish twin only. Add one deep route, for example GET /api/v1/orgs/:org/projects/:project/items/:item, that answers a fixed body built from its parameters. See Stage 2, The extra routes.
        status: pending
      - id: deep-scenario
        content: Add the deep-route scenario to bench/http.mjs, with its branch in contract(). The twins answer 404 and read n/a, as nginx already does for the echo. Keep check.mjs green. See Stage 2, The scenario.
        status: pending
      - id: readme
        content: Add "The route table" to bench/http-twins/README.md, saying what the nish twin registers and why the twins don't, and record the run's figures in bench/README.md's HTTP table. See Stage 2, Docs.
        status: pending
      - id: goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update, because bench/http1-server.ts is in the corpus, and read the diff. Commit as feat(bench) with Measured req/s and the band. See Stage 2, The commit.
        status: pending
---

## Context

#485 asks for a short design note, then the HTTP application layer in stages. Routing is its second bullet, and this plan builds only that. Static files, compression, logging, configuration, shutdown and the unified handler interface come in later stages.

What main (7611faf) actually has differs from the request in a few places:

- **There is no 112-route table today.** `bench/http1-server.ts` routes four paths with hand-written `Http1Parser.targetIs`/`methodIs` chains: `GET /plaintext`, `GET /json`, `POST /json-echo` and `POST /json-echo-doc` (`begin` at about l.173, `answer` at about l.283, `finish` at about l.212).
- **There are no Elysia or Hono twins.** The twins in `bench/http-twins/` are bun, uws, node-http, go-fasthttp, go-nethttp, rust-actix, rust-hyper and nginx.
- **The twins README has no "The route table" section.** The nearest is "The contract".
- **The scenarios have different names.** `bench/http.mjs` has plaintext, json, post-json and post-json-doc, plus the c=4096 and close variants. Read the request's "ping, query, body" as plaintext, json and post-json.

The owner's decision of 2026-10-20 settles this. Stage 2 *builds* the extra-route table, in the nish twin only. The "old linear scan" the Measured trailer compares against is a hand-written linear scan over that same table, written in `bench/router.ts`.

**Prerequisite: query decoding has not landed.** No URL, query or percent-decoding module exists in `std/` or `src/`. So query parsing is out of scope. The router ends the path at the first `?` and leaves the query bytes alone. Percent-decoding of *matched parameters* is in scope, because the request requires it.

**No function values.** There are no function values in Nish (`docs/AI.md`, "no function values"; `docs/wp22-arrow-functions.md` §3). An arrow may only be the argument of a function-typed parameter, and nothing can store a function. So a route is an index, and the program dispatches with `switch`.

**Compile time.** Module `const`s fold only scalars and strings. An array or class constant is refused (`tests/cases/reject_const_array`), and there is no comptime evaluation. The one precedent for a literal the checker validates is a class's `static readonly json = {...}` metadata (`src/json-typed.ts`). So the checker cannot validate a route table today. The design note says what it would need, and this plan builds none of it.

## Stage 1 — the router

**Owns:**
- `docs/wp42-http-app-layer.md`
- `std/net/router.ts`
- `tests/link/net_router*/**`
- `tests/nish-cmp.js`
- `bench/router.ts`
- `docs/guide/using-nish/http-router.md`
- `docs/guide/using-nish/standard-library.md`
- `scalar.config.json`
- `std/README.md`
- `docs/security/router.md`
- `docs/security/README.md`
- `tests/self/goldens/**`
- `tests/run.js` (only if a new link program needs a registration line there)

### The design note

`docs/wp42-http-app-layer.md` should run to a page or two, not more. It covers:

- **What goes where.** What of #485 belongs in `std/net`: the router now, and later the handler interface, static files and compression. What stays an example under `examples/`: a full application server wiring these pieces together.
- **The router.** Its API, its matching rules (precedence, trailing slash, empty segments, the wildcard, methods), its limits, and its refusal codes.
- **Carrier independence.** HTTP/1 passes `parser.head` with its target span. HTTP/2 and HTTP/3 pass `HttpFields.path` over `0..length`. The `*` target (`OPTIONS *`) and CONNECT's authority form are not `/`-rooted, so the router never matches them and the program handles them first.
- **Compile time.** What the checker would need to decide routing at compile time. For example: a checker-validated `static readonly routes` literal, like the typed-JSON metadata, that turns duplicates and ambiguities into `NL` diagnostics and could generate a `switch`-shaped matcher. Say that this is future work and is not built here.
- **The later stages** of #485, by name, with routing marked as this one.

### The module

`std/net/router.ts`, imported as `nish/net/router`. The names here are a sketch. The worker settles them, and the design note records them:

- `new Router(limits)` builds an empty table. Limits are the maximum pattern bytes, segments per pattern, parameters per route and routes. The defaults are stated in the doc.
- `router.add(method: string, pattern: string): i32` returns the new route's index (0, 1, 2…). On a refusal it returns a negative code, and nothing is added:
  - `ROUTER_DUPLICATE`: the same method and the same shape. `:a` and `:b` at the same position count as the same shape.
  - `ROUTER_AMBIGUOUS`: two patterns that both match some target, where precedence doesn't decide between them. For example, two different parameter names at one node whose subtrees then conflict, or a wildcard that isn't last.
  - `ROUTER_TOO_LONG`: over the byte, segment or parameter limit.
  - `ROUTER_BAD_PATTERN`: no leading `/`, an empty parameter name, a `*` that isn't the whole final segment, or a stray `%`.

  Whether a pair is refused never depends on which was registered first. The tests add each refusing pair in both orders.
- `router.match(method: u8[], mStart, mEnd, target: u8[], tStart, tEnd, params: i32[]): i32` returns the route index, or a negative code:
  - `ROUTER_NOT_FOUND`: no path matches.
  - `ROUTER_METHOD_NOT_ALLOWED`: the path matches but the method doesn't, so a server can answer 405 rather than 404.
  - `ROUTER_TOO_MANY_PARAMS`: the matched route has more parameters than `params` can hold. This is a refusal, never a partial or out-of-bounds write.

  Parameters go into `params` as `[start, end)` pairs of offsets into `target`, in pattern order. The wildcard is one more pair, for the rest of the path. The path ends at the first `?` or at `tEnd`.
- **Matching rules.**
  - A segment's precedence is literal, then parameter, then wildcard.
  - A trailing slash is significant: `/a` and `/a/` are different routes.
  - A parameter never matches an empty segment. An empty segment (`//`) matches only a literal empty segment in a pattern.
  - Matching is on raw bytes, so `%2F` inside a segment never splits it.
  - Whether a failed literal branch backtracks into the parameter branch is the worker's decision, recorded in the design note. Either way, the worst-case work for one lookup must be bounded and stated, both in the note and in the security record. A hostile target must not be able to drive it super-linear in the target's length.
- **Storage.** The tree lives in flat `i32[]` and `u8[]` arrays grown by `add`. `match` allocates nothing.
- **Conventions.** Follow `std/README.md`, "Writing a module here": spell out the widths and `toI32` the builtins, give private helpers distinct names (the package namespace is flat), write every function as an arrow `const`, and import nothing from `src/`.

### Percent-decoding

`routerDecode(target: u8[], start: i32, end: i32, out: u8[]): i32` decodes one matched range into `out`. It returns the decoded length, or a negative code for a malformed escape (`%`, `%G1`, `%4`) or for `out` being too small. It works only on ranges that `match` has already split, which is how `%2F` stays inside its parameter. It does not decode `+` to a space. That is query-string form encoding, which is out of scope.

### Tests

`tests/link/net_router/` holds `main.ts` and a `checks.ts` on `nish/testing`'s `Suite`. `net_router_f64/` runs the same checks under `--number-mode f64`. The cases:

- **Literal before parameter.** `/users/me` and `/users/:id`. The literal wins in both registration orders, and `/users/42` reaches the parameter route.
- **Deep routes.** Six or more segments, with a parameter at several levels. The ranges are checked byte for byte.
- **Trailing slash.** `/a` vs `/a/`, each registered alone and then both together.
- **Empty segments.** `//`, `/a//b`, and a parameter that is not matched by an empty segment.
- **Percent-encoded segments.** `/files/a%2Fb` matches `/files/:name` as one segment, and `routerDecode` gives `a/b`. Malformed escapes are refused.
- **Wildcard.** `/static/*` takes the rest of the path.
- **Methods.** Not-found and method-not-allowed are distinct, and the query is ignored.
- **Carrier independence.** One table, matched from an `Http1Parser`'s head span and from an `HttpFields.path`.
- **Allocation.** After warm-up, `Arena.used()` is flat across a burst of lookups. Use the `before`/`moved === 0` pattern of `tests/link/net_http_date/checks.ts`.

One runtime-refusal directory per negative, on the `tests/link/net_http1_server_bad_config` template. Each prints, then panics on the code, with `expected.code` set to 1:

- `net_router_negative_duplicate`
- `net_router_negative_ambiguous`
- `net_router_negative_too_long`
- `net_router_negative_too_many_params`

Every refusal code's return value is also asserted in the positive `checks.ts`. Each new link program gets its entry in `tests/nish-cmp.js` (the released seed's `std` lacks the module).

### The measurement

`bench/router.ts` builds the synthetic extra-route table. That is the same table stage 2 registers, so define it once and have stage 2 copy it, or note that the two must agree. It times a deep-route lookup two ways:

- on the router;
- on a hand-written linear scan that compares each route's pattern segments against the target, in registration order, which is how the table would be scanned by hand.

Follow `bench/simd-s0.mjs`'s discipline:

- a target that changes on every iteration, drawn from a small rotating set;
- the result folded into a printed checksum;
- interleaved rounds, with min and median;
- a column timing a byte-identical copy of the router run, which gives the noise band.

The figures go into the design note and into the `Measured:` trailer.

### Docs

- **The guide page.** `docs/guide/using-nish/http-router.md`: patterns, precedence, refusals, dispatch with `switch`, parameters and decoding, and use from HTTP/1 and HTTP/2. Its examples go in `ts nish:ok` fences, per the page rules in `docs/README.md`. Add a `/http-router` route under `/using-nish` in `scalar.config.json`.
- **The standard-library page.** Add a line in its `nish/net` section linking to the guide page.
- **`std/README.md`.** A row in the `nish/net` table, in the 3-column format.
- **The security record.** `docs/security/router.md`, with the prefix `ROUTE-n` (`RT-` is taken). It covers scope, the threat model and properties verified. Its rows cover:
  - unmatched targets;
  - non-`/` targets;
  - over-long and deeply nested targets;
  - the lookup bound;
  - `%2F` and malformed escapes;
  - targets with more parameters than storage holds;
  - the query left unparsed.

  It states the commit its anchors are at, and names each test by its exact `check(...)` string, grepped against `tests/run.js`. Add its row in `docs/security/README.md`.

### The commit

```
feat(net): an HTTP router in nish/net/router
```

The body is the changelog prose. Add `Measured:` with the deep-route lookup in ns on the router against the linear scan, plus the noise band, copied from `bench/router.ts`'s output on the merged head. Add `Refs: docs/wp42-http-app-layer.md` and `Tests: tests/link/net_router`. Close with `Refs #485`, not `Fixes`, because #485 has later stages.

## Stage 2 — the bench twin on the router

**Depends on:** `router`, merged. The stage consumes its API.

**Owns:**
- `bench/http1-server.ts`
- `bench/http.mjs`
- `bench/http-twins/README.md`
- `bench/http-twins/check.mjs`
- `bench/README.md`
- `tests/self/goldens/**`

### The server

Build one `Router` at start-up with the four real routes. `begin` matches once, stores the route index in the slot's `route[]` as today, and `answer` and `finish` `switch` on it. `GET /json` must now check the method, where `answer` used to ignore it. Every answer stays byte-identical to today's, so `check.mjs` passes unchanged for the four contract routes.

### The extra routes

These are about 112 routes, matching `bench/router.ts`'s table:

- static routes;
- routes with one to three `:param` segments;
- one `*` route;
- several levels of depth.

They are registered after the real routes, so a real route is never cheap because it was added first. Each extra route answers a short fixed body. The deep route's body echoes its parameters, so a wrong range shows up in the contract. Only the nish twin carries them.

### The scenario

Add `{ name: "deep-route c=256", path: "/api/v1/orgs/acme/projects/p42/items/i7", conns: 256 }` (or similar) to `bench/http.mjs`, with its exact body in `contract()`. The twins answer 404 and read n/a. If `check.mjs` compares every route across the twins, make it skip the nish-only route explicitly and say why.

### Measuring

Run `bash bench/http-twins/run.sh`, which builds `nish` and `nish-copy` and `cmp`s them. If `wrk` is not installed, install it. If the twins' toolchains are not available, `nish` and `nish-copy` alone are enough for the band. Run:

- plaintext c=256, json c=256 and post-json c=256 on the router, in interleaved rounds, against the noise band between `nish` and `nish-copy`;
- the pre-change server (main's `bench/http1-server.ts`, built as a third binary) in the same rounds, so "has not moved" is read against the band;
- the deep-route scenario.

### Docs

`bench/http-twins/README.md` gets a new section, "The route table". It says what the nish twin registers, why only it carries the extra routes, and what the deep scenario times. Record the figures in `bench/README.md`'s HTTP table, with the band column.

### The commit

```
feat(bench): the nish HTTP twin registers its routes on nish/net/router
```

Add `Measured:` with plaintext, json and post-json req/s before and after, and the band, plus the deep-route req/s. Close with `Refs #485`.

## Verification (both stages)

Follow CLAUDE.md's definition of done: `npm run check`, an undegraded `npm test` (read the skip count), and `npm run lint`. Regenerate the goldens with `node tests/self/goldens.js --update` (`--seed build/seed/bin/nish` if `build/nish` is not built) and read the diff. Run `bash scripts/fetch-seed.sh --force` first. Neither stage touches `src/`, so the wasi and performance sections aren't required. If a change does reach `src/`, it is out of scope, so stop and say so.
