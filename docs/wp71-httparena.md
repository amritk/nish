# WP71: An HttpArena entry, and what it asks of `std/net`

**Status: proposed, design only; nothing in `bench/`, `std/` or `runtime/` is
built for it.** The facts about HttpArena below were read from its site and
repository on 2026-11-20, and its scores are those of its results of
2026-11-16; both move, so a stage re-reads them before it relies on one. The
anchors into this repository are at `f2b8933f`.

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

From [the composite score](https://www.http-arena.com/docs/scoring/composite-score/):

- **A profile is worth up to 1,000.** An entry's average requests per second
  over the profile's connection counts, divided by the best entry's, times
  1,000. A profile an entry does not join scores 0.
- **Three profiles run at a fixed rate** (`latency-1m`, `latency-10k`,
  `8gbit`) and are scored on cost instead: CPU per request 0.50, p99 0.25,
  mean latency 0.25, scaled so the best is worth 1,000.
- **`json-comp` rewards a small body.** Its rate is multiplied by
  (smallest bytes per response ÷ ours)² before it is scored.
- **A family's score is the sum of its profiles.** The overall board is
  HTTP/1.1 + HTTP/2 + HTTP/3 + gRPC + WebSocket, 19 scored profiles, so at
  most 19,000. The gateway profiles have a board of their own and are not
  in the overall one.
- **Completeness.** A framework entry declares in its `meta.json` whether it
  has routing, middleware, request and response; each declared missing takes
  2.5% off the family's score. It does not apply to the gRPC and WebSocket
  boards.
- **Memory** is an optional toggle on the site, off unless a reader turns it
  on.
- **Reference-only profiles** are measured and shown but not scored:
  `pipelined`, `latency-500k-8cpu`, `static-tls`, `async-db` and `fortunes`.

On the results of 2026-11-16, the HTTP/1.1 board's first place was
`dusty-tuned` (Zig) at 7,638 of 8,000. No entry joined every family. Summing
each family's published scores by hand (the site prints no overall figure in
the pages read), the two highest were `genhttp-ioxide` (C#) at about 14,500,
with no gRPC, and `ntex` (Rust) at about 14,400, with no HTTP/3. An entry at
80% of the best on all 19 profiles would sum to 15,200. **Breadth is worth
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
  96–127, on the same machine; `latency-500k-8cpu` gets 0–3 and 64–67.
- **Ports.** 8080 serves HTTP/1.1, WebSocket and cleartext gRPC; 8081 serves
  HTTP/1.1 over TLS; 8082 serves h2c with prior knowledge; 8443 serves HTTP/2
  over TLS, HTTP/3 and gRPC over TLS. The runner mounts `/data/dataset.json`,
  `/data/static/` and `/certs/` read-only and passes `DATABASE_URL`.
- **The pull request.** A `frameworks/<name>/` directory with a `Dockerfile`,
  a `meta.json` (display name, language, type, mode, completeness, the
  profiles joined, maintainers) and the source. `./scripts/validate.sh <name>`
  runs every check of every joined profile and fails on any; a
  `/benchmark -f <name>` comment benchmarks the pull request on the machine
  and posts the figures; `CODEOWNERS` asks two maintainers to review every
  file.

## 3. The profiles, against what is built

"Built" names what the entry would use at `f2b8933f`; a profile whose row
names another package waits on it.

| Family | Profile | What it asks | Built | Waits on |
| --- | --- | --- | --- | --- |
| HTTP/1.1 | `baseline` | `GET` and `POST /baseline11?a=&b=`, a sum; a `Content-Length` or chunked body; 4,096 connections | `nish/net/http-server`'s HTTP/1.1 listener, query parameters, a body held whole | — |
| | `limited-conn` | the same, a new connection every 10 requests | the same | — |
| | `async` | `GET /delay/{ms}` answered after a real timer, 32,000 connections held | answers that outlive a turn ([http-one-handler.md](http-one-handler.md) §3.3); the program keeps the deadlines | — |
| | `latency-1m`, `latency-10k` | `/baseline11` at a fixed rate, scored on CPU and latency | the same listener; io_uring is measured under `HttpHandler` only | S5 |
| | `json-comp` | `/json/{count}?m=` from the dataset, gzip or br per request, scored on size² | `JsonWriter`; gzip through `nish/net/http-compress` | [WP73](wp73-brotli.md) for br |
| | `json-tls` | the same JSON over HTTP/1.1 on TLS, port 8081 | `Http1TlsServer`, outside the façade | [WP39](wp39-http-server.md) G7 |
| | `8gbit` | `POST /echo`, 10 KiB over HTTP/1.1 on TLS at 50,000 req/s, scored on cost | the same | WP39 G7 |
| HTTP/2 | `baseline-h2` | `GET /baseline2` over TLS, port 8443, 100 streams | `listenHttp2Tls` | — |
| | `static-h2` | 20 files from `/data/static/`, br or gzip when offered | — | [WP43](wp43-http-app-layer.md) stage 3 |
| | `baseline-h2c` | `/baseline2` over h2c, port 8082 | `listenH2c` | — |
| | `json-h2c` | `/json/{count}` over h2c | `listenH2c`, `JsonWriter` | — |
| HTTP/3 | `baseline-h3` | `/baseline2` over QUIC, port 8443 | `listenHttp3` | — |
| | `static-h3` | the 20 files over QUIC | — | WP43 stage 3 |
| gRPC | `unary-grpc` | `BenchmarkService/GetSum` over h2c on port 8080, beside HTTP/1.1 | — | [WP72](wp72-grpc.md); WP39 G7's h2c by preface |
| | `unary-grpc-tls` | the same over TLS, port 8443 | — | WP72 |
| WebSocket | `echo-ws`, `echo-ws-pipeline`, `echo-ws-limited` | an upgrade on `/ws`, port 8080, text echoed | `Http1Server`'s WebSocket, not on the façade | WP39 G7 |

So 10 of the 19 scored profiles can be entered on what is built, `json-comp`
with gzip alone. The other nine wait on WP39 G7's three items, WP43's static
files, WP72's gRPC and, for a smaller `json-comp` body, WP73's Brotli.

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
  `nish/net/http-server` and `nish/net/prefork`), joining the 10 profiles of
  §3 that wait on nothing, with one worker a core, pinned and steered, and
  passing `validate.sh` in an HttpArena checkout at a named commit. A
  `tests/link/` case checks the routes' answers over loopback, as
  `tfb_entry` does for TechEmpower's.
- **S2, the profiles that wait on other packages**, one stage per
  dependency, each joined as its package lands: S2a the TLS pair and S2b the
  echo trio after WP39 G7, S2c gRPC after WP72, S2d the static pair after
  WP43 stage 3, S2e br for `json-comp` after WP73.
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
- **S5, the gateway board** *(deferred)*: `gateway-h2`, `gateway-h3` and
  `production-stack` run the server behind nginx or a peer, and
  `production-stack` reads Redis, which `std/` has no client for. They are
  not in the overall board.

No stage builds a rig of HttpArena's size or measures the leaders on one;
HttpArena's own machine measures the entry when it is entered.

## 5. Decisions

| | Question | Recommendation |
| --- | --- | --- |
| **D1** | The entry's type and mode | **A framework of type `emerging`, in standard mode first**: it uses the standard library's documented server as any program would. Tuned mode, with its own buffer sizes and worker counts, is a second entry once standard is measured |
| **D2** | Where the entry lives | **`bench/httparena/` in this repository**, beside `bench/techempower/`, copied into `frameworks/nish/` when it is entered, as WP39 D2 did for TechEmpower |
| **D3** | Whether and when to enter | **After S1**, with every §3 profile that waits on nothing joined; HttpArena's benchmark comment on the pull request is the first figure at its size. A public number is the owner's call each time |
| **D4** | The reference-only profiles | **`pipelined` and `async-db`**, which need nothing new (`async-db` is one query per request on `nish/net/postgres`). Not `fortunes`, which standard mode wants from "a real template engine", which `std/` does not have. None of them is scored |
| **D5** | The completeness axes | **Declare only what is built.** Routing, request and response are; middleware is WP43 stage 5's open question, so the entry declares it missing until that lands |
