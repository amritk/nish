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
`std/`. Every `file:line` anchor below is at commit `ab9099e`, which this
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
Each cell is median / min over the rounds.

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

**Single.** nish's p99 is 203 µs against nginx's 223 µs, both inside the
noise band. The tail is thin: of 44,219 requests in one 5 s run, 30 took
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

Raising the body makes the shape appear on this machine. In the sweep below,
each cell is one 3 s single-client run, and p50 is h2load's summary median.

| body | nish p50 | nish p95 | nish p99 | nginx p50 |
| --- | --- | --- | --- | --- |
| 100 B | 96 µs | 150 µs | 230 µs | 102 µs |
| 1 kB | 117 µs | | | 116 µs |
| 4 kB | 204–257 µs | 1.52–1.56 ms | 1.65–1.69 ms | 137 µs |
| 16 kB | 1.70–1.80 ms | 2.94 ms | 3.12 ms | 145 µs |
| 64 kB | 6.18 ms | | | 228 µs |

At 4 kB the median stays near nginx's, but about a quarter of the requests
take one millisecond more. This is the issue's shape: a fast median and a
p99 a millisecond out. Past 16 kB every request pays it, and throughput levels
off near 10 MB/s per connection: 593 req/s at 16 kB, 9.7 MB/s at 64 kB.

The harness at a 4 kB body (`node bench/h3-latency.mjs --runs 9 --size
4096`):

H3_4K_TABLE

## Leads

### The pacer: confirmed

A local patch made `pacerDelay` (`std/net/quic-recovery.ts:832`) always
answer 0, so nothing is ever paced:

| body | p50 paced | p50 unpaced | p99 paced | p99 unpaced |
| --- | --- | --- | --- | --- |
| 100 B | 96 µs | 96 µs | 203 µs | 202 µs |
| 4 kB | 204–257 µs | 159 µs | 1.65 ms | 321 µs |
| 16 kB | 1.70 ms | 369 µs | 3.12 ms | 653 µs |
| 64 kB | 6.18 ms | 1.10 ms | | 2.10 ms |

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
clock ticks. That gives a p50 of 204–257 µs and a p99 of 1.65 ms where the
unpaced server gives 159 µs and 321 µs. Bodies of 16 kB and up need more than
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
  resolution sends at once instead of being filed for the next tick.
- **Let the burst follow the window.** Cap the budget at `max(initial
  window, cwnd)`, as the second lead measured. It is not enough alone, but
  needed for large bodies once the clock is fixed.
- **Don't pace what isn't a burst.** Skip the credit check for an ACK-only
  datagram, or for a response's datagrams while nothing else is in flight.
  This would need its own measurement; the 100 B results here give no reason
  to expect a gain.

The c96m10 CPU cost per request, 28 % above nginx's, is a separate question
from the stall, and this page leaves it open.
