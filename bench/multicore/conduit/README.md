# A Conduit server for the multicore server challenge

The [multicore server challenge](https://github.com/arjaythedev/multicore-server-challenge)
scores RealWorld "Conduit" servers by how many simulated users they hold on an
8-vCPU, 16 GB box sharing it with PostgreSQL 18. This is an entry written in
Nish on its standard library, and this file is its lab notebook: the design,
how it is measured here, and every measured change, kept or dropped. The
folder the challenge receives is staged at
[`../submission/nish-std-amritk/`](../submission/nish-std-amritk/README.md)
(`node bench/multicore/stage.mjs` copies this directory's source into it).

## Design

- **Processes.** `main.ts` runs `nish/net/prefork` with restarts off (the
  challenge's rule 9 does not restart a crashed server, so neither does
  this): `HTTP_WORKERS` (2) HTTP workers and one bcrypt service. Each HTTP
  worker binds `HOST:PORT` with `SO_REUSEPORT` and `TCP_NODELAY` and owns
  everything it touches; nothing is shared between processes but the bcrypt
  service's socket.
- **One loop per worker** (`worker.ts`), `tests/postgres/carrier.ts`'s shape:
  `pollWait` over the listener, every keep-alive connection
  (`nish/net/http1-server`'s `Http1Server`), the worker's Postgres
  connections and its bcrypt connection.
- **Postgres.** Two `PgPool`s per worker, reads (`DB_READ_CONNS`, 3) and
  writes (`DB_WRITE_CONNS`, 1), each connection with up to 16 pipelined
  groups in flight (`DB_MAX_IN_FLIGHT`) and the rest of the requests in the
  pool's FIFO queue. Every statement is registered up front and prepared on a
  connection in the same flight as its first request. Every connection starts
  with `plan_cache_mode=force_generic_plan`, `jit=off` and
  `max_parallel_workers_per_gather=0`, set in the startup packet's `options`
  (session settings, not `ALTER SYSTEM`).
- **One group per request.** A request is one pipelined group (Bind and
  Execute for each statement, one Sync), which Postgres runs as one implicit
  transaction committed at the Sync. The response is sent once the group's
  ReadyForQuery arrives, so every write is committed before its response
  (rule 6). An endpoint whose reference SQL looks a row up and then writes
  runs both as one statement (a data-modifying `WITH`) or as two statements of
  one group; only `PUT /api/articles/:slug` takes two round trips, its 404 and
  403 decided between them. A request whose connection is lost answers 500
  and is never sent again: a lost write may have committed.
- **Rows straight into JSON.** Every result column is read in place from the
  connection's receive buffer (`colStart`, `colLength`) into a `JsonWriter`
  for that connection, with no string made: timestamps through
  `PgText.timestamp` (RFC 3339, milliseconds, truncated), `text[]` tag lists
  through `PgArrayWalker`. A request's own strings (path segments, query
  values, body fields) are spans of one byte array the request keeps.
- **Tokens** (`jwt.ts`). HS256 over an `HmacSha256` keyed once with
  `JWT_SECRET`: each signature copies the two keyed states and feeds them the
  message. Every request's token has its signature, `alg` and `exp` checked;
  nothing is remembered between requests (rule 5).
- **bcrypt** (`bcrypt-service.ts`). One process, reached by every HTTP worker
  over loopback TCP, batches up to four hashes or four checks into one
  `bcryptHash4` or `bcryptVerify4` call, after a collection window of up to
  `BCRYPT_BATCH_MS` (160 ms, #1's figure). Cost 10, salts from the CSPRNG.
  A password is copied once out of the request body into a 73-byte buffer the
  request owns, sent, and wiped; the service wraps each in a `Secret` and
  wipes it and the frame it came in once its batch has run.
- **Memory.** A request in progress is a `ConduitReq` from a free list; the
  JSON writers write into one buffer per Postgres connection; a keep-alive
  connection's slot keeps no output buffer while idle (`Http1OutputPool`).
  The build uses `--deny-retention`.

## How it is measured

`bash bench/multicore/setup.sh` builds a PostgreSQL 18 cluster tuned as the
challenge's `box/pg-conf.sh` tunes the box (for this machine's cores and
memory, `max_connections = 100`) and loads both seeds at the challenge commit
setup.sh pins. `bash bench/multicore/run.sh` builds the server, runs the
challenge's conformance suite against it on a fresh copy of the dev seed, then
runs the challenge's own load generator (`bench/cmd/loadgen run`, unchanged)
at fixed user counts on a fresh copy of the full seed, each run after a
30-second warm-up at a quarter of its users. From `/proc` it reads the CPU
every postgres process and every server process used over the measured
window and divides each by the requests completed in it. `run.mjs`'s header
says exactly what each figure is.

This container has **4 cores**, not the box's 8, and the load generator runs
on the same 4. So the comparison with the leaderboard is per request, not in
users: #1 (rust-tokio-Scooter1337) held 100,000 users at 26,279 req/s with 20%
of 8 cores in the app and 70% in Postgres, which is about **213 µs of Postgres
CPU** and **61 µs of app CPU per request**. The local runs use the loadgen's
`-think-scale 0.1` (think times and session lengths a tenth as long), so 1,000
users make the requests of about 10,000; the mix of requests, logins included,
is the same.

## Results

Every row is one run of `run.sh` on a fresh copy of the full seed (100,000
users, 500,000 articles), think-scale 0.1, 30 s warm-up, 20 s ramp, 60 s
measured, `HTTP_WORKERS=2 DB_READ_CONNS=3 DB_WRITE_CONNS=1`. "app" is every
server process; it splits into the HTTP workers and the bcrypt service. A
change is kept only when it moves a figure by more than the spread of the
three runs before it.

### Baseline: the reference SQL

The SQL of SPEC.md, as `sql.ts` first had it; three runs at each load.

| users | req/s | p95 ms | p99 ms | errors | Postgres µs/req | app µs/req | HTTP | bcrypt |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 2,645 | 2.1 | 4.0 | 0 | 335.6 | 136.8 | 76.4 | 60.4 |
| 1,000 | 2,647 | 2.1 | 3.4 | 0 | 311.4 | 130.7 | 74.2 | 56.5 |
| 1,000 | 2,641 | 1.9 | 3.3 | 0 | 335.1 | 131.8 | 77.4 | 54.4 |
| 2,000 | 5,269 | 4.0 | 7.6 | 0 | 312.2 | 106.5 | 60.5 | 46.1 |
| 2,000 | 5,255 | 3.7 | 6.4 | 0 | 311.6 | 105.4 | 60.8 | 44.6 |
| 2,000 | 5,269 | 3.6 | 17.5 | 0 | 301.5 | 104.3 | 59.4 | 44.9 |
| 4,000 | 10,133 | 60.4 | 169.5 | 0 | 250.2 | 70.7 | 38.4 | 32.4 |
| 4,000 | 10,308 | 34.2 | 79.3 | 0 | 245.4 | 68.5 | 38.5 | 29.9 |
| 4,000 | 10,300 | 38.8 | 82.8 | 0 | 248.8 | 66.8 | 38.6 | 28.2 |

Noise band: about ±4% on Postgres µs/request (302–312 at 2,000 users), ±1%
on HTTP µs/request. The cost of a request falls as the load rises, because
more requests share each wakeup, each `pollWait` and each pipelined round
trip. At 4,000 users the four cores are full (Postgres about 2.5 of them, the
load generator most of the rest) and the loadgen flags its own CPU over 75%,
so those rows are a floor on throughput, not a ceiling. The bcrypt share is
the logins': at think-scale 0.1 about 3 to 11 logins a second arrive, so a
160 ms window rarely fills four lanes, and one lane costs nearly what four
do. At the challenge's 100,000 users (about 27 logins a second) the batches
fill.

### The changes, in order

Each change is three runs at 2,000 users, compared with the three runs before
it. Between two sessions on one build Postgres µs/request moves by up to ±4%,
which is not small at 26,000 requests a second, so a change inside that band is
not dropped on the runs alone: its statements are compared directly, by their
plans (`EXPLAIN (ANALYZE, BUFFERS)` under a generic plan) and by `pgbench` on
one connection, old and new interleaved. The figures are Postgres
µs/request, HTTP-worker µs/request and p95, each as the range of the three runs.

| # | Change | Postgres µs/req | HTTP µs/req | p95 ms | Kept |
| --- | --- | ---: | ---: | ---: | --- |
| P4 | `Http1Config.idleInput`: idle connections lend their input and head buffers | 322–330 | 61–63 | 4.3–4.6 | yes: 3.20 → **1.13 KiB** per idle connection (15,000 open), HTTP cost within the noise |
| O1 | tag names by primary key: `ARRAY(SELECT (SELECT t.name FROM tags t WHERE t.id = at.tag_id) ...)` | **274–287** (−14%) | 62–64 | 3.0–3.4 | yes |
| O2 | capped counts as index-only scans: the global count `ORDER BY a.id`, the feed's over `= ANY(ARRAY(followees))` | 275–300 | 62–66 | 3.0–4.4 | no: the plans are the same. `EXPLAIN (ANALYZE, BUFFERS)` gives both counts an index-only scan before and after, the global one 6 buffers and no heap fetch either way, the feed's 50 buffers either way (0.545 against 0.535 ms) |
| O3 | `GET /api/tags` as one `text[]` row (`SELECT ARRAY(SELECT name FROM tags ORDER BY name)`), walked in place | **267–268** (−3% to −6%) | 61 | 2.8–3.0 | yes |
