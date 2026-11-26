# The HttpArena entry

[HttpArena](https://github.com/MDA2AV/HttpArena) entry for Nish, in its
`frameworks/<name>/` layout. Standard mode: every body is computed per request,
and nothing is precomputed or cached by URL.

To use it, copy this directory to `frameworks/nish/` in an HttpArena checkout
and rename `nish.dockerfile` to `Dockerfile`. HttpArena builds that name; this
repository's file-name lint refuses a capitalised one, as it does for
`bench/techempower/`.

```sh
cp -r bench/httparena "$HTTPARENA/frameworks/nish"
mv "$HTTPARENA/frameworks/nish/nish.dockerfile" "$HTTPARENA/frameworks/nish/Dockerfile"
cd "$HTTPARENA" && scripts/validate.sh nish
```

## Files

| File | What it is |
| --- | --- |
| `main.ts` | The entry point: it reads the CMD's arguments and calls `arenaMain`. |
| `server.ts` | The routes, over `nish/net/http-server` on 8080 and h2c on 8082, one prefork worker a core. |
| `db.ts` | The `/async-db` query, over `nish/net/postgres`, its pool sized from `DATABASE_MAX_CONN`. |
| `meta.json` | The profiles HttpArena runs and the entry's completeness axes. |
| `nish.dockerfile` | The image: a released compiler from `install.sh` and LLVM 18. |

`tests/link/httparena_entry` builds `server.ts` and drives every route through
one worker: split and chunked requests, a lower-case `content-length`, random
operands, pipelined requests answered in order, 32 overlapping `/delay`
requests, `json-comp` with no `Accept-Encoding`, and `/async-db` against a
stand-in PostgreSQL (`pg.ts` there) that answers the entry's query with known
rows, and refuses it. It serves on `0.0.0.0`, as HttpArena runs it, and asks
for `/baseline11` on `127.0.0.2`, `127.0.0.32` and `127.0.0.160`, and holds 200
keep-alive connections idle for 6 s. It runs one worker, so the prefork path
that starts a worker a core is not tested there.

The server listens with `tcpListenFlags` flag 0 for nodelay only, on the poll
loop, not io_uring (flag 8): WP71 S3's rings lost to it on CPU per request
(the record "io_uring under the http-server façade (WP71 S3)" in
`docs/BENCHMARKS.md`).

Only a connect to PostgreSQL has a deadline (5 s). A query that has started
has none, as in `nish/net/postgres`, so a database that stops answering holds
that query's connection until the socket closes.

## Held connections

`connections-1m` holds 1,000,000 keep-alive connections, 31,250 from each of
`127.0.0.1` to `127.0.0.32`, against 8080. The entry listens on `0.0.0.0` and
closes no idle connection before `nish/net/http-server`'s 60 s idle timeout
(30 s for a head that has not arrived). Its CMD passes `slots` 0, and
`arenaSlots` in `server.ts` gives each worker's HTTP/1.1 listener 4 times its
even share of the million, at least 16,384 and at most the 1,048,576 one
server holds: 62,500 a worker on HttpArena's 64-CPU server cpuset. The
headroom is for uneven steering: prefork's CPU-steered listener picks a
worker by the CPU a connection arrives on, and under HttpArena's cpusets
those are the load generator's CPUs, not the server's, so workers are not
handed equal shares. A slot not yet used costs about 40 bytes (a worker given
1,048,576 slots idles at 87,344 kB of RSS, one given 16,384 at 47,264 kB). The
h2c listener keeps 16,384 slots, because its stream tables are allocated for
every slot up front.

The descriptors are HttpArena's: its `--ulimit nofile` is 2,097,152.

### Memory per held connection

Measured on a 4-CPU Intel Xeon at 2.10 GHz with 16 GB of memory, Linux 6.18,
on the `server.ts` of the pull request that added this section (its branch
commit `694bb76f`), built with Nish 0.46.0 at `--profile speed`, 4 workers,
`slots` 0. The largest fleet held was 78,000 connections, 19,500 a worker:
the sandbox caps every process at 20,000 descriptors, and cannot raise it. Four Python clients, one pinned
to each CPU, each opened their connections from `127.0.1.x` to
`127.0.0.1`–`127.0.0.32`:8080, sent one `/baseline11` on each, read its answer
and held it. The figure is the summed RSS of the entry's processes holding
them, less the same sum before the first connect, over the connections held.

| Held | Idle RSS (kB) | Holding RSS (kB) | Bytes a connection |
| --- | --- | --- | --- |
| 36,000 (2 runs) | 345,452–345,676 | 360,220–360,460 | 420 |
| 72,000 (3 runs) | 345,460–345,632 | 363,300–363,464 | 252–253 |
| 78,000 (3 runs) | 345,320–345,696 | 363,304–363,668 | 235–237 |

The band across runs is 2 bytes a connection. The figure falls as the fleet
grows because part of the growth is not per connection: from 36,000 to 78,000
held, RSS grew by 3,249 kB, 79 bytes for each connection added. That is RSS
only: the kernel's socket memory is not in it. A million was not held here,
and these figures are not a measurement of one.

## Validation

`scripts/validate.sh nish` passed, 47 passed and 0 failed, at HttpArena
commit `3388e4586647ad7d9fd09faec3363f078ded0a9e`, with the entry installing
Nish 0.46.0, before `connections-1m` was in `meta.json`. Its subscribed
profiles were `baseline`, `pipelined`, `limited-conn`, `async`,
`latency-1m`, `latency-10k`, `json-comp`, `baseline-h2c`, `json-h2c` and
`async-db`, and its checks included the exhaustive fragmentation check (9 request shapes,
1,047 split offsets).

The run was in a sandbox that needed three local changes, none to this
directory's code:

- The base images were pulled from `mirror.gcr.io` and tagged `ubuntu:24.04`
  and `postgres:18`, because Docker Hub answered 429 Too Many Requests.
- The image trusted the sandbox's TLS proxy CA, added before `install.sh` is
  fetched.
- `--ulimit memlock=-1:-1` was lowered to the sandbox's 8 MiB hard limit,
  which runc could not raise. The entry locks no memory.
