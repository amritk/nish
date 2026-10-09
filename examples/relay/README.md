# The relay

cs's WebTransport relay (`services/relay` in
[`amritk/cs`](https://github.com/amritk/cs), Rust over `wtransport` 0.7),
written in Nish on `std/net`: WP34's lane A1
([`docs/wp34-hosting-cs.md`](../../docs/wp34-hosting-cs.md) §2 and §5). A
browser sends unreliable WebTransport datagrams over QUIC; the relay forwards
each payload verbatim over UDP to the game server a signed grant names, one
upstream socket per session, and sends the game server's datagrams back the
same way. It knows nothing about the game.

```bash
nish examples/relay/main.ts --link build/relay
build/relay --help
build/relay --port 4433 --secret "$(openssl rand -hex 32)" --cert-out /run/cs/relay.json
```

## Files

| File | Ports | What it is |
| --- | --- | --- |
| [`frame.ts`](frame.ts) | `frame.rs` | the wire format: seven frame types, eight close codes, little-endian, NUL-terminated UTF-8, decoded over a byte window with DATA's payload a window, not a copy |
| [`grant.ts`](grant.ts) | `grant.rs` | `v1.<base64url(json)>.<base64url(hmac-sha256)>`: the MAC checked in constant time before the JSON is read, then expiry, then shape |
| [`json.ts`](json.ts) | — | the grant's JSON, read by hand: an object of strings and integers (N11's phase-one case) |
| [`peers.ts`](peers.ts) | `main.rs` `Limits.per_peer` | sessions per remote address, a salted open-addressing table |
| [`relay.ts`](relay.ts) | `main.rs` `serve`, `pump`, `Limits` | the sessions, their caps, timers and stats, over `nish/net/http3-server` and `nish/net/webtransport` |
| [`identity.ts`](identity.ts) | `tls.rs` | the self-signed P-256 identity and its hash file, or a PEM pair re-read when it changes |
| [`options.ts`](options.ts) | `main.rs` `parse_options` | the command line and the environment |
| [`main.ts`](main.ts) | `main.rs` `main`, `watch_certificate` | the process: options, identity, sockets, the loop, signals |

## What it does, as `main.rs` does it

- **Caps and timeouts**, all start-up numbers in `RelayConfig`: at most 4,096
  sessions and 64 per address, both counted from a connection's first
  Initial; 5 s from that Initial to open a session, or the connection is
  closed with code 1, so a handshake that pings on holds neither place for
  longer; 256 datagrams a second per session, then CLOSE RATE_LIMITED; 5 s to say hello;
  10 s idle, checked at each STATS; STATS every 2 s; QUIC's idle timeout 30 s.
  A client over either session cap is still accepted, told why (CLOSE
  RATE_LIMITED) and closed, from a reserve of 64 spare QUIC slots.
- **Close codes and reasons** are main.rs's and grant.rs's, string for string.
  A refusal closes the QUIC connection with application code 1, the end of a
  session with 0.
- **Identity.** Minted at start for 13 days (`SELF_SIGNED_DAYS`) with its
  SHA-256 written to `--cert-out` as `{"hash":"…","expiresAt":…}`; or
  `--cert`/`--key`, looked at every 60 s and swapped under the running server
  when either file changes and the pair loads (the key must be the one the
  certificate names, or the pair is refused), with `{"trusted":true}` written
  so a stale pin cannot survive. Live sessions keep their handshake's identity.
- **Offload.** The client side always asks for GRO and sends paced GSO flights
  (the carrier's). `--offload` adds GRO on each upstream socket, cut at the
  segment size as offload.rs cuts it, and sends the DATA one pass brings for a
  session in one GSO send while its payloads are the same size.
- **A clean stop** on SIGINT or SIGTERM: CLOSE SHUTDOWN to every session, each
  connection closed, exit 0.
- **The grant secret** is a `Secret<u8[]>` (`nish:secret`) that `main.ts`
  holds and wipes on its way out; `GrantVerifier.verify` takes it per call and
  exposes it to the HMAC alone, which wipes each padded key block. The HMAC's
  SHA-256 is the verifier's own, over arrays it makes and wipes, because
  `Sha256` keeps its arrays in fields, which the `using a = arena()` block
  around verification cannot follow through `exposeWith`. What the wipe cannot
  reach is the option's string (`--secret` or `CS_RELAY_SECRET`), immutable
  for the process's life.
- **Memory.** Every table is made at start-up, and nothing a session does
  keeps memory, its handshake included: N9's soak
  (`tests/link/net_relay_soak`) runs 100,000 sessions past a warm-up of 500
  with the arena at the same chunk and offset and the resident set the same
  to the byte at every checkpoint, 0 bytes a session. It took three `std`
  changes to get there: a session kept 101,818 bytes before #492 (the QUIC
  handshake's state, now in the slot), 10,983 before #512 (the
  CertificateVerify signature, now over scratch) and 1,727 before #515 (the
  QUIC listener's copy and parse of the first Initial, and its stateless
  resets, now read in place and answered into scratch). The full-size
  pool, 4,160 QUIC slots, is about 754 MB resident at start, about 181 KB a
  slot. Measured one part at a time: the `QuicConnection` is 158 KB of it —
  about 90 KB fixed (its sent-packet rings, CRYPTO reassembly and three
  key spaces), about 44 KB of stream buffers (nine streams at 2,048 bytes
  each way) and about 24 KB of datagram rings (eight of 1,200 bytes each
  way) — then the `Http3Connection` 15 KB and the `WebTransport` 7 KB. A
  slot's `TlsServer`, about 31 KB, is made at its first handshake (#492).
  `relayQuicConfig` already asks for the smallest stream buffers a CONNECT
  fits, and the rest are `std/net` constants, so no smaller slot is on
  offer. What a deployment can lower is the slot count: `RelayConfig`'s
  `maxSessions` and `spareSlots`, start-up constants as main.rs's
  `Limits` are, with no flag.

## Where it differs from the Rust

- **No DNS.** `nish:net` takes address literals, so a grant names an address
  or `localhost`; a name closes with UPSTREAM_UNREACHABLE, as a name that does
  not resolve does in main.rs.
- **No QUIC keep-alive PING.** `nish/net/quic` sends none of its own; the
  2-second STATS is an ack-eliciting datagram and keeps the path warmer than
  main.rs's 3-second keep-alive, and `RelayConfig` refuses a stats interval
  past 3 s.
- **The self-signed certificate names `CN=localhost` and no SAN**:
  `nish/crypto/x509` mints basicConstraints and keyUsage alone, the
  extensions Chromium needs before it compares a pinned hash (X509-9 in
  [`docs/security/crypto-x509.md`](../../docs/security/crypto-x509.md)), and
  `serverCertificateHashes` pins by hash rather than by name, so `--san`
  values are used only for the development-secret check.
- **The grant's JSON is stricter**: a fraction, an exponent, `true`, `null`
  or an array anywhere is refused, where serde reads them; `signGrant` writes
  none of them.
- **A bad frame is counted, not logged**: main.rs prints a line for each,
  which a client can turn into a log flood.
- **A hash file that cannot be rewritten after a renewal ends the process**:
  `nish:fs` has no fallible write, where main.rs logs the failure and serves on.
  The file was written at start, so this needs its directory to have changed.
- **`Http3Server` says nothing when it frees a slot.** The relay looks at
  every slot a step served once that step's flush is done, so a connection a
  client closes, or one the relay closes, gives its places back in the same
  step; one QUIC times out on its own is noticed at the slot's next relay
  timer, within 2 s while it forwards and 5 s while it waits for its hello.
- **`--help`** exists; main.rs has no usage line.

## Known gaps

- **NAT rebinding.** The QUIC server does not follow a peer's address change
  (no migration, RFC 9000 §9): `Http3Server` keeps the address of a
  connection's first datagram, so a client whose NAT rebinds mid-session loses
  its session, where quinn would validate the new path and keep it.
- **DATA down is at most 1,164 bytes.** `nish/net/quic` sends 1,200-byte
  packets and has no path MTU discovery, so after the quarter stream ID and the
  3-byte header 1,164 bytes of payload fit; a larger datagram from the game
  server is dropped and counted (`droppedDown`). Up, the full 1,200 bytes are
  forwarded.
- **Eight datagrams queued each way per connection** (QUIC's
  `QUIC_CONN_DATAGRAM_QUEUE`): a burst of more than eight from the game server
  inside one turn of the loop drops the rest, counted.

## Tests

- [`tests/link/net_relay`](../../tests/link/net_relay) (and `_f64`): the frame
  and grant fixtures cs's `cargo test` uses, every case those tests have and a
  negative for each error; the JSON reader; the options and identity (tls.rs's
  tests); and the relay across loopback in one loop — a Nish WebTransport
  client (`net_webtransport/peer.ts`'s, by import), a Nish UDP game server and
  the relay — for a session's life and every refusal with its close code, on a
  clock the test drives.
- `tests/link/net_relay_bad_*` and `net_relay_*_window`: each cap and window
  that panics, one program each.
- [`tests/link/net_relay_soak`](../../tests/link/net_relay_soak): N9's
  acceptance, 2,000 sessions past a warm-up of 500 in `npm test`, and
  `soak 100000` for the full run, both holding the arena and the resident
  set to exactly 0 bytes of growth.
