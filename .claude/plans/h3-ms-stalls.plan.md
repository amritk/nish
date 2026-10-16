---
name: HTTP/3 server — find and remove the ~1 ms stalls
overview: Nish's HTTP/3 server has nginx-class median latency but a 1.36 ms p99 and sits 34% idle at 96 connections, which points at work parked until a millisecond tick. The first stage builds an h2load harness, reproduces the stalls and names their cause with evidence, changing nothing in std/. The second fixes that cause in the QUIC stack, pins the new timing with tests and records it in docs/security/http3.md.
stages:
  - id: h3-diagnose
    title: perf(std) — an HTTP/3 latency harness, and the cause of the 1 ms stalls
    goal: A committed, rerunnable h2load harness that reproduces the three figures against tests/link/net_interop_server serve mode and nginx, and a record in docs/h3-latency.md that names which mechanism parks responses, measured before any change to std/
    verification: bash bench/h3-latency/build-tools.sh and node bench/h3-latency.mjs --runs 5 print the three scenarios for nish, nish-copy and nginx with latency p50/p99, req/s and server CPU; npm run lint and node docs/check-links.mjs pass
    status: pending
    todos:
      - id: diag-tools
        content: Add bench/h3-latency/build-tools.sh that builds OpenSSL 3.6.5, nghttp3 1.18.0, ngtcp2 1.25.0, nghttp2 1.70.0 (h2load with HTTP/3, gcc-14) and nginx 1.31.7 with http_v3 into a cache directory — see Stage 1, The tools
        status: pending
      - id: diag-harness
        content: Add bench/h3-latency.mjs, which runs the three scenarios against nish, a byte-identical copy of the nish binary and nginx in interleaved rounds, pinned with taskset, reading h2load's request row and /proc/<pid>/stat — see Stage 1, The harness
        status: pending
      - id: diag-reproduce
        content: Reproduce the three figures on the session's machine and record them with their noise band in docs/h3-latency.md — see Stage 1, Reproduce
        status: pending
      - id: diag-localise
        content: Localise the stall with local, uncommitted instrumentation and experiments, one lead at a time, and record the evidence and the named cause in docs/h3-latency.md — see Stage 1, Localise
        status: pending
      - id: diag-readme
        content: Describe the harness in bench/README.md — see Stage 1, The harness
        status: pending
  - id: h3-fix
    title: perf(std) — answer on loopback without waiting for the next millisecond
    goal: Remove the cause the diagnosis record names, so that single-connection p99 is within 2x of nginx's, the server is at least 95% busy at 96 connections, and 10 streams per connection does not regress, with RFC 9002 pacing, ack delay and PTO still correct
    verification: node bench/h3-latency.mjs --runs 9 --baseline <h3-diagnose merge SHA> shows the three acceptance figures with the noise band; node tests/run.js net_quic, net_http3, net_interop and net_loopback and npm run check pass; an undegraded npm test is green; tests/self/goldens regenerated and read
    status: pending
    todos:
      - id: fix-root-cause
        content: Change the mechanism docs/h3-latency.md names in std/net, keeping RFC 9002's timer granularity for loss and PTO — see Stage 2, The fix
        status: pending
      - id: fix-pin-timing
        content: Pin the new timing behaviour with checks in tests/link/net_quic_recovery, tests/link/net_http3_server and, where the serve loop changed, tests/link/net_interop_server — see Stage 2, Tests
        status: pending
      - id: fix-security-record
        content: Record the changed timer or recovery behaviour in docs/security/http3.md (and docs/security/quic.md when recovery changed), anchored at the commit — see Stage 2, The security record
        status: pending
      - id: fix-measure
        content: Re-run the harness against the pre-fix build and write the after figures and noise band into docs/h3-latency.md and the commit's Measured trailer — see Stage 2, Measuring
        status: pending
      - id: fix-goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff — see Verification
        status: pending
---

## Context

Measured on one core, loopback, h2load 1.70 with HTTP/3, against [tests/link/net_interop_server](../../tests/link/net_interop_server/main.ts)'s `serve` mode:

| scenario | Nish | nginx 1.31.7 |
|---|---|---|
| 1 connection, 1 request in flight | p50 74 µs, **p99 1.36 ms** | p50 84 µs, p99 0.35 ms |
| 96 connections × 1 in flight | 24k req/s, **server 66% busy** | 43k req/s, 98% busy |
| 96 connections × 10 in flight | 132k req/s, 7.5 µs CPU/req | 174k req/s, 5.7 µs CPU/req |

The server is waiting, not working. A read of the code (no runs yet) found these places where ready work can wait for a millisecond tick:

| lead | where | what it does on loopback |
|---|---|---|
| Pacer | [std/net/quic-recovery.ts](../../std/net/quic-recovery.ts) `pacerDelay` / refill (~808–845) | Integer ms. `smoothedRtt` floors to 0 on loopback, so the rate uses `GRANULARITY` = 1 ms; the budget is capped at 12,000 bytes and refills only when a whole ms has elapsed. A connection sending more than ~10 datagrams inside one ms waits for the next. The delay rounds up and is at least 1 ms. |
| Pacing ACK-only datagrams | [std/net/quic-listener.ts](../../std/net/quic-listener.ts) `quicListenerTakeFlight` (~920–951) | The pacer test runs before any datagram is built, so a pure ACK waits too. RFC 9002 §7 does not congestion-control ACK-only packets. |
| Wheel clamp | [std/net/http3-server.ts](../../std/net/http3-server.ts) `Http3Wheel.file` / `tick` (~330–357, 924–938) | `tick` ends with `cursor = now + 1` and a past deadline is clamped to `cursor`, so an already-due deadline is waited out for at least 1 ms. |
| Floored clock | [tests/link/net_interop_server/server.ts](../../tests/link/net_interop_server/server.ts) `nowMs` (66), `step` (184–222) | `monotonicNanos() / 1000000` floors, and `epoll_wait` takes whole ms, so a timed wake lands up to ~1–2 ms late. |
| RTT in ms | `quic-recovery.ts` RTT sample (~467–489) | A 48 µs RTT is sampled as 0 ms: `lossDelay` floors to 1 ms, PTO is 26 ms. |

The requirement is explicit: reproduce first, and find which of these it is before changing anything. Hence two stages in sequence.

## Approach

- **Two PRs, in order.** `h3-diagnose` lands a harness and a written diagnosis without touching `std/`, so the fix PR is reviewed against a measured cause rather than a guess. `h3-fix` starts only once `h3-diagnose` has merged, because its todos depend on what the diagnosis finds. Its fix is not fixed in advance: it changes the mechanism the record names, and the record names the cause before the fix is written.
- **The harness is the acceptance instrument.** The same script the fix stage uses is what acceptance runs on merged `main`, comparing pre-fix and post-fix builds in one container.
- **Noise band on every figure** (CLAUDE.md, #538). Every run includes `nish-copy`, a byte-identical copy of the nish binary, timed in the same interleaved rounds. A delta counts only outside the nish against nish-copy band.
- **No `src/` change is expected.** `monotonicNanos()` already gives sub-ms time to `std/`, so the rolling freeze does not bite. If the fix turns out to need a new builtin, the worker stops and says so in a draft PR rather than widening the stage.

## Stage 1 — h3-diagnose

**Owns:** `bench/h3-latency.mjs`, `bench/h3-latency/**`, `bench/README.md`, `docs/h3-latency.md`. All are new except `bench/README.md`. Nothing in `std/`, `src/`, `runtime/` or `tests/` changes in this stage; the instrumentation is local and is not committed.

### The tools

`bench/h3-latency/build-tools.sh [--prefix <dir>]` (default `~/.cache/nish-h3-bench`), idempotent: it skips a component already installed at the pinned version.

- OpenSSL 3.6.5: `./Configure --libdir=lib no-docs no-tests`
- nghttp3 v1.18.0 and ngtcp2 v1.25.0: `--enable-lib-only --with-openssl`, against that OpenSSL
- nghttp2 v1.70.0: `CC=gcc-14 CXX=g++-14 ./configure --enable-http3 --enable-app --with-libngtcp2 --with-libnghttp3`. nghttp2 1.70 needs C++23's `<print>`, which GCC 13 lacks; on Ubuntu 24.04, `apt-get install gcc-14 g++-14` after `apt-get update`.
- nginx 1.31.7 `--with-http_v3_module --with-http_ssl_module`, against the same OpenSSL.

The script verifies each tarball's checksum. It records the URL and the SHA-256 in the script.

### The harness

`node bench/h3-latency.mjs [--runs N] [--duration S] [--scenario single|c96|c96m10|all] [--baseline <git-rev>] [--nginx|--no-nginx]`

- Builds `build/interop-server` from the checkout (`build/nish tests/link/net_interop_server/main.ts -o build/interop/ --link build/interop-server`) and copies it byte for byte to `build/interop-server-copy`. With `--baseline <rev>`, it also builds the server from that revision in a worktree, so a fix is measured against its own base in the same rounds.
- Serves one small fixed file from a temp `--www` dir. nginx serves the same file with a generated config: one worker, `listen 443 quic reuseport`, the same certificate.
- Pins the server with `taskset -c 0` and h2load with `taskset -c 1-3` using `-t 3`, `--npn-list h3` (or `--alpn-list h3`).
- Scenarios: `single` is `-c 1 -m 1`, `c96` is `-c 96 -m 1`, `c96m10` is `-c 96 -m 10`, each for a fixed request count or duration.
- Per run it reads h2load's `requests:` and `req/s` lines and its `request :` latency row (min, max, mean, sd). It also reports p50 and p99. When h2load's summary has no p99, it computes p50 and p99 from h2load's `--log-file` per-request times. It computes server CPU busy % from utime+stime deltas in `/proc/<pid>/stat` over the run window, divided by wall time.
- Runs targets in interleaved rounds (nish, nish-copy, nginx, baseline…) and prints a table of the min and median per target and scenario, plus the noise band, which is the spread between nish and nish-copy.

`bench/README.md` gets a short section: what it measures, the build-tools step, the commands.

### Reproduce

Run `--runs 9` for all three scenarios on the session's container, then write the table into `docs/h3-latency.md` with the machine (`nproc`, CPU model, kernel), the tool versions and the noise band. The figures need not match the ones above in absolute terms. What has to reproduce is their shape: a p99 well above nginx's at `single`, and idle server CPU at `c96`. If the shape does not reproduce, the record says so with the figures, and the stage stops there as a draft PR.

### Localise

Test one lead at a time, each with a measurement, and record each result, refuted ones included. Example experiments, which are not commitments:

- Count, per run, how often `pacerDelay` held a datagram, how often a flight was ACK-only and held, and how many wakes came from the wheel rather than from a readable socket. Use temporary counters printed at SIGTERM.
- Remove one parker at a time in a local build: the pacer budget, ACK-only pacing, the `cursor + 1` clamp, the floored `nowMs`. Re-measure `single` p99 and `c96` CPU after each.
- Log `smoothedRtt`, `latestRtt` and the pacer budget over a `single` run.

The record ends with a **Cause** section naming the mechanism or mechanisms, with the numbers that show it, and a **Fix direction** that `h3-fix` will follow.

## Stage 2 — h3-fix

**Owns:** `std/net/**`, `tests/link/net_*/**`, `docs/security/http3.md`, `docs/security/quic.md`, `docs/h3-latency.md`, `bench/h3-latency.mjs`, `bench/h3-latency/**`, `docs/guide/using-nish/standard-library.md` (only if a public API's units change), and `tests/self/goldens/**` (generated). It starts after `h3-diagnose` merges, so sharing `docs/h3-latency.md` and the harness with it is sequential, not concurrent.

### The fix

Follow `docs/h3-latency.md`'s Fix direction. The shape depends on what was found; each lead in Context maps to a fix like this:

| cause | expected fix | RFC 9002 constraint that stays |
|---|---|---|
| Pacer in whole ms | Keep the pacer's clock, refill and delay in µs, or carry the sub-ms remainder, so the rate on a 48 µs RTT is the real one, and the delay is not rounded up to 1 ms | §7.7: pace at a rate based on cwnd/srtt. A burst is still bounded by the initial window. |
| ACK-only paced | Exempt ACK-only datagrams from the pacer and the cwnd check | §7: ACK-only packets are not congestion controlled. |
| RTT floored to 0 ms | Sample and smooth RTT in µs, and convert at the timer boundary | §6.1.2 / §6.2.1: kGranularity of 1 ms stays the floor of loss delay and PTO. |
| Wheel clamp / floored wake | Let an already-due deadline report a timeout of 0, and compute the poll timeout from a µs clock, rounding a future deadline up rather than truncating it | None: a wake must not be early enough to busy-spin with nothing due. |

The fix keeps the zero-allocation-per-request property and the existing f64 mode (`net_http3_server_f64`, `net_interop_server_f64`).

### Tests

New checks in the existing link programs, mirroring the style of [tests/link/net_quic_recovery/unit.ts](../../tests/link/net_quic_recovery/unit.ts) (`:247–257`, the pacer checks) and [tests/link/net_http3_server/units.ts](../../tests/link/net_http3_server/units.ts) (`:55–110`, the wheel checks). Each one pins a specific number:

- the behaviour that caused the stall now does the right thing (for example, a sub-ms RTT gives a pacer rate that releases the next datagram in µs, not at the next ms; an ACK-only flight is not held; a due deadline gives timeout 0);
- what RFC 9002 still requires, at the new resolution: the pacer still holds a burst past the initial window for the right time, the loss delay floor and the PTO floor are still kGranularity, and `max_ack_delay` still enters PTO only after handshake confirmation;
- the existing pacing, PTO and ack-delay checks still pass with unchanged expectations, or have a stated reason for each change.

Update `expected.out` goldens with the repo's tooling, not by hand.

### The security record

[docs/security/http3.md](../../docs/security/http3.md): a row for each timer or recovery behaviour that changed, in the existing row format, plus updates to the narrative about the wheel and pacer (~190–207). Its `file:line` anchors are at the PR head's commit, which the row names (CLAUDE.md, Security). Every check the row cites is named by its exact `check(...)` string, grepped against the tree. Update [docs/security/quic.md](../../docs/security/quic.md) as well when `quic-recovery.ts` changed.

### Measuring

`node bench/h3-latency.mjs --runs 9 --baseline <h3-diagnose merge SHA>`, all three scenarios, interleaved. Write the after-table into `docs/h3-latency.md` beside the before-table, and put the three acceptance figures with their noise band in the commit's `Measured:` trailer, copied from the harness output on the head being merged.

## Out of scope

- The broader G8 benchmark (`docs/wp39-http-server.md`), which covers HTTP/2, `docs/BENCHMARKS.md` and CI. The harness here is HTTP/3 latency only and does not run in CI.
- HTTP/1.1 and HTTP/2 serve loops, TLS, QPACK, and the per-request CPU cost beyond what the stall fix moves. The 7.5 µs vs 5.7 µs gap at `c96m10` is only required not to get worse.
- Changing congestion control (NewReno) or the idle timeout.
- Any `src/` or `runtime/` change.

## Tests

- Stage 1 adds no test. Its deliverables are a script and a record, checked by `npm run lint` and `node docs/check-links.mjs`.
- Stage 2: see Stage 2, Tests. Targeted runs use `node tests/run.js <filter>` with net_quic, net_http3, net_interop and net_loopback.

## Verification

- Stage 1: `bash bench/h3-latency/build-tools.sh`; `node bench/h3-latency.mjs --runs 5`; `npm run lint`; `node docs/check-links.mjs`.
- Stage 2: `node tests/run.js net_quic`, `net_http3`, `net_interop`, `net_loopback` (the filter rules are in `.claude/testing.md`); `npm run check`; `npm run lint`; `node tests/self/goldens.js --update` (add `--seed build/seed/bin/nish` if `build/nish` is not built) and read the diff; `node bench/h3-latency.mjs --runs 9 --baseline <rev>`; then an undegraded `npm test`. Read the skip count, not just the exit code.
