# HTTP/3 latency: where the millisecond stalls come from

Issue #670 reported that `std/net`'s HTTP/3 server, run as
`tests/link/net_interop_server serve`, answered a lone client with a median
close to nginx's but a p99 near a millisecond, and that it gave up throughput
under load:

| scenario | nish | nginx |
| --- | --- | --- |
| single (`-c1 -m1`), p50 / p99 | 74 µs / 1.36 ms | 84 µs / 0.35 ms |
| c96 (`-c96 -m1`) | 24k req/s at 66 % server CPU | 43k req/s at 98 % |
| c96m10 (`-c96 -m10`) | 132k req/s | 174k req/s |

This page records what reproduces on a second machine, the leads followed,
and the mechanism that parks responses. It was measured before any change to
`std/`. Every `file:line` anchor below is at commit `99b81d2`, which this
branch leaves untouched under `std/`.

## How it is measured

[`bench/h3-latency.mjs`](../bench/h3-latency.mjs) runs h2load over HTTP/3
against three servers: the interop server, a byte-identical copy of it, and
nginx. [`bench/h3-latency/build-tools.sh`](../bench/h3-latency/build-tools.sh)
builds the tools. [`bench/README.md`](../bench/README.md#http3-latency) says
how to run it.

- The rounds are interleaved: each round runs every target once, in turn.
- The servers are pinned to core 0, and h2load to cores 1–3 with three
  threads.
- p50 and p99 come from h2load's per-request log, not from its rounded summary.
- Server CPU is read from `/proc/<pid>/stat`.
- The copy's spread against the original is the **noise band**. A difference
  smaller than the band is not a difference.

Machine: 4-core Intel Xeon @ 2.80 GHz, Linux 6.18.44, Ubuntu 24.04.5,
Node 22.22.0, loopback. Tools: h2load from nghttp2 1.70.0 over ngtcp2 1.25.0
and nghttp3 1.18.0, and nginx 1.31.7, all against OpenSSL 3.6.5.

## What reproduces

### 100-byte body: the reported shape does not reproduce

`node bench/h3-latency.mjs --runs 9`: 9 rounds of 5 s each, plus a 1 s warm-up.
Each cell is median / min over the rounds. These runs predate the harness
dropping rows h2load logs with no status (the first requests of a run, about
0.5 % of them at c96m10 against nish, none against nginx); its `no status`
column now counts them.

| scenario | target | p50 | p99 | req/s | server busy | CPU/req |
| --- | --- | --- | --- | --- | --- | --- |
| single | nish | 96 µs / 92 µs | 203 µs / 189 µs | 9.1k / 7.2k | 49% / 43% | 53.79 µs / 50.59 µs |
| single | nish-copy | 95 µs / 93 µs | 197 µs / 184 µs | 9.4k / 8.7k | 49% / 47% | 52.07 µs / 51.11 µs |
| single | nginx | 102 µs / 97 µs | 223 µs / 194 µs | 8.6k / 6.0k | 45% / 37% | 52.29 µs / 48.38 µs |
| single | noise (nish vs copy) | ±1.1% | ±3.0% | ±3.0% | ±0.7% | ±3.3% |
| c96 | nish | 2.64 ms / 2.05 ms | 6.01 ms / 5.17 ms | 23.6k / 21.1k | 98% / 97% | 41.84 µs / 36.67 µs |
| c96 | nish-copy | 2.77 ms / 2.34 ms | 6.15 ms / 4.32 ms | 21.7k / 18.4k | 96% / 83% | 44.06 µs / 36.22 µs |
| c96 | nginx | 1.82 ms / 1.64 ms | 32.84 ms / 31.62 ms | 26.9k / 24.6k | 98% / 96% | 36.33 µs / 33.42 µs |
| c96 | noise (nish vs copy) | ±4.5% | ±2.3% | ±8.7% | ±1.8% | ±5.1% |
| c96m10 | nish | 11.37 ms / 9.54 ms | 19.41 ms / 17.01 ms | 55.0k / 53.1k | 98% / 98% | 17.84 µs / 15.20 µs |
| c96m10 | nish-copy | 11.97 ms / 9.73 ms | 18.55 ms / 15.18 ms | 52.8k / 50.2k | 98% / 97% | 18.46 µs / 15.19 µs |
| c96m10 | nginx | 6.62 ms / 6.21 ms | 113.61 ms / 108.28 ms | 70.1k / 67.6k | 98% / 98% | 13.91 µs / 12.95 µs |
| c96m10 | noise (nish vs copy) | ±5.0% | ±4.7% | ±4.1% | ±0.5% | ±3.4% |

**Single.** nish's p99 is 203 µs against nginx's 223 µs: 9.8 % lower,
outside the ±3.0 % band, so nish is not worse here. The tail is thin: of 44,219 requests in one 5 s run, 30 took
0.9 ms or more (0.07 %).

**c96.** Both servers saturate the one core they are pinned to, at 98 %
busy. On this machine nish is CPU-bound there, not idle-waiting as the
issue's 66 % suggests.

**c96m10.** nish costs 17.84 µs of server CPU per request against nginx's
13.91 µs: 28 % more, against a ±3.4 % band. That is a cost per request, not a
stall, and it is outside this page's question.

The issue's figures most likely come from a faster machine, where one core
was not saturated at c96. That is not verified here.

### Larger bodies: the stall reproduces

Raising the body makes the shape appear on this machine. The sweep below is
three interleaved rounds of one 4 s single-client run per body and server;
each cell is the range over the rounds of h2load's summary figures. nginx ran
with `keepalive_requests` raised, so its connection is never recycled
mid-run, as the harness configures it. The sweep was a shell loop beside the
harness, with the same pinning; `node bench/h3-latency.mjs --scenario single
--size <bytes>` reproduces any one row.

| body | nish p50 | nish p95 | nish p99 | nish req/s | nginx p50 | nginx p99 |
| --- | --- | --- | --- | --- | --- | --- |
| 100 B | 93–104 µs | | 182–369 µs | | 105–112 µs | 217 µs–1.38 ms |
| 1 kB | 105 µs | | 193–239 µs | | 99–110 µs | 204 µs–1.32 ms |
| 4 kB | 182–242 µs | 1.46–1.55 ms | 1.57–1.65 ms | 1.8–2.1k | 100–108 µs | 221–640 µs |
| 16 kB | 1.67–1.82 ms | 2.92–2.94 ms | 3.03–3.41 ms | 600–610 | 102–114 µs | |
| 64 kB | 6.13–6.17 ms | | 8.45–8.71 ms | 157–159 | 136–166 µs | |

At 4 kB the median stays within about twice nginx's, but the p95 is already
a millisecond and a half: about a quarter of the requests take one
millisecond more. This is the issue's shape, a fast median and a p99 a
millisecond out. From 16 kB every request pays it, and throughput levels off
near 10 MB/s per connection: about 600 req/s at 16 kB, 10 MB/s at 64 kB.
nginx's own p99 at 100 B and 1 kB swings between rounds; its tail is not
steady on this machine either.

The harness at a 4 kB body (`node bench/h3-latency.mjs --runs 9 --size
4096`), median / min over the rounds:

| scenario | target | p50 | p99 | req/s | server busy | CPU/req |
| --- | --- | --- | --- | --- | --- | --- |
| single | nish | 224 µs / 197 µs | 1.62 ms / 1.59 ms | 1.8k / 1.7k | 29% / 28% | 159.33 µs / 145.50 µs |
| single | nish-copy | 223 µs / 201 µs | 1.61 ms / 1.60 ms | 1.9k / 1.8k | 29% / 29% | 158.62 µs / 148.63 µs |
| single | nginx | 108 µs / 98 µs | 232 µs / 180 µs | 8.2k / 7.1k | 45% / 42% | 55.20 µs / 48.86 µs |
| single | noise (nish vs copy) | ±0.4% | ±0.5% | ±2.2% | ±0.5% | ±0.4% |
| c96 | nish | 6.66 ms / 5.97 ms | 12.69 ms / 11.24 ms | 9.4k / 8.9k | 98% / 98% | 104.51 µs / 97.59 µs |
| c96 | nish-copy | 6.80 ms / 6.04 ms | 13.02 ms / 11.67 ms | 9.3k / 8.8k | 98% / 98% | 106.68 µs / 97.76 µs |
| c96 | nginx | 1.89 ms / 1.84 ms | 33.33 ms / 32.91 ms | 25.3k / 22.7k | 98% / 98% | 38.84 µs / 37.58 µs |
| c96 | noise (nish vs copy) | ±2.0% | ±2.5% | ±1.7% | ±0.1% | ±2.0% |
| c96m10 | nish | 17.65 ms / 16.70 ms | 254.38 ms / 231.46 ms | 11.5k / 11.3k | 98% / 98% | 85.15 µs / 81.24 µs |
| c96m10 | nish-copy | 17.93 ms / 17.08 ms | 265.32 ms / 241.51 ms | 11.3k / 10.8k | 99% / 98% | 87.20 µs / 82.48 µs |
| c96m10 | nginx | 8.14 ms / 7.73 ms | 124.55 ms / 121.72 ms | 56.7k / 53.8k | 98% / 98% | 17.30 µs / 16.32 µs |
| c96m10 | noise (nish vs copy) | ±1.6% | ±4.1% | ±2.2% | ±0.5% | ±2.3% |

**Single.** p99 1.62 ms against nginx's 232 µs, against a ±0.5 % band: the
issue's tail, reproduced. The server is 29 % busy, so it is waiting, not
working, for most of each request.

**c96 and c96m10.** Both servers saturate their core. nish costs 2.7 times
nginx's CPU per request at c96 and 4.9 times at c96m10, so under load it is
CPU-bound, not parked. That is a second finding, below under
[Per-byte cost](#per-byte-cost-the-throughput-gap-under-load).

## Leads

### The pacer: confirmed

A local patch made `pacerDelay` (`std/net/quic-recovery.ts:832`) always
answer 0, so nothing is ever paced:

Same sweep, same rounds, the stock server against the unpaced one:

| body | p50 paced | p50 unpaced | p99 paced | p99 unpaced | req/s paced | req/s unpaced |
| --- | --- | --- | --- | --- | --- | --- |
| 100 B | 93–104 µs | 94–103 µs | 182–369 µs | 182–219 µs | | |
| 4 kB | 182–242 µs | 149–161 µs | 1.57–1.65 ms | 258–316 µs | 1.8–2.1k | 5.6–6.1k |
| 16 kB | 1.67–1.82 ms | 363–370 µs | 3.03–3.41 ms | 653–713 µs | 600–610 | 2.5–2.6k |
| 64 kB | 6.13–6.17 ms | 1.07–1.09 ms | 8.45–8.71 ms | 2.05–2.44 ms | 157–159 | 810–868 |

With the pacer off, the millisecond tail is gone at every size, and 100 B
does not move.

A second local patch counted, in `flushSlot`
(`std/net/http3-server.ts:851`), how often a slot was filed on the wheel at
the pacer's time rather than at the connection's own deadline:

| body | requests | flushes | filed at the pacer's time |
| --- | --- | --- | --- |
| 100 B | 27,508 | 26,000 | 0 |
| 4 kB | 5,563 | 8,000 | 2,748 |
| 16 kB | 1,815 | 4,000 | 2,904 |

The counter printed every 2,000 flushes, so each count is the last multiple of
2,000 the run reached.

At 100 B the pacer never parks a response on this machine. At 4 kB it parks
one flush in three, which matches the quarter of requests that pay a
millisecond. At 16 kB it parks about 1.6 flushes per request.

### The burst cap alone: partial

A local patch raised the pacer's cap from the initial window to
`max(initial window, cwnd)`:

| body | p50 | p95 / p99 |
| --- | --- | --- |
| 4 kB | 203 µs | 1.50 ms / 1.61 ms |
| 16 kB | 393 µs | p95 1.64 ms |
| 64 kB | 1.12 ms | |

This helps large bodies, whose window has grown. It leaves the 4 kB tail
where it was. A small response is application-limited, so its window never
grows past the initial 12,000 bytes (`std/net/quic-recovery.ts:444`, RFC 9002
§7.8). For those responses the cap is not what binds; the millisecond refill
is.

### Delayed ACKs: refuted by reading

`QuicConnection.deadline()` (`std/net/quic.ts:2726`) covers the idle timer,
key retention and loss recovery only. The server has no ACK-delay timer. A
pending ACK goes out with the next flush, which runs on every datagram read,
so it is never held for a timer.

### Not tested

- The wheel moves its cursor to `now + 1` after a tick
  (`std/net/http3-server.ts:938`). This matters only for slots filed for the
  current millisecond, which the pacer never produces: `pacerDelay` answers
  at least 1.
- Whether an ACK-only datagram should need a full datagram's pacer credit. It
  does today (`std/net/quic-listener.ts:934`), but at 100 B the pacer never
  binds.
- The issue's 100 B tail on its own machine. The counter shows the pacer
  parks nothing at 100 B here, so if that tail is real it has a second cause.
  This page does not name one.

### Per-byte cost: the throughput gap under load

The pacer explains the single-client tail, not the c96 gap at 4 kB and up.
From 4 kB up the unpaced server is no faster at c96 than the stock one;
both saturate their core. At 100 B the unpaced range is higher, which this
page does not explain: the counter shows the pacer parks nothing at 100 B.

| body | c96 req/s paced | c96 req/s unpaced | c96 req/s nginx |
| --- | --- | --- | --- |
| 100 B | 22.3–25.8k | 25.7–30.2k | 25.8–28.8k |
| 1 kB | 20.8–21.9k | 19.5–22.1k | 26.3–27.2k |
| 4 kB | 9.3–10.5k | 10.3–10.7k | 24.4–26.3k |
| 16 kB | 3.0–3.4k | 3.5k | 19.0–20.4k |

nginx's cost per request barely moves with the body; nish's grows with it.
A callgrind profile of the unpaced server built with `-g`, counted after a
50-request warm-up over 300 single-client requests, gives about 2.5 M
instructions per 16 kB request against about 157 k per 100 B one: some 148
instructions per body byte. AES is about 1 % of the whole. The rest is
loops that touch the body one byte at a time:

- `streamWrite` copies the body into the stream's ring one byte per
  iteration, with a bounds check each (`std/net/quic-stream.ts:1075`).
- Each ring index is `offset % size` on 64-bit integers, per byte
  (`std/net/quic-stream.ts:272`, about 8 % of instructions).
- Acknowledged data is kept as one bit per byte: an ACK marks its range bit
  by bit (`std/net/quic-stream.ts:1524`, the setter at :187), and the send
  base advances by testing one bit per byte (`std/net/quic-stream.ts:1528`,
  the test at :183). The two bitmap helpers are about 10 %.
- `quicPacketCopy` copies a STREAM frame's payload into the datagram one
  byte at a time (`std/net/quic-packet.ts:540`).

Inclusively, processing incoming packets, mostly ACKs, is 46 % of the 16 kB
profile; building and sealing datagrams 30 %, of which the frame copy is
15 % and sealing 14 %; and `streamWrite` 22 %.

## Cause

**The QUIC pacer works in whole milliseconds and holds at most 12,000 bytes,
so a connection sends at most about ten full datagrams per tick of the
millisecond clock. A response that finds the budget spent waits for the next
tick, about a millisecond.**

1. Every time in `std/net/quic-recovery.ts` is the caller's monotonic clock in
   whole milliseconds (`std/net/quic-recovery.ts:27`).
2. `pacerRefill` (`std/net/quic-recovery.ts:808`) earns `elapsed × cwnd × 5 /
   (rtt × 4)` (line 819).
   - `elapsed` is in whole milliseconds, so nothing is earned between two
     ticks of the clock.
   - `rtt` is `max(smoothedRtt, 1)`. On loopback the real RTT is about 85 µs,
     so the smoothed RTT truncates to 0 ms and `rtt` is 1.
3. The budget is capped at `QUIC_RECOVERY_INITIAL_WINDOW`, 12,000 bytes
   (line 821). With the window at its initial 12,000 bytes, one tick earns
   15,000, which the cap cuts to 12,000.
4. `quicListenerTakeFlight` (`std/net/quic-listener.ts:920`) sends a
   datagram only while the pacer holds credit for a full 1,200-byte datagram
   (line 934). Each datagram is charged its real size.
5. When credit runs out mid-response, `pacerDelay` answers at least 1 ms
   (`std/net/quic-recovery.ts:841`). `flushSlot` then files the connection on
   the timer wheel at that time (`std/net/http3-server.ts:851`). The rest of
   the response goes out on the next millisecond tick.

A 4 kB response takes four datagrams, and the ACKs and HEADERS beside it take
more. Back-to-back requests on one connection use up the 12,000-byte budget
within a millisecond, and the request that finds it spent parks until the
clock ticks. That gives a p50 of 182–242 µs and a p99 of 1.57–1.65 ms where
the unpaced server gives 149–161 µs and 258–316 µs. Bodies of 16 kB and up need more than
one budget per response, so every request waits at least one tick. The rate
ceiling of 12,000 bytes per millisecond is the 10 MB/s plateau.

The rate the pacer aims for, 5/4 of the window per RTT, is RFC 9002 §7.7's.
At an RTT under the clock's resolution, the floor of 1 ms on `rtt` and the
whole-millisecond refill make the real rate up to twelve times lower than
§7.7's for an 85 µs path. The 12,000-byte cap then stops the connection from
catching up.

## Fix direction

Measure before choosing; any of these ships with this harness's figures
before and after.

- **Pace on a finer clock.** Keep the pacer's time and RTT in microseconds,
  so it earns credit between millisecond ticks and uses the real RTT rather
  than a 1 ms floor. A wake that is due sooner than the wheel's 1 ms
  resolution sends at once instead of being filed for the next tick. Loss
  delay and the PTO keep RFC 9002's 1 ms kGranularity floor
  (`QUIC_RECOVERY_GRANULARITY`, applied in `lossDelay` at
  `std/net/quic-recovery.ts:511` and in `ptoBase` at :653); they read the
  same `smoothedRtt`, so the finer units must not lower their floor.
- **Let the burst follow the window.** Cap the budget at `max(initial
  window, cwnd)`, as the second lead measured. It is not enough alone, but
  needed for large bodies once the clock is fixed. RFC 9002 §7.7 says a
  sender SHOULD NOT send a burst larger than the initial window unless it
  knows the path can absorb it, and `pacerRefill`'s comment
  (`std/net/quic-recovery.ts:803`) calls the initial window the largest
  burst it allows; a larger cap has to state that knowledge.
- **Don't pace what isn't a burst.** Skip the credit check for an ACK-only
  datagram, or for a response's datagrams while nothing else is in flight.
  This would need its own measurement; the 100 B results here give no reason
  to expect a gain. The §7.7 limit above applies here too: a skipped check
  may not let a burst past the initial window.

For the per-byte cost under load, separately from the stall:

- **Copy in slices.** Move the body into the ring and into the datagram with
  one bulk copy per contiguous run, not a loop per byte.
- **Keep acknowledged data as ranges.** A send-side ACK record of offset
  ranges makes an ACK cost one operation per range, not per byte, and the
  send base jumps to the end of the first range.
- **Index the ring without a 64-bit modulo per byte.** Reduce the offset
  once per run, or keep the ring a power of two and mask.

At 100 B, nish's c96m10 cost per request is 28 % above nginx's; that part
is not per-byte, and this page leaves it open.
