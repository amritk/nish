---
name: WP82 — std panic-free for QUIC, HTTP/3, TLS, DNS and the rest of std/net
overview: Every std/net module outside the HTTP/1 server stack (WP80) and PostgreSQL (WP81) holds 3579 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014 - DNS 484, TLS record and handshake 472, the TLS and fetch client side 580, QUIC 808, HTTP/3 and QPACK 460, HTTP/2 and HPACK 348, WebTransport, WebSocket, gRPC and OIDC 427. This package removes or proves them, unblocking http-get-json (tls/record-client.ts:802, fetch.ts:431 and 1550, plus one slice in the example itself) and relay (tls/codec.ts:1093, quic-packet.ts:642, plus relay's own grant.ts and main.ts sites). Its first todo adds instruction-count benches for QUIC packet parse, a TLS record seal and open, and a DNS message encode and decode, baselined before any site changes; no PR may raise a count. This is attacker-facing code - update the docs/security record of the area whenever a finding's code moves.
priority: 190
labels: [ready]
issue: 2137
stages:
  - id: s1-dns
    title: WP82 S1 — DNS
    goal: DNS config, message, resolver and client sites are removed or proved; the bench programs land first and are baselined.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2138
    todos:
      - id: s1-bench
        content: Add instruction-count programs to bench/instructions.json (see bench/README.md, Instruction counts, and bench/run.mjs) that call the functions this package changes - QUIC packet parse (quic-packet), a TLS record seal and open (tls/record), a DNS message encode and decode (dns-message), an HTTP/2 frame parse and HPACK decode; baseline them on CI's runner before any site is changed, and take every count from CI's table, never a local run — see WP82 S1
        status: pending
      - id: s1-fix
        content: Remove or prove every site in std/net/dns-config.ts, std/net/dns-message.ts, std/net/dns-resolver.ts, std/net/dns.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S1
        status: pending
      - id: s1-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S1
        status: pending
      - id: s1-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S1
        status: pending
      - id: s1-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S1
        status: pending
  - id: s2-tls-record
    title: WP82 S2 — TLS codec, record, schedule, ticket and verify
    goal: The TLS handshake codec and record layer are cleared, which clears tls/codec.ts:1093 (relay) and tls/record-client.ts:802 (http-get-json).
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2139
    todos:
      - id: s2-fix
        content: Remove or prove every site in std/net/tls/client.ts, std/net/tls/codec.ts, std/net/tls/record-client.ts, std/net/tls/record-server.ts, std/net/tls/record.ts, std/net/tls/schedule.ts, std/net/tls/ticket.ts, std/net/tls/verify.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S2
        status: pending
      - id: s2-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S2
        status: pending
      - id: s2-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S2
        status: pending
      - id: s2-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S2
        status: pending
  - id: s3-client
    title: WP82 S3 — the TLS, fetch and outbound client side
    goal: tls, tls-tcp, fetch, http1-client-codec, outbound and upstream are cleared, which clears fetch.ts:431 and 1550 (http-get-json).
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2140
    todos:
      - id: s3-fix
        content: Remove or prove every site in std/net/tls.ts, std/net/tls-tcp.ts, std/net/fetch.ts, std/net/http1-client-codec.ts, std/net/outbound.ts, std/net/upstream.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S3
        status: pending
      - id: s3-example
        content: Remove the one slice in examples/http-get-json's own source that panics, then drop its opt-out header and smoke args and the guide marker and sentence about it — see WP82 S3
        status: pending
      - id: s3-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S3
        status: pending
      - id: s3-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S3
        status: pending
      - id: s3-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S3
        status: pending
  - id: s4-quic-wire
    title: WP82 S4 — QUIC wire layer
    goal: QUIC packet, frame, ack, connection-id, parameter and datagram sites are cleared, which clears quic-packet.ts:642 (relay).
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2141
    todos:
      - id: s4-fix
        content: Remove or prove every site in std/net/quic-packet.ts, std/net/quic-frame.ts, std/net/quic-conn-ack.ts, std/net/quic-conn-cid.ts, std/net/quic-conn-params.ts, std/net/quic-datagram.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S4
        status: pending
      - id: s4-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S4
        status: pending
      - id: s4-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S4
        status: pending
      - id: s4-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S4
        status: pending
  - id: s5-quic-engine
    title: WP82 S5 — QUIC recovery, streams, connection and listener
    goal: QUIC loss recovery, stream, connection and listener sites are cleared.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2142
    todos:
      - id: s5-fix
        content: Remove or prove every site in std/net/quic-recovery.ts, std/net/quic-stream.ts, std/net/quic.ts, std/net/quic-listener.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S5
        status: pending
      - id: s5-relay
        content: Clear relay's own grant.ts and main.ts sites, then drop examples/relay's opt-out header, smoke args and guide marker and sentence — see WP82 S5
        status: pending
      - id: s5-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S5
        status: pending
      - id: s5-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S5
        status: pending
      - id: s5-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S5
        status: pending
  - id: s6-http3
    title: WP82 S6 — HTTP/3, its frames, QPACK and the HTTP/3 server
    goal: HTTP/3 and QPACK sites are cleared; malformed frames become a Result that maps to the protocol's connection error.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2143
    todos:
      - id: s6-fix
        content: Remove or prove every site in std/net/http3.ts, std/net/http3-frame.ts, std/net/qpack.ts, std/net/http3-server.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S6
        status: pending
      - id: s6-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S6
        status: pending
      - id: s6-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S6
        status: pending
      - id: s6-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S6
        status: pending
  - id: s7-http2
    title: WP82 S7 — HTTP/2, its frames, cleartext and TLS entry points, and HPACK
    goal: HTTP/2 and HPACK sites are cleared.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2144
    todos:
      - id: s7-fix
        content: Remove or prove every site in std/net/http2.ts, std/net/http2-frame.ts, std/net/http2-cleartext.ts, std/net/http2-tls.ts, std/net/hpack.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S7
        status: pending
      - id: s7-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S7
        status: pending
      - id: s7-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S7
        status: pending
      - id: s7-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S7
        status: pending
  - id: s8-realtime
    title: WP82 S8 — WebTransport, WebSocket, gRPC and OIDC
    goal: WebTransport, WebSocket, gRPC and OIDC sites are cleared.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js && node scripts/security-scope.mjs
    issue: 2145
    todos:
      - id: s8-fix
        content: Remove or prove every site in std/net/webtransport.ts, std/net/websocket.ts, std/net/grpc.ts, std/net/oidc.ts the way #2103 did (no nish:unsafe, no made-up-value guards, a Result where the failure is real, a proof where unreachable) — see WP82 S8
        status: pending
      - id: s8-security
        content: Update the docs/security record where a fixed finding moved — see WP82 S8
        status: pending
      - id: s8-pins
        content: Regenerate the pinned std line numbers, the checked goldens and docs/reference, and add the nish-cmp DECLARED and file exit entries the PR's IR moves need — see WP82 S8
        status: pending
      - id: s8-ratchet
        content: Lower tests/std-panics.json to the new exact per-module counts and lower each instruction count that fell to CI's figure, with the before and after table in the PR body — see WP82 S8
        status: pending
---

# WP82 — std panic-free for QUIC, HTTP/3, TLS, DNS and the rest of std/net

## Context

Every std/net module outside the HTTP/1 server stack (WP80) and PostgreSQL (WP81) holds 3579 distinct unproven, non-OOM, non-call, non-unchecked panic sites as of 071ed014: DNS 484, TLS record and handshake 472, the TLS and fetch client side 580, QUIC 808, HTTP/3 and QPACK 460, HTTP/2 and HPACK 348, WebTransport, WebSocket, gRPC and OIDC 427. This package removes or proves them, unblocking http-get-json (tls/record-client.ts:802, fetch.ts:431 and 1550, plus one slice in the example itself) and relay (tls/codec.ts:1093, quic-packet.ts:642, plus relay's own grant.ts and main.ts sites). Its first todo adds instruction-count benches for QUIC packet parse, a TLS record seal and open, and a DNS message encode and decode, baselined before any site changes; no PR may raise a count. This is attacker-facing code: update the docs/security record of the area whenever a finding's code moves.

Examples unblocked: http-get-json (S2, S3), relay (S2, S4, S5). The diagnostic names only the first site per call, so more can appear after a fix.

## Rules every stage of this package follows

1. Remove or prove each site the way #2103 did. No `nish:unsafe`. No made-up-value guard (`if (i < len) x[i] else 0` invents a value and hides the bug). Return a Result where the failure is real (bad input, a short read). Give the compiler a bounds or overflow proof it accepts where the site is unreachable. An explicit `panic(...)` on the kept list stage S1 of `.claude/plans/std-panic-free.plan.md` records stays, with its reason.
2. Each PR lowers `tests/std-panics.json` to the new exact counts (`node tests/run.js std-panics` fails on a fall that is not written back).
3. Drop every opt-out the PR makes unneeded: the example's header comment, its `// smoke: args --allow-panics`, the guide markers and their sentences. The stale opt-out check (`node tests/run.js performance`) fails otherwise.
4. Regenerate every pinned `std/<file>.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`; grep `std/<file>.ts:[0-9]`), the checked goldens (`node tests/self/goldens.js --update`) and the reference (`node scripts/gen-reference.mjs`).
5. Declare nish-cmp moves: `DECLARED` entries in `tests/nish-cmp.js` for every corpus program whose IR moves, and `file: "exit"` entries for a program that flips between refused and compiled or calls a new `std/` export (the seed refuses it). Run nish-cmp locally with `MAX_ROWS` raised in an uncommitted scratch copy to see every row.
6. Performance must improve as the work goes. No PR in this package may raise any count in `bench/instructions.json`; a count that falls is lowered in that PR. Every new or lowered count is taken from the table CI's runner prints (the instructions check in the bench shard), never from a local cachegrind run, and `bench/instructions.json` is never lowered from a local run. Each PR body shows the before and after table.

7. Owns. A stage creates or edits only the files its `Owns:` line names, plus these shared files, where it adds or changes only its own entries: `tests/std-panics.json` (its own modules' rows, rewritten with `node tests/run.js std-panics --update-std-panics`), `bench/instructions.json` (the counts of programs that reach its modules), `tests/nish-cmp.js` (its own `DECLARED` entries), `tests/run.js` (checks about its own modules), `docs/security/*.md` (rule 9), and the `docs/guide/` `allow-panics` markers and sentences that name one of its modules (it removes its modules from a marker, and the marker and its sentence when nothing is left; a marker still needed stays). Generated files are regenerated with their tool, never hand-edited or hand-merged: `tests/self/goldens/checked/**`, `docs/reference/**`, `scalar.config.json`, `docs/IR_COOKBOOK.md`, `tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `tests/differential/**` (the goldens register). A new `tests/link` case goes in a new directory the stage creates, named after its own modules.
8. No public signature change whose callers lie outside the stage's `Owns`. Prove the site instead, or stop and say so in a draft PR.
9. Security records. A stage edits a `docs/security/` record only in the findings, scope lines and `file:LINE` references that cite its own files, and the record's row in `docs/security/README.md` when its counts change. A finding it fixes lands with a before/after test, or stays recorded open. `node scripts/security-scope.mjs` passes.

## Merge order

S1 merges first: its bench programs are the baseline every later count is measured against, so no other stage merges before it. S2 merges before S3 (http-get-json's opt-out needs both, and they share `docs/security/tls.md` and `docs/guide/using-nish/http-client.md`'s markers). S2 and S4 merge before S5 (relay's opt-out needs all three, and S4 and S5 share `docs/security/quic.md` and `quic-multicore.md`). Every other pair is free. Development does not wait on merge order: each stage is written against `main`, and before it merges it updates from `main`, regenerates the generated files, and re-takes its `tests/std-panics.json` rows and bench counts.

## Stages

### S1 — DNS

DNS config, message, resolver and client sites are removed or proved; the bench programs land first and are baselined.
**Owns:** `std/net/dns-config.ts`, `std/net/dns-message.ts`, `std/net/dns-resolver.ts`, `std/net/dns.ts`, `docs/security/dns.md`, `tests/link/net_dns*/**` (new), `bench/std-net-*.ts`, `bench/std-net-*.args` (new), and its own entries in `bench/run.mjs` (`STD_COUNTED`) and `bench/README.md` (the Instruction counts list and its program count), plus the shared and generated files of rule 7.


Sites as of 071ed014 (484): net/dns-config 117, net/dns-message 80, net/dns-resolver 232, net/dns 55. Kinds: index 228, overflow 187, panic 32, array-length 30, slice 4, divide 2, io-exit 1.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `dnsFallbackServers`.

The bench todo lands first in the branch, as its own commit, so CI's first run of the PR prints the four new programs' counts on `main`'s code: those are the baseline written to `bench/instructions.json`. The programs are `bench/std-net-quic-packet`, `bench/std-net-tls-record`, `bench/std-net-dns-message` and `bench/std-net-http2-frame` (an HTTP/2 frame parse and an HPACK block decode), registered in `STD_COUNTED` beside WP80's `std-*` programs.

### S2 — TLS codec, record, schedule, ticket and verify

The TLS handshake codec and record layer are cleared, which clears tls/codec.ts:1093 (relay) and tls/record-client.ts:802 (http-get-json).
**Owns:** `std/net/tls/**`, `docs/security/tls.md`, `tests/link/net_tls_{common,ecdsa,ecdsa_f64,ext_*,memory,memory_f64,p256,psk_wire*,record*,resume*,rfc8448*,ticket*,wipes*}/**`, `tests/fuzz/targets/tls-{record,client-hello,server-flight}.ts`, `tests/fuzz/corpus/tls-{record,client-hello,server-flight}/**`, plus the shared and generated files of rule 7.


Sites as of 071ed014 (472): net/tls/client 36, net/tls/codec 149, net/tls/record-client 63, net/tls/record-server 63, net/tls/record 62, net/tls/schedule 26, net/tls/ticket 72, net/tls/verify 1. Kinds: overflow 315, index 105, array-length 39, slice 5, panic 3, io-exit 3, divide 2.

### S3 — the TLS, fetch and outbound client side

tls, tls-tcp, fetch, http1-client-codec, outbound and upstream are cleared, which clears fetch.ts:431 and 1550 (http-get-json).
**Owns:** `std/net/tls.ts`, `std/net/tls-tcp.ts`, `std/net/fetch.ts`, `std/net/http1-client-codec.ts`, `std/net/outbound.ts`, `std/net/upstream.ts`, `examples/http-get-json.ts`, `docs/security/{fetch,http1-client-codec,outbound,upstream}.md`, `tests/link/net_tls_client_*/**`, `tests/link/net_{fetch,http_fetch,http1_client,outbound,upstream}*/**`, `tests/fuzz/targets/http1-client.ts`, `tests/fuzz/corpus/http1-client/**`, plus the shared and generated files of rule 7.


http-get-json's opt-out also names `std/json` (WP80 S1) and a slice in the example itself. The opt-out is dropped once S2, WP80 S1 and this stage have merged and the example builds without `--allow-panics`; if a site outside WP82 still remains when this stage merges, the header is rewritten to name only what remains, and the PR body says which.

Sites as of 071ed014 (580): net/tls 121, net/tls-tcp 64, net/fetch 112, net/http1-client-codec 157, net/outbound 59, net/upstream 67. Kinds: overflow 304, index 175, array-length 52, slice 23, panic 10, io-exit 7, divide 7, pop 2.

### S4 — QUIC wire layer

QUIC packet, frame, ack, connection-id, parameter and datagram sites are cleared, which clears quic-packet.ts:642 (relay).
**Owns:** `std/net/quic-packet.ts`, `std/net/quic-frame.ts`, `std/net/quic-conn-ack.ts`, `std/net/quic-conn-cid.ts`, `std/net/quic-conn-params.ts`, `std/net/quic-datagram.ts`, `tests/link/net_quic_{packet,frame,conn,datagram,common}*/**`, `tests/fuzz/targets/quic-{frame,header}.ts`, `tests/fuzz/corpus/quic-{frame,header}/**`, plus the shared and generated files of rule 7.


Sites as of 071ed014 (267): net/quic-packet 127, net/quic-frame 67, net/quic-conn-ack 20, net/quic-conn-cid 21, net/quic-conn-params 9, net/quic-datagram 23. Kinds: overflow 221, index 26, array-length 11, divide 5, slice 4.

### S5 — QUIC recovery, streams, connection and listener

QUIC loss recovery, stream, connection and listener sites are cleared.
**Owns:** `std/net/quic-recovery.ts`, `std/net/quic-stream.ts`, `std/net/quic.ts`, `std/net/quic-listener.ts`, `examples/relay/**`, `tests/link/net_quic_{recovery,stream,lifecycle,listener,memory,ecn,path,prefork,server_wipes,wipes,worker}*/**`, `tests/link/net_relay*/**`, plus the shared and generated files of rule 7.


Relay's opt-out also names its four pinned `panic`s (relay.ts, peers.ts, pinned by its link tests), its I/O exits, and its frame and JSON parsers. This stage clears relay's grant.ts and main.ts sites and the `std/net` sites relay reaches in its modules; it drops the opt-out only if relay then builds without `--allow-panics`, and otherwise rewrites the header to name only what remains.

Sites as of 071ed014 (541): net/quic-recovery 124, net/quic-stream 132, net/quic 203, net/quic-listener 82. Kinds: overflow 433, index 53, array-length 30, divide 17, panic 6, pop 2.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `QuicStreams.borrowRecv`, `QuicStreamPools.lend`.

### S6 — HTTP/3, its frames, QPACK and the HTTP/3 server

HTTP/3 and QPACK sites are cleared; malformed frames become a Result that maps to the protocol's connection error.
**Owns:** `std/net/http3.ts`, `std/net/http3-frame.ts`, `std/net/qpack.ts`, `std/net/http3-server.ts`, `docs/security/http3.md`, `tests/link/net_{http3,qpack}*/**`, plus the shared and generated files of rule 7.


Sites as of 071ed014 (460): net/http3 248, net/http3-frame 21, net/qpack 38, net/http3-server 153. Kinds: index 221, overflow 182, array-length 32, panic 12, divide 7, slice 4, io-exit 2.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `Http3Connection.share`.

### S7 — HTTP/2, its frames, cleartext and TLS entry points, and HPACK

HTTP/2 and HPACK sites are cleared.
**Owns:** `std/net/http2.ts`, `std/net/http2-frame.ts`, `std/net/http2-cleartext.ts`, `std/net/http2-tls.ts`, `std/net/hpack.ts`, `docs/security/{http2,http2-cleartext}.md`, `tests/link/net_{http2,hpack}*/**`, `tests/fuzz/targets/hpack.ts`, `tests/fuzz/corpus/hpack/**`, plus the shared and generated files of rule 7.


Sites as of 071ed014 (348): net/http2 92, net/http2-frame 81, net/http2-cleartext 48, net/http2-tls 8, net/hpack 119. Kinds: overflow 202, index 103, panic 28, pop 6, array-length 4, slice 3, divide 2.

### S8 — WebTransport, WebSocket, gRPC and OIDC

WebTransport, WebSocket, gRPC and OIDC sites are cleared.
**Owns:** `std/net/webtransport.ts`, `std/net/websocket.ts`, `std/net/grpc.ts`, `std/net/oidc.ts`, `docs/security/{webtransport,grpc,oidc}.md`, `tests/link/net_{webtransport,websocket,grpc}*/**`, `tests/fuzz/targets/websocket{,-client}.ts`, `tests/fuzz/corpus/websocket{,-client}/**`, plus the shared and generated files of rule 7.


Sites as of 071ed014 (427): net/webtransport 214, net/websocket 165, net/grpc 30, net/oidc 18. Kinds: index 196, overflow 162, array-length 45, panic 13, slice 7, divide 3, io-exit 1.

Explicit panics to fix, not kept (their reasons were internal invariants or unreachable guards, not a contract the doc states): `websocketFrame`, `websocketWriteFrame`.

## Acceptance criteria

Checked on `main` after the last stage merges.

1. `node tests/run.js std-panics` passes, and `tests/std-panics.json` lists no site in any of the 41 modules this package names (S1 to S8), except an explicit `panic(...)` in a function on the kept list.
2. None of `dnsFallbackServers`, `QuicStreams.borrowRecv`, `QuicStreamPools.lend`, `Http3Connection.share`, `websocketFrame` or `websocketWriteFrame` calls `panic(...)`, and none is on the kept list.
3. `bench/instructions.json` holds the four `std-net-*` programs (QUIC packet parse, TLS record seal and open, DNS message encode and decode, HTTP/2 frame parse and HPACK decode), and no count in it is higher than at the commit where S1 merged.
4. `build/nish examples/http-get-json.ts` and `build/nish examples/relay/main.ts`, built without `--allow-panics`, report no panic site in a WP82 module; each example builds without the flag or its opt-out header names only sites outside WP82.
5. Malformed input is an error, not an abort: a truncated DNS answer, a truncated QUIC long header, a malformed HTTP/3 frame and a malformed HPACK block each give an error the caller handles (an `Err`, or the protocol's connection error), pinned by a `tests/link` case that exits 0.
6. `node scripts/security-scope.mjs` passes, and every `docs/security/` record whose cited code moved cites the current lines.
7. No `docs/guide/` `allow-panics` marker names a WP82 module.
8. `main`'s CI is green on the last merge commit: every `test (…, shard N/9)` row, `examples`, `bootstrap`, `nish-cmp` and `lint`.
