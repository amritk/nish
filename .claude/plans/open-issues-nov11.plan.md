---
name: Open-issue sweep, 2026-11-11
overview: Close the open follow-up issues that are bounded, testable in a 4-core x86_64 container, and clear of the runs in flight (#1407 async server/pg, #1416 http1 codec, #1418 WP51 stage 2 on src/). Five stages, one PR each.
stages:
  - id: quic-stream-copy
    title: perf(net) — copy QUIC stream bytes by slice, not by byte
    goal: Cut the instructions the HTTP/3 stream path spends per body byte (#699) without changing a byte on the wire
    verification: node tests/run.js net_quic && node tests/run.js net_http3 && npm run check && npm run lint, plus a callgrind Ir-per-request before/after on bench/h3-latency
    todos:
      - id: quic-ring-copy
        content: Replace the byte-at-a-time ring copies in std/net/quic-stream.ts with slice copies — see quic-stream-copy
        status: pending
      - id: quic-ack-ranges
        content: Keep received-range and ACK bookkeeping in std/net/quic-stream.ts as ranges and drop the per-byte 64-bit modulo — see quic-stream-copy
        status: pending
      - id: quic-packet-copy
        content: Make quicPacketCopy in std/net/quic-packet.ts a slice copy — see quic-stream-copy
        status: pending
      - id: quic-measure-record
        content: Measure Ir per request before/after and record it in docs/h3-latency.md, docs/security/quic.md and the commit's Measured trailer; DECLARED nish-cmp entries if IR moves — see quic-stream-copy
        status: pending
  - id: docs-polish
    title: docs — finish the docs-site-polish follow-ups
    goal: Close the mechanical half of #1296 (long paragraphs, uncompiled guide examples)
    verification: node scripts/gen-reference.mjs --check && node docs/check-links.mjs && node tests/run.js guide && npm run lint
    todos:
      - id: polish-paragraphs
        content: Break the over-120-word paragraphs in docs/guide/using-nish/http-client.md (FetchPool) and the std/crypto/p256.ts and p384.ts module doc comments, then regenerate docs/reference — see docs-polish
        status: pending
      - id: polish-modules-fences
        content: Make the two docs/guide/language/modules.md examples compile under nish:ok, adding multi-file support to the guide-example check in tests/run.js if it needs it — see docs-polish
        status: pending
  - id: rules-bench-wording
    title: docs — scope the guide-update rule to every user-visible change, fix stale bench wording
    goal: Close #591 item 3, #744 item 3 and the #1295 bench-report defects
    verification: node docs/check-links.mjs && npm run lint && node bench/http1-e2e/report.mjs --help (or its own self-check) exits 0
    todos:
      - id: rule-guide-update
        content: Extend the construct-only guide-update sentences in .claude/testing.md and docs/ARCHITECTURE.md to every change a user sees — see rules-bench-wording
        status: pending
      - id: bench-pool-wording
        content: Reword the per-carrier connection pool claim in bench/README.md and the bench/http.mjs header now the HTTP/1.1 plain pool is lazy (#744) — see rules-bench-wording
        status: pending
      - id: bench-report-sign
        content: Fix the sign and wording of the arm-B saving in bench/http1-e2e/report.mjs and say in bench/http1-e2e/README.md which tag to fetch (#1295) — see rules-bench-wording
        status: pending
  - id: ring-inplace-gaps
    title: test(sync) — close the ring-in-place bench and test gaps
    goal: Close the non-decision items of #1238
    verification: node tests/run.js sync_ring && node bench/ring-inplace/run.mjs with a bad mode and a bad n each exiting non-zero && npm run lint
    todos:
      - id: ring-bench-validate
        content: Validate mode and n in bench/ring-inplace/bench.ts and run.mjs, fix the integer-division body_bytes, and drop or back the unbacked claim — see ring-inplace-gaps
        status: pending
      - id: ring-partial-test
        content: Add a single-process test reserving in place against a partly full ring (std/sync/ring.ts) — see ring-inplace-gaps
        status: pending
      - id: ring-memmove-pin
        content: Pin that copyBytes lowers to a single memmove with a golden tests/cases program — see ring-inplace-gaps
        status: pending
  - id: x509-extensions
    title: feat(crypto) — expose x509 criticality, AKI issuer/serial and AIA to pki
    goal: Let std/crypto/pki.ts refuse the limbo cases #1028 lists and shrink the divergence list
    verification: node tests/run.js crypto_pki && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run lint
    todos:
      - id: x509-expose
        content: Expose each decoded extension's critical flag, AKI issuer/serial presence and AIA well-formedness from std/crypto/x509.ts, documented — see x509-extensions
        status: pending
      - id: pki-use
        content: Use them in std/crypto/pki.ts to refuse the cases #1028 names and remove those rows from tests/link/crypto_pki_limbo/divergences.ts — see x509-extensions
        status: pending
      - id: x509-records
        content: Update docs/security/crypto-x509.md and crypto-pki.md with what closed and what stays open — see x509-extensions
        status: pending
---

## Context

148 open issues; most are run trackers or need hardware, benchmarks on a quiet host, or an owner's decision. This run takes the ones a worker can finish and verify in one PR on a 4-core x86_64 cloud container, and stays clear of three runs in flight:

| in flight | holds |
| --- | --- |
| #1418 WP51 stage 2 (live branch) | `src/**`, `tests/self/goldens/**`, `tests/wordings/**` — so no stage here touches `src/` |
| #1407 / PR #1419 | `std/net/{serve,handler,http1-*,router,postgres-*}.ts`, async runtime, postgres docs |
| #1416 | `std/net/http1-codec.ts`, `std/net/http1-server.ts`, `bench/http1-request/**` |

Held for a later run (they touch `src/` under #1418): #461 item 2 (NL9007 wording), #503 (parts+join arena). Waiting on #1419: #1325.

Every stage reads its issue first — the issue is the spec; this plan only scopes it. Each PR body says `Fixes #N` only when it closes the whole issue, otherwise `Refs #N` plus what is left open.

## quic-stream-copy

**Owns:** `std/net/quic-stream.ts`, `std/net/quic-packet.ts`, `tests/link/net_quic*/**`, `tests/link/net_http3*/**`, `docs/h3-latency.md`, `docs/security/quic.md`, `docs/reference/net/quic-{stream,packet}.md`, `bench/h3-latency.mjs`, `bench/h3-latency/**`, `tests/nish-cmp.js`

Issue #699: ~148 instructions per body byte in the stream path. Replace per-byte loops with slice copies (`copyBytes` from `nish/bytes` or the existing slice primitives), keep ACK state as ranges, remove the per-byte 64-bit `%` (wrap with a compare). Bytes on the wire stay identical: every `net_quic*` / `net_http3*` link test passes unchanged. Measure with callgrind (deterministic, no quiet host needed): Ir per request on the h3 bench for a large body, main vs branch, stated in the commit's `Measured:` trailer and in `docs/h3-latency.md`. A security-record row changes only if a finding's code moved. If nish-cmp's corpus IR moves, add narrow `DECLARED` entries (`tests/nish-cmp.js` is also in #1407's fix-pool lane: a conflict there is resolved by keeping both entries).

## docs-polish

**Owns:** `docs/guide/using-nish/http-client.md`, `docs/guide/language/modules.md`, `std/crypto/p256.ts`, `std/crypto/p384.ts` (module doc comments only), `docs/reference/crypto/p256.md`, `docs/reference/crypto/p384.md`, `tests/run.js` (guide-example check only)

Issue #1296, mechanical half: split paragraphs over 120 words; turn the plain ` ```ts ` fences in modules.md ("Exporting and importing", "Packages") into checked `nish:ok` examples. If the guide check compiles one file per fence, add the smallest multi-file form (e.g. a `nish:ok file=<name>` group) next to the existing fence grammar at `tests/run.js` ~22391 and document it where that grammar is documented. Out: whether paragraph length becomes a CI rule (owner's call, leave on the issue). No code in p256/p384 changes — comments only; the reference regenerates with `node scripts/gen-reference.mjs`.

## rules-bench-wording

**Model:** sonnet

**Owns:** `.claude/testing.md`, `docs/ARCHITECTURE.md`, `bench/README.md`, `bench/http.mjs`, `bench/http1-e2e/report.mjs`, `bench/http1-e2e/README.md`, `bench/http1-e2e/run.sh`

- #591 item 3: the guide-update rule in `.claude/testing.md` (~153–163) and `docs/ARCHITECTURE.md` (~245) reads as construct-only; make it match CLAUDE.md's "The user guide moves with the language" (any user-visible change). Items 1–2 (Scalar sidebar) stay open.
- #744 item 3: `bench/README.md` (~1354) and the `bench/http.mjs` header say a pool is built per carrier; the HTTP/1.1 plain pool is lazy now.
- #1295 defects: `report.mjs` (~373) prints "saves -9 ns" — fix the sign/wording; README says which tag (`v0.35.0`) the baseline arm fetches. The x86 PMU measurement stays open.

## ring-inplace-gaps

**Owns:** `bench/ring-inplace/**`, `tests/link/sync_ring_inplace*/**` (new dirs allowed), `tests/cases/bytes_copy_memmove*` (new), `tests/differential/goldens*` (registration of the new case)

Issue #1238, without `peekWait` (owner's call) and without the `http1-server` `sendBody` item (#1416's lane). Bench: refuse an unknown `mode` and a non-positive or non-integer `n` with a non-zero exit; compute `body_bytes` without integer truncation; back or drop the claim the issue names. Test: one process, a ring partly filled, then an in-place reserve that wraps / does not fit — assert the documented result. Pin: a positive `tests/cases/` program whose golden `.ll` shows `copyBytes` as one `llvm.memmove` call, registered with `node tests/differential/goldens.js --update`. Must not edit `tests/run.js` (docs-polish owns it); if the new test dir needs registering there, say so in the PR and the lead sequences it.

## x509-extensions

**Owns:** `std/crypto/x509.ts`, `std/crypto/pki.ts`, `tests/link/crypto_pki*/**`, `tests/link/crypto_x509*/**` (new dirs allowed), `docs/security/crypto-x509.md`, `docs/security/crypto-pki.md`, `docs/reference/crypto/{x509,pki}.md`, `docs/guide/**/x509*`, `tests/nish-cmp.js` (merge after quic-stream-copy)

Issue #1028, without the PSL item (owner's call). New public fields/functions carry doc comments with `@param`/`@returns`. Each limbo case it closes is removed from `divergences.ts` and its expected verdict asserted; each it does not close keeps its row with the reason. Security record lists the findings closed and still open. No secret material is touched (public certificate parsing), so no `Secret` wrapping is needed.

## Out of scope

Anything in `src/`; issues needing hardware (#807, #832, #1092, #1180), quiet-host benchmarks (#700, #966, #1043, #1044), an owner's decision (#946, #947, #1377, #1401, #1406, …), or epics (#357, #472, #481, #485, #833, #930).

## Verification

Per stage, its `verification` line, plus CLAUDE.md's definition of done (`npm run check`, `npm run lint`, `node tests/run.js <filter>` for every section touched, `node scripts/security-scope.mjs`, `node scripts/gen-reference.mjs --check` for `std/` changes). The full suite is CI's eight shards.
