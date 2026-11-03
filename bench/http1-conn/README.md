# Http1Connection's per-request cost

`main.ts` drives `Http1Connection` the way `Http1Server` does, with no
socket: each request is fed whole (a GET of about 350 bytes with an
`Authorization` header), answered with a 67-byte JSON body, the output is
consumed as if sent, and the connection is parked and released. The clock is
pinned so the `Date` header never reformats. What is timed is the
connection and the codec under it, per request.

```bash
node bench/http1-conn/run.mjs                  # 15 rounds, old against the working tree
node bench/http1-conn/run.mjs --rounds 5 --base origin/main
```

`run.mjs` builds `main.ts` twice at `--profile speed`, once beside
`std/net/http1-server.ts` as `--base` has it (default: the merge base with
`origin/main`) and once beside the working tree's, and links a byte-identical
copy of the first. Every round runs the three binaries on two shapes, rotating
which goes first:

- `hot`: every request on one connection, so its fields stay in cache.
- `cold`: the same requests dealt round-robin over `--connections`
  connections of one pool (default 50,000), so each request finds its
  connection out of cache, as a busy server does.

Each run is pinned to one core with `taskset` when there is one and reports
the fastest of `--batches` batches (default 5) of `--requests` requests
(default 200,000). The table gives the median and the min–max over the
rounds, and the ratio of medians to `old`; `old′` against `old` is the noise
band. A checksum that differs between the binaries fails the run.

`main.ts` alone takes `hot|cold [requests] [connections] [batches]` and prints
`shape ns requests checksum` for its fastest batch.
