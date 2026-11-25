# WP71: An HttpArena entry, and what it asks of `std/net`

**Status: proposed, design only; nothing in `bench/`, `std/` or `runtime/` is
built for it.** The facts about HttpArena below were first read from its site and
repository on 2026-11-20, and re-read on 2026-11-25 at HttpArena
`3388e458` (its `scripts/lib/profiles.sh`, `scripts/validate.sh`,
`scripts/gen_leaderboard_data.py` and the site's profile and scoring pages);
its scores are those of its results of 2026-11-16. Both move, so a stage
re-reads them before it relies on one. The anchors into this repository were
first taken at `f2b8933f` and re-checked at `c5265f9c`.

TechEmpower archived its Framework Benchmarks on 2026-03-24 and named no
successor ([wp39](wp39-http-server.md), E9). The project that took its place
for an entry like ours is [HttpArena](https://www.http-arena.com/)
([MDA2AV/HttpArena](https://github.com/MDA2AV/HttpArena)): an open benchmark
run on one machine, with entries added by pull request and benchmarked on
that pull request. Its leaderboard covers HTTP/1.1, HTTP/2, HTTP/3, gRPC and
WebSocket, not TechEmpower's seven HTTP/1.1 tests. This package is the entry
and the list of what the entry needs that `std/` does not have yet. It runs
nothing HttpArena-specific of its own: HttpArena's `validate.sh` checks the
entry, and HttpArena's machine measures it when it is entered. Each such piece is planned in the package that owns its module.

## 1. How HttpArena scores

From [the composite score](https://www.http-arena.com/docs/scoring/composite-score/)
and the board's own catalog (`scripts/gen_leaderboard_data.py`):

- **A profile is worth up to 1,000.** An entry's average requests per second
  over the profile's connection counts, divided by the best entry's, times
  1,000. A profile an entry does not join scores 0.
- **Five profiles run at a fixed rate** and are scored on cost instead,
  scaled so the best is worth 1,000. `latency-1m`, `latency-10k` and `8gbit`
  are scored on CPU per request, p99 and mean latency. `connections-1m` and
  `connections-1m-tls` hold a million connections and are scored on CPU per
  request, the container's peak memory, p50 and p99, a quarter each.
- **`json-comp` rewards a small body.** Its rate is multiplied by
  (smallest bytes per response ÷ ours)² before it is scored.
- **A family's score is the sum of its profiles.** The overall board is
  HTTP/1.1 (10 profiles) + HTTP/2 (4) + HTTP/3 (2) + gRPC (2) +
  WebSocket (3), 21 scored profiles, so at most 21,000. When this note was
  first written it was 19: `connections-1m` and `connections-1m-tls` have
  been scored on the HTTP/1.1 board since.
- **Two boards stand apart from the overall one.** The database board scores
  `async-db` and `fortunes`, which were reference-only when this note was
  first written. The gateway board scores `gateway-64` (Gateway (H2) on the
  board), `gateway-h3` and `production-stack`.
- **Completeness.** A framework entry declares in its `meta.json` whether it
  has routing, middleware, request and response; each declared missing takes
  2.5% off the composite. It does not apply to the gRPC and WebSocket
  boards.
- **Memory** is an optional toggle on the site, off unless a reader turns it
  on.
- **Reference-only profiles** are measured and shown but not scored for a
  framework: `pipelined`, `static-tls` and `connections-5m` (the last run only
  for the entries on HttpArena's allowlist).
- **Compliance and resilience** are columns of their own and count toward no
  composite: protocol suites (Http11Probe, h2spec, h3spec, Autobahn) an entry
  opts into with `spec` in `meta.json`, which need a `/spec` route for the
  first two, and an opt-in resilience suite of adversarial clients.

On the results of 2026-11-16, when the overall board had 19 scored
profiles and HTTP/1.1 had 8, the HTTP/1.1 board's first place was
`dusty-tuned` (Zig) at 7,638 of 8,000. No entry joined every family. Summing
each family's published scores by hand (the site prints no overall figure in
the pages read), the two highest were `genhttp-ioxide` (C#) at about 14,500,
with no gRPC, and `ntex` (Rust) at about 14,400, with no HTTP/3. An entry at
80% of the best on all 21 profiles would sum to 16,800. **Breadth is worth
more on this board than the last 10% on any one profile**, and that sets this
package's order: every family first, then the gaps.

## 2. The rules that bind the entry

- **A framework, not an engine.** HttpArena's
  [engine rules](https://www.http-arena.com/docs/add-framework/implementation-rules/engine/)
  count "a runtime's own HTTP server (node:http, Go net/http)" as a framework.
  `nish/net/http-server` is the standard library's server, so the entry is a
  framework entry, ranked with the frameworks and scored on every profile.
- **Standard or tuned mode.** Standard uses documented framework APIs and
  settings a production guide would recommend. Tuned may change buffer sizes,
  socket options, workers and serializers. Neither may precompute a response
  body or cache one by URL; static files need a cache the framework owns that
  follows the disk.
- **The machine.** One AMD Threadripper PRO 3995WX, 64 cores and 128 threads
  ([hardware](https://www.http-arena.com/docs/hardware/)). The server's
  container gets CPUs 0–31 and 64–95, and the load generators 32–63 and
  96–127, on the same machine. The database profiles split it three ways:
  the server 0–15 and 64–79, the generator 16–31 and 80–95, Postgres the rest.
- **Ports.** 8080 serves HTTP/1.1, WebSocket and cleartext gRPC; 8081 serves
  HTTP/1.1 over TLS; 8082 serves h2c with prior knowledge; 8443 serves HTTP/2
  over TLS, HTTP/3 and gRPC over TLS. The runner mounts `/data/dataset.json`,
  `/data/static/` and `/certs/` read-only and passes `DATABASE_URL` and
  `DATABASE_MAX_CONN` (256, the pool's ceiling).
- **The certificate is RSA-2048, and it is checked.** `/certs/server.crt` is
  an `rsaEncryption` 2048-bit certificate signed `sha256WithRSAEncryption`, its
  key a PKCS#8 `PRIVATE KEY`. `validate.sh`'s TLS posture probe fails a TLS
  listener whose certificate is not the mounted one (an entry that generated
  its own EC certificate would sign handshakes about 25 times cheaper, by its
  own figures), that settles on anything but TLS 1.3, that negotiates a
  non-AEAD suite, or that selects an ALPN the client did not offer. The TLS
  server here signs only with ECDSA P-256, so every TLS profile waits on RSA
  signing ([`tls-rsa-server`](../.claude/plans/tls-rsa-server.plan.md), #481).
- **Held connections.** `connections-1m` and `connections-1m-tls` spread a
  million connections over `127.0.0.1` to `127.0.0.32`, so the entry listens
  on `0.0.0.0` or `[::]`, caps no connections below the fleet and closes no
  idle keep-alive connection in under five seconds. The container gets a
  96 GiB memory cap and `--ulimit nofile` 2,097,152.
- **The pull request.** A `frameworks/<name>/` directory with a `Dockerfile`,
  a `meta.json` (display name, language, type, mode, completeness, the
  profiles joined, maintainers) and the source. `./scripts/validate.sh <name>`
  runs every check of every joined profile and fails on any; a
  `/benchmark -f <name>` comment benchmarks the pull request on the machine
  and posts the figures; `CODEOWNERS` asks two maintainers to review every
  file.

## 3. The profiles, against what is built

"Built" names what the entry would use at `c5265f9c`; a profile whose row
names another package or issue waits on it. "RSA" is RSA certificates on the
TLS server, #481, which every TLS row waits on (§2).

| Family | Profile | What it asks | Built | Waits on |
| --- | --- | --- | --- | --- |
| HTTP/1.1 | `baseline` | `GET` and `POST /baseline11?a=&b=`, a sum; a `Content-Length` or chunked body; 4,096 connections | `nish/net/http-server`'s HTTP/1.1 listener, query parameters, a body held whole | — |
| | `limited-conn` | the same, a new connection every 10 requests | the same | — |
| | `async` | `GET /delay/{ms}` answered after a real timer, 32,000 connections held | answers that outlive a turn ([http-one-handler.md](http-one-handler.md) §3.3); the program keeps the deadlines | — |
| | `latency-1m`, `latency-10k` | `/baseline11` at a fixed rate, scored on CPU and latency | the same listener; io_uring is measured under `HttpHandler` only, and S3 measures it under the façade | — |
| | `connections-1m` | `/baseline11` across a million held connections at 250,000 req/s, scored on CPU, memory, p50 and p99 | the same listener, on `0.0.0.0`, its slots sized for the fleet | — |
| | `connections-1m-tls` | the same over TLS 1.3 on port 8081 | `Http1TlsServer`, outside the façade | [WP39](wp39-http-server.md) G7 (#2010); RSA |
| | `json-comp` | `/json/{count}?m=` from the dataset, gzip or br per request, scored on size² | `JsonWriter`; gzip through `nish/net/http-compress` | [WP73](wp73-brotli.md) and #2006 for br |
| | `json-tls` | the same JSON over HTTP/1.1 on TLS, port 8081 | `Http1TlsServer`, outside the façade | WP39 G7 (#2010); RSA |
| | `8gbit` | `POST /echo`, 10 KB over HTTP/1.1 on TLS at 50,000 req/s, scored on cost | the same | WP39 G7 (#2010); RSA |
| HTTP/2 | `baseline-h2` | `GET /baseline2` over TLS, port 8443, 100 streams | `listenHttp2Tls` | RSA |
| | `static-h2` | 20 files from `/data/static/`, br or gzip when offered | `nish/net/static` with `.br`/`.gz` siblings ([WP43](wp43-http-app-layer.md) stage 3) | RSA |
| | `baseline-h2c` | `/baseline2` over h2c, port 8082 | `listenH2c` | — |
| | `json-h2c` | `/json/{count}` over h2c | `listenH2c`, `JsonWriter` | — |
| HTTP/3 | `baseline-h3` | `/baseline2` over QUIC, port 8443 | `listenHttp3` | RSA |
| | `static-h3` | the 20 files over QUIC | `nish/net/static` | RSA |
| gRPC | `unary-grpc` | `BenchmarkService/GetSum` over h2c on port 8080, beside HTTP/1.1 | `nish/net/grpc` ([WP72](wp72-grpc.md)) | WP39 G7's h2c by preface (#2012) |
| | `unary-grpc-tls` | the same over TLS, port 8443 | `nish/net/grpc` | RSA |
| WebSocket | `echo-ws`, `echo-ws-pipeline`, `echo-ws-limited` | an upgrade on `/ws`, port 8080, text echoed | `Http1Server`'s WebSocket, not on the façade | WP39 G7 (#2011) |

So 9 of the 21 scored profiles can be entered on what is built, `json-comp`
with gzip alone. The other 12 wait: eight on RSA (with WP39 G7's TLS on the
façade for the three on port 8081), the WebSocket trio on WP39 G7's
WebSocket, and `unary-grpc` on WP39 G7's h2c by preface. WP73's Brotli would
shrink `json-comp`'s body.

The other boards:

| Board | Profile | What it asks | Built | Waits on |
| --- | --- | --- | --- | --- |
| Database | `async-db` | a range query of up to 50 rows from Postgres as JSON, a pool of at most `DATABASE_MAX_CONN` | `nish/net/postgres` | — |
| | `fortunes` | 200 rows from Postgres, one added, sorted and rendered as escaped HTML by a template engine | no template engine (D4) | standard mode: a template engine |
| Gateway | `gateway-64`, `gateway-h3` | the server behind an edge proxy over HTTP/2 and HTTP/3, a mixed workload | the server, behind a stock proxy that terminates TLS | S5 |
| | `production-stack` | edge, Redis cache-aside, JWT auth and the server, reads and writes | `std/crypto/jwt.ts` | S5; a Redis client |
| Reference | `pipelined` | 16 requests batched on each connection | `listenHttp1` | — |
| | `static-tls` | the 20 files over HTTP/1.1 on TLS | `nish/net/static` | WP39 G7 (#2010); RSA |
| | `connections-5m` | five million held connections | the same listener | HttpArena's allowlist |

Every figure this repository has is from a 4-vCPU VM with the load generator
on the same CPUs, and `nish/net/prefork` is measured at 1, 2 and 4 cores
([wp42](wp42-multicore-server.md)). Pinning and steering by CPU are built
(`setCpuAffinity`, and the reuseport program behind `tcpListenFlags`'s
flag 4 in `runtime/runtime-net.c`), and QUIC steers by connection ID
([h3-multicore.md](h3-multicore.md)). How any of it scales to 32 cores, and
how far each profile is from its leader, is not known until HttpArena
measures the entry (S4).

## 4. Stages

- **S1, the entry on what is built.** `bench/httparena/` in HttpArena's
  layout (`Dockerfile` from a released compiler, `meta.json`, the source on
  `nish/net/http-server` and `nish/net/prefork`), joining the 8 plaintext
  profiles of §3 that need only their routes, `async-db` and `pipelined`,
  with one worker a core, pinned and steered, and passing `validate.sh` in an
  HttpArena checkout at a named commit. A `tests/link/` case checks the
  routes' answers over loopback, as `tfb_entry` does for TechEmpower's.
- **S2, the profiles that wait on other packages**, one stage per
  dependency, each joined as its package lands: S2a the TLS pair after WP39
  G7's TLS and RSA, S2b the echo trio after WP39 G7's WebSocket, S2c gRPC
  after WP39 G7's h2c by preface and RSA, S2d the static pair after RSA, S2e
  br for `json-comp` after WP73, S2f `baseline-h2` and `baseline-h3` after
  RSA, S2g `connections-1m` (it waits on nothing, but it asks for capacity
  and a measurement rather than a route), and S2h `connections-1m-tls` after
  S2a.
- **S3, io_uring under the façade.** WP63 S4 measured 29.5% less CPU a
  request under `HttpHandler` at 96,000 connections, with the rings taken
  through the listener (`tcpListenFlags`'s flag 8, `HandlerLimits.listen`).
  The façade also serves a listener the program makes, but no
  `tests/link/net_http_server*` case opens its listener with flag 8, so
  whether its carriers run on ring slots is untested; this stage checks that
  first, then measures the CPU-scored profiles' route (`latency-1m`,
  `latency-10k`, and `8gbit` once S2a lands) with and without the rings, on
  the machine the [BENCHMARKS.md](BENCHMARKS.md) table names.
- **S4, the entry** *(open question)*: the pull request to HttpArena, a
  public number. The owner's call each time.
- **S5, the gateway board** *(deferred)*: `gateway-64`, `gateway-h3` and
  `production-stack` run the server behind a stock proxy that terminates
  TLS, and `production-stack` reads Redis, which `std/` has no client for.
  They are not in the overall board.

No stage builds a rig of HttpArena's size or measures the leaders on one;
HttpArena's own machine measures the entry when it is entered.

## 5. Decisions

| | Question | Recommendation |
| --- | --- | --- |
| **D1** | The entry's type and mode | **A framework of type `emerging`, in standard mode first**: it uses the standard library's documented server as any program would. Tuned mode, with its own buffer sizes and worker counts, is a second entry once standard is measured |
| **D2** | Where the entry lives | **`bench/httparena/` in this repository**, beside `bench/techempower/`, copied into `frameworks/nish/` when it is entered, as WP39 D2 did for TechEmpower |
| **D3** | Whether and when to enter | **After S1**, with every §3 profile that waits on nothing joined; HttpArena's benchmark comment on the pull request is the first figure at its size. A public number is the owner's call each time |
| **D4** | The database and reference-only profiles | **`async-db` and `pipelined`**, which need nothing new (`async-db` is one query per request on `nish/net/postgres`; it is scored on the database board, and `pipelined` is reference-only). Not `fortunes`, which standard mode wants from "a real template engine", which `std/` does not have; a tuned entry may hand-write the HTML |
| **D5** | The completeness axes | **Declare only what is built.** Routing, request and response are, and so is middleware since WP43 stage 5's route steps landed (#2007): ordered steps, bound to a route, that run before and after it and may refuse the request. The entry declares all four |
