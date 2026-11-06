---
name: QUIC follows a peer's address change (NAT rebinding)
overview: The QUIC server keeps a connection alive when the client's NAT rebinds. When a non-probing packet with the highest packet number arrives from a new address, the server moves the connection to that address. It validates the new path with PATH_CHALLENGE and PATH_RESPONSE, holds the anti-amplification limit until the path is valid, resets the congestion controller and RTT estimator, and falls back to the old path if validation fails (RFC 9000 §8.2, §9.3, §9.4). wp34 gap 1 for cs's relay.
stages:
  - id: rebind
    title: "feat(runtime): follow a QUIC peer's address change with path validation"
    goal: A WebTransport or HTTP/3 session through Http3Server survives the client's source address or port changing mid-connection. Replies go to the new address, which is validated with PATH_CHALLENGE and PATH_RESPONSE inside the anti-amplification limit. A failed validation goes back to the last validated address. A packet from a forged source cannot move the connection for good.
    verification: npm run check && npm run lint && node tests/run.js net_quic && node tests/run.js net_http3 && node tests/run.js net_webtransport && node tests/run.js net_loopback && node tests/run.js net_relay && node tests/run.js net_interop && node scripts/security-scope.mjs && node docs/check-links.mjs && node tests/self/goldens.js --update && git diff --exit-code tests/self/goldens
    status: pending
    todos:
      - id: prove-open
        content: Show the gap at main before changing code. A test where the client's datagrams come from a second address after the handshake makes Http3Server keep sending to the first address (addresses[slot] is written only in `unowned`). That test is the "before" half of the record's finding. See rebind, Today
        status: pending
      - id: path-state
        content: Give QuicConnection a path state. It holds the current and the last validated peer address, a pending PATH_CHALLENGE with its 8 bytes and deadline, and per-path amplification counters. Everything is sized when the slot is built and nothing allocates per packet. See rebind, State
        status: pending
      - id: migrate
        content: Decide per datagram whether it is from the current path. A non-probing packet with the highest packet number from a new address, after the handshake is confirmed, moves the connection and starts validation. A probing-only packet from a new address gets its PATH_RESPONSE on that path and moves nothing. See rebind, Rules
        status: pending
      - id: validate
        content: Send PATH_CHALLENGE with unpredictable data in a datagram padded to 1,200 bytes, keep the 3x limit on the unvalidated path, accept the matching PATH_RESPONSE, and give up after max(3*PTO, 6*kInitialRtt), going back to the last validated address. See rebind, Rules
        status: pending
      - id: reset-cc
        content: Once the new path is validated, reset the congestion controller and RTT estimator to their initial values (RFC 9002 A.3, B.3) unless only the port changed. Keep ECN validation per path or restart it. See rebind, Rules
        status: pending
      - id: server-wiring
        content: Make Http3Server pass each datagram's source to its slot and send each flight to the address the connection chose, which may be the probe path for a PATH_RESPONSE. Update the relay (examples/relay) for an address that can change, and say what its per-peer accounting does on a rebind. See rebind, Wiring
        status: pending
      - id: tests
        content: Add link tests for every rule. They cover a port rebind, an address rebind, a probe-only packet, a spoofed source that never answers the challenge, the amplification cap on the new path, the CC/RTT reset, and a lost PATH_CHALLENGE that is resent. Each also has an f64 twin where the suite has one. Show Arena.used() flat across repeated rebinds on a warm connection. Add a net_loopback carrier run whose client rebinds. See rebind, Tests
        status: pending
      - id: interop
        content: Add the quic-interop-runner's rebind-port and rebind-addr cases to RUNNER_CASES in .github/workflows/interop.yml (quic-go and ngtcp2 clients both run them) and to its header comment. See rebind, Interop
        status: pending
      - id: docs
        content: Update docs/security/quic.md (and http3.md / webtransport.md if their scope moves) with a finding that has a before/after test. Update the networking guide page, std/net/quic.ts's and http3-server.ts's module headers, and the line that says path validation is not here. Update wp34's status line, the §5a "Left" cell and §8, and docs/LANGUAGE.md only if a builtin changes. See rebind, Docs
        status: pending
---

# QUIC follows a peer's address change

## Context

cs is porting its relay (`services/relay`) to Nish (`examples/relay/`, wp34
A1). A player whose home NAT gives their UDP flow a new port or address
mid-match loses the session today. That is wp34's gap 1, the one gap a player
feels. RFC 9000 §9 says what a server must do. This plan does the
peer-address-change half of §9: NAT rebinding, which is also what any
client-initiated migration looks like from the server. A server-initiated
migration and `preferred_address` stay out of scope. The server keeps
sending `disable_active_migration`, and §9 lets it go on with path
validation when a peer moves anyway.

## rebind

Owns: `std/net/quic.ts`, `std/net/quic-recovery.ts`, `std/net/quic-conn-*.ts`,
`std/net/quic-listener.ts`, `std/net/http3-server.ts`,
`std/net/webtransport.ts`, `examples/relay/**`, `tests/link/net_quic*/**`,
`tests/link/net_http3*/**`, `tests/link/net_webtransport*/**`,
`tests/link/net_loopback*/**`, `tests/link/net_relay*/**`,
`tests/link/net_interop_server/**`, `tests/interop/**`,
`.github/workflows/interop.yml`, `docs/security/quic.md`,
`docs/security/http3.md`, `docs/security/webtransport.md`,
`docs/security/README.md`, `docs/guide/**` (the networking/QUIC pages),
`docs/wp34-hosting-cs.md`, `tests/self/goldens/checked/**` (regenerated).

Out of scope: `src/` (if a compiler change looks needed, stop and file an
issue), PMTU discovery (gap 2), and server-initiated migration and
`preferred_address`.

### Today

- `Http3Server.datagram` (`std/net/http3-server.ts` ~727) routes by DCID
  and calls `serve(slot, …)` without the source address. `addresses[slot]`
  is written once, in `unowned`, when the first Initial is accepted. Every
  flush sends to that address.
- `QuicConnection` (`std/net/quic.ts`) answers PATH_CHALLENGE
  (`receivePathChallenge`, ~2637) into a ring that is sent wherever the slot
  sends. It never sends a PATH_CHALLENGE, ignores PATH_RESPONSE (~2307), and
  sets `disableActiveMigration = true` with the comment "path validation
  beyond answering PATH_CHALLENGE is not here" (~1786).
- The amplification limit (`amplificationBlocked`, ~2974) is one pair of
  counters for the connection. `addressValidated` is set once.

### State

All state is per slot, made when the slot is built and reused on `reset`.
That means two addresses of 18 bytes (the form `nish:net` uses), the
challenge's 8 bytes and its deadline, and a bytes received/sent pair for the
path being validated. Nothing allocates per packet, as the stack's rule
requires. The challenge data comes from the connection's existing entropy
source, never a counter.

### Rules

These come from RFC 9000. Cite the section beside each one in the code.

1. §9.3: a packet from a new address, that is not probing-only (§9.1: only
   PATH_CHALLENGE, PATH_RESPONSE, NEW_CONNECTION_ID, PADDING), and that has
   the largest packet number so far, moves the connection. The server sends
   to the new address from then on and starts validating it, unless it
   validated that address recently (§9.3.1 allows skipping).
2. §9 / §9.6: before the handshake is confirmed, a packet from another
   address does not move the connection. Pick dropping it or keeping the
   current path, say which in the record, and test it.
3. §8.2.2: a PATH_CHALLENGE is answered with PATH_RESPONSE on the path it
   came on. A probe from a new address gets its answer there without moving
   the connection.
4. §8.2.1: a datagram carrying PATH_CHALLENGE (and a PATH_RESPONSE, §8.2.2)
   is padded to at least 1,200 bytes, unless the amplification limit on that
   path forbids it. §9.3 / §8.1: until the new path is validated, the server
   sends it at most 3 times what it received on it.
5. §8.2.3: validation succeeds on a PATH_RESPONSE whose data matches the
   challenge outstanding, received on any path. §8.2.4: it fails after
   max(3 * PTO, 6 * kInitialRtt). A lost challenge may be resent within that
   time, with fresh data each time.
6. §9.3.2: if validation fails, the server goes back to the last validated
   address. A spoofed source that never answers therefore cannot redirect
   the connection's traffic for good. If there is no validated address to go
   back to, the connection is closed silently (§9.3.2 last paragraph).
7. §9.4: once the new address is validated, the congestion controller and
   RTT estimator are reset to initial values (RFC 9002 A.3 and B.3), unless
   only the port changed. §13.4.2: ECN validation restarts on the new path.
8. §9.3.3: a packet that arrives late from the old path after the move
   (a lower packet number) does not move the connection back.

Keep the decision ("which address does this datagram come from, and does it
move us?") in `QuicConnection`, so a caller with no `Http3Server` gets it too.
The caller gives each datagram's source and reads where the next flight goes.

### Wiring

`Http3Server.serve` passes the source address to the slot. `flushSlot` sends
each flight to the address the connection names, which for a PATH_RESPONSE
to a probe may not be the current one. Keep `addresses[slot]` meaning "where
this slot sends now" and document it, or replace it with an accessor and
update every reader (grep `addresses[`). `examples/relay/relay.ts` keeps its
own copy of the address for its per-peer cap. State in the relay README
whether a rebind moves the session's count to the new address, and test the
choice.

### Tests

- Unit-level, in `tests/link/net_quic_*` (look at `net_quic_conn`,
  `net_quic_recovery` and `net_quic_memory`): each rule above, with
  datagrams built by the existing test client helpers. Positive and negative
  cases: a probe-only packet doesn't move the connection, a late old-path
  packet doesn't move it back, and a spoofed source is abandoned.
- Through `Http3Server` / WebTransport, over real UDP on loopback: a client
  that switches to a second socket (a new port) mid-session keeps its
  session, and its datagrams and streams keep flowing both ways.
- `tests/link/net_loopback`: a carrier run where the client rebinds.
- Memory: `Arena.used()` stays flat over many rebinds on a warm connection,
  the way `net_quic_memory` and the loopback suite measure it.
- `_f64` twins where the touched directory has one.
- A before-and-after for the security record: the rebind test fails on
  `main`'s `std/` and passes with the change. Say in the PR how you checked
  the "before" half.

### Interop

The quic-interop-runner has `rebind-port` and `rebind-addr` server cases.
Add them to `RUNNER_CASES` and the header comment. This is the second
implementation the definition of done asks for. If the runner at the pinned
commit names them differently, use its names. The interop workflow runs on PRs
that touch its paths. Read its result on the PR, and do not call the gap done
without it.

### Docs

- `docs/security/quic.md`: the new attack surface (spoofed sources, an
  amplification attack through a new path, redirecting traffic). Each is
  fixed with a before/after test or recorded open, in the record's format
  (`docs/security/README.md#writing-a-record`). Keep the index row current.
- The guide's networking page that describes the QUIC/HTTP/3 server: one
  short passage saying a client's address change is followed and validated.
- `docs/wp34-hosting-cs.md`: the status line, §5a's "Left" cell for the
  relay/QUIC row, and §8. While you are there, correct §8's stale TLS
  client and `async` rows.
- The module headers of `std/net/quic.ts` and `std/net/http3-server.ts`.

### Commit

`feat(runtime): follow a QUIC peer's address change with path validation`,
with a body for the release notes that says what cs's relay gains. Add a
`Measured:` trailer only if you claim a speed or memory figure. The
memory-flat check is a test, not a claim.
