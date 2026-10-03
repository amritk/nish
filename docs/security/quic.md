# Security record: QUIC

The record for `nish/net/quic-packet` (WP34 Q1) and for the connection built
on it, `nish/net/quic` and its parts (WP34 Q2, first part). It says which
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
| `std/net/quic.ts` | `QuicConnection`: `receive`, `sign`, `takeDatagram`, `readStream`, `writeStream`, `close`, `release` |

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
holds learned from memory.

## Findings

| Id | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| QUIC-1 | Low | `std/net/quic-packet.ts` (`quicKeys`, `quicKeyUpdateSecret`, `quicKeysUpdate`, and the `QuicKeys` they answer) | **What is not wiped: everything secret in this module.** `quicKeys` and `quicKeysUpdate` take a Handshake or 1-RTT traffic secret. They answer a `QuicKeys` that holds the packet key, the IV and the header-protection key, with both AES keys expanded, for as long as the caller keeps it. `quicKeyUpdateSecret` takes the current secret and answers the next generation's. The HKDF-Expand-Label intermediates of all three stay in arena memory after the call returns, until that memory is reused, as do the nonces `quicSealPacket` and `quicDecryptPacket` build from the IV. A later memory disclosure could read them. **What needs no wipe:** the Initial secrets and keys (`quicInitialSecrets`, and `quicKeys` of its answer) are not secret, because anyone who reads the client's first Destination Connection ID derives them (RFC 9001 §5.2). The Retry key and nonce are published constants (§5.8). | **Open.** The primitives are on `main`. `secureZero` (#417) is a store no optimiser removes. `nish:secret`'s `Secret<T>` (#418) is what `nish/crypto`'s signers and X25519 now take a key as (ECC-2, X509-7). This module does not use them yet. A `Secret` may not be a field (NL2430), so `QuicKeys` cannot simply hold its keys as `Secret`s: wiping them is a redesign of the key API that Q2 consumes, and it belongs with Q2. **Follow-up (#430):** move the QUIC and TLS key-holding structs onto `nish:secret` before Q2's connection keys ship. Until then, nothing here is wiped. |
| QUIC-2 | Low | `std/net/quic.ts` (`QuicConnection`, the `QuicConnSpace` of each level) | **What a connection holds between calls.** A connection keeps each level's `QuicKeys` (packet key, IV, header-protection key, and for the AES suites both keys expanded), its `TlsServer` (whose fields hold the ephemeral key and the handshake, traffic and exporter secrets, TLS-1), and the seed its connection IDs and reset tokens are derived from, for as long as the connection lives, because a `Secret` may not be a field (NL2430). **What is wiped:** `secureZero` clears each level's key, IV and header-protection key when the level is discarded (the Initial keys on the first Handshake packet, the Handshake keys when the handshake is confirmed, RFC 9001 §4.9), and `release()` clears the 1-RTT keys, the seed, the ephemeral key and `TlsServer`'s secret fields. The caller's entropy array is wiped as soon as it is copied, and each derived connection ID's HMAC output once it is split. **What is not:** the expanded AES key schedules (`AesKey` holds words, not a `u8[]`, so `secureZero` cannot reach them), the HKDF-Expand-Label and HMAC intermediates `quicKeys` and the ID derivation leave in arena memory, and anything a caller keeps after it forgets to call `release()`. | **Open.** **Follow-up (#430):** the QUIC and TLS key-holding structs move onto `nish:secret`, which is where the expanded schedules can be wiped too. |
| QUIC-3 | Medium | `std/net/quic.ts` (`receive`, `takeDatagram`) | **Per-packet allocation.** Every datagram a connection reads and every one it writes allocates from the arena (the parsed header, the packet's plaintext, the reassembly runs, the sealed packet), and nothing is given back while the connection lives, so a connection's memory grows with the traffic its peer sends. Each buffer a peer can fill is bounded (CRYPTO reassembly by `QUIC_CONN_CRYPTO_WINDOW`, each stream by the credit advertised and the connection by `maxData`, connection IDs by the limit, ACK ranges by 32), but the sum over a long connection is not. | **Open.** A carrier bounds it today by bounding a connection's life. The plan's N9 discipline (a connection's state in a slot reused from a pool, nothing allocated per packet) lands with the streams and loss recovery of Q3 and Q4. |

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
