---
name: WP45 — a DNS stub resolver in std/net/dns
overview: Build the stub resolver docs/wp45-name-resolution.md recommends (no getaddrinfo) in two pull requests. The first ships the sans-IO wire format and configuration parsers, which compile on wasm32. The second ships the resolver, both as a sans-IO core a program drives from its own pollWait loop and as a blocking resolveHost helper for CLIs, with its tests, security record and docs. Fixes #479.
stages:
  - id: dns-wire
    title: "feat(net): DNS message codec and resolv.conf / hosts parsers"
    goal: Pure, bounded DNS wire code and configuration parsers over caller-owned arrays, with no nish:net import, tested with captured packets, a fuzz pass and a wasm32 build, and recorded in docs/security/dns.md
    verification: npm run check && npm run lint && node scripts/security-scope.mjs && node tests/run.js std_dns && node tests/run.js "lists the modules" && node tests/run.js "presence gates" && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: wire-query
        content: Add the A/AAAA query builder to std/net/dns-message.ts — see Stage 1, The message codec
        status: pending
      - id: wire-parse
        content: Add the bounded response parser (header, question match, answers, CNAME, TTL, compression) to std/net/dns-message.ts — see Stage 1, The message codec
        status: pending
      - id: wire-config
        content: Add the resolv.conf and hosts parsers in std/net/dns-config.ts — see Stage 1, The configuration parsers
        status: pending
      - id: wire-register
        content: Register both modules in src/std-modules.ts, release.yml's three presence gates, std/README.md and the wasi link list in tests/run.js — see Stage 1, Registration
        status: pending
      - id: wire-tests
        content: Add tests/link/std_dns_message and tests/link/std_dns_config with captured packets, malformed and compression-loop answers, and a seeded fuzz — see Tests
        status: pending
      - id: wire-record
        content: Write docs/security/dns.md with its Areas index row and scope — see Stage 1, Security record
        status: pending
      - id: wire-guide
        content: Add the nish/net/dns-message and nish/net/dns-config sections to docs/guide/using-nish/standard-library.md — see Stage 1, Docs
        status: pending
  - id: dns-resolver
    title: "feat(net): nish/net/dns, a stub resolver on the caller's loop"
    goal: A sans-IO resolver core and a nish:net driver for it, plus a blocking resolveHost(name, timeoutMs), tested end to end against a Nish DNS server on loopback, with the record, guide and LANGUAGE.md moved to match
    verification: npm run check && npm run lint && node scripts/security-scope.mjs && node tests/run.js std_dns && node tests/run.js reject_net_unknown_export && node tests/run.js "lists the modules" && node tests/run.js "presence gates" && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: res-core
        content: Add the sans-IO resolver core in std/net/dns-resolver.ts — see Stage 2, The core
        status: pending
      - id: res-driver
        content: Add the nish:net driver and resolveHost in std/net/dns.ts — see Stage 2, The driver and resolveHost
        status: pending
      - id: res-register
        content: Register both modules as in Stage 1 — see Stage 1, Registration
        status: pending
      - id: res-tests
        content: Add the loopback DNS server and end-to-end, core, caps and soak tests under tests/link/std_dns* — see Tests
        status: pending
      - id: res-record
        content: Extend docs/security/dns.md and its index row to the resolver — see Stage 2, Security record
        status: pending
      - id: res-docs
        content: Update standard-library.md, networking.md, LANGUAGE.md, AI.md, the reject_net_unknown_export comment and the WP45 status lines — see Stage 2, Docs
        status: pending
---

# WP45 — a DNS stub resolver in `std/net/dns`

## Context

`nish:net` takes address literals only: `netAddress` answers `-22` for a name ([docs/LANGUAGE.md](../../docs/LANGUAGE.md) netAddress row, ~7458, and the "Not yet" bullet, ~7708). [docs/wp45-name-resolution.md](../../docs/wp45-name-resolution.md) weighs `getaddrinfo`, a stub resolver and both, and recommends **the stub resolver alone**. This plan builds it. Issue [#479](https://github.com/amritk/nish/issues/479).

**This plan widens the note in three places, as the requester asked.** These requests override the note's §8 and §3.
- `search` and `ndots` are in scope.
- `timeout` and `attempts` from `resolv.conf` are honoured.
- A blocking `resolveHost(name, timeoutMs)` exists for programs with no loop. It is not `getaddrinfo`: it is the same stub resolver driven by a `pollWait` loop of its own, so it adds no second answer and no hidden reads.

## Approach

| Decision | Why |
| --- | --- |
| Three layers: wire and config (pure), resolver core (sans-IO), driver (`nish:net`) | The pure layers compile on wasm32. The core can be driven by any loop. Only the driver reaches the network. |
| The core never imports `nish:net`, never reads a clock and never reads a file | The caller passes the time and the bytes, so the core's capability report is `entropy` alone. |
| Query IDs come from `crypto.getRandomValues` | It is `entropy`, and an ID that is hard to guess is the point. |
| Each attempt uses a fresh `udpBind("…", 0, 0)` socket | The kernel picks a random ephemeral port, so every query has a random source port. The socket closes when the attempt ends. |
| `resolveHost` reads `/etc/resolv.conf` and `/etc/hosts` itself | Only that helper reaches `fs.read` and `clock`. A program that drives the core does neither. |
| No cache | This follows the note's §6. Answers carry their TTL, and a caller that keeps an answer keeps its TTL. |

N9 holds throughout: pools and buffers are sized at construction and owned by the caller, nothing allocates per packet, and `Arena.used()` stays flat in a soak.

## Stage 1 — `dns-wire`

**Owns:** `std/net/dns-message.ts`, `std/net/dns-config.ts`, `tests/link/std_dns_message/**`, `tests/link/std_dns_config/**`, `docs/security/dns.md`, `docs/security/README.md`, `std/README.md`, `src/std-modules.ts`, `.github/workflows/release.yml` (the three presence-gate lines only), `tests/run.js` (the hand-listed wasi link names only), `docs/guide/using-nish/standard-library.md`, `tests/self/goldens/checked/**` (regenerated only)

### The message codec

`std/net/dns-message.ts` (`nish/net/dns-message`) is pure Nish over `u8[]`, with no `nish:*` import.

- **The query builder** writes one standard query into a caller-owned buffer: an ID, RD set, one question (QTYPE A=1 or AAAA=28, QCLASS IN), and no EDNS. It returns the length or a negative error. It refuses a label over 63 bytes, a name over 255 bytes in wire form, an empty label and a non-ASCII byte. A trailing dot is accepted.
- **The response parser** reads a reply against the query it answers. It checks:
  - the ID and QR bit;
  - the opcode;
  - QDCOUNT is 1, and the question's name, type and class match the query, compared case-insensitively;
  - RCODE, which becomes NOERROR, NXDOMAIN, SERVFAIL, REFUSED or an error;
  - TC, which is reported so the caller can retry over TCP.
- It collects A and AAAA records into caller-owned 18-byte addresses (the address form, with the caller's port) together with each record's TTL. It keeps the CNAME chain that starts at the question name and takes only records whose owner is the current end of that chain. It skips other record types.
- **Bounds.** Every read is checked against the message length. A compression pointer may only point backwards, a name follows at most a constant number of hops (for example 16), and a name is at most 255 bytes. Each count is checked against the bytes left. RDLENGTH must equal 4 for A and 16 for AAAA, and stay within the message. At most `MAX_ANSWERS` (8) addresses are kept; the rest are dropped and counted. The parser never panics and does work linear in the message length.
- Errors are distinct negative constants that are exported and documented.

### The configuration parsers

`std/net/dns-config.ts` (`nish/net/dns-config`) works on bytes the caller has already read, with no `nish:fs` import.

- **resolv.conf:**
  - `nameserver` takes IPv4 and IPv6 literals, up to 3 as glibc keeps them, stored as 18-byte addresses on port 53. Converting a literal without `netAddress` keeps the module pure: write a small literal parser, or use one the repo already has, and say which in the PR.
  - `search` (and `domain`, last one wins) is capped at 6 domains and 256 bytes.
  - `options` takes `ndots:n` (clamped 0..15), `timeout:n` (clamped 1..30 s) and `attempts:n` (clamped 1..5), and ignores the others.
  - `#` and `;` start comments. Unknown lines are ignored, and an over-long line is skipped, not truncated into a value.
  - With no nameserver the default is 127.0.0.1 and ::1. The defaults are ndots 1, timeout 5 and attempts 2.
- **hosts:** an address followed by names, with comments. The parser looks a name up case-insensitively and answers IPv4 and IPv6 addresses separately. Tables have fixed caps that are documented, and an entry past a cap is dropped and counted.

### Registration

A new std module is listed in:
- `src/std-modules.ts` `stdModuleNames` (sorted);
- each of the three `for f in …` presence gates in `.github/workflows/release.yml` (lines ~334, ~425, ~572);
- a row in `std/README.md`.

`tests/run.js` checks the first two. The link tests that build under `--profile wasi` are added to the hand-listed wasi names in `tests/run.js`. A change to `src/` regenerates `tests/self/goldens/checked/` with `node tests/self/goldens.js --update` and runs the `wasi` and `performance` sections ([CLAUDE.md](../../CLAUDE.md)).

### Security record

`docs/security/dns.md` follows the shape of [`url.md`](../../docs/security/url.md) and [`router.md`](../../docs/security/router.md): the anchors' commit, Result, a `## Scope` table naming both files, Threat model, Findings and Properties verified. It names each bound above with the exact `check(...)` string that pins it, and adds a row to the Areas table in [docs/security/README.md](../../docs/security/README.md). `node scripts/security-scope.mjs` must pass.

### Docs

Add rows to the summary table in [standard-library.md](../../docs/guide/using-nish/standard-library.md), plus a `## nish/net/dns-message` section and a `## nish/net/dns-config` section. Follow the page rules in [docs/README.md](../../docs/README.md#writing-a-guide-page).

## Stage 2 — `dns-resolver`

**Depends on `dns-wire` to start** (it consumes that stage's interface). **Owns:** `std/net/dns-resolver.ts`, `std/net/dns.ts`, `tests/link/std_dns/**`, `tests/link/std_dns_resolver/**`, `tests/link/std_dns_caps/**`, `tests/link/std_dns_soak/**`, `docs/security/dns.md`, `docs/security/README.md`, `std/README.md`, `src/std-modules.ts`, `.github/workflows/release.yml` (presence-gate lines only), `tests/run.js` (hand-listed names only), `docs/guide/using-nish/standard-library.md`, `docs/guide/using-nish/networking.md`, `docs/LANGUAGE.md`, `docs/AI.md`, `tests/cases/reject_net_unknown_export.ts`, `docs/wp45-name-resolution.md`, `docs/MASTER_PLAN.md`, `tests/self/goldens/checked/**` (regenerated only)

### The core

`std/net/dns-resolver.ts` (`nish/net/dns-resolver`) is sans-IO and imports only `dns-message` and `dns-config`. Its shape:

```ts
// sketch — names are the worker's, the contract is not
class DnsResolver {
  constructor(config: DnsConfig, hosts: DnsHosts | null, maxLookups: i32)
  // Begins a lookup. localhost and hosts entries complete at once, with no packet.
  start(name: string, port: i32, nowNanos: i64): i32        // lookup id or negative error
  // Work for the driver: which attempt, UDP or TCP, to which server, which bytes.
  nextOutgoing(out: u8[], to: u8[], meta: i32[]): i32
  // Bytes that arrived for an attempt, with their source address.
  receive(attempt: i32, buf: readonly u8[], len: i32, from: readonly u8[], nowNanos: i64): i32
  tick(nowNanos: i64): void                 // expires attempts and moves to the next server
  nextDeadlineNanos(): i64                  // the caller's pollWait timeout is min(its own, this)
  result(lookup: i32, out: u8[], ttls: i32[]): i32   // addresses, 18 bytes each, or a negative error
}
```

- `localhost` and `*.localhost` answer 127.0.0.1 and ::1 with no packet (RFC 6761 §6.3). A hosts entry answers next.
- **Search order.**
  - A name with a trailing dot is absolute.
  - A name with at least `ndots` dots is tried as given first, then with each `search` suffix.
  - A name with fewer dots tries the suffixes first, then the name as given.
  - NXDOMAIN moves on to the next candidate. SERVFAIL or a timeout moves on to the next server.
- A and AAAA are both in flight at once. The lookup completes when both answer or fail, and it fails only if both do.
- **Attempts.** A query tries each nameserver in turn, `attempts` rounds, with `timeout` seconds per try.
- A reply with TC set is retried for that query over TCP to the same server, with a two-byte length prefix.
- **CNAMEs.** A chain that ends inside the reply without the target's records is re-queried for the target. There are at most 8 CNAME hops per lookup, and a loop is an error.
- A reply is dropped, and the attempt keeps waiting, when it comes from any other address or port than the one queried, or when its ID or question does not match. A drop is counted and never fails the lookup.
- Each answer is kept with the smallest TTL in its RRset. At most `MAX_ANSWERS` are kept per lookup.

### The driver and `resolveHost`

`std/net/dns.ts` (`nish/net/dns`) drives the core over `nish:net`.

- **The loop driver** opens a fresh `udpBind` port-0 socket per UDP attempt, or a `tcpConnect` for TCP. It registers them in the caller's poll set with tokens from a caller-given range, routes ready tokens to `receive`, and closes sockets when attempts end. It never calls `pollWait` itself. The caller passes `min(own, nextDeadline)` as its timeout.
- **`resolveHost(name: string, timeoutMs: i32, port: i32 = 0, …)`** is the blocking helper. It reads `/etc/resolv.conf` and `/etc/hosts` (a missing file means the defaults), runs its own `pollCreate`/`pollWait` loop until the lookup completes or `timeoutMs` passes, and returns addresses into a caller-owned array, or a negative error. Its doc comment says it blocks the thread and is meant for CLIs and start-up.
- This helper is the only part that reaches `fs.read` and `clock`.

### Security record

Extend the `## Scope` of `docs/security/dns.md` to both new files, and the index row with it. Add the resolver's threat model: off-path spoofing, met by a random ID, a random port and the source and question checks; a CNAME loop; a TCP length over the buffer; a slow-drip TCP reply bounded by the deadline; and pool exhaustion. List each with the `check(...)` that pins it.

### Docs

- **[standard-library.md](../../docs/guide/using-nish/standard-library.md):** a `## nish/net/dns` section with both usages, the loop driver and `resolveHost`, and its table row.
- **[networking.md](../../docs/guide/using-nish/networking.md):** replace "Hosts are numeric literals … because there is no name resolution" (~29-30) with a short "Resolving a name" section that points at `nish/net/dns`. The `-22` row stays true for `netAddress`.
- **[LANGUAGE.md](../../docs/LANGUAGE.md):** the netAddress row says `-22` for a name and points at `nish/net/dns`. The "Not yet" bullet drops "no name resolution".
- **[AI.md](../../docs/AI.md):** fix ~2182.
- **`tests/cases/reject_net_unknown_export.ts`:** the comment says `dnsLookup` is still not a `nish:net` export because resolution lives in `nish/net/dns`. The case itself stays.
- **WP45 status:** [docs/wp45-name-resolution.md](../../docs/wp45-name-resolution.md) becomes "built", and its row in [docs/MASTER_PLAN.md](../../docs/MASTER_PLAN.md) (~267) changes to match.

## Tests

Mirror [`tests/link/std_json_tokenizer`](../../tests/link/std_json_tokenizer) and `tests/link/std_url`: a `main.ts` with `Suite` from `std/testing`, `expected.out` and `expected.code`. **Captured packets** are real replies, kept as hex byte literals with a comment naming the query and resolver they came from.

| Directory | Stage | Covers |
| --- | --- | --- |
| `tests/link/std_dns_message` | 1 | Query bytes for A and AAAA. Captured replies: plain A, AAAA, a CNAME chain, a compressed name, NXDOMAIN, TC set, more than 8 answers. Malformed replies: a header under 12 bytes; counts past the end; a forward pointer; a self-pointer and a two-pointer **compression loop**; a label over 63; a name over 255; RDLENGTH 5 for A; RDATA past the end; a wrong ID, question or QR. A seeded mutation fuzz (fixed seed, totals pinned, no panic). It also runs under `--profile wasi`. |
| `tests/link/std_dns_config` | 1 | resolv.conf with every directive, clamps, comments, over-long lines, IPv6 nameservers, no nameserver; hosts with aliases, comments, caps, case. It also runs under `--profile wasi`. |
| `tests/link/std_dns_resolver` | 2 | The core driven by scripted packets with no sockets. It covers search and ndots order, the next server on timeout, attempts, TC to TCP, CNAME re-query and loop, spoofed source, ID and question dropped, localhost and hosts. It also runs under `--profile wasi`. |
| `tests/link/std_dns` | 2 | **The end-to-end acceptance test.** A DNS server written in Nish on loopback UDP and TCP serves a test zone (A, AAAA, a CNAME, a name only reachable through `search`, a reply that sets TC). The resolver runs on the same `pollWait` loop. The server asserts that IDs and source ports vary across queries. `resolveHost("localhost", …)` returns with no packet. |
| `tests/link/std_dns_caps` | 2 | `expected.caps.json`: a program driving the core over the loop reports `net` and `entropy` (`clock` from its own `monotonicNanos`), and a program calling `resolveHost` adds `fs.read`. |
| `tests/link/std_dns_soak` | 2 | Many lookups with `Arena.used()` flat. |

Tests in `tests/link` need no `.ll` golden and no differential registration. Any positive `tests/cases/*` a stage adds does: its `.ll`, `node tests/differential/goldens.js --update`, and the checked goldens.

## Out of scope

- `getaddrinfo`, NSS, and an `ffi` route to either.
- A cache, DNSSEC, DoT and DoH, mDNS, and EDNS0.
- Happy Eyeballs: the caller connects.
- A `nish:net` export: `dnsLookup` stays absent.
- WASI preview 2 sockets.
- A DNS server in `std/`: the one the tests need lives in `tests/link`.

## Verification

- `npm run check`, `npm run lint` (run bare, read the exit status), and `node scripts/security-scope.mjs`.
- `node tests/run.js std_dns` and the registry checks (`"lists the modules"`, `"presence gates"`).
- `WASI_SYSROOT=/usr node tests/run.js wasi`: read the skip line.
- `node tests/run.js performance`, because `src/std-modules.ts` changes.
- The full suite is CI's four `test` shards, each one's skip count read.
