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
  writes (`DB_WRITE_CONNS`, 1), the write connection with up to 16 pipelined
  groups in flight (`DB_MAX_IN_FLIGHT`), each read connection with up to 4
  (`DB_READ_IN_FLIGHT`), and the rest of the requests in the pool's FIFO
  queue. `PgPool` opens another connection only once more than its starting
  connections times `maxInFlight` groups wait, so the read pool's lower cap is
  what lets the coalesced reads reach more than one connection (O8): the
  second opens past 4 groups in flight and the third past 8. One shape holds
  at most `DB_READ_BATCHES` (3) groups, so the third connection opens only
  when several shapes and the uncoalesced reads are in flight together; how
  many open under the 4,000-user mix has not been counted. Every statement is
  registered up front and prepared on a
  connection in the same flight as its first request. Every connection starts
  with `plan_cache_mode=force_generic_plan`, `jit=off` and
  `max_parallel_workers_per_gather=0`, set in the startup packet's `options`
  (session settings, not `ALTER SYSTEM`).
- **One group per read, one group per batch of writes.** A read is one
  pipelined group (Bind and Execute for each statement, one Sync), which
  Postgres runs as one implicit transaction. Writes are committed in groups
  (O7): while a batch is in flight on the write connection the writes that
  arrive wait, then up to 128 of them go as one group, so one transaction and
  one WAL flush. No timer holds a write: an idle server sends one at once.
  Every response waits for its group's ReadyForQuery, so every write is
  committed before its response (rule 6). A failed batch rolled back every
  write in it, so each is sent again alone and answers its own error. An endpoint whose reference SQL looks a row up and then writes
  runs both as one statement (a data-modifying `WITH`) or as two statements of
  one group; only `PUT /api/articles/:slug` takes two round trips, its 404 and
  403 decided between them. A request whose connection is lost answers 500
  and is never sent again: a lost write may have committed.
- **Coalesced reads** (O9 to O11). `GET /api/articles/:slug`, its
  `/comments` and `GET /api/tags` are the three read shapes the mix sends most
  (an article page, 35% of the mix, asks for an article and its comments;
  the home page and the feed, 37%, each ask for the tags).
  The requests of one shape that wait in a worker while its read batches are
  in flight (`DB_READ_BATCHES`, one per read connection) go as one statement:
  up to 32 slugs and viewers bound as a `text[]` and an `int8[]`,
  `unnest(...) WITH ORDINALITY` joined to the reference SQL, each row carrying
  its request's place, so each request is answered from its own rows and
  answers just as it would alone. The tags read has no parameters, so every
  request waiting takes the one row of one execution. Nothing is kept past
  that execution: a request that arrives after it was sent waits for the
  next (rule 5). One request waiting alone runs the plain statement; a slug
  Postgres refuses fails the batch, so each of its requests is sent again
  alone and answers its own error. `concurrency.mjs` checks that every read
  answers byte for byte what it answers alone.
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

## What it does not defend

This is a benchmark entry, not a std module, so it has no `docs/security/`
record. What it leaves open:

- **The bcrypt service authenticates nobody.** It listens on
  `127.0.0.1:BCRYPT_PORT`. Any local process can connect and have hashes
  computed or checked, which costs CPU but reveals nothing stored.
- **Not every copy of a password is wiped.** The service wipes its own copies.
  The worker wipes the 73-byte copy it sends. But the request body still sits
  in the HTTP parser's input buffer and in the request's `body` buffer (and an
  old copy of it when that grew) until they are reused, and none of these is
  wiped.
- **A slug Postgres refuses spoils its coalesced batch.** A slug with a NUL
  byte (`%00`) or bytes that are not UTF-8 fails the Bind of the one
  statement it shares with up to 31 other waiting reads, so the batch fails
  and every member is sent again alone. The answers stay right (the
  concurrency check sends both kinds), but a client sending such slugs
  steadily turns its worker's coalesced reads back into one statement each,
  plus the failed batch.
- **A `JWT_SECRET` too short or too guessable** is the operator's problem: the
  key is used as given.

## How it is measured

`bash bench/multicore/setup.sh` builds a PostgreSQL 18 cluster tuned as the
challenge's `box/pg-conf.sh` tunes the box (for this machine's cores and
memory, `max_connections = 100`) and loads both seeds at the challenge commit
`bench/postgres/setup.sh` pins. `bash bench/multicore/run.sh` builds the server, runs the
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

### Where it stands

Three runs a row, think-scale 0.1, full seed, after a 30 s warm-up. The
first three rows are the build before coalescing (O7), from
`run.sh --users 2000,4000 --repeat 3 --idle 15000`; the last two are one later
session's pairs, from `run.sh --alt <main> --users 4000 --repeat 3 --idle 0`:

| users | req/s | p95 ms | p99 ms | errors | Postgres µs/req | HTTP µs/req | bcrypt µs/req |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2,000 | 5,256–5,282 | 2.9–3.4 | 6.0–7.1 | 0 | 274–290 | 53.0–54.6 | 45–49 |
| 4,000 | 9,960–10,351 | 27–77 | 67–146 | 0 | 233–252 | 33.6–34.0 | 32–36 |
| 4,000, with group commit (O7) | 10,275–10,422 | 21–37 | 40–70 | 0 | 233–246 | 34.2–34.6 | 26–31 |
| 4,000, with coalesced reads (O11), against `main` in the same session | 9,099–9,628 | 87–135 | 137–308 | 0 | **258–268** | 37.5–39.3 | 32.7–33.8 |
| 4,000, `main` (O7) in that session | 9,230–9,323 | 110–123 | 170–176 | 0 | 279–286 | 37.3–37.7 | 33.4–36.8 |

The third row is the six group-commit runs that served as the B side of O8's
pairs. The last two are one later session's three pairs, the coalesced build
against `main` (`run.sh --alt <main> --users 4000 --repeat 3 --idle 0`), where
the machine gives the same `main` 279–286 µs, about 17% above the earlier
session's 233–246. Paired, coalescing takes **−17.7, −23.2 and −21.3 µs**, a
mean of **−20.7 µs (−7.3%)**, outside both builds' spreads (10.4 and 6.8). p95
is lower on two pairs of three and higher on the first (135 against 118 ms),
whose p99 is too (308 against 173); the means are p95 108 against 117 ms and
p99 201 against 173.

Memory per idle keep-alive connection: **1.13 KiB** of the server's RSS at
15,000 connections, measured on the build before coalescing (the coalesced
build's session ran `--idle 0`, so it has no figure of its own), the
kernel's socket buffers aside, against 3.20 KiB before `idleInput`.

Against the figures derived from #1 (rust-tokio-Scooter1337: 100,000 users,
26,279 req/s, 70% of 8 cores in Postgres and 20% in the app):

| per request | #1 (derived) | here, at 10,000 req/s | target |
| --- | ---: | ---: | --- |
| Postgres CPU | ≈ 213 µs | 258–268 µs against `main`'s 279–286 in one session; ≈ 216–228 µs on the earlier session's scale | ≤ 190 µs: **missed** |
| app CPU | ≈ 61 µs | 37.5–39.3 µs HTTP (coalesced build, later session) + ≈ 17 µs bcrypt at the box's login rate | ≤ 61 µs: met |
| RSS per idle connection | ~1 KiB at 100k | 1.13 KiB (the build before coalescing) | ~1 KiB: met |
| p95 / p99 / errors | <500 ms / <1 s / <1% | 87–135 ms / 137–308 ms / 0 | met, at 4,000 users here |

The bcrypt figure measured here (32–36 µs) is a 4-core container's: at
think-scale 0.1 about 10 logins a second arrive, so most batches run one
lane. At the box's 100,000 users about 27 logins a second fill four lanes,
about 16 ms of one core a login, which is about 17 µs a request.

**Projection for the 8-vCPU box**, from these per-request costs: a challenge
user makes 0.263 requests a second (#1's 26,279 req/s over 100,000 users), so
one costs 0.263 × (Postgres + HTTP) µs plus bcrypt's 4.4 µs of CPU a second,
and 90% of 8 cores is usable, as #1 used: users = 7.2 s of CPU a second ÷
(0.263 × (Postgres + HTTP) + 4.4) µs. On the one session that measured both
builds, the means of the three pairs give **about 86,500 users** for the
coalesced build (261.5 + 38.2 µs; 84,500 to 87,800 from its slowest and
fastest run) against **about 81,400** for `main` (282.3 + 37.5 µs; 80,500 to
82,300), **+6%**. That session's machine was slower throughout than the earlier
one, where O7's 240 + 34 µs gave about 94,000 users. Carrying the paired
−7.3% over to that earlier scale is the assumption-laden figure: Postgres
222.5 µs (216–228, O7's 233–246 less 7.3%) and HTTP 34.7 µs (O7's 34 plus the
0.7 µs the coalesced build measured above `main`) give about 100,000 users
(98,000 to 102,400 across that Postgres range). Both rest on these
assumptions: per-request costs no higher at the box's 26,000 req/s than at the
10,000 measured here (they fell from 2,000 to 4,000 users, which argues
lower); the load generator on separate machines, where here it shares the
four cores; the box's CPU as fast per instruction as this container's; and
Postgres's latency still inside p95 500 ms and p99 1 s at 90% CPU, which
nothing here can test. Two HTTP workers stay well inside their cores (34 µs
at 13,000 req/s each is 44%).

Every row is one run of `run.sh` on a fresh copy of the full seed (100,000
users, 500,000 articles), think-scale 0.1, 30 s warm-up, 20 s ramp, 60 s
measured, `HTTP_WORKERS=2 DB_READ_CONNS=3 DB_WRITE_CONNS=1`. "app" is every
server process; it splits into the HTTP workers and the bcrypt service. A
change is kept only when it moves a figure by more than the spread of the
three runs before it. The one exception is a stack whose parts pay only
together: O9 (+4.5 µs alone) was kept as the base for O10 and O11, and the
stack is judged against `main`, in the coalesced-reads row above.

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

From O4 on, each change runs against the build before it in one session,
A then B at each of four repeats (`run.sh --alt`), because the machine drifts
within a session too: the same O3 build gave 274 to 311 µs/request across
four runs of one session. The figures are the mean of the paired difference.

Statements here are measured by the backend's own CPU per call
(`/proc/<pid>/stat` of the one backend pgbench drives, prepared statements,
generic plans, scripts interleaved over three rounds), with the statements
of one request sent as one pipeline, as the server sends them.

| # | Change | Postgres µs/req | HTTP µs/req | p95 ms | Kept |
| --- | --- | ---: | ---: | ---: | --- |
| P4 | `Http1Config.idleInput`: idle connections lend their input and head buffers | 322–330 | 61–63 | 4.3–4.6 | yes: 3.20 → **1.13 KiB** per idle connection (15,000 open), HTTP cost within the noise |
| O1 | tag names by primary key: `ARRAY(SELECT (SELECT t.name FROM tags t WHERE t.id = at.tag_id) ...)` | **274–287** (−14%) | 62–64 | 3.0–3.4 | yes |
| O2 | capped counts as index-only scans: the global count `ORDER BY a.id`, the feed's over `= ANY(ARRAY(followees))` | 275–300 | 62–66 | 3.0–4.4 | no: the plans are the same. `EXPLAIN (ANALYZE, BUFFERS)` gives both counts an index-only scan before and after, the global one 6 buffers and no heap fetch either way, the feed's 50 buffers either way (0.545 against 0.535 ms) |
| O3 | `GET /api/tags` as one `text[]` row (`SELECT ARRAY(SELECT name FROM tags ORDER BY name)`), walked in place | **267–268** (−3% to −6%) | 61 | 2.8–3.0 | yes |
| O4 | list pages cut in a subquery before the select list: `LIMIT ... OFFSET` over the whole select had computed every per-row subquery for each row the OFFSET skips too | 268–294 against O3's 274–311, **−11 µs (−3.8%)** paired | 62–65 | 3.0–3.8 | yes: pgbench, interleaved, gives the global list 0.264–0.274 ms against 0.546–0.600 |
| O5 | an article's comments in one statement, a `LEFT JOIN LATERAL` from the article, instead of a lookup and the list | 249–292 against O4's 258–289, −0.2 µs paired | 59–65 | 2.4–3.6 | yes, as a simplification: neutral. By the backend's own CPU under pgbench the pair pipelined in one group costs what the one statement does (117–123 against 115–121 µs a call); sent as two round trips it would have cost 35 µs more |
| O6 | a list page and its capped count as one statement (the count a `WITH` joined to the page) | — | — | — | no: pipelined, the pair costs the same (343–381 against 360–386 µs a call) and the joined form needs a column offset on every row |
| O7 | group commit: writes wait until the write connection has no batch in flight, then up to 128 go as one group, one transaction and one WAL flush; a failed group retries each write alone, a lost one answers 500 (three pairs at 4,000 users) | 234–240 against 240–241, **−3.9 µs (−1.6%)** paired | 34.1–34.2 / 33.9–34.1 | p95 **23–33** against 39–46, p99 **45–67** against 90–129 | yes: the tail halves, since a write no longer waits behind other writes' flushes on its connection. Checked under concurrency: 40 favorites at once all 200 and the count up by 40; 20 sign-ups with three duplicate names, 18 201s and two 422s, one row |
| O8 | read batching: up to 32 waiting reads as one pipelined group, one implicit transaction, each answered when its last statement completes (three pairs at 4,000 users against O7) | first build 207–220 against 237–240, but p95 **78–111** against 23–27: `PgPool` opens a connection only once more than `maxInFlight` (16) groups per connection wait, and batching never queued that many, so every read ran on one backend per worker. Neither a Flush after each read nor 8-read batches nor two batches a connection moved p95 (54–133). With the pool's cap at the batch depth, every connection open: 231–245 against 233–246 | 33.5–34.1 / 34.2–34.5 | p95 22–42 against 21–33 | no: inside the spread once the reads are spread over the connections. What it saved was one backend doing a worker's reads, which saturates it |
| O9 | coalesced article reads: the `GET /api/articles/:slug` requests waiting in a worker as one `article_slugs` statement over `unnest($1::text[], $2::int8[]) WITH ORDINALITY`, up to 32 a batch, `DB_READ_BATCHES` (3) in flight, the read pool's `maxInFlight` 4 (three pairs at 4,000 users against `main`; this session's machine gives `main` 292–295 µs, not the 233–246 of the rows above) | 291–309 against 292–295, **+4.5 µs** paired (+17.5, −1.7, −2.3) | 42.3–45.1 / 37.9–38.5 | p95 152–246 against 138–149 | kept as the base of O10 and O11, not on its own figures: the batch statement costs 526 µs a call for 5 rows on average (`pg_stat_statements`, one run), 105 a row against 167 for one alone, but article GET is about 5% of the statements' time. The concurrency check: 7,720 concurrent reads, 193 distinct, every one answered as alone |
| O9b | O9 with `DB_READ_BATCHES=1`, so batches grow larger | — | — | p95 **531** (article GET 819) | no: fails the verdict (p95 ≥ 500 ms). One batch at a time waits behind list pages in the read pool's FIFO, and every article read waiting waits with it |
| O10 | coalesced comment reads, the same way (`comment_slugs`: the article by slug, `LEFT JOIN LATERAL` its 100 newest comments, the place column `COMMENT_ORD`) (three pairs against O9) | 282–291 against 288–309, **−13 µs (−4.3%)** paired (−27.2, −15.0, +3.2) | 40.8–41.6 / 42.4–45.2 | p95 143–186 against 174–249 | yes, as marginal: the mean of the pairs is outside A's spread (8.5) but inside B's (22). The two shapes together are 35% of requests, which is what makes O9's machinery pay. Concurrency: 7,720 reads in 4,022 transactions, against 5,778 for O9 |
| O11 | every waiting `GET /api/tags` of a worker answered by one execution of its one-row statement, with no cap on how many (three pairs against O10) | 258–268 against 274–287, **−16 µs (−5.8%)** paired (−10.5, −8.8, −29.1) | 37.3–38.9 / 40.1–41.4 | p95 **82–115** against 134–162, p99 127–174 against 211–239 | yes: outside both spreads (9.9 and 13.9) on every pair, and the tail falls by a third, since 37% of requests (the home page and the feed) ask for the tags first. Concurrency: 7,720 reads in 4,093 transactions |

### The HTTP worker's own instructions

App-side changes are measured by instructions, which do not drift with the
machine: `valgrind --tool=callgrind` on the HTTP worker (one worker, 100 users
at think-scale 0.1 for 45 s, about 11,600 requests of the mix), the total over
the run including about 99M of start-up (SCRAM's PBKDF2 for the Postgres
connections).

| # | Change | Instructions (run) | Kept |
| --- | --- | ---: | --- |
| A0 | the server as after O5 | 1,741M | — |
| A1 | Postgres sockets re-armed only when their interest changes (`strace -c`: 41,062 → 41 `epoll_ctl` in 10 s) | — | yes: HTTP µs/request −2.0 paired |
| A2 | `nish/net/http1` and `http1-server` move bytes with `copyBytes` instead of byte loops (std) | **1,145M** (−34%) | yes |
| A3 | `JsonWriter.raw` copies with `copyBytes` (std), and a `text[]` with nothing to escape goes out as its JSON array in one pass of block copies | **1,022M** | yes |
| A4 | articles written directly: the fixed text as pre-encoded fragments, only the values escaped (`json-out.ts`) | **892M** | yes |
| A5 | a token whose header is the one issued is not decoded | **869M** | yes |
| A6 | the tag array in one byte loop instead of a scan and a copy per element | 887M (more requests too) | no |

Paired against the O5 build (three pairs at 2,000 users), A1 to A5 together
take the HTTP workers from 64.1–65.2 to **54.4–55.0 µs/request (−16%)**,
Postgres unchanged (287–294 against 282–294). Instructions halved; the time
did not, because most of what is left is the kernel's: about one `send` and
one `recv` for HTTP and one each for Postgres per request.

### Topology

Each setting against the default (`HTTP_WORKERS=2 DB_READ_CONNS=3
DB_WRITE_CONNS=1`, three pairs at 3,000 users, `run.sh --alt-env`). At 3,000
users the loadgen's own CPU passes 75% of the box, so it flags the runs as
load-generator limited; the per-request costs are still the server's.

| Setting (B) | Postgres µs/req, A / B | HTTP µs/req, A / B | p99 ms, A / B | Kept |
| --- | --- | --- | --- | --- |
| `DB_READ_CONNS=2` | 250–261 / 244–253 | 41.6–42.9 / 41.5–42.9 | 13.0–18.5 / 15.6–21.7 | no: paired differences +0.2, −14.7, −7.3 µs, no clear gain, p99 worse; 3 also leaves the 8-core box more backends |
| `HTTP_WORKERS=1 DB_READ_CONNS=6 DB_WRITE_CONNS=2` (the same 8 backends) | 262–278 / 253–263 | 42.8–43.9 / **35.6–36.0** | 14.7–113.8 / 11.2–15.7 | not as the default: one loop batches more requests per wakeup and per round trip, −7.5 µs HTTP and about −4.5% Postgres per request here, but one worker saturates its core near 28,000 requests a second at that cost, about #1's whole rate, so the box keeps two; `HTTP_WORKERS=1` stays an option |
