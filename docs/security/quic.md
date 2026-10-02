# Security record: QUIC

The record for `nish/net/quic-packet` (WP34 Q1), which the QUIC connection
stage (Q2) extends when `nish/net/quic` lands. It says which functions hold
secrets that are not wiped, as CLAUDE.md §Security asks of every module in the
stack until the runtime has a wipe the optimiser cannot drop (#385), and it
names the tests that pin the module's refusals.

## Scope

| File | Functions |
| --- | --- |
| `std/net/quic-packet.ts` | `quicInitialSecrets`, `quicKeys`, `quicKeyUpdateSecret`, `quicKeysUpdate`, `quicSealPacket`, `quicRemoveHeaderProtection`, `quicDecryptPacket`, `quicOpenPacket`, the Retry functions, and the varint, packet-number and header codecs |

Out of scope: the primitives it calls, `nish/crypto/aes`,
`chacha20poly1305`, `hkdf` and `ct`, whose records are
[crypto-aead.md](crypto-aead.md) and [crypto-k1.md](crypto-k1.md).

## Threat model

The peer controls every byte of every datagram: `quicParseHeader`,
`quicRemoveHeaderProtection`, `quicDecryptPacket`, `quicOpenPacket` and
`quicRetryVerify` take attacker input of any length and value. A win for the
attacker is a panic or an unbounded loop or allocation on that input, a packet
accepted that the key holder did not seal, or a traffic secret or key learned
from memory or timing. The builders (`quicLongHeader`, `quicShortHeader`,
`quicSealPacket`, `quicRetryPacket`) take this side's own arguments, and
answer `null` rather than panic when those are out of range.

## Findings

| Id | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| QUIC-1 | Low | `std/net/quic-packet.ts` (`quicKeys`, `quicKeyUpdateSecret`, `quicKeysUpdate`, and the `QuicKeys` they answer) | Traffic secrets and the keys derived from them are not wiped. `quicKeys` and `quicKeysUpdate` take a Handshake or 1-RTT traffic secret and answer a `QuicKeys` that holds the packet key, the IV and the header-protection key, both AES keys expanded, for as long as the caller keeps it. `quicKeyUpdateSecret` takes the current secret and answers the next generation's. The HKDF-Expand-Label intermediates of all three, and the nonces `quicSealPacket` and `quicDecryptPacket` build from the IV, stay in arena memory after the call returns, until that memory is reused. A later memory disclosure could read them. The Initial secrets and keys (`quicInitialSecrets`, and `quicKeys` of their answer) are not secret: anyone who reads the client's first Destination Connection ID derives them (RFC 9001 §5.2). The Retry key and nonce are published constants (§5.8). | **Open**, as ECC-2 and X509-7 are, for the same reason. The language has no store the optimiser is barred from removing, so a wipe written in Nish could be deleted as a dead store and give false assurance. Once a release ships the primitive (#385), each of these functions wipes before it returns, and a test pins that the wipe survives `-O2`. |

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
