---
name: WP34 leftovers
overview: Finish what WP34's two runs (#1430, follow-up #1496) left in this repo — the QUIC send-buffer stall (#1485), WebTransport's datagram rate cap (#1496 criterion 2), HTTP/3's missing clock (H3-5), what the AES kernels leave in vector registers (AEAD-4) and the --cpu question, K5's scalar safegcd for verify, cached G table and 64-bit limbs — and bring the WP34 roadmap page and design note in line with what is on main. The cs waves (cs repository, staging) and the WP39 page's Done count (owned by #1433) are out of scope.
stages:
  - id: quic-send-buffer
    title: "fix(net): a QUIC transfer survives a NAT rebind while one hole fills the stream buffer (#1485)"
    goal: A server whose stream buffer is full behind one lost packet follows a client's NAT rebind and finishes the transfer, at the default 64 KiB maxStreamData, without relying on the interop server's 256 KiB window
    verification: node tests/run.js net_quic && node tests/run.js net_interop_server && npm run check && npm run lint
    todos:
      - id: qsb-test-first
        content: Add a std loopback (sans-IO) test, extending tests/link/net_interop_server/rebind.ts's approach, that runs the rebind-in-the-gap case at maxStreamData 65536 and fails on bf63d260 (show the failing output in the PR body)
      - id: qsb-fix
        content: Send an ack-eliciting probe before the PTO when data is queued behind a full buffer and nothing new is in flight (see "Decisions"), in std/net/quic*.ts; new fields widest-first (NL9010); slot-byte budgets in tests/runtime-budgets.js move only with a recorded reason
      - id: qsb-record
        content: Record the stall and the defence in docs/security/quic.md and its README index row; state the bound on room() and QuicServerConfig.maxStreamData's doc comments; update docs/guide/using-nish/networking.md if a config field or its meaning changes
      - id: qsb-cmp
        content: Run nish-cmp; add narrow DECLARED entries for any moved corpus IR (changelog words capitalised like the generated notes)
  - id: h3-limits
    title: "feat(net): an HTTP/3 server clock (H3-5) and WebTransport's rate-cap decision (#1496)"
    goal: An HTTP/3 server closes a slot whose client idles or trickles past a configured timeout without program code, and WebTransport's maxDatagramsPerSecond defence is decided and recorded
    verification: node tests/run.js net_http3 && node tests/run.js net_webtransport && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: h3-clock
        content: Give http3-server.ts a header/idle clock mirroring WebTransport's expire(now) and HTTP/2's idle timeout (#1454) — config fields with defaults and validation, widest-first
      - id: h3-tests
        content: A loopback test where a trickling and an idle client lose their slot at the timeout, failing without the clock, plus a negative config test
      - id: wt-rate
        content: Record dropping and counting as the rate cap's defence in docs/security/webtransport.md WT-2 and in maxDatagramsPerSecond's doc comment (decided at sign-off; no close-after-N)
      - id: h3-record
        content: Move H3-5 (docs/security/http3.md and its README row) to fixed with its test; update docs/guide/using-nish/networking.md; regenerate docs/reference; nish-cmp DECLARED if IR moves
  - id: aes-kernels
    title: "fix(runtime): reach what the AES kernels leave in vector registers (AEAD-4), and settle --cpu for the kernel path"
    goal: AEAD-4 is narrowed to what genuinely cannot be reached, with the rest wiped and pinned by a disassembly check, and the "--cpu" leftover is either built or recorded with its reason
    verification: node tests/run.js crypto_aes && node tests/run.js ct_asm && node tests/run.js "aes kernel" && node tests/run.js wipe && npm run lint
    todos:
      - id: aead4-regs
        content: Clear the vector registers each AES kernel used before it returns (x86-64 and aarch64, e.g. inline asm or _mm256_zeroall where AVX is on the path), and decide about spills (a scrub or a recorded residue)
      - id: aead4-test
        content: Pin the clear with a check that reads the -O2 disassembly on both targets and a twin without it that must be refused, beside the existing "runtime-aes.c on …: the wipes survive" check
      - id: aead4-record
        content: Rewrite AEAD-4 in docs/security/crypto-aead.md and its README row (and ct-verification.md where it cites it) to what is now reached and what is not
      - id: cpu-decide
        content: Decide whether --cpu can choose the AES path at build time (no x86-64 psABI level guarantees AES-NI or PCLMULQDQ); build it if a level does, otherwise record why the runtime check stays, in crypto-aead.md
  - id: k5-verify
    title: "perf(crypto): P-256's cached table for G and a safegcd scalar inverse for verify (K5)"
    goal: P-256 sign and key generation use the fixed-base table of #1487, and verify takes s^-1 through safegcd instead of Fermat, with verify not slower and every ct_asm and Wycheproof check passing
    verification: node tests/run.js crypto_p256 && node tests/run.js ct_asm && node tests/run.js net_tls_p256 && npm run check && npm run lint
    todos:
      - id: k5-take-1487
        content: Merge #1487's branch into this stage's branch (it is green and converged but unmerged; this PR supersedes it and says so), resolving against main with sync-main
      - id: k5-scalar-safegcd
        content: Route verify's public s^-1 through the safegcd scalar inverse (p256ScalarInverse) or a variable-time twin of it, retire the Fermat path if nothing else uses it, and extend ct_asm_p256 if a secret path changes
      - id: k5-measure
        content: Measure sign, verify and bench/tls-handshake.mjs server CPU against bf63d260 with a byte-identical twin for the noise band (Measured trailer); record figures in docs/wp34-hosting-cs.md's K5 result section and docs/security/crypto-ecc.md
  - id: k5-limbs
    title: "perf(crypto): P-256 field arithmetic on 64-bit limbs (K5), or the figures that decline it"
    goal: P-256's field arithmetic runs on 64-bit limbs if that clears the K5 bar (sign faster, verify not slower, handshake CPU down, ct_asm reads it), otherwise the measured reason not to is recorded and the K5 box closes either way
    verification: node tests/run.js crypto_p256 && node tests/run.js ct_asm && node tests/run.js net_tls_p256 && npm run check && npm run lint
    todos:
      - id: limbs-spike
        content: Build 64-bit-limb field multiply/square/reduce (fiat-crypto's 64-bit P-256 shape, with the copied code's notice kept and listed in THIRD_PARTY_NOTICES.md) and measure it against k5-verify's result with a noise band
      - id: limbs-land-or-record
        content: Land it with ct_asm_p256 extended and Wycheproof passing if it clears the bar; otherwise land only the figures and the decision in docs/wp34-hosting-cs.md's K5 section
      - id: limbs-tick
        content: Tick K5's box on docs/roadmap/wp34-hosting-cs.md and move the design note's K5 rows (lane table and status table "Left") in this same PR
  - id: wp34-close
    title: "docs: WP34's roadmap page and design note match main"
    goal: No line of the WP34 roadmap page or design note calls something open that is done or decided, and the Done count matches its boxes
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: close-prose
        content: Rewrite the roadmap lines that say "AEAD-4 and the --cpu flag stay open" and "H3-5 stays open" to what the run landed, and the design note's K3 "Left" and H-row cells with them
      - id: close-r2
        content: Rewrite the design note's R2 row status in the present tense of what is done (Chromium through Playwright, green in the interop job), with no "open" wording left
      - id: close-1485
        content: Note #1485's fix where the design note describes QUIC buffers or the interop rebind case, and check the Done count against the boxes
---

# WP34 leftovers

Tracking: #1430 (closed handoff), #1496 (follow-up), #1485. On main already:
#1449, #1458, #1437, #1464, #1469, #1454, #1477, #1479, #1488. WP34's roadmap
page says 15 of 19; the four open boxes are K5's remainder and three cs waves.

## Decisions (taken at sign-off)

- **#1485:** keep the send buffer tied to maxStreamData and document it as the
  memory bound (on `room()`, `QuicServerConfig.maxStreamData` and in quic.md),
  and add an earlier ack-eliciting probe: a sender with data queued that it
  cannot send and nothing new in flight probes before the PTO, so a client's
  rebind is followed promptly. No separate send-buffer field.
- **WebTransport rate cap (#1496 criterion 2):** dropping and counting is the
  defence; no close-after-N. Record it in WT-2 of docs/security/webtransport.md
  (why: datagrams are unreliable by contract, RFC 9297; a drop costs O(1); a
  close would punish a bursty browser) and say so in the field's doc comment.
  h3-limits' wt-rate todo is a record, not code.
- **K5 and #1487:** k5-verify merges #1487's branch into its own and its PR
  supersedes #1487 (the lead closes #1487 after the merge); k5-limbs builds on it.

## quic-send-buffer

**Owns:** `std/net/quic.ts`, `std/net/quic-stream.ts`, `std/net/quic-recovery.ts`,
`tests/link/net_quic_*/**`, `tests/link/net_interop_server*/**`,
`docs/security/quic.md`, `docs/security/README.md` (QUIC rows only),
`docs/guide/using-nish/networking.md` (QUIC paragraphs only),
`tests/runtime-budgets.js` (shared, serialized), `tests/nish-cmp.js` (DECLARED entries only, shared, serialized)

Open PR #1495 (WP39 G5 CUBIC, another run) also touches `quic-recovery.ts`;
whichever lands second takes the other in through `npm run sync-main`.

## h3-limits

**Owns:** `std/net/http3.ts`, `std/net/http3-server.ts`, `std/net/webtransport.ts`,
`tests/link/net_http3*/**`, `tests/link/net_webtransport*/**`,
`docs/security/http3.md`, `docs/security/webtransport.md`,
`docs/security/README.md` (H3-5 and WT rows only),
`docs/guide/using-nish/networking.md` (HTTP/3 and WebTransport paragraphs only),
`tests/runtime-budgets.js` (shared, serialized), `tests/nish-cmp.js` (DECLARED entries only, shared, serialized)

Open PR #1473 (WP39 G7 facade, another run) may touch `http3-server.ts`.

## aes-kernels

**Owns:** `runtime/runtime-aes.c`, `tests/run.js` (the runtime-aes.c wipe and
kernel blocks only), `tests/ct-asm-runtime.js`, `docs/security/crypto-aead.md`,
`docs/security/ct-verification.md` (AEAD-4 citations only),
`docs/security/README.md` (AEAD-4 row only)

## k5-verify

**Owns:** `std/crypto/p256.ts`, `scripts/gen-p256-table.mjs`,
`tests/link/crypto_p256*/**`, `tests/ct-asm.js` and its p256 fixtures,
`bench/p256*`, `docs/security/crypto-ecc.md`, `docs/security/README.md` (ECC rows only),
`docs/wp34-hosting-cs.md` (K5 result sections only), and whatever else #1487's diff touches
`tests/runtime-budgets.js` and `tests/nish-cmp.js` (shared, serialized)

## k5-limbs

Depends on k5-verify (same files; starts when it merges).

**Owns:** as k5-verify, plus `THIRD_PARTY_NOTICES.md`, the K5 box on
`docs/roadmap/wp34-hosting-cs.md` and the design note's K5 rows.

## wp34-close

Depends on every other stage. **Model:** sonnet

**Owns:** `docs/roadmap/wp34-hosting-cs.md`, `docs/wp34-hosting-cs.md` (rows not owned above)

## Generated files (every stage)

Regenerated with the repo's tooling, never hand-edited or hand-merged:
`tests/self/goldens/checked/**`, `docs/reference/**` and its routes in
`scalar.config.json`, `tests/cases/*.ll`, `docs/IR_COOKBOOK.md`,
`tests/differential/goldens/**`.
