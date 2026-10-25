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
