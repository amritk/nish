# Security record: QUIC

The record for `nish/net/quic-packet` (WP34 Q1), for the connection built
on it, `nish/net/quic` and its parts (WP34 Q2, first part), and for what a
server answers before any connection exists, `nish/net/quic-listener`, with
the connection's idle timeout and key update (WP34 Q2, second part). It says which
functions hold secrets and which of them are wiped, as CLAUDE.md §Security
asks, and it names the tests that pin the modules' refusals.

## Scope

| File | Functions |
| --- | --- |
| `std/net/quic-packet.ts` | `quicInitialSecrets`, `quicKeys`, `quicKeyUpdateSecret`, `quicKeysUpdate`, `quicSealPacket`, `quicRemoveHeaderProtection`, `quicDecryptPacket`, `quicOpenPacket`, the Retry functions, and the varint, packet-number and header codecs |
| `std/net/quic-frame.ts` | `quicParseFrame` and the frame writers |
| `std/net/quic-conn-params.ts` | `quicParseTransportParameters`, `quicEncodeTransportParameters` |
| `std/net/quic-conn-ack.ts` | `QuicAckRanges` |
| `std/net/quic-conn-cid.ts` | `QuicCidTable` |
| `std/net/quic.ts` | `QuicConnection`: `receive`, `sign`, `takeDatagram`, `readStream`, `writeStream`, `close`, `release`, `acceptRetry`, `deadline`, `handleTimer`, `updateKeys`; `quicStatelessResetToken` |
| `std/net/quic-listener.ts` | `QuicListener`: `handle` (Version Negotiation, Retry and its token, the stateless reset) |

Out of scope: the primitives they call, `nish/crypto/aes`,
`chacha20poly1305`, `hkdf`, `hmac` and `ct`, whose records are
[crypto-aead.md](crypto-aead.md) and [crypto-k1.md](crypto-k1.md), and the
TLS 1.3 handshake `nish/net/quic` drives, whose record is [tls.md](tls.md).

## Threat model

The peer controls every byte of every datagram: `quicParseHeader`,
`quicRemoveHeaderProtection`, `quicDecryptPacket`, `quicOpenPacket` and
`quicRetryVerify` take attacker input of any length and value. A win for the
attacker is a panic or an unbounded loop or allocation on that input, a packet
accepted that the key holder did not seal, or a traffic secret or key learned
from memory or timing. The builders (`quicLongHeader`, `quicShortHeader`,
`quicSealPacket`, `quicRetryPacket`) take this side's own arguments, and
answer `null` rather than panic when those are out of range.

`QuicConnection.receive` takes every datagram a client sends, and every
frame in it is attacker input: `quicParseFrame`, `quicParseTransportParameters`
(the client's parameters arrive inside its ClientHello), `QuicAckRanges` and
`QuicCidTable` all read values the peer chose. A win for the attacker there is
a panic, a buffer it can grow without bound, a state the connection reaches
that RFC 9000 forbids (data delivered past its final size or credit, a frame
acted on in a packet type that may not carry it, a 1-RTT packet processed
before the handshake completes), more bytes sent to an unvalidated address
than three times what it sent (RFC 9000 §8.1), or a secret the connection
holds learned from memory. A key update the client starts is attacker input
too: the Key Phase bit costs nothing to flip, and every update it really
makes costs the server two key derivations.

`QuicListener.handle` takes every datagram no connection owns, from anyone,
from any address. A win for the attacker there is a Retry token it can forge,
replay from another address, or use past its lifetime; an answer larger than
what it sent, so the server amplifies traffic toward a spoofed address; a
stateless reset that two endpoints answer back and forth forever, or one that
reveals the token of a connection still alive (RFC 9000 §21.11); or an answer
that tells it whether a guess at a connection ID or token was right.

## Findings

| Id | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| QUIC-1 | Low | `std/net/quic-packet.ts` (`quicKeys`, `quicKeyUpdateSecret`, `quicKeysUpdate`, and the `QuicKeys` they answer) | **What is not wiped: everything secret in this module.** `quicKeys` and `quicKeysUpdate` take a Handshake or 1-RTT traffic secret. They answer a `QuicKeys` that holds the packet key, the IV and the header-protection key, with both AES keys expanded, for as long as the caller keeps it. `quicKeyUpdateSecret` takes the current secret and answers the next generation's. The HKDF-Expand-Label intermediates of all three stay in arena memory after the call returns, until that memory is reused, as do the nonces `quicSealPacket` and `quicDecryptPacket` build from the IV. A later memory disclosure could read them. **What needs no wipe:** the Initial secrets and keys (`quicInitialSecrets`, and `quicKeys` of its answer) are not secret, because anyone who reads the client's first Destination Connection ID derives them (RFC 9001 §5.2). The Retry key and nonce are published constants (§5.8). | **Open.** The primitives are on `main`. `secureZero` (#417) is a store no optimiser removes. `nish:secret`'s `Secret<T>` (#418) is what `nish/crypto`'s signers and X25519 now take a key as (ECC-2, X509-7). This module does not use them yet. A `Secret` may not be a field (NL2430), so `QuicKeys` cannot simply hold its keys as `Secret`s: wiping them is a redesign of the key API that Q2 consumes, and it belongs with Q2. **Follow-up (#430):** move the QUIC and TLS key-holding structs onto `nish:secret` before Q2's connection keys ship. Until then, nothing here is wiped. |
| QUIC-2 | Low | `std/net/quic.ts` (`QuicConnection`, the `QuicConnSpace` of each level) | **What a connection holds between calls.** A connection keeps each level's `QuicKeys` (packet key, IV, header-protection key, and for the AES suites both keys expanded), its `TlsServer` (whose fields hold the ephemeral key and the handshake, traffic and exporter secrets, TLS-1), the seed its connection IDs are derived from, and for key update (RFC 9001 §6) the current 1-RTT read and write secrets, the next generation's read secret and read keys, and for `QUIC_CONN_PTO` after an update the previous generation's read keys, for as long as the connection lives, because a `Secret` may not be a field (NL2430). **What is wiped:** `secureZero` clears each level's key, IV and header-protection key when the level is discarded (the Initial keys on the first Handshake packet, the Handshake keys when the handshake is confirmed, RFC 9001 §4.9); a key update clears the replaced write key, IV and secret at once and the replaced read key, IV and secret when the previous keys go, a probe timeout later (the header-protection key is shared by every generation and goes with the level); and `release()`, or the idle timeout, clears the 1-RTT keys, the key-update secrets and keys, the seed, the ephemeral key and `TlsServer`'s secret fields. The first update wipes `TlsServer`'s own 1-RTT secret arrays, which the connection takes rather than copies. The caller's entropy array is wiped as soon as it is copied, and each derived connection ID's HMAC output once it is split. **What is not:** the expanded AES key schedules (`AesKey` holds words, not a `u8[]`, so `secureZero` cannot reach them), the HKDF-Expand-Label and HMAC intermediates `quicKeys` and the ID derivation leave in arena memory, and anything a caller keeps after it forgets to call `release()`. | **Open.** **Follow-up (#430):** the QUIC and TLS key-holding structs move onto `nish:secret`, which is where the expanded schedules can be wiped too. |
| QUIC-3 | Medium | `std/net/quic.ts` (`receive`, `takeDatagram`) | **Per-packet allocation.** Every datagram a connection reads and every one it writes allocates from the arena (the parsed header, the packet's plaintext, the reassembly runs, the sealed packet), and nothing is given back while the connection lives, so a connection's memory grows with the traffic its peer sends. Each buffer a peer can fill is bounded (CRYPTO reassembly by `QUIC_CONN_CRYPTO_WINDOW`, each stream by the credit advertised and the connection by `maxData`, connection IDs by the limit, ACK ranges by 32), but the sum over a long connection is not. | **Open.** A carrier bounds it today by bounding a connection's life. The plan's N9 discipline (a connection's state in a slot reused from a pool, nothing allocated per packet) lands with the streams and loss recovery of Q3 and Q4. |
| QUIC-4 | Low | `std/net/quic.ts` (`notePhase`, `updateWriteKeys`, `prepareNextReadKeys`) | **What a key update leaves in the arena.** Each key update the client starts makes the server derive two generations of keys: its own next write keys at once (RFC 9001 §6.2) and, a probe timeout later, the next read keys after that (§6.3). `quicKeyUpdateSecret` and `quicKeysUpdate` leave their HKDF and HMAC state and the AES schedule `aesKey` answers in the arena, as T2's record install does (TLS-3), and for the same reason: `Arena.release` is deprecated (#428), `std/` may call nothing deprecated, and a `using a = arena()` block is refused (NL2424) while those callees store allocations. Measured under AES-128-GCM over sixty-four updates in `net_quic_lifecycle`, an update the client starts, its packet read and both derivations made, leaves 11,200 bytes behind (of which reading any 1-RTT packet is about 640, QUIC-3). The 1-RTT keys' install derives one generation ahead too, once a connection. **The bound:** a connection follows at most `QUIC_CONN_MAX_KEY_UPDATES` (64) updates from its client and closes on the next with KEY_UPDATE_ERROR, having derived nothing for it, so a client can make the server derive at most 64 × 11,200 = 716,800 bytes a connection this way; and since the next read keys exist only a probe timeout after the last update, a client can update at most about once a second. A packet whose Key Phase bit is flipped but that does not authenticate under the next keys, which were derived in advance, derives nothing at all (608 bytes, the cost of any dropped packet). **The cap is an interoperability trade-off, like TLS-3's:** RFC 9001 sets no limit on how many key updates a peer starts, so a conforming long-lived client that updates on a schedule of its own, more than 64 times, is disconnected. A client that updates only when an AEAD's confidentiality limit requires it (§6.6) reaches the cap after 2^29 packets. | **Open.** The bound holds; the cost goes away when HKDF and HMAC can run without storing allocations, so a derivation can take an arena scope again (the way out TLS-3 names). Updates the server starts with `updateKeys()` are the application's to bound. |
| QUIC-5 | Low | `std/net/quic.ts` (`QuicServerConfig`), `std/net/quic-listener.ts` (`QuicListener`) | **The static keys and the listener's seed.** The stateless reset key and the Retry token key (`statelessResetKey`, `retryTokenKey`) are fields of the caller's `QuicServerConfig`, and the listener's 32-byte seed a field of `QuicListener`, for the server's whole life: a reset key has to outlive a restart to be any use (RFC 9000 §10.3.2), and a `Secret` may not be a field (NL2430). Nothing in either module copies them, and nothing wipes them: the configuration is the caller's, shared by every connection, so it is the caller's to wipe when the server stops. The HMAC intermediates each token and each reset token leave in the arena are not wiped (K1's record), nor are the generator's blocks once the listener moves past them, except the bytes it hands out, which it zeroes in its pool as it takes them. A memory disclosure of the reset key lets the reader end any of the server's connections; of the token key, forge Retry tokens for any address, which undoes the address validation Retry is for, though not the TLS handshake after it. | **Open.** **Follow-up (#430):** the key-holding structs move onto `nish:secret`. Until then a deployment keeps both keys out of anything that logs or dumps the configuration, and rotates the token key freely (a token lives at most a minute). |
| QUIC-6 | Low | `std/net/quic.ts` | **The AEAD limits of RFC 9001 §6.6 are not enforced.** The connection does not count the packets it seals under one key, so it does not start a key update itself before AES-GCM's confidentiality limit of 2^23 packets, and it does not count packets that fail authentication against the integrity limit (2^52 for AES-GCM, 2^36 for ChaCha20-Poly1305), so it does not close with AEAD_LIMIT_REACHED. With flow control never raised (Q4), a connection carries at most `maxData` plus its own `maxStreamData` per stream, far under 2^23 packets; a forgery attempt rate high enough to approach 2^36 over one connection's life is not a loopback scenario, but it is one the RFC asks to be bounded. | **Open.** It belongs with Q3 and Q4, which make long-lived, high-volume connections possible: a sealed-packet count that calls `updateKeys()` before the limit, and a failed-open count that closes. |

## Properties verified

Each property is pinned by a check in `tests/link/net_quic_packet` that also
runs under `--number-mode f64` in `net_quic_packet_f64`.

- **No input panics a parse.** Every read in `quicParseHeader` is
  bounds-checked against the datagram. Each refusal is reached by an input
  built to reach it alone: an empty or out-of-range start, a header cut inside
  its version, either connection ID or its length, a token length, a token or
  a Length (`QUIC_ERR_TRUNCATED`); a clear fixed bit in either header form
  (`QUIC_ERR_FIXED_BIT`); another version, with its connection IDs read
  (`QUIC_ERR_VERSION`); a version 1 connection ID of 21 bytes
  (`QUIC_ERR_CID_LENGTH`); a Length past the datagram, including RFC 9001 A.2
  cut by one byte (`QUIC_ERR_LENGTH`).
- **No input panics an open.** A packet too short to sample, a header read
  from a longer datagram and a header built by hand are `QUIC_ERR_SAMPLE`.
  A flipped ciphertext byte and the wrong keys are `QUIC_ERR_DECRYPT`, and the
  AEADs check the whole tag before decrypting anything. Reserved bits set
  under a valid tag are `QUIC_ERR_RESERVED_BITS`, in both header forms.
- **A caller's mistake is not a forgery.** Keys `quicKeys` did not make are
  `QUIC_ERR_KEYS` at both halves of an open, and `null` at the seal.
- **The Retry tag is compared in constant time** (`timingSafeEqual`), and a
  changed token byte, a changed tag byte or the wrong original DCID fails it.
- **Packet numbers stay in range.** `quicPacketNumberDecode` answers inside
  [0, 2^62) at both ends of the space, including the input RFC 9000 §A.3's
  pseudocode lets out (2^62 − 1 as the largest packet number), and
  `quicPacketNumberLength` refuses more than 2^31 packets in flight.

### Q2's connection

Each property is pinned by a check in `tests/link/net_quic_frame`,
`net_quic_conn_parts` or `net_quic_conn`, each of which also runs under
`--number-mode f64` (`*_f64`), and the whole exchange by
`tests/link/net_quic_conn_replay`.

- **No frame panics a parse.** `quicParseFrame` reads only inside the window
  it is given; every break §19 names is reached by bytes built to reach it
  alone and answers its transport error (`net_quic_frame`).
- **No parameter panics a parse**, and each bound of §18.2 is refused at its
  boundary and accepted just inside it (`net_quic_conn_parts`).
- **Every protocol violation closes the connection** with RFC 9000's error and
  says so in a CONNECTION_CLOSE naming the frame: an empty packet, a frame a
  packet type may not carry, NEW_TOKEN, HANDSHAKE_DONE or an unsolicited
  PATH_RESPONSE to a server, an ACK of a packet never sent, CRYPTO at 1-RTT,
  each stream-ID, flow-control and final-size break, each connection-ID break,
  reserved bits under a valid tag, bad transport parameters, and a TLS alert
  as CRYPTO_ERROR (`net_quic_conn`, `refusals.ts`). Before the handshake is
  confirmed the close goes in every space the server has keys for.
- **What cannot be used is dropped, not acted on:** a first datagram under
  1200 bytes, one that does not parse or authenticate (leaving no state
  behind), a DCID under 8 bytes, a 0-RTT or Retry packet, a packet for keys
  not yet held or already discarded, an Initial from another SCID, a 1-RTT
  packet to an ID the server never issued or before the handshake completes,
  and a duplicate packet number (`net_quic_conn`, `data.ts`).
- **Every buffer a peer fills is bounded**: CRYPTO data 16 KiB ahead is
  CRYPTO_BUFFER_EXCEEDED, stream data past its credit FLOW_CONTROL_ERROR, a
  burst of PATH_CHALLENGEs does not grow a queue, ACK ranges stop at 32, and
  owed retirements at twice the ID limit (QUIC-3 is the sum of them over time).
- **The anti-amplification limit holds:** a flight of five datagrams goes out
  three before the client sends more, and the rest once it does (`data.ts`).
- **The keys are wiped as their level is discarded and by `release()`**, as
  far as `secureZero` reaches (QUIC-2; `data.ts` checks the bytes are zero).
- **A real client agrees.** aioquic 1.3.0 completed a handshake and a stream
  echo against the server, and the replay sends its recorded datagrams from a
  Nish UDP client and requires every answer byte for byte
  (`net_quic_conn_replay`).

### Q2b: what a server answers without a connection, the idle timeout and key update

Each property is pinned by a check in `tests/link/net_quic_lifecycle`, which
also runs under `--number-mode f64` (`net_quic_lifecycle_f64`), and each
behaviour end to end against aioquic 1.3.0 by
`tests/link/net_quic_lifecycle_replay` (and `_f64`), whose five recordings are
replayed byte for byte from a Nish UDP client.

- **Version Negotiation** answers a long header of any version but 1 in a
  datagram of at least 1200 bytes, with the connection IDs swapped and version
  1 listed (RFC 9000 §17.2.1). A smaller datagram is dropped (§5.2.2), so the
  answer, at most 521 bytes, is never larger than what came in; a packet of
  version 0, itself Version Negotiation, is never answered (§6.1); and a
  connection ID too long for version 1 is echoed all the same, since version
  1's rules may not decide this (§17.2.1). aioquic, opened in version 2,
  negotiates down to 1 and completes an echo.
- **A Retry token cannot be forged, moved or kept.** It carries a 128-bit
  HMAC-SHA256 under the token key over the time it was issued, the client's
  original DCID, the connection ID the Retry told the client to use, and the
  client's address and port, compared in constant time (§8.1.4). A changed MAC
  byte, a changed time, a token cut short, a DCID length that runs past it,
  another address or port, another destination ID, a token a lifetime old and
  one issued later than now are each refused with INVALID_TOKEN in an Initial
  the client can read (§8.1.2), and the one returned a millisecond inside its
  lifetime is accepted. A token is good for `retryTokenLifetime`, at most a
  minute, which is what limits its replay (§8.1.4 asks for replay to be
  "prevented or limited"; within that minute, a replay from the same address
  and port opens a second handshake to the same client, which proves nothing
  and amplifies nothing, since the address is the one the token was sent to).
  The INVALID_TOKEN close is sent only when the client's Initial authenticates
  under the Initial keys of the ID it was sent to, so noise gets silence, and
  it is far smaller than the 1200 bytes it answers. A token without this
  server's marker byte, another server's, counts as no token (§8.1.3).
- **Retry validates the address.** The connection `acceptRetry` sets up names
  the original DCID and the Retry's SCID in its transport parameters (§7.3)
  and sends its whole first flight at once, where an unvalidated client is held
  to three times what it sent. aioquic follows a Retry and completes an echo.
- **A stateless reset is neither an amplifier, a loop nor an oracle**
  (§10.3, §10.3.3, §21.11):
  - *Size.* A reset answers only a short-header datagram, and is always
    shorter than it: one byte shorter up to 43 bytes, between 43 bytes and one
    byte short of the datagram above that, and never more than 1200. A datagram
    of 21 bytes or fewer gets none, since a reset is at least 21 bytes (§10.3).
    So it amplifies nothing, and two endpoints resetting each other shrink to
    silence in at most a datagram's length of rounds.
  - *Rate.* At most `QUIC_LISTENER_RESET_BURST` (16) at once, then one every
    `QUIC_LISTENER_RESET_INTERVAL` (100 ms); the rest are counted and dropped
    (§10.3.3 suggests the limit; it is one for the whole listener, not per
    address, so a flood from one address can use up another's resets for a
    while, which costs only the speed at which a broken connection is noticed).
  - *Never answering a reset with a reset.* A reset from a peer is a
    short-header datagram like any other, so the size rule is what ends an
    exchange of them, together with the rate limit; a long header, which a
    reset may also look like in other versions (§10.3), is never answered with
    one.
  - *No oracle.* The token is HMAC-SHA256 under the static key of the
    packet's connection ID, cut to 16 bytes (§10.3.2), so it reveals nothing
    of the key or of any other ID's token. The listener sees only datagrams no
    live connection owns, which is the caller's routing (`ownsConnectionId`)
    and is stated in the module header as the condition under which a reset
    cannot end a live connection (§21.11). The rest of each reset comes from
    the listener's HMAC generator, so two resets for the same packet differ in
    everything but the token.
  - *The connection's side.* Every ID the server issues, its first in the
    `stateless_reset_token` transport parameter (§18.2) and each later one in
    its NEW_CONNECTION_ID, carries the token the static key gives it, so a
    restarted server with the same key ends the connections it lost. aioquic
    1.3.0 keeps the token but does not check datagrams against it, so the
    recording's client script does, as §10.3.1 describes, and finds the reset.
- **The idle timeout** is the smaller of the two `max_idle_timeout`s, or the
  one that is not 0, raised to three probe timeouts; with neither, there is
  none (§10.1). A packet received and processed restarts it, and so does the
  server's first ack-eliciting packet since, and nothing else. When it passes
  the connection closes silently, sends nothing, wipes every key, and ignores
  every datagram after; a handshake the client abandons times out the same
  way. aioquic, silent after an echo, sees no close, and the server's own
  timer ends the connection three seconds on.
- **Key update, both ways** (RFC 9001 §6). A packet with the Key Phase bit
  flipped that authenticates under the next keys is the client updating; the
  server's write keys follow before it acknowledges anything (§6.2). The
  server starts an update only once confirmed, with the client's last update
  more than a probe timeout old, and once the client has acknowledged a packet
  of the current phase (§6.1). A packet under the previous keys numbered below
  the update is read for a probe timeout after it (§6.5); one numbered above a
  packet under newer keys, or one under the next keys numbered below one under
  the current, is KEY_UPDATE_ERROR (§6.4). The next read keys are derived in
  advance, outside any packet's processing, so a forged Key Phase bit derives
  nothing and shows no timing difference (§6.3). Replaced keys are wiped
  (QUIC-2), and what an update leaves in the arena is bounded by the cap
  (QUIC-4). aioquic updates first and follows the server's update after.
