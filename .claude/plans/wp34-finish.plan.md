---
name: WP34 — finish the in-repo network stack items
overview: Close every WP34 item that lives in this repository — the constant-time disassembly (K2-K4), a faster P-256 (K5), secp256r1 and a carrier timeout on the TLS server (T1, TLS-4), the HTTP/1.1 interop and the open timeouts (WP39 G1, G2), QUIC datagrams past 1,200 bytes (A1) and the interop runner's congestion cases (Q3) — then tick the roadmap. The cs waves live in the cs repository and staging and are out of scope.
stages:
  - id: ct-asm
    title: "test(crypto): read the ChaCha rounds, the bitsliced AES loops and the X25519 ladder by disassembly"
    goal: K2, K3 and K4's remaining discipline becomes a ct-asm check that fails on a branch or secret-indexed load
    verification: node tests/run.js ct_asm && npm run check && npm run lint
    todos:
      - id: ct-asm-loops
        content: Teach tests/ct-asm.js to check a whole loop body and its back edge, not one step — see ct-asm
      - id: ct-asm-chacha
        content: Pin the ChaCha20 rounds and the loops around both halves in ct_asm_chacha20poly1305 — see ct-asm
      - id: ct-asm-aes
        content: Pin the bitsliced fallback's key schedule, packing and block loops in ct_asm_aes — see ct-asm
      - id: ct-asm-x25519
        content: Pin the 255-step ladder loop, the inversion and the encodings in ct_asm_x25519 — see ct-asm
      - id: ct-asm-record
        content: Update docs/security/ct-verification.md and the crypto records with what is now read and what stays discipline — see ct-asm
  - id: p256-speed
    title: "perf(crypto): a safegcd field inversion and a windowed verify for P-256"
    goal: P-256 signing and verify cost measurably fewer instructions, constant time where a secret is involved, with Wycheproof still passing
    verification: node tests/run.js p256 && node tests/run.js wycheproof && node tests/run.js ct_asm && npm run check && npm run lint
    todos:
      - id: p256-field-inv
        content: Replace Fermat p256FieldInvert with a constant-time safegcd inversion, mirroring p256ScalarInverse (#780) — see p256-speed
      - id: p256-verify-window
        content: Give p256Verify an interleaved variable-base window (public inputs only, variable time allowed) — see p256-speed
      - id: p256-measure
        content: Measure both against the base in valgrind Ir with a noise band and record the figures in the design note's K5 row text in the PR body — see p256-speed
  - id: tls-server
    title: "feat(net): secp256r1 key shares and a carrier idle timeout on the TLS server"
    goal: The TLS 1.3 server accepts secp256r1 (directly or via HelloRetryRequest) and the TCP carrier sheds an idle connection (TLS-4)
    verification: node tests/run.js net_tls && npm run check && npm run lint && node scripts/security-scope.mjs
    todos:
      - id: tls-p256-share
        content: Accept and select a secp256r1 key share in std/net/tls.ts with p256Ecdh, preferring x25519, with HelloRetryRequest when only P-256 is supported — see tls-server
      - id: tls-carrier-timeout
        content: Add a configurable idle timeout to std/net/tls-tcp.ts and close TLS-4 — see tls-server
      - id: tls-tests
        content: Loopback tests for a P-256-only client, an HRR to P-256, an invalid point, and the idle timeout — see tls-server
      - id: tls-docs
        content: Update docs/security/tls.md, its README row, and the TLS guide page — see tls-server
  - id: http-timeouts
    title: "fix(net): a lingering close for HTTP/1.1, SETTINGS and idle timeouts for HTTP/2, a session clock for WebTransport"
    goal: WP39 G2's open findings H1-2, H2-3 and WT-2 are fixed, each with a before/after test
    verification: node tests/run.js net_http1 && node tests/run.js net_http2 && node tests/run.js net_webtransport && npm run check && npm run lint && node scripts/security-scope.mjs
    todos:
      - id: h1-linger
        content: Lingering close after a refusal in std/net/http1-server.ts (RFC 9112 9.6), bounded in bytes and time — see http-timeouts
      - id: h2-timeouts
        content: SETTINGS-ack and idle timeouts in std/net/http2.ts and http2-tls.ts — see http-timeouts
      - id: wt-clock
        content: A session clock and a rate cap in std/net/webtransport.ts — see http-timeouts
      - id: http-timeouts-docs
        content: Mark H1-2, H2-3 and WT-2 fixed in their records and README rows, and update docs/guide/using-nish/networking.md — see http-timeouts
  - id: http1-interop
    title: "test(net): curl and Autobahn for HTTP/1.1 and WebSocket, Chrome over HTTP/1.1, in the interop job"
    goal: WP39 G1's open half runs in .github/workflows/interop.yml and passes
    verification: node tests/run.js net_interop_server && npm run check && npm run lint, then the interop workflow green on the PR head
    todos:
      - id: interop-curl-h1
        content: Add curl --http1.1 over TLS and over plain TCP to the interop job's curl step — see http1-interop
      - id: interop-autobahn
        content: Add an Autobahn fuzzingclient job against the interop server's HTTP/1.1 WebSocket endpoint, failing on any non-OK case — see http1-interop
      - id: interop-chrome-h1
        content: Add a Chrome-over-HTTP/1.1 check modelled on tests/interop/chrome-resume.py — see http1-interop
  - id: quic-pmtu
    title: "feat(net): QUIC sends datagrams past 1,200 bytes after path MTU discovery"
    goal: A1 — the relay carries DATA down above 1,164 bytes once DPLPMTUD has validated a larger path
    verification: node tests/run.js net_quic && node tests/run.js net_http3 && node tests/run.js net_webtransport_datagram && node tests/run.js relay && npm run check && npm run lint
    todos:
      - id: pmtu-probe
        content: DPLPMTUD (RFC 9000 14.3, RFC 8899) in std/net/quic.ts and quic-listener.ts — PADDING+PING probes, validation, black-hole fallback to 1,200 — see quic-pmtu
      - id: pmtu-recovery
        content: Keep quic-recovery.ts's window and pacer correct for a variable datagram size — see quic-pmtu
      - id: pmtu-relay
        content: Lift the relay's 1,164-byte DATA-down limit and pin a loopback datagram above it — see quic-pmtu
  - id: quic-congestion
    title: "test(net): the interop runner's congestion cases"
    goal: Q3 — the quic-interop-runner job runs crosstraffic and goodput and they pass
    verification: node tests/run.js net_quic_recovery && npm run check && npm run lint, then the interop workflow green on the PR head
    todos:
      - id: runner-cases
        content: Add the congestion testcases to the quic-interop-runner job and runner-verdict.py — see quic-congestion
      - id: runner-tune
        content: Fix what they expose in std/net/quic-recovery.ts — see quic-congestion
  - id: roadmap
    title: "docs: tick WP34's and WP39's finished stages"
    goal: The roadmap and design notes say what this run landed
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: roadmap-tick
        content: Tick the merged items on docs/roadmap/wp34-hosting-cs.md and wp39-http-server.md, update Done counts, Next and the index — see roadmap
      - id: roadmap-notes
        content: Update the status rows in docs/wp34-hosting-cs.md and docs/wp39-http-server.md from the merged PRs' bodies — see roadmap
---

# WP34 — finish the in-repo network stack items

## Context

[`docs/roadmap/wp34-hosting-cs.md`](../../docs/roadmap/wp34-hosting-cs.md) has nine open items. Six are in this repository; three (cs waves 3 and 4) need the `amritk/cs` repository, its Rust relay and its staging, and are out of scope. Several WP34 items are the same work as WP39 stages: T1 is G3's `secp256r1`, K5 is G4's faster P-256, T2/H1/H2 are G1 and G2. Status per item: [`docs/wp34-hosting-cs.md`](../../docs/wp34-hosting-cs.md) lines 297-349 and 1059-1080; WP39 G1/G2 in [`docs/wp39-http-server.md`](../../docs/wp39-http-server.md) §3 Part B.

## Shared files

Ownership below is disjoint except for append-style shared files that every stage may need: `tests/run.js` (test sections), `tests/nish-cmp.js` (`DECLARED` entries), `docs/security/README.md` (each stage edits only its own findings' rows), plus generated files. A conflict in these is resolved by the worker updating from `main` when the lead asks; generated files are regenerated, never merged by hand. No stage edits `docs/roadmap/**` or the two design notes — the `roadmap` stage does, from the merged PRs' bodies, so the boxes do not conflict across seven PRs.

Generated: `tests/self/goldens/checked/**`, `tests/differential/**` goldens, `docs/reference/**`, `docs/cookbook/**` outputs, `tests/differential/emit-ts-known.txt` (CI's Node only).

## ct-asm

**Owns:** `tests/ct-asm.js`, `tests/ct-asm-runtime.js`, `tests/cases/ct_asm_chacha20poly1305.*`, `tests/cases/ct_asm_aes.*`, `tests/cases/ct_asm_x25519.*`, `docs/security/ct-verification.md`, `docs/security/crypto-aead.md`, `std/crypto/chacha20poly1305.ts`, `std/crypto/aes.ts`, `std/crypto/x25519.ts`

K2/K3/K4 rows (design note lines 331-333). The checker reads one step today; extend it so a loop's body and its back edge are held to the same rule (the back edge's branch depends only on a public counter). The `std/crypto` files are owned only so a real leak the new check finds can be fixed with a before/after test; no refactor. AEAD-4 (vector registers left behind) and the `--cpu` flag (WP38 S2) stay open and are recorded so. X25519's record lives in `docs/security/crypto-ecc.md`, which `p256-speed` owns; ct-asm records the ladder in `ct-verification.md` only.

## p256-speed

**Owns:** `std/crypto/p256.ts`, `tests/cases/ct_asm_p256.*`, `docs/security/crypto-ecc.md`

Field inversion: safegcd (Bernstein–Yang), as `p256ScalarInverse` already does for the scalar field (#780); currently 22.4% of a signature. Verify: an interleaved wNAF/Shamir window over `u1·G + u2·Q`; verify's inputs are public, so variable time is allowed, and the doc comment says so. 64-bit limbs are out of scope (L, and they lean on WP41's mul-wide). `Measured:` is valgrind Ir, base vs head vs a byte-identical copy of base for the noise band (`.claude/testing.md`).

## tls-server

**Owns:** `std/net/tls.ts`, `std/net/tls/codec.ts`, `std/net/tls/schedule.ts`, `std/net/tls-tcp.ts`, `tests/link/net_tls_*` (new server cases), `docs/security/tls.md`, `docs/guide/using-nish/tls-certificates.md`

The client already offers secp256r1 ([`std/net/tls/client.ts`](../../std/net/tls/client.ts) line 43) and `p256Ecdh` exists in `std/crypto/p256.ts` (exported, takes a `Secret`, validates the point) — use it, do not edit `p256.ts`. Server order: x25519 first; a HelloRetryRequest for secp256r1 when the client supports it but sent no usable share. TLS-4: an idle deadline in the carrier, default on, configurable, using the same clock the HTTP/1.1 request-head deadline (H1-1) uses. `record_size_limit` (G3's other half) is out of scope.

## http-timeouts

**Owns:** `std/net/http1-server.ts`, `std/net/http1-codec.ts`, `std/net/http2.ts`, `std/net/http2-tls.ts`, `std/net/webtransport.ts`, `tests/link/net_http1_server*`, `tests/link/net_http2*`, `tests/link/net_webtransport*` (new cases), `docs/security/http1-codec.md`, `docs/security/http2.md`, `docs/security/webtransport.md`, `docs/guide/using-nish/networking.md`, `docs/guide/using-nish/websocket.md`

H1-2, H2-3 and WT-2 rows of [`docs/security/README.md`](../../docs/security/README.md) (lines 479-484). Reuse H1-1's deadline mechanism; every new limit is configurable and has a default. H3-5 (HTTP/3 has no clock) is not in WP34 or G2's list and stays open.

## http1-interop

**Owns:** `.github/workflows/interop.yml` (the `curl`, a new `autobahn`, and `chrome` jobs only), `tests/interop/**`, `tests/link/net_interop_server/**`, `tests/link/net_interop_server_f64/**`

Verified only in CI: the interop workflow runs on PRs touching `std/net/**`, so this PR must trigger it (its own workflow edit does). No docker daemon in cloud sessions. Autobahn: `crossbario/autobahn-testsuite` fuzzingclient, pinned by digest.

## quic-pmtu

**Owns:** `std/net/quic.ts`, `std/net/quic-listener.ts`, `std/net/quic-packet.ts`, `std/net/quic-frame.ts`, `std/net/quic-datagram.ts`, `std/net/quic-recovery.ts`, `tests/link/net_quic*`, `examples/relay/**`, `docs/security/quic.md`

`QUIC_CONN_DATAGRAM_SIZE = 1200` today (`std/net/quic.ts` ~364). DPLPMTUD with a search up to the peer's `max_udp_payload_size` and the local interface; on probe loss fall back; never exceed what was validated. Loopback's MTU lets a test exercise a larger size. The relay README's 1,164-byte note goes.

## quic-congestion

**Owns:** `.github/workflows/interop.yml` (the `quic-interop-runner` job only), `tests/interop/runner-verdict.py`, `tests/interop/simulator.dockerfile`, `std/net/quic-recovery.ts`, `tests/link/net_quic_recovery*`

Starts after `quic-pmtu` and `http1-interop` merge (it shares `quic-recovery.ts` with the first and `interop.yml` with the second). Proven only in CI.

## roadmap

**Owns:** `docs/roadmap/**`, `docs/wp34-hosting-cs.md`, `docs/wp39-http-server.md`

**Model:** sonnet

Runs last, after every other stage merged or escalated. Ticks only what merged; an escalated stage stays unticked and is named. Next says the cs waves remain, in the cs repository.

## Order

Wave 1, at once: `http1-interop`, `quic-pmtu`, `http-timeouts`, `tls-server` (the CI-only and longest stages first). Wave 2 as slots free: `ct-asm`, `p256-speed`. Then `quic-congestion` once `quic-pmtu` and `http1-interop` merged, then `roadmap`. Merge order edges: `quic-congestion` after `quic-pmtu` and `http1-interop`; `roadmap` after all.

## Out of scope

The cs waves (other repository, staging, Rust relay), P-256 64-bit limbs, AEAD-4 and `--cpu`, `record_size_limit`, H3-5, WebTransport over HTTP/2, 0-RTT.

## Verification

Per stage, its `verification` line; the full suite is CI's eight shards. `src/` is not touched by any stage.
