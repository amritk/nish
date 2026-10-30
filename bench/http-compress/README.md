# http-compress: compression that pays for itself

`server.ts` is one `Http1Server` on plain TCP answering `GET /<k>` with one of
16 JSON bodies of 560 to 8,045 bytes (feed JSON from `../gzip/feed.mjs`, sizes
in even steps of the logarithm, mean 2,666). `client.py` asks for them in a
fixed random order over one keep-alive connection, each with
`Accept-Encoding: gzip`, gunzips what comes gzip and checks every body against
its file. `run.mjs` builds the server and runs the client against each
setting:

```bash
npm run build && node bench/http-compress/run.mjs --requests 50000 --rounds 3
```

| setting | what the server does |
| --- | --- |
| none | no compression: `respond` and `write` |
| level | every body gzipped by `GzipCompressor` at `DEFLATE_FAST` (`encoder = HTTP_ENCODER_LEVEL`, `minLength` 0): compress always, as `HttpCompressor` did before its policy |
| always | every body gzipped, the encoder picked by size (`HTTP_ENCODER_AUTO`: the fixed-Huffman encoder under 16 KB, which is every body here) |
| threshold | as `always`, but `minLength` 1024: smaller bodies sent as they are |
| segment | as `always`, with `segmentMode`: gzip sent only when the response, head included, takes fewer TCP segments of 1,448 bytes than it would as it is |

Per response it reports:

- the server's CPU time, user and system, from `/proc/<pid>/stat`, over the
  measured requests. A loopback send runs the receiver's side of the network
  stack in the sender's context, so this counts the kernel's per-segment work
  as well as the encoder.
- the bytes, segments and pure ACKs the client's `TCP_INFO` counts:
  `bytes_received`, `data_segs_in`, and `segs_out - data_segs_out`.
  Loopback's MTU is 64 KB, so the client sets `TCP_MAXSEG` to 1460 before it
  connects, the MSS an Ethernet peer advertises, and the server's segments
  carry 1,448 bytes each (1,460 less the timestamp option), as on a real
  network.
- the share sent gzip, and each `HttpCompressor.decision` as a share of the
  requests (the server counts them; `GET /stats` returns the counts).

## Result

A 2.3 GHz Xeon virtual machine (4 cores), Linux 6.18, the server built with
`--profile speed`. 50,000 requests a setting after 5,000 to warm up; CPU is
the median of 3 rounds, and the counts are the same in every round. The kernel
counts CPU in 10 ms ticks, so a figure here moves by about ±1 µs between runs.

| setting | server CPU µs/response | bytes/response | segments/response | client ACKs/response | sent gzip |
| --- | --- | --- | --- | --- | --- |
| none | 19.00 | 2783 | 2.44 | 0.63 | 0% |
| level | 38.40 | 1235 | 1.38 | 0.31 | 100% |
| always | 26.00 | 1633 | 1.56 | 0.44 | 100% |
| threshold | 26.40 | 1629 | 1.56 | 0.44 | 75% (too small 25%) |
| segment | 28.00 | 1718 | 1.56 | 0.44 | 57% (no fewer segments 43%) |

- **Compressing saves wire, not time, on loopback.** Every compressed setting
  takes more server CPU than `none`. Gzip at `DEFLATE_FAST` doubles it, from 19
  to 38 µs. The fixed encoder adds 7 µs, a third of that cost, for 1.32 times
  `level`'s bytes. The saving is on the wire: 0.9 to 1.1 fewer segments and
  0.2 to 0.3 fewer ACKs per response. That matters on a network with a real
  round trip and a congestion window. On loopback it costs nothing.
- **Segment mode keeps `always`'s segment count.** It sends 43 % of responses
  as they are, the ones whose gzip would have filled as many segments, so it
  sends 85 bytes more per response than `always` with the same number of
  segments and ACKs, and the client gunzips 43 % fewer responses. Server CPU
  is not lower: segment mode compresses first and then decides, as the
  request allowed. Answering a body whose identity response fits in one
  segment without compressing it would save that work, but this module does
  not do that yet.
- **The size threshold alone** keeps the bodies under 1 KB as they are. Their
  gzip saves bytes but not a segment, and here it costs the same as `always`.

`server.ts` uses the module's own `respondEncoded`, so each row is what an
application gets from the setting.
