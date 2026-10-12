---
name: TLS 1.3 session resumption with tickets (server side)
overview: Teach nish/net/tls's server to issue NewSessionTickets and accept them back as a PSK with (EC)DHE (RFC 8446 §4.6.1, §4.2.11, psk_dhe_ke only, no 0-RTT), with ticket keys held as Secret<u8[]> and sealed by the existing ChaCha20-Poly1305. The threat model lands first, in docs/security/tls.md, and the stages after it build the wire format, the ticket seal, the server, and the curl and Chromium interop lanes, in that order.
stages:
  - id: threat-model
    title: "docs(security): threat model for TLS 1.3 session resumption"
    goal: The resumption design and its threat model are recorded in docs/security/tls.md before a line of code exists
    verification: npm run check && npm test && npm run lint
    todos:
      - id: tm-scope
        content: Add a Resumption section to docs/security/tls.md naming the attacker, what a win is, and the files the later stages add — see Threat model
        status: pending
      - id: tm-ticket-keys
        content: Decide ticket-key lifetime, rotation and wipe, and the caller-held Secret hand-off forced by NL2430 — see Threat model
        status: pending
      - id: tm-replay
        content: Decide anti-replay — single-use tickets via a bounded strike register, and 0-RTT out of scope with the reasons — see Threat model
        status: pending
      - id: tm-fs
        content: Record forward secrecy under psk_dhe_ke only, and what a leaked ticket key does and does not expose — see Threat model
        status: pending
      - id: tm-fallback
        content: Fix the fallback-versus-abort table every later stage tests against — see Fallback and abort table
        status: pending
  - id: psk-wire
    title: "feat(std): read pre_shared_key and write NewSessionTicket in nish/net/tls"
    goal: The codec and key schedule speak RFC 8446's PSK messages, pinned by RFC 8448 §3 and §4 byte for byte
    verification: npm run check && npm test && npm run lint
    todos:
      - id: wire-read-psk
        content: Read pre_shared_key identities and binders and psk_key_exchange_modes into TlsClientHelloView in std/net/tls/codec.ts — see PSK wire
        status: pending
      - id: wire-write
        content: Add tlsWriteNewSessionTicket and the ServerHello pre_shared_key writer in std/net/tls/codec.ts — see PSK wire
        status: pending
      - id: wire-schedule
        content: Add the PSK early secret, binder key, binder verify and resumption PSK derivation, in place, to std/net/tls/schedule.ts — see PSK wire
        status: pending
      - id: wire-tests
        content: Add tests/link/net_tls_psk_wire reproducing RFC 8448 §3's NewSessionTicket and §4's PSK, early secret and binder, plus malformed-extension refusals — see Tests
        status: pending
  - id: ticket-seal
    title: "feat(std): seal and open TLS session tickets under a Secret key in nish/net/tls/ticket"
    goal: A ticket is sealed and opened with ChaCha20-Poly1305 under a caller-held Secret key, and a tampered, expired, replayed or unknown-key ticket opens to nothing
    verification: npm run check && npm test && npm run lint
    todos:
      - id: ticket-format
        content: Add std/net/tls/ticket.ts with the ticket plaintext layout, tlsTicketSeal and tlsTicketOpen over chacha20Poly1305Seal and Open inside expose — see Ticket seal
        status: pending
      - id: ticket-rotation
        content: Add the key-id, current-plus-previous rotation helpers and their wipe, with keys as Secret parameters, never fields — see Ticket seal
        status: pending
      - id: ticket-strike
        content: Add TlsTicketStrikes, the bounded single-use register that refuses resumption when full rather than growing — see Ticket seal
        status: pending
      - id: ticket-tests
        content: Add tests/link/net_tls_ticket with round trip, every tamper position, expiry, replay, retired key and strike-register-full cases, and a tests/run.js check that the ticket key wipe survives opt -O2 — see Tests
        status: pending
  - id: server-resume
    title: "feat(std): resume TLS 1.3 sessions with tickets in nish/net/tls"
    goal: TlsServer, TlsRecordServer and TlsTcpServer issue tickets after a full handshake and resume from them with psk_dhe_ke, falling back to a full handshake per the table, measured against a full handshake
    verification: npm run check && npm test && npm run lint && node tests/run.js performance
    todos:
      - id: server-accept
        content: Select the first openable identity, verify its binder, and skip Certificate and CertificateVerify in TlsServer in std/net/tls.ts — see Server
        status: pending
      - id: server-handoff
        content: Add the ticket hand-off states to TlsServer and the TlsTcpServer calls that borrow the caller's Secret keys, as signP256 borrows the P-256 key — see Server
        status: pending
      - id: server-issue
        content: Send NewSessionTicket post-handshake from TlsRecordServer in std/net/tls/record-server.ts, with no early_data extension — see Server
        status: pending
      - id: server-tests
        content: Add tests/link/net_tls_resume with the resumed handshake, every fallback and abort row, and 0 bytes per resumed handshake through a reused slot — see Tests
        status: pending
      - id: server-bench
        content: Add tests/link/net_tls_resume_bench timing full against resumed handshakes with a noise band, and record the figure beside its check — see Measurement
        status: pending
      - id: server-docs
        content: Update docs/security/tls.md Scope, Properties verified and Findings, and the nish/net/tls entry in docs/guide/using-nish/standard-library.md — see Server
        status: pending
  - id: interop-resume
    title: "test(interop): curl and Chromium resume a TLS 1.3 session"
    goal: The interop workflow proves curl and Playwright's Chromium each resume a session against the Nish server over TLS on TCP
    verification: npm run check && npm test && npm run lint && bash -n tests/interop/run-endpoint.sh
    todos:
      - id: interop-server
        content: Enable tickets in tests/link/net_interop_server and log one line per handshake saying full or resumed — see Interop
        status: pending
      - id: interop-curl
        content: Add a curl check in .github/workflows/interop.yml that makes two connections and asserts the second resumed — see Interop
        status: pending
      - id: interop-chrome
        content: Add tests/interop/chrome-resume.py and its interop.yml step, two navigations on fresh connections with the second resumed — see Interop
        status: pending
---

# TLS 1.3 session resumption with tickets

Refs #481 (its session-resumption bullet; the other bullets stay open). Related: #430.

## Context

[`std/net/tls.ts`](../../std/net/tls.ts) is a server-only TLS 1.3 handshake. It already derives the resumption master secret (`TLS_SECRET_RESUMPTION`, `resumptionSecret`) once the client's Finished verifies, but issues no NewSessionTicket and ignores a `pre_shared_key` offer beyond checking it is the last extension ([`codec.ts`](../../std/net/tls/codec.ts) §4.2.11 check). Every connection pays a full handshake, including a P-256 signature and the certificate chain.

Two repo rules shape the design:

- **A `Secret` may not be a field** (NL2430, [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) "Secrets"). Ticket keys outlive a connection, so no class can hold them. The program holds them in locals and lends them to the call that needs them, the way [`TlsTcpServer.signP256`](../../std/net/tls-tcp.ts) borrows the P-256 key.
- **Secret material in `std/crypto` use is a `Secret` and is wiped** (CLAUDE.md §Security). `std/` may use `nish:secret` and `secureZero` now; `src/` is not touched by this plan, so the rolling freeze does not bind.

## Approach

| decision | choice | why |
| --- | --- | --- |
| key exchange modes | `psk_dhe_ke` only; a `psk_ke`-only offer gets a full handshake | forward secrecy for the resumed session's traffic |
| 0-RTT | out of scope; tickets carry no `early_data` extension, EncryptedExtensions never accepts it | replay of early data needs a global anti-replay mechanism this stack does not have (RFC 8446 §8) |
| ticket AEAD | ChaCha20-Poly1305 from [`std/crypto/chacha20poly1305.ts`](../../std/crypto/chacha20poly1305.ts) | takes the key as raw bytes, so it runs inside `expose` with no expanded key schedule left in a field (unlike `AesKey`, TLS-2) |
| ticket keys | `Secret<u8[]>` of 32 bytes plus a public 16-byte key id, held by the program as current and previous | NL2430; rotation is the program's, helpers make it one call |
| replay | single-use tickets, a bounded strike register of ticket ids for the ticket lifetime; full register refuses resumption | RFC 8446 §C.4; bounded memory beats unbounded acceptance |
| carrier | TCP (`TlsRecordServer`, `TlsTcpServer`) only; QUIC keeps tickets off | "server side first"; QUIC's ticket path is a later plan |

Proposed defaults, which `threat-model` confirms or changes: ticket lifetime 2 h (`ticket_lifetime` 7200); a key issues for 12 h, is then accepted as previous for one more ticket lifetime, then wiped; strike register sized by the program, default 65,536 ids.

## Threat model

Stage `threat-model`. One new section in [`docs/security/tls.md`](../../docs/security/tls.md), written in that file's style (attacker, win conditions, then a table), before any code. It decides, and later stages cite by heading:

- **Ticket-key lifetime and rotation.** Issue window, acceptance window, the wipe at retirement, what happens to tickets under a retired key (full handshake), and that keys never touch disk or a field.
- **Anti-replay.** Why replaying a `psk_dhe_ke` ClientHello without 0-RTT wins the attacker no keys, why tickets are still single-use (linkability, ticket-key compromise window), the strike register's bound and its fail-closed behaviour, and that it is per process (a fleet sharing keys can be replayed across instances; documented, not solved).
- **0-RTT.** Out of scope, default no, with the reasoning; what the server does when a client offers `early_data` anyway.
- **Forward secrecy.** With `psk_dhe_ke` a later ticket-key compromise exposes the resumption PSK, not a resumed session's traffic; with `psk_ke` it would, which is why it is refused.
- **What stays in memory**, as TLS-1 records for the other secrets: the opened PSK in `TlsServer`'s arrays, wiped with `secureZero`.

## Fallback and abort table

Every later stage's tests cite this table. `threat-model` writes it into the record.

| client offers | server does | RFC |
| --- | --- | --- |
| a valid unused ticket, correct binder, `psk_dhe_ke` | resumed handshake, no Certificate or CertificateVerify | §4.2.11 |
| a ticket that fails to open (tampered, unknown key id) | full handshake | §4.2.11 SHOULD |
| an expired ticket (age past lifetime, or key retired) | full handshake | §4.6.1 |
| a ticket already used once | full handshake | §8, §C.4 |
| strike register full | full handshake | this design |
| only `psk_ke` | full handshake | this design |
| a ticket that opens, wrong binder | `decrypt_error` alert | §4.2.11 MUST |
| `pre_shared_key` without `psk_key_exchange_modes` | `missing_extension` alert | §4.2.9 MUST |
| `pre_shared_key` not last | `illegal_parameter` (existing) | §4.2.11 |
| `early_data` offered | handshake proceeds, early data not accepted | §4.2.10 |

## PSK wire

Stage `psk-wire`. [`std/net/tls/codec.ts`](../../std/net/tls/codec.ts) and [`std/net/tls/schedule.ts`](../../std/net/tls/schedule.ts) only.

- `TlsClientHelloView` gains windows onto `pre_shared_key`'s identities (with `obfuscated_ticket_age`), its binders, the offset where the binders start (the truncated-transcript point), and the `psk_key_exchange_modes` list. Malformed vectors are `decode_error`, as the existing readers are.
- Writers, in place into the existing output buffers: `tlsWriteNewSessionTicket(lifetime, ageAdd, nonce, ticket)` with no extensions, and the ServerHello `pre_shared_key` extension carrying `selected_identity`.
- Schedule, in place over the existing `HkdfScratch`: early secret from a PSK, `res binder` key, binder `finished_key` and verify (constant time, as the Finished compare is), and `tlsResumptionPsk(resumptionMaster, nonce)` = HKDF-Expand-Label(…, "resumption", nonce, Hash.length).

## Ticket seal

Stage `ticket-seal`. New [`std/net/tls/ticket.ts`](../../std/net/tls/ticket.ts) (exported as `nish/net/tls/ticket`).

```ts
// sketch: the shapes, not the final names
export const tlsTicketSeal = (key: Secret<u8[]>, keyId: u8[], nonce: u8[], state: TlsTicketState, out: u8[]): i32 => …
export const tlsTicketOpen = (key: Secret<u8[]>, keyId: u8[], ticket: u8[], nowMs: i64, out: TlsTicketState): boolean => …
export class TlsTicketStrikes { constructor(capacity: i32) … ; take(id: u8[], expiresMs: i64): boolean }
```

- Ticket bytes: key id (16, public, AAD) ‖ nonce (12, from `crypto.getRandomValues`) ‖ sealed(state) ‖ tag. State: suite, issue time (`Date.now()` ms), `ticket_age_add`, lifetime, the resumption PSK, ALPN and server name the session agreed.
- `tlsTicketOpen` runs the AEAD inside `expose`, wipes every intermediate with `secureZero`, and answers false for a bad tag, an unknown key id, or an age past lifetime. Every key parameter is borrowed; nothing the module makes holds a `Secret` past its return.
- `TlsTicketStrikes` is an open-addressed table of ticket ids with expiry, made once at its capacity; expired entries are reused; when no slot is free `take` answers false.

## Server

Stage `server-resume`. [`std/net/tls.ts`](../../std/net/tls.ts), [`std/net/tls/record-server.ts`](../../std/net/tls/record-server.ts), [`std/net/tls-tcp.ts`](../../std/net/tls-tcp.ts).

- **Hand-off, not fields.** As the signature is handed off today, `TlsServer` pauses in a new state when a ClientHello offers a ticket (the caller calls `openTicket(keys…)`), and after the client's Finished (the caller calls `issueTicket(key…)`). `TlsTcpServer` gets the matching per-slot calls; a program that never calls them gets today's behaviour, and QUIC never calls them.
- **Resumed path.** Identity 0..n, first that opens and passes the strike register and the suite match is selected; binder verified over the truncated transcript; `psk_dhe_ke` required; ServerHello carries `pre_shared_key`; EncryptedExtensions then Finished, no Certificate or CertificateVerify, so no signature hand-off.
- **Issue.** One NewSessionTicket after the handshake, written by `TlsRecordServer` at the application level; the resumption PSK is derived, sealed, and wiped.
- **Memory.** Per TLS-3, a resumed handshake through a reused slot leaves `Arena.mark()` where the first left it.
- **Docs.** `docs/security/tls.md`: Scope gains the new functions, Properties verified gains each test, Findings gains any new row (and TLS-1's text names the opened PSK). The user guide's `nish/net/tls` entry says how to turn resumption on.

## Measurement

`tests/link/net_tls_resume_bench`: N full handshakes against N resumed handshakes in-process over the test client in [`tests/link/net_tls_common`](../../tests/link/net_tls_common), each iteration on a fresh random, folded into a printed checksum, interleaved rounds, with the full handshake also timed against a byte-identical copy of itself for the noise band (CLAUDE.md, #538). Report server CPU time per handshake and bytes on the wire for both. The figure is recorded in a comment beside the check in `tests/run.js` and copied from there into the squash commit's `Measured:` trailer.

## Interop

Stage `interop-resume`. [`tests/link/net_interop_server`](../../tests/link/net_interop_server), [`tests/interop`](../../tests/interop), [`.github/workflows/interop.yml`](../../.github/workflows/interop.yml).

- The interop server holds a ticket key in a local, rotates it per the threat model, and logs `tls: full` or `tls: resumed` per handshake.
- **curl:** two connections to the HTTP/1.1 or HTTP/2 over TLS port in one curl run that cannot reuse the connection (`--ssl-sessions` if the pinned 8.17 image has it, else two URLs with `Connection: close`), and the server log must show `tls: resumed` for the second.
- **Chromium:** two navigations on fresh connections. Chrome does not cache sessions for a certificate it accepted with an error, so the step trusts the test certificate through `--ignore-certificate-errors-spki-list` (as the WebTransport lane pins its hash) and the worker confirms resumption from the server log, not from Chrome.

## Out of scope

- 0-RTT and early data acceptance.
- QUIC resumption (`std/net/quic*.ts` untouched).
- A client-side ticket store (the test client gets only what the tests need).
- Sharing ticket keys or the strike register across processes.
- `src/` and the compiler: no language change. If NL2430 blocks a needed shape, the stage stops and says so.
- The other #481 bullets (P-256 key exchange, RSA, `record_size_limit`).

## Tests

Each mirrors an existing link test: [`net_tls_rfc8448`](../../tests/link/net_tls_rfc8448) for byte-for-byte traces, [`net_tls_ext_refusals`](../../tests/link/net_tls_ext_refusals) for alerts, [`net_tls_memory`](../../tests/link/net_tls_memory) for `Arena.mark()`.

| stage | test | covers |
| --- | --- | --- |
| psk-wire | `net_tls_psk_wire` | RFC 8448 §3 NewSessionTicket bytes; §4 resumption PSK, early secret, binder; malformed identities, binders, modes |
| ticket-seal | `net_tls_ticket` + a `tests/run.js` -O2 wipe check | seal/open round trip; a flipped bit at each region; expiry; replay; retired and unknown key; strikes full |
| server-resume | `net_tls_resume`, `net_tls_resume_bench` | every row of the fallback and abort table; 0 bytes per resumed handshake; the measured cost |
| interop-resume | interop workflow | curl and Chromium resume |

Each new `check(...)` string is cited verbatim in the record's Properties verified (CLAUDE.md §Security).

## Verification

Every stage: `npm run check`, an undegraded `npm test` (read the skip line), `npm run lint`. Stages touching `std/` regenerate `tests/self/goldens` with `node tests/self/goldens.js --update` and read the diff; a stage that merges after another `std/` stage merges `main` and regenerates. `server-resume` also runs `node tests/run.js performance`.

## Slicing (for /feature)

| stage | owns | depends on (merge) | starts after |
| --- | --- | --- | --- |
| threat-model | `docs/security/tls.md` | — | — |
| psk-wire | `std/net/tls/codec.ts`, `std/net/tls/schedule.ts`, `tests/link/net_tls_psk_wire/**`, `tests/self/goldens/**` (generated) | threat-model | threat-model merged |
| ticket-seal | `std/net/tls/ticket.ts`, `tests/link/net_tls_ticket/**`, `tests/run.js`, `tests/self/goldens/**` (generated) | threat-model, psk-wire | threat-model merged |
| server-resume | `std/net/tls.ts`, `std/net/tls/record-server.ts`, `std/net/tls-tcp.ts`, `tests/link/net_tls_resume/**`, `tests/link/net_tls_resume_bench/**`, `tests/link/net_tls_common/**`, `tests/run.js`, `tests/self/goldens/**`, `docs/security/tls.md`, `docs/guide/using-nish/standard-library.md` | psk-wire, ticket-seal | both merged |
| interop-resume | `tests/link/net_interop_server/**`, `tests/interop/**`, `.github/workflows/interop.yml` | server-resume | server-resume merged |

**Accepted exception:** `psk-wire` and `ticket-seal` run concurrently and both regenerate `tests/self/goldens/**`. Those files are generated, never hand-merged (CLAUDE.md), so the edge is a merge order: `ticket-seal` merges second, after merging `main` and regenerating.
