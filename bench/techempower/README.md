# The TechEmpower json and plaintext entry

A Nish entry for two of the TechEmpower Framework Benchmarks' (TFB) test
types, `json` and `plaintext`, in the layout upstream keeps under
`frameworks/<Language>/<name>/`: `benchmark_config.json`, and `nish.dockerfile`
for the test named `default`. It is WP39's E5
([docs/wp39-http-server.md](../../docs/wp39-http-server.md)).

**It is not submitted.** Sending an entry to TechEmpower/FrameworkBenchmarks
puts a public number on the project, so whether and when to do it is the
owner's call (WP39 D1). The plan is after E8, once `fortune` passes the
verifier too. Until then the entry is run and measured from this directory, and
nothing here is sent upstream.

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
  one serialization per `/json`, and an `Arena.used()` that does not move over
  200 warmed requests.
- `main.ts` is the program: one process, one thread, one `pollWait` loop. It
  takes `main <port> [nodelay] [host] [slots]`, prints `listening <port>`, and
  exits 0 on SIGINT or SIGTERM.

The approach is `Realistic`: the handler uses the standard library's server as
any program would, with nothing of HTTP stripped out. It is one core until the
prefork supervisor of #719 lands, which is WP39's follow-up for multi-core.

## Building and running it

```bash
build/nish bench/techempower/main.ts --link build/tfb/entry --profile speed
build/tfb/entry 8080
curl -i http://127.0.0.1:8080/json
```

The image builds from a released compiler, installed by `install.sh`. Its
`NISH_VERSION` build argument must name a release after 0.18.0, the first with
`tcpListenFlags` and `JsonWriter`:

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

`run.sh` times the entry, a byte-identical copy of it (the noise band), and
every built HTTP twin, under `wrk`: `/plaintext` 16-deep pipelined (with
`pipeline.lua`) at 256, 1024, 4096 and 16384 connections, and `/json` at 16, 32,
64, 128, 256 and 512. The server is pinned to CPU 0 and `wrk` to the others.
Its header says the rest of the method. The recorded figures are in
[docs/BENCHMARKS.md](../../docs/BENCHMARKS.md#techempower-json-and-plaintext).
