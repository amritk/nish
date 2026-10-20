---
name: QUIC AEAD limits, optimistic-ACK detection, and ECN in recovery
overview: Closes amritk/nish#474 in two serial PRs. Stage 1 enforces RFC 9001 §6.6's AEAD confidentiality and integrity limits (QUIC-6) and catches optimistic ACKs by skipping packet numbers (QUIC-7). Stage 2 makes the connection echo and act on ECN (RFC 9000 §13.4, RFC 9002 §7.1 and B.7).
stages:
  - id: aead-limits-ackskip
    title: "fix(net): enforce QUIC's AEAD limits and detect optimistic ACKs"
    goal: The server key-updates before AES-GCM's confidentiality limit, closes with AEAD_LIMIT_REACHED past the integrity limit, and closes with PROTOCOL_VIOLATION on an ACK of a packet number it skipped
    verification: npm run check && npm run lint && node tests/run.js quic && node tests/run.js net_loopback && node tests/run.js http3 && npm test
    todos:
      - id: seal-count
        content: Count packets sealed under the current 1-RTT write key in std/net/quic.ts (sealAt), and start updateKeys() at a threshold under the AEAD's confidentiality limit — see Stage 1, QUIC-6
      - id: seal-hard-limit
        content: Close with AEAD_LIMIT_REACHED when the hard confidentiality limit is reached and no key update could start — see Stage 1, QUIC-6
      - id: open-fail-count
        content: Count packets that fail AEAD authentication across every key in openScoped, and close with AEAD_LIMIT_REACHED past the integrity limit, processing nothing after — see Stage 1, QUIC-6
      - id: limit-hook
        content: Give the connection a test-only way to scale both limits down, defaulting to RFC 9001's values per AEAD — see Stage 1, QUIC-6
      - id: pn-skip
        content: Skip an Application Data packet number at random intervals in sealAt, and remember the recent skipped numbers in a bounded set — see Stage 1, QUIC-7
      - id: ack-skip-check
        content: Close with PROTOCOL_VIOLATION in receiveAck when any ACK range covers a remembered skipped number — see Stage 1, QUIC-7
      - id: stage1-tests
        content: Add link-test PASS lines for every behaviour above, each shown failing on the base commit — see Tests
      - id: stage1-measure
        content: Measure the cost of the skip on the loopback QUIC lane against a noise band, for the commit's Measured trailer — see Stage 1, Measuring
      - id: stage1-docs
        content: Close QUIC-6 and QUIC-7 in docs/security/quic.md with their anchors, update docs/security/README.md, the wp34 and wp39 rows and the stale header comments — see Docs
  - id: ecn-recovery
    title: "feat(net): use ECN in QUIC recovery and acknowledge ECN marks"
    goal: The server reports the ECN marks it receives as ACK_ECN counts, marks its own packets ECT(0) while ECN validation holds, and reduces its congestion window on a rising CE count as RFC 9002 specifies
    verification: npm run check && npm run lint && node tests/run.js quic && node tests/run.js net_loopback && node tests/run.js http3 && npm test
    todos:
      - id: ecn-receive
        content: Pass the received ECN codepoint from std/net/http3-server.ts (udpRecvFrom meta[1]) into the connection, and count ECT(0), ECT(1) and CE per packet-number space for packets that open — see Stage 2, Receiving
      - id: ecn-ack-write
        content: Write ACK_ECN (0x03) with the counts from std/net/quic-conn-ack.ts once any mark has been counted in that space — see Stage 2, Receiving
      - id: ecn-recovery-ce
        content: Process an ACK_ECN's CE count in std/net/quic-recovery.ts per RFC 9002 B.7, starting one congestion event per recovery period — see Stage 2, Recovery
      - id: ecn-send-validate
        content: Mark outgoing packets ECT(0) and validate ECN per RFC 9000 §13.4.2, turning marking off when validation fails — see Stage 2, Sending
      - id: stage2-tests
        content: Add unit and connection-level PASS lines for the CE reaction, the counts, and validation failure, each shown failing on the base commit — see Tests
      - id: stage2-docs
        content: Update the recovery and ACK writer header comments, the wp34 Q3 row, wp39 G5 and the QUIC record's ECN mention — see Docs
---

## Context

[`std/net/quic.ts`](std/net/quic.ts) seals every packet through `sealAt` (`space.nextPn` read at ~3490, incremented at ~3527) and opens through `openScoped` (~1829), where an AEAD failure is a silent `drop()` (~1840). `updateKeys()` (~2912) starts a server key update only when phases agree and the client has acked a packet of the current phase. `receiveAck` (~2239) refuses an ACK at or past `nextPn` but cannot tell an ACK for a packet in flight from a real one. [`std/net/quic-frame.ts`](std/net/quic-frame.ts) already parses ACK_ECN's counts (~329) and defines `QUIC_ERROR_AEAD_LIMIT_REACHED` (0x0f), but nothing uses either. [`std/net/quic-conn-ack.ts`](std/net/quic-conn-ack.ts) writes only type 0x02. [`std/net/quic-recovery.ts`](std/net/quic-recovery.ts) says outright that nothing reads ECN (header, ~47). [`std/net/http3-server.ts`](std/net/http3-server.ts) reads `meta[0]` from `udpRecvFrom` but never `meta[1]`, the ECN bits N5 delivers, and sends with ECN 0.

The records: [`docs/security/quic.md`](docs/security/quic.md) QUIC-6 and QUIC-7 (Open), listed again in [`docs/security/README.md`](docs/security/README.md)'s Open findings table and counted in its Areas row and footnote 11.

## Approach

- **Two stages, run one after the other.** Both have to edit `quic.ts` (`sealAt` and `receiveAck` especially) and the generated goldens, so running them at the same time means two PRs editing the same functions. Stage 2 starts from `main` once stage 1 has merged. QUIC-6 and QUIC-7 share one stage because they edit the same two functions and the same rows and counts in the security README.
- **Server-side only.** The connection in `quic.ts` is the server; there is no client to change.
- **Limits are per AEAD.** AES-128/256-GCM has a confidentiality limit of 2^23 packets and an integrity limit of 2^52. ChaCha20-Poly1305 has an integrity limit of 2^36 and no practical confidentiality limit (RFC 9001 §6.6, Appendix B). The counts are 64-bit and never wrap.
- **Random skips come from the CSPRNG the connection already uses** for connection IDs and tokens. The skip interval is random, not fixed, so a client cannot predict which numbers will be skipped.

## Stage 1 — AEAD limits and optimistic-ACK detection

**Owns:** `std/net/quic.ts`, `std/net/quic-packet.ts`, `std/net/quic-frame.ts`, `std/net/quic-recovery.ts`, `tests/link/net_quic_*/**`, `tests/link/net_loopback*/**`, `tests/link/net_http3*/**`, `tests/link/net_interop_server*/**`, `tests/wipes/quic*.js`; generated: `tests/self/goldens/**`, `tests/differential/**`, `docs/security/quic.md`, `docs/security/README.md`, `docs/wp34-hosting-cs.md`, `docs/wp39-http-server.md`, `docs/guide/using-nish/standard-library.md`, `std/README.md`

**Depends on:** nothing.

### QUIC-6

- **Confidentiality.** Keep a count of packets sealed under the current write key. Reset it when `updateWriteKeys` installs a new key. When the count crosses a threshold under the limit (for example 3/4 of it), call `updateKeys()` on each seal until an update starts, since `updateKeys()` is a no-op until the client has acked the current phase. Server-started updates do not count against `QUIC_CONN_MAX_KEY_UPDATES`, which bounds client-started ones. If the count reaches the hard limit and still no update could start, close with `QUIC_ERROR_AEAD_LIMIT_REACHED` rather than seal again under that key. Initial and Handshake keys never come near the limit, because their spaces carry a handful of packets; say so in a comment rather than counting them.
- **Integrity.** Keep a connection-lifetime count of packets that fail AEAD authentication, across all keys and levels. Packets whose header protection fails before the AEAD runs (the drop at ~1835) are not counted, because nothing was opened. Past the AEAD's integrity limit, `fail(QUIC_ERROR_AEAD_LIMIT_REACHED)` and process no more packets (§6.6, "immediately close"). A first Initial that fails to open (`unstart()`, ~1735) is not counted, because there is no connection yet.
- **Test hook.** Default both limits from the negotiated AEAD. Add a narrow override that a test can set, such as a field written before the handshake or a parameter on the constructor's options, so that a link test can drive a connection past a limit of about 16 packets. Follow whatever pattern the module already uses for test-scaled constants (`QUIC_CONN_MAX_KEY_UPDATES` is a module constant; prefer a per-connection field that defaults to it).

### QUIC-7

- In `sealAt`, Application Data space only, skip a number now and then. Draw the next skip from a range of about 1 in 128 to 1 in 1024 packets, a random distance each time. A skipped number is never sealed or recorded in recovery. Remember the most recent few skipped numbers (8 is enough) in a small ring.
- In `receiveAck`, after the existing `largest >= nextPn` refusal, check every range against the ring. A hit is `fail(QUIC_ERROR_PROTOCOL_VIOLATION, frameType)` (RFC 9000 §21.4).
- Check that `recovery.onPacketSent`/`recordSent` and the ring in `quic-recovery.ts` take numbers that are increasing but not consecutive. They should already, because the ring is kept in send order. Check also that the packet-number length encoding (~3233, ~3287, ~3640) still covers the gap.

### Measuring

Measure the skip's cost on the loopback QUIC lane. Each skipped number costs one extra ACK range byte now and then and no retransmission. Time a transfer whose input varies per iteration and whose output is folded into a printed checksum. Time the base against a byte-identical copy of itself, in the same interleaved rounds, to get the noise band, and state the figures in the commit's `Measured:` trailer. Claim a cost only outside the band. The interop workflow runs on the PR automatically (`std/net/**` triggers it), and its `transferloss`, `handshakeloss` and `keyupdate` cases must stay green.

## Stage 2 — ECN

**Owns:** `std/net/quic.ts`, `std/net/quic-recovery.ts`, `std/net/quic-conn-ack.ts`, `std/net/quic-frame.ts`, `std/net/http3-server.ts`, `std/net/quic-listener.ts`, `tests/link/net_quic_*/**`, `tests/link/net_loopback*/**`, `tests/link/net_http3*/**`, `tests/link/net_interop_server*/**`, `tests/wipes/quic*.js`; generated: `tests/self/goldens/**`, `tests/differential/**`, `docs/security/quic.md`, `docs/security/README.md`, `docs/wp34-hosting-cs.md`, `docs/wp39-http-server.md`, `docs/guide/using-nish/standard-library.md`, `std/README.md`

**Depends on:** `aead-limits-ackskip`, for development and merge. It starts from `main` after stage 1 merges, because both stages edit `sealAt` and `receiveAck`.

### Receiving

`Http3Server` reads `meta[1]` after each `udpRecvFrom` and hands the codepoint to the connection's receive entry point as a new parameter. Every existing call site passes "not ECT". Each packet that opens successfully increments its space's ECT(0), ECT(1) or CE count (RFC 9000 §13.4.1). A coalesced datagram counts once per packet. Once a space has counted any mark, `QuicAckRanges.putAck` writes type 0x03 with the three counts.

### Recovery

RFC 9002 B.7 `ProcessECN`. When an ACK_ECN's CE count exceeds the largest CE count seen in that space, store it and call the congestion event with the send time of the packet the ACK newly acknowledged as largest. A congestion event already in recovery (`inRecovery`) does nothing, so one round trip halves the window at most once. Counts that decrease, or a missing count where one is required, feed validation (below), never recovery.

### Sending

Mark outgoing packets ECT(0) (`udpSendTo`'s `ecn` argument, now `H3_SERVER_ZERO`) while ECN validation holds (RFC 9000 §13.4.2, §A.4). Validation fails on any of these:

- an ACK that newly acknowledges ECT-marked packets but carries no ECN counts;
- counts that decrease;
- ECT(0) plus CE rising by less than the number of ECT(0) packets newly acknowledged.

On failure, stop marking for the rest of the connection. Also stop if every marked packet in the first round trip is lost (the §A.4 testing period). The listener's pre-connection flights stay unmarked.

## Docs

- [`docs/security/quic.md`](docs/security/quic.md). QUIC-6 and QUIC-7 go to `**Closed**` (this PR's number), naming what enforces each, with `anchors at <sha>`. The `<sha>` is the branch commit whose `file:line` anchors the row cites, as `docs/security/runtime.md` RT-14 and RT-17 do. The Tests list cites every check by its exact `check(...)` string, templates as templates. For a link test that is `` `link/${name}: exits with ${wantCode} and stdout matches expected.out` `` for the program, plus the PASS line, as QUIC-9 does. **Grep each cited string against `tests/run.js` (and the PASS line against the program's `expected.out`) before pushing** (CLAUDE.md, Security). Stage 2 rewrites whatever text in the record says ECN is unused.
- [`docs/security/README.md`](docs/security/README.md). Stage 1 removes QUIC-6 and QUIC-7 from Open findings, and moves the QUIC Areas row, the Total row and footnote 11 from open to fixed.
- [`docs/wp34-hosting-cs.md`](docs/wp34-hosting-cs.md) Q3 row's "Left" column and [`docs/wp39-http-server.md`](docs/wp39-http-server.md) G5. Each stage strikes what it closed.
- Header comments that would go stale: `quic.ts` (~46, ~117–121), `quic-recovery.ts` (~47) and `quic-conn-ack.ts` (~23).
- [`docs/guide/using-nish/standard-library.md`](docs/guide/using-nish/standard-library.md) `nish/net/*` section. Update it only if it describes behaviour these stages change (CLAUDE.md, "The user guide moves with the language"). If it does not, say so in the PR body.

## Out of scope

- Editing `.github/workflows/interop.yml` to add the quic-interop-runner's `ecn`, `goodput` or `crosstraffic` cases. A workflow edit is a sensitive path for an autonomous merge. Propose it in the PR body if the stage's results suggest it.
- A QUIC client, and any change to `src/` or `runtime/`. ECN already crosses the runtime boundary (N5).
- L4S or ECT(1) marking, and DPLPMTUD.

## Tests

Mirror the existing link programs: key update in [`tests/link/net_quic_lifecycle/`](tests/link/net_quic_lifecycle) (`keys.ts`), refusals and close in [`tests/link/net_quic_conn/`](tests/link/net_quic_conn) (`refusals.ts`, `data.ts`), recovery in [`tests/link/net_quic_recovery/`](tests/link/net_quic_recovery) (`unit.ts`, `conn.ts`), and the real-socket lane in [`tests/link/net_loopback/`](tests/link/net_loopback) (`carrier-quic.ts`). Each `_f64` twin stays in step. Every new behaviour gets a PASS line in an `expected.out`, shown failing on the stage's base commit, which the security README requires of every fix.

- Stage 1. A connection with a scaled-down confidentiality limit sends past the threshold, and the client side sees the key phase flip. One whose client never acks the new phase hits the hard limit and closes with 0x0f. Forged packets past a scaled-down integrity limit close with 0x0f, and a valid packet after that is not processed. An ACK range covering a skipped number closes with 0x0a. A real client's ACKs never trip it: the existing conn, lifecycle and loopback lanes stay green.
- Stage 2. In the recovery unit, a rising CE count halves the window, the same count again does nothing, and a second rise inside the recovery period does nothing. At the connection level, a CE-marked packet makes the next ACK an ACK_ECN with CE=1; validation failure stops ECT marking; the loopback lane runs with marks on real UDP.

Regenerate generated files with the repo's tooling only. That means `node tests/self/goldens.js --update` (with `--seed build/seed/bin/nish` if `build/nish` is not built) for `tests/self/goldens/`, `--update-link-goldens` for link `.ll` goldens, and `node tests/differential/goldens.js --update` if a positive `tests/cases/*` is added. Read each diff before committing.

## Verification

Per stage, as each stage's `verification` field says: `npm run check`, `npm run lint` (bare, exit status read), `node tests/run.js quic`, `node tests/run.js net_loopback`, `node tests/run.js http3`, and before the PR opens an undegraded `npm test` (read the skip count). Run `bash scripts/fetch-seed.sh --force` once at the start so the seed matches `main`. The interop workflow must be green on the PR head.
