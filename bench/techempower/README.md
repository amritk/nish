# The TechEmpower entry

A Nish entry for every TechEmpower Framework Benchmarks (TFB) test type:
`json` and `plaintext` (the test named `default`) and `db`, `query`,
`update`, `cached-query` and `fortune` on Postgres (the test named
`postgres`), in the layout upstream keeps under
`frameworks/<Language>/<name>/`: a benchmark config, `nish.dockerfile` for
the test named `default` and `nish-postgres.dockerfile` for `postgres`. The
config is `benchmark-config.json` here, because the repository's file names
are kebab-case (`npm run lint`); it becomes
upstream's `benchmark_config.json` when it is copied into that layout (WP39
D2). It is WP39's E5
([docs/wp39-http-server.md](../../docs/wp39-http-server.md)).

**It is not submitted.** Sending an entry to TechEmpower/FrameworkBenchmarks
puts a public number on the project, so whether and when to do it is the
owner's call (WP39 D1). The entry is run and measured from this directory,
and nothing here is sent upstream: no pull request against
TechEmpower/FrameworkBenchmarks, and no rank claimed from a run whose load
generator shares the server's machine.

## What it answers

| Request | Answer |
| --- | --- |
| `GET /json` | 200, `application/json`, `{"message":"Hello, World!"}`, serialized by a `JsonWriter` on every request, as TFB requires |
| `GET /plaintext` | 200, `text/plain`, `Hello, World!` |
| anything else | 404, `text/plain`, `not found` |

Every response carries `Server: nish`, `Date` and `Content-Length`. Pipelined
requests are answered in order, a burst in one write. A request the parser
refuses is answered 400 with `Connection: close`, and the server goes on
serving its other connections.

- `server.ts` is the handler: one `Http1Server` pool from `nish/net/http1-server`
  and TFB's two routes. `tests/link/tfb_entry` imports it and checks it over
  loopback against the verifier's rules: status, exact body, `Content-Type`,
  `Content-Length`, `Server`, an IMF-fixdate `Date`, a 16-deep pipelined burst,
  a 1000-deep one whose answers overrun the output (a reply held back by a
  full output resumes on `H1_WRITE`), one serialization per `/json`, and an `Arena.used()` that does not move over
  200 warmed requests.
- `main.ts` is the program: one process, one thread, one `pollWait` loop. It
  takes `main <port> [nodelay] [host] [slots]`, prints `listening <port>`, and
  exits 0 on SIGINT or SIGTERM.

The approach is `Realistic`: the handler uses the standard library's server as
any program would, with nothing of HTTP stripped out. It is one core: the
prefork supervisor of #719 (`nish/net/prefork`) has landed and the database
entry below runs on it, but `main.ts` does not yet, which is WP39's
follow-up for multi-core.

## Building and running it

```bash
build/nish bench/techempower/main.ts --link build/tfb/entry --profile speed
build/tfb/entry 8080
curl -i http://127.0.0.1:8080/json
```

The image builds from a released compiler, installed by the `install.sh` of
that release's tag. Its `NISH_VERSION` build argument must name a release after
0.18.0, which has neither `tcpListenFlags` nor `JsonWriter`. 0.19.0 is the first
release to have both, so the image builds only once 0.19.0 is out:

```bash
docker build -f bench/techempower/nish.dockerfile --build-arg NISH_VERSION=0.19.0 -t nish-tfb bench/techempower
docker run --rm -p 8080:8080 nish-tfb
```

## Measuring it

```bash
bash bench/http-twins/build.sh       # the twins, into build/http-twins/
bash bench/techempower/run.sh        # 3 interleaved rounds of 10 s
bash bench/techempower/run.sh --quick
```

`run.sh` times the entry, a byte-identical copy of it (the noise band), its
async twin (`async-main.ts`) and every built HTTP twin, under `wrk`:
`/plaintext` 16-deep pipelined (with `pipeline.lua`) at 256, 1024, 4096 and
16384 connections, and `/json` at 16, 32, 64, 128, 256 and 512. It then times
the database entry, a byte-identical copy of it and its async twin
(`async-db-main.ts`) on `/db`, `/queries`, `/updates`, `/fortunes` and
`/cached-queries` at 16, 64 and 256 connections, against a throwaway Postgres
it starts in `build/tfb/pg` (`PG_BIN` names its binaries; `--only db` runs
these alone). The server is pinned to CPU 0, Postgres to CPU 1 and `wrk` to the
rest. Each server's peak RSS is recorded beside its figures, and the report
says, per concurrency, whether the async twin is inside the band: WP49 stage
6's gate. Its header says the rest of the method. The recorded figures are in
[docs/BENCHMARKS.md](../../docs/BENCHMARKS.md#techempower-json-and-plaintext)
and, for the gate,
[docs/BENCHMARKS.md](../../docs/BENCHMARKS.md#techempower-the-async-entry-against-the-explicit-one-wp49-stage-6).

## The database entry

`db-server.ts` is the handler and `db-main.ts` the program, run as one
process a core by `nish/net/prefork`. Each worker builds its own
`HttpHandler`, `PgPool` and `PgCarrier` (`nish/net/postgres-carrier`) on its
own `SO_REUSEPORT` listener, so the workers share nothing and the kernel
spreads connections across them.

| Request | Answer |
| --- | --- |
| `GET /db` | one `{"id":n,"randomNumber":m}`, a random World row |
| `GET /queries?queries=n` | an array of `n` random World rows |
| `GET /updates?queries=n` | `n` random rows, each given a new `randomNumber` and written back |
| `GET /cached-queries?count=n` | `n` random rows from an in-process copy of World |
| `GET /fortunes` | the Fortune table plus "Additional fortune added at request time.", sorted by message, as an HTML table |

The JSON answers are `application/json` and the fortunes page is
`text/html; charset=utf-8`. Every answer carries `Server: nish` and `Date`.
The count is read as TFB's rules read it. A count that is absent, empty, not a
number, or below 1 is 1, and a count above 500 is 500. If the database fails a
request, it is answered 503.

- **Reads are batched across requests.** Every World id that an in-flight
  `/db`, `/queries` or `/updates` asks for is keyed into one `PgBatcher`. It
  sends one statement for every id waiting in that turn:

  ```sql
  select t.*, q.ord from unnest($1::int8[]) with ordinality as q(key, ord)
  cross join lateral (select id, randomnumber from world where id = q.key) as t
  order by q.ord
  ```

  Each row is a lookup of its own id, but one statement carries many rows, and
  a request that is alone in its turn gets one statement carrying all of its
  rows. TFB's rules forbid bulk-selecting a request's rows in one query, so
  whether this complies is **unresolved**. It is the owner's call, made before
  any submission, and this stage does not make it. If the answer is no, the
  fallback is a pipelined one-statement-per-row mode: each id is its own
  `select id, randomnumber from world where id = $1`, many of them in flight
  on a connection at once.
- **An update is one statement.** A request's ids are sorted and made
  distinct, which keeps concurrent updates from deadlocking. Rows sharing an id
  share its new number. The update is
  `update world ... from (select unnest($1::int8[]), unnest($2::int8[]))`.
- **Cached queries are read from memory.** Each worker reads World once at
  start-up into an array and answers from it. No response is cached.
- **Each worker allocates about 55 MB at start-up.** It holds 1,024 request
  slots, and each slot owns its buffers (about 54 KB), so the slots come to
  about 55 MB a worker before the first request. One worker a core means
  that figure times the core count.
- **A request waiting for room has no time limit.** When the carrier has no
  room for a request's queries, the request waits and is retried every turn.
  A lost database connection fails its queries, which frees room for the
  waiting requests. A database that keeps the connection open but
  never answers is not detected: the carrier has no query timeout, so the
  queries in flight and the requests waiting behind them hang until it does.
  Adding one is the carrier's work, not this entry's.
- **Fortunes are rendered into one reused buffer.** The rows are sorted by
  their UTF-8 bytes, `& < > " '` are escaped as `&amp; &lt; &gt; &quot; &#39;`,
  and every other byte, the Japanese row's included, is copied untouched.

`tests/link/tfb_db` checks all of this over loopback against a stand-in
Postgres: bodies, headers, clamping, batching across five clients, the update's
ids, the exact fortunes page and the 503. `tests/postgres/live/run.mjs tfb`
checks it against a real server with TFB's tables and two workers.

```bash
build/nish bench/techempower/db-main.ts --link build/tfb/db-entry --profile speed
# db-main <pgPort> <user> <password> <database> [port] [host] [pgHost] [workers] [connections]
build/tfb/db-entry 5432 benchmarkdbuser benchmarkdbpass hello_world 8080 127.0.0.1 127.0.0.1 0 4
curl -i 'http://127.0.0.1:8080/queries?queries=5'
```

`pgHost` must be a numeric address or a Unix socket path, because the carrier
resolves no names. The image resolves `tfb-database` with `getent` when it
starts.

### Not a rank

`run.sh` measures the database tests only relatively: the async entry against
the explicit one and the explicit one against its own copy, on one machine
where `wrk`, Postgres and the server share four cores. TFB runs its load
generator, its server and its database on three machines, and a client that
shares the server's cores measures their contention as well as the server. So
the figures in [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) compare builds
with each other; they are not a TechEmpower rank, and none is claimed (WP49
D6). Correctness is checked by `tests/link/tfb_db` against a stand-in Postgres
and by `tests/postgres/live/run.mjs tfb` against a real one.

### Pinning workers to cores

With more than one worker, `db-main` hands the listeners to
`nish/net/prefork`: the supervisor binds one `SO_REUSEPORT` listener a worker
with `TCP_NODELAY`, and sets `PreforkConfig.pin`. On Linux, worker `k` pins
itself to CPU `k`, and a classic BPF program on the reuseport group sends each
connection to the listener whose index is the CPU that received it, so a
connection is served on the core that took its interrupt. A worker that cannot
be pinned says so on stderr and runs unpinned. One process (`workers` 1) binds
its own listener and is not pinned.

Two limits follow from mapping worker `k` to CPU number `k`:

- **The allowed CPUs should start at 0.** Worker `k` asks for CPU number `k`,
  not the `k`-th CPU the process may run on. Under `taskset -c 4-7` every pin
  fails and the workers run unpinned, and a connection received on CPU 4 or
  above, past the group, falls back to the kernel's hash.
- **More workers than allowed CPUs panic.** The count is
  `availableParallelism()`, which a cgroup CPU quota or `NISH_NUM_THREADS`
  lowers, so `NISH_WORKERS` above it stops the supervisor before a worker
  starts. The container passes 0, one worker a core, which never exceeds it.
