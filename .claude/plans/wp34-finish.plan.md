---
name: WP34 — finish the in-repo network stack items (second run)
overview: The first run (tracking issue #1430) merged five of WP34's in-repo stages. This run lands the rest — the WP39 G2 timeouts (PR #1454, held by a QUIC rebinding failure in the interop runner), the runner's congestion cases (Q3), a TLS handshake driven to completion through a HelloRetryRequest (#1472) — and then ticks the roadmap. The cs waves live in the cs repository and staging and stay out of scope.
stages:
  - id: http-timeouts
    title: "fix(net): a lingering close for HTTP/1.1, SETTINGS and idle timeouts for HTTP/2, a session clock for WebTransport"
    goal: PR #1454 merges with the cause of the rebind-addr truncation named and evidenced, and the runner's rebind cases passing on its head
    verification: node tests/run.js net_http1 && node tests/run.js net_http2 && node tests/run.js net_webtransport && node tests/run.js net_interop_server && npm run check && npm run lint && node scripts/security-scope.mjs
    todos:
      - id: rebind-root-cause
        content: Name the root cause of the quic-interop-runner (ngtcp2) rebind-addr truncation at 188,725 bytes with evidence from the runner's logs or a loopback reproduction, in the PR body — see http-timeouts
      - id: rebind-fix
        content: Fix that cause where it lives, with a test that fails without the fix; a change that only makes the runner case pass is not a fix — see http-timeouts
      - id: timeouts-land
        content: Keep H1-2, H2-3 and WT-2 as reviewed (converged at round 2), synced with main and green — see http-timeouts
  - id: quic-congestion
    title: "test(net): the interop runner's congestion cases"
    goal: Q3 — the quic-interop-runner job runs crosstraffic and goodput and they pass
    verification: node tests/run.js net_quic_recovery && npm run check && npm run lint, then the interop workflow green on the PR head
    todos:
      - id: runner-cases
        content: Add the congestion testcases to the quic-interop-runner job and runner-verdict.py — see quic-congestion
      - id: runner-tune
        content: Fix what they expose in std/net/quic-recovery.ts, each fix pinned by a net_quic_recovery case that fails without it — see quic-congestion
  - id: hrr-handshake
    title: "test(net): a TLS handshake through a HelloRetryRequest to secp256r1, to completion"
    goal: Issue #1472 — the HRR path reaches TLS_STATE_CONNECTED on both sides in a test that fails if either side derives a different secret
    verification: node tests/run.js net_tls_p256 && npm run check && npm run lint
    todos:
      - id: hrr-complete
        content: Drive the HRR case in tests/link/net_tls_p256 past the server's signature to both Finished messages, compare both sides' application secrets and exchange one record each way — see hrr-handshake
      - id: hrr-negative
        content: Add the negatives the path needs (a second ClientHello whose share is not the group the retry named; a second HelloRetryRequest) — see hrr-handshake
      - id: hrr-fix
        content: Fix whatever the completed handshake exposes in std/net/tls.ts or std/net/tls/, with the record updated; if nothing, change no std file — see hrr-handshake
  - id: roadmap
    title: "docs: tick WP34's finished stages and WP39's G1 and G2"
    goal: The roadmap and design notes say what the two runs landed
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: roadmap-tick
        content: Tick the merged items on docs/roadmap/wp34-hosting-cs.md, update its Done count, Next and its row in the index — see roadmap
      - id: roadmap-notes
        content: Update the status rows in docs/wp34-hosting-cs.md, and the G1 and G2 rows only of the WP39 roadmap page and design note, from the merged PRs' bodies — see roadmap
---

# WP34 — finish the in-repo network stack items (second run)

## Context

The first run's ledger and close-out are on tracking issue #1430. On `main` from it: #1449 (T1 secp256r1 on the TLS server, TLS-4 idle timeout), #1458 (A1, QUIC DPLPMTUD and the relay's DATA-down limit), #1437 (WP39 G1: curl, Autobahn and Chrome over HTTP/1.1), #1464 (K2–K4 loop reading by disassembly), #1469 (K5: safegcd field inversion and a windowed verify). Open: #1454 (WP39 G2). Not started: Q3 and the roadmap. Acceptance gap: #1472.

Lessons carried in from that run, and binding on every stage here:

- A field added to a class in `std/` goes in widest first; CI's performance gate refuses NL9010 padding (`node tests/run.js performance`).
- PRs touching `std/` merge one at a time, each with `npm run sync-main` right before its turn.
- A test that cannot fail is a blocking finding.

A second run, `wp39-complete` (#1433), is live in the same repository. Its `g5-cubic` stage waits for this plan's `quic-congestion` branch and will then change `std/net/quic-recovery.ts`; its `roadmap` stage owns the WP39 roadmap page and the index. This plan stays out of its lanes except where named below.

## Shared files

Append-style shared files any stage may need: `tests/run.js`, `tests/nish-cmp.js` (`DECLARED` entries), `docs/security/README.md` (own findings' rows only), plus generated files: `tests/self/goldens/checked/**`, `tests/differential/**` goldens, `docs/reference/**`, `docs/cookbook/**` outputs, `tests/differential/emit-ts-known.txt` (CI's Node only). Generated files are regenerated, never merged by hand. Only `roadmap` edits `docs/roadmap/**` and the design notes; the others end their PR body with a "Roadmap" section.

## http-timeouts

**Owns:** `std/net/http1-server.ts`, `std/net/http1-codec.ts`, `std/net/http2.ts`, `std/net/http2-tls.ts`, `std/net/webtransport.ts`, `tests/link/net_http1_server*`, `tests/link/net_http2*`, `tests/link/net_webtransport*`, `tests/link/net_interop_server/**`, `tests/link/net_interop_server_f64/**`, `docs/security/http1-codec.md`, `docs/security/http2.md`, `docs/security/webtransport.md`, `docs/guide/using-nish/networking.md`, `docs/guide/using-nish/standard-library.md`, `docs/guide/using-nish/websocket.md`; and, only for the rebind root cause if it lies there, `std/net/quic.ts`, `std/net/quic-listener.ts`, `tests/link/net_quic_path*`

The PR exists (#1454, branch `feature/wp34-finish/http-timeouts`) and its worker session is the first run's; no new session is spawned. Its review converged at round 2 and CI was green before it took in #1458. After that sync, `quic-interop-runner (ngtcp2)` rebind-addr truncated the 10 MiB download at 188,725 bytes after the address change (twice), and rebind-port once. The same cases passed on `main` at d12762d6 without this PR. The worker has since pushed a change giving the interop server's QUIC streams a 256 KiB window. That head gets a fresh review round whose first question is whether the change removes a cause or hides a symptom: this PR's timers against #1458's path handling is the stated suspect, and a flow-control stall after a path change is a server bug wherever the window is set. If the cause is in QUIC path handling, the fix goes in `quic.ts` or `quic-listener.ts` with a `net_quic_path` case that fails without it. `std/net/quic-recovery.ts` belongs to `quic-congestion`.

## quic-congestion

**Owns:** `.github/workflows/interop.yml` (the `quic-interop-runner` job and `RUNNER_CASES` only), `tests/interop/runner-verdict.py`, `tests/interop/runner-requirements.txt`, `tests/interop/simulator.dockerfile`, `std/net/quic-recovery.ts`, `tests/link/net_quic_recovery/**`, `tests/link/net_quic_recovery_f64/**`, `docs/security/quic.md`

`RUNNER_CASES` today (interop.yml line 119) has no measurement case. Add `crosstraffic` and `goodput` (the runner's measurements) and teach `runner-verdict.py` to judge them. Proven only in CI: there is no docker daemon in a cloud session, so the PR's own Interop run is the evidence, and every tuning change to `quic-recovery.ts` is also pinned by a loopback `net_quic_recovery` case so it can fail without the runner. Do not weaken or drop an existing runner case to get green. `#1458` made the datagram size variable; keep the window and pacer correct for it.

## hrr-handshake

**Owns:** `tests/link/net_tls_p256/**`; and, only for a defect the completed handshake exposes, `std/net/tls.ts`, `std/net/tls/**`, `docs/security/tls.md`

Issue #1472. The HRR case in `tests/link/net_tls_p256/main.ts` stops at the server's signature (line 161); no client Finished is read after the retried ClientHello. Drive it to `TLS_STATE_CONNECTED`, compare the application traffic secrets on both sides, and send a record each way. The transcript hash across a HelloRetryRequest (RFC 8446 4.4.1, the `message_hash` synthetic message) is the likeliest thing to be wrong, and the comparison is what would show it. Put `Fixes #1472` in the PR body.

## roadmap

**Owns:** `docs/roadmap/wp34-hosting-cs.md`, `docs/wp34-hosting-cs.md`, `docs/roadmap/index.md` (WP34's row only), `docs/roadmap/wp39-http-server.md` and `docs/wp39-http-server.md` (the G1 and G2 rows only)

**Model:** sonnet

Runs last, after every other stage merged or escalated. Ticks only what merged, from both runs; an escalated stage stays unticked and is named. K5's box names 64-bit limbs, which no PR landed: tick it only if the page's own wording is met, otherwise split the line. Next says the cs waves remain, in the cs repository. Every other WP39 box belongs to the `wp39-complete` run.

## Order

At once: `http-timeouts` (review of its current head), `quic-congestion`, `hrr-handshake`. Then `roadmap`. Merge order: one at a time, `npm run sync-main` right before each; `roadmap` after all. No stage needs another's code.

## Out of scope

The cs waves (other repository, staging, Rust relay), P-256 64-bit limbs and a scalar safegcd for verify, AEAD-4 and `--cpu`, H3-5, WebTransport over HTTP/2, 0-RTT, CUBIC (WP39 G5), and every WP39 stage the `wp39-complete` run owns.

## Verification

Per stage, its `verification` line; the full suite is CI's eight shards. `src/` is not touched by any stage.
