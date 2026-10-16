---
name: HTTP Date header — every Nish HTTP server sends an IMF-fixdate Date
overview: RFC 9110 §6.6.1 requires an origin server with a clock to send Date; Node, Bun, Go, hyper and nginx all do, and Nish sends none. A shared `HttpDate` formats the IMF-fixdate at most once per second into 29 bytes the pool owns, the HTTP/1.1, HTTP/2 and HTTP/3 response heads write it without allocating, the clock is injectable so byte-exact tests stay deterministic, and bench/http.mjs measures the cost against the noise band.
stages:
  - id: s0-bench
    title: "perf(bench): bench/http.mjs, an HTTP/1.1 server load bench with a noise band"
    goal: A repeatable HTTP server benchmark that times a Nish HTTP/1.1 server under a Node load client, interleaving a build of the tree, a byte-identical copy of it, and a build of another git ref, and prints min/median per column
    verification: node bench/http.mjs --self --runs 15 prints a requests/s min and median for the tree and its byte-identical copy with one response checksum per column; node bench/http.mjs --base origin/main --runs 5 prints the third column; npm run lint passes; npm test compiles the new bench/*.ts
    status: pending
    todos:
      - id: s0-server
        content: Add bench/http-server.ts, a keep-alive Http1Server answering a fixed small response, on the pattern of the repo's own h1 examples/tests — see S0, The server
        status: pending
      - id: s0-harness
        content: Add bench/http.mjs on bench/simd-s0.mjs's pattern (interleaved rounds, a byte-identical copy column, min and median, checksums) plus a --base <ref> column built from a git worktree — see S0, The harness
        status: pending
      - id: s0-record
        content: Document the bench and record main's noise band in bench/README.md — see S0, The record
        status: pending
  - id: s1-date-h1
    title: "feat(net): HTTP/1.1 responses carry a Date header"
    goal: std/net/http-fields.ts gains HttpDate, which formats the IMF-fixdate at most once per second into a 29-byte cache, and every HTTP/1.1 final response carries exactly one Date, with Arena.used() flat on a warmed slot
    verification: npm run check; node tests/run.js link (net_http_date, net_http1*); npm run lint; node tests/run.js wasi (skip line read) and node tests/run.js performance; node docs/check-links.mjs; tests/self/goldens regenerated and read; node bench/http.mjs --base origin/main --runs 15 inside the noise band; the full npm test runs in CI (4 shards), not locally (owner, 2026-10-16)
    status: pending
    todos:
      - id: s1-formatter
        content: Add HttpDate to std/net/http-fields.ts with the hand-written days-to-civil and weekday arithmetic, a 29-byte cache refreshed only when the second changes, and pin/unpin for an injected clock — see S1, HttpDate
        status: pending
      - id: s1-formatter-tests
        content: Add tests/link/net_http_date (and its _f64 twin) pinning the reference instants, the once-per-second refresh count, and a flat arena across a second boundary — see Tests
        status: pending
      - id: s1-h1-write
        content: Write the Date line in http1WriteResponseHead / Http1Connection.respond for final responses only, counted in need and the control reserve — see S1, HTTP/1.1
        status: pending
      - id: s1-program-date
        content: Apply the program's-Date-wins rule on HTTP/1.1 — see The program's own Date
        status: pending
      - id: s1-pool
        content: Give Http1Server and Http1TlsServer one HttpDate shared by every slot, exposed as server.date, and a bare Http1Connection its own — see S1, Who owns the cache
        status: pending
      - id: s1-tests-h1
        content: Pin the clock in every tests/link/net_http1* program whose responses are asserted byte for byte, update expected.out, and add the Date cases listed under Tests — see Tests
        status: pending
      - id: s1-docs
        content: Update std/README.md (http-fields, http1, http1-server rows), docs/guide/using-nish/standard-library.md and docs/security/http1.md — see Docs
        status: pending
      - id: s1-goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff — see Verification
        status: pending
  - id: s2-date-h2-h3
    title: "feat(net): HTTP/2 and HTTP/3 responses carry a date field"
    goal: Every HTTP/2 and HTTP/3 final response head carries exactly one date field from the shared HttpDate, trailers and interim responses carry none, and Arena.used() stays flat on a warmed slot
    verification: npm run check; node tests/run.js link (net_http2*, net_http3*); npm run lint; node tests/run.js wasi (skip line read) and node tests/run.js performance; node docs/check-links.mjs; tests/self/goldens regenerated and read; the full npm test runs in CI (4 shards), not locally (owner, 2026-10-16)
    status: pending
    todos:
      - id: s2-h2
        content: Encode date after :status in Http2Connection.sendHead (HPACK static index 33), grow bound, final responses only — see S2, HTTP/2
        status: pending
      - id: s2-h3
        content: Encode date after :status in Http3Connection.writeHead for responses only (not writeTrailers), counted in size against maxFieldSectionSize and in the bufferSize check — see S2, HTTP/3
        status: pending
      - id: s2-program-date
        content: Apply the program's-Date-wins rule on HTTP/2 and HTTP/3 — see The program's own Date
        status: pending
      - id: s2-pool
        content: Share one HttpDate across Http2TlsServer's and Http3Server's slots, exposed as server.date; a bare Http2Connection / Http3Connection gets its own — see S1, Who owns the cache
        status: pending
      - id: s2-tests
        content: Pin the clock in the net_http2* and net_http3* programs, update expected.out and the peers' decoded field lists, add the Date cases under Tests — see Tests
        status: pending
      - id: s2-docs
        content: Update std/README.md (http2, http2-tls, http3, http3-server rows), the guide page, docs/security/http2.md and docs/security/http3.md — see Docs
        status: pending
      - id: s2-goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff — see Verification
        status: pending
---

## Context

RFC 9110 §6.6.1: an origin server with a clock MUST send a `Date` field in every
2xx, 3xx and 4xx response and MAY send one in 1xx and 5xx; the form is the
IMF-fixdate, `Fri, 16 Oct 2026 08:11:54 GMT` — always 29 bytes. Node, Bun, Go,
hyper and nginx send it on every response. Nish sends none: the three servers
write only `:status` (h2/h3) or the framing fields (h1) themselves.

What exists (main @ 99b81d2):

- **h1.** `Http1Connection.respond` (`std/net/http1-server.ts:758`) calls
  `http1WriteResponseHead` (`std/net/http1.ts:1419`), which counts `need` in
  i64 (1442–1464), writes the status line, the caller's fields (1473–1478),
  `Content-Length` / `Transfer-Encoding` (1479–1485), `Connection` (1486–1490).
  1xx goes through the same `respond` (`interim`, 770). Reserved caller names:
  `http1ServerReserved` (307–312).
- **h2.** `Http2Connection.sendHead` (`std/net/http2.ts:1256`) sizes a `bound`
  (1262–1265), encodes `:status` (`encodeStatus`, 1093–1103), then the caller's
  fields. HPACK static index 33 is `date`.
- **h3.** `Http3Connection.writeHead` (`std/net/http3.ts:1840`) also serves
  `writeTrailers` (status 0). It sums `size` against
  `peer.maxFieldSectionSize` and checks `total > bufferSize`.
- **Clocks.** `Date.now()` is a builtin (`src/builtins.ts:691`, ms as f64). No
  std/net code reads wall time: h1 uses `monotonicNanos()` for idle timeouts,
  h2/h3 connections are sans-IO, and `Http3Server` takes `now: i64` ms from the
  caller.
- **Civil dates.** Only `std/crypto/x509.ts` has any, module-private
  (`x509DaysFromCivil` at 375, a year loop in the Time writer at ~625). There
  is no days-to-civil inverse and no weekday helper, so S1 writes its own (the
  Hinnant `civil_from_days` algorithm, constant time per call, no loop over
  years); x509 is left alone.
- **Arena checks.** `tests/link/net_http1_server/harness.ts:439–487`,
  `tests/link/net_http2/checks.ts:507–526`, `tests/link/net_http2_tls/harness.ts:175–189`,
  `tests/link/net_http3/arena.ts`, `tests/link/net_http3_server/loopback.ts:206`.
- **WP39.** This is [`docs/wp39-http-server.md`](../../docs/wp39-http-server.md)
  E4, "An HTTP date", for the TechEmpower entry (E5), whose rules require a
  `Date` on every response. S1 marks E4 done there if the document keeps a
  status line for it.
- **Bench.** There is no HTTP benchmark; `bench/http.mjs` does not exist, so S0
  builds it.

## The program's own Date — decided at sign-off

**The program's Date wins** (the owner, 2026-10-16). When the fields a program
passes to `respond` include one named `date`, the server writes that one and
skips its own, so the response carries exactly the program's Date. This is how
Go's `net/http`, Node's `setHeader('Date', …)` and hyper behave. `date` is not
added to the reserved names. A program that wants the server's value with a
fixed clock uses `server.date.pin(...)` instead.

Whatever the rule, it is the same on all three protocols, the comparison is
ASCII case-insensitive on the field name, it allocates nothing, and a response
never carries two Date fields.

## S0 — bench/http.mjs

**The server.** `bench/http-server.ts`: an `Http1Server` on a loopback port
given on the command line, keep-alive, answering every request `200` with a
fixed 13-byte body, exiting after a request count it is given and printing a
checksum of what it served. Follow the existing h1 server example/test programs
for the API; it is compiled by `npm test` like every `bench/*.ts`.

**The harness.** `bench/http.mjs` on `bench/simd-s0.mjs`'s pattern:

- Columns: `self` (the tree), `copy` (a byte-identical copy of the same binary,
  so the noise band is measured, not assumed), and with `--base <ref>` a third,
  built from that ref in a temporary `git worktree` with the same `build/nish`.
- The load client is Node (`http.Agent({ keepAlive: true })`, a fixed number of
  concurrent connections, a fixed request count); every response is checked for
  status and body, and the column's checksum folds every body length and status,
  so a column that served nothing cannot look fast.
- Interleaved rounds (`--runs N`, default 15), each column once per round in a
  rotated order; report requests/s min and median per column, and the band as
  `copy / self` min–max over rounds.
- Exit non-zero if a column's checksum disagrees with `self`'s.

HTTP/1.1 is the protocol benched: it is the one server Node can load without
TLS, and S1 and S2 share the one `HttpDate.current()` call each response makes,
so the h1 figure bounds the formatting cost. The per-response HPACK/QPACK
encode of one 29-byte field is S2's own and is reasoned in its PR body, not
benched.

**The record.** A `bench/README.md` section: how to run it, what each column
means, and main's band at the S0 commit on the machine it ran on (the
`Measured:` trailer of S0's commit carries the same figures).

## S1 — HttpDate and HTTP/1.1

### HttpDate

`HttpDate` goes in `std/net/http-fields.ts`, beside the header model, as
[WP39 E4](../../docs/wp39-http-server.md) allows. A module of its own would
also have to be registered in `src/std-modules.ts` and in three file lists of
`.github/workflows/release.yml`, so it stays out of a new file. `http1.ts`
imports it from there. `Date.now()` is a builtin and needs no import.

```ts
export class HttpDate {
  constructor();                    // wall clock, nothing formatted yet
  current(): u8[];                  // the 29 bytes for now; reformats only if the second changed
  pin(unixMs: i64): boolean;        // injected clock: current() answers this instant until unpin();
                                    // false (and no change) outside 1970-01-01T00:00:00Z .. 9999-12-31T23:59:59Z
  unpin(): void;                    // back to Date.now()
  formats(): i64;                   // how many times the bytes were rewritten — what tests count
}
```

- The cache is one `u8[]` of 29 bytes allocated in the constructor and rewritten
  in place; `current()` allocates nothing, ever. The second it holds is an
  `i64` (`floor(ms / 1000)`), and the bytes are rewritten only when the second
  read differs from it. A clock that steps backwards reformats, too: the rule is
  "differs", not "greater".
- Arithmetic is integer-only on `i64`, so `--number-mode f64` gives the same
  bytes: days = floor(seconds / 86400), then `civil_from_days` (era / yoe /
  doy / mp, Hinnant), weekday = (days + 4) mod 7 with 0 = Sunday (1970-01-01
  was a Thursday). Day names and month names come from one constant table of
  bytes, not from string concatenation.
- Read the clock with `Date.now()` converted to `i64` once per `current()`.
  `node tests/run.js wasi` must stay green: if `Date.now()` is refused on
  wasm32, say so in the PR and gate the read the way std already gates
  wasm32-refused builtins rather than dropping the feature.

### Who owns the cache

"Cached by the pool": `Http1Server` and `Http1TlsServer` construct one
`HttpDate` and hand the same object to every `Http1Connection` they create, so N
slots format at most once per second between them. The server exposes it as a
public `date` field, which is how a program or test injects the clock
(`server.date.pin(...)`). An `Http1Connection` constructed on its own builds its
own `HttpDate` unless one is passed. S2 does the same for `Http2TlsServer`,
`Http3Server`, `Http2Connection` and `Http3Connection`, so S1 settles the
constructor shape (an optional trailing `date: HttpDate` argument, or a setter,
whichever fits the existing constructors) and S2 copies it.

### HTTP/1.1

- Final responses (status ≥ 200) only; interim 1xx go out without Date (RFC 9110
  permits either; Node omits it from `100 Continue`, and it keeps the 1xx path
  untouched).
- The line is `Date: <29 bytes>\r\n` (37 bytes), written after the caller's
  fields and before the framing fields, counted in `need` and in the control
  reserve `respond` keeps, so `HTTP1_NO_ROOM` stays exact.
- `Http1Connection.restart()` and `respond` stay allocation-free.

## S2 — HTTP/2 and HTTP/3

### HTTP/2

`sendHead`: after `:status`, `date` encoded through the existing encoder
(static name index 33, literal value, the same indexing mode `:status` uses
unless the HPACK encoder already picks one for repeated values), final
responses only; trailers (`writeTrailers` or the equivalent path) and 1xx carry
none. Grow `bound` by the field's worst-case size.

### HTTP/3

`writeHead` serves responses and trailers: add the field only when it is a
response head (status ≥ 200), counted in `size` with `QPACK_FIELD_OVERHEAD`
against `peer.maxFieldSectionSize` and in the `bufferSize` check.

## Docs

- `std/README.md`: the `http-fields` row names `HttpDate`, and the http1/http1-server (S1),
  http2/http2-tls/http3/http3-server (S2) rows say the server sends Date and how
  to pin the clock.
- `docs/guide/using-nish/standard-library.md`, the nishnet section: what the
  server sends, the program's-own-Date rule, and `server.date.pin` for tests
  (S1 writes the section; S2 adds h2/h3 to it).
- `docs/security/http1.md` (S1), `http2.md` and `http3.md` (S2): add Date to the
  properties verified — the bytes are bounded (37 / one field), counted against
  the output and field-section limits, allocation-free, never doubled — citing
  each check by its exact `check(...)` string, grepped against the tests; a row
  added names the commit its anchors are at (`docs/security/README.md`).

## Tests

- `tests/link/net_http_date` and `net_http_date_f64`: the reference instants
  below byte for byte; `pin` refusing a value before 1970 and after 9999;
  1,000 `current()` calls within one pinned second give `formats()` = 1, and
  stepping the pinned clock across a second gives 2; a backwards step
  reformats; `Arena.used()` unchanged across those calls after the first.

  | unix ms | bytes |
  |---|---|
  | 0 | `Thu, 01 Jan 1970 00:00:00 GMT` |
  | 951782400000 | `Tue, 29 Feb 2000 00:00:00 GMT` |
  | 1709164800000 | `Thu, 29 Feb 2024 00:00:00 GMT` |
  | 1792138314000 | `Fri, 16 Oct 2026 08:11:54 GMT` |
  | 4107542400000 | `Mon, 01 Mar 2100 00:00:00 GMT` |
  | 253402300799000 | `Fri, 31 Dec 9999 23:59:59 GMT` |

- Each protocol (S1: h1; S2: h2, h3): existing byte-exact programs pin the
  server's clock and their expected bytes gain the Date line/field; new cases —
  a final response carries exactly one Date; a 1xx and trailers carry none; the
  program's-own-Date rule (both a lower-case and a mixed-case name); a response
  sized to fit exactly without Date now reports no room (h1 `HTTP1_NO_ROOM`, h3
  field-section limit); `Arena.used()` flat over a warmed slot while the pinned
  clock crosses a second boundary; two slots of one server share one
  `formats()` count.
- Negative tests are the no-room / limit cases and `pin` refusals; each lands in
  both the integer and `_f64` program where the protocol has one.

## Verification

- `npm run check`, `npm run lint`, `node docs/check-links.mjs`.
- `node tests/run.js link` for the touched programs locally. The full
  `npm test` runs in CI's four shards, not locally (owner, 2026-10-16, as in
  #657); a worker reads every shard's skip count on its head.
- std/ changes move `tests/self/goldens/checked.txt`: regenerate with
  `node tests/self/goldens.js --update` (`--seed build/seed/bin/nish` if
  `build/nish` is not built; `bash scripts/fetch-seed.sh --force` first), read
  the diff, never hand-merge.
- `node tests/run.js wasi` (with `WASI_SYSROOT` set; read the skip line) and
  `node tests/run.js performance`.
- S1's commit carries `Measured:` from `node bench/http.mjs --base origin/main
  --runs 15` — self vs base median requests/s and the self/copy band; the
  claim is "inside the band", and if it is not, the PR says so and does not
  merge until the cost is inside it.

## Ownership and order

| Stage | Owns |
|---|---|
| s0-bench | `bench/http.mjs`, `bench/http-server.ts`, `bench/README.md` |
| s1-date-h1 | `std/net/http-fields.ts`, `std/net/http1.ts`, `std/net/http1-server.ts`, `tests/link/net_http_date*/**`, `tests/link/net_http1*/**`, `tests/self/goldens/**`, `tests/differential/goldens/**`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, `docs/security/http1.md`, `docs/wp39-http-server.md` (E4 status only) |
| s2-date-h2-h3 | `std/net/http2.ts`, `std/net/http2-tls.ts`, `std/net/http3.ts`, `std/net/http3-server.ts`, `std/net/http-fields.ts` (only if S2 needs a fix to HttpDate, said in the PR), `tests/link/net_http2*/**`, `tests/link/net_http3*/**`, `tests/self/goldens/**`, `tests/differential/goldens/**`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, `docs/security/http2.md`, `docs/security/http3.md` |

- s0-bench and s1-date-h1 run at once; they share no path.
- s2-date-h2-h3 starts when s1-date-h1 merges: it consumes `HttpDate` and the
  constructor shape S1 settles, and shares the docs and goldens.
- Merge order: s0-bench → s1-date-h1 (S1's `Measured:` needs the bench; S1 may
  run it from S0's branch before S0 merges) → s2-date-h2-h3.

## Out of scope

- A `Server:` header, `Last-Modified`, conditional requests.
- Reusing or refactoring `std/crypto/x509.ts`'s date code.
- Changing `Http1Config` / `Http2Config` / `Http3Config` (a clock is not a cap).
- Benching h2/h3 through a load client.
