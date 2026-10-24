# Security record: QUIC

The record for `nish/net/quic-packet` (WP34 Q1), for the connection built
on it, `nish/net/quic` and its parts (WP34 Q2, first part), and for what a
server answers before any connection exists, `nish/net/quic-listener`, with
the connection's idle timeout and key update (WP34 Q2, second part), for
loss recovery, `nish/net/quic-recovery` and its use in the connection and the
listener's pacer (WP34 Q3), and for streams and datagrams,
`nish/net/quic-stream` and `nish/net/quic-datagram`, the connection as a
reusable slot that allocates nothing per packet, and the listener's GSO
flight (WP34 Q4). It says which
functions hold secrets and which of them are wiped, as CLAUDE.md §Security
asks, and it names the tests that pin the modules' refusals.

## Scope

| File | Functions |
| --- | --- |
| `std/net/quic-packet.ts` | `quicInitialSecrets`, `quicKeys`, `quicKeyUpdateSecret`, `quicKeysUpdate`, their in-place forms `quicInitialSecretsInto`, `quicKeysInto`, `quicKeyUpdateSecretInto`, `quicKeysUpdateInto` and the `QuicKeysSlot` they write into, `quicKeysWipe`, `quicSealPacket`, `quicRemoveHeaderProtection`, `quicDecryptPacket`, `quicOpenPacket`, the Retry functions, and the varint, packet-number and header codecs |
| `std/net/quic-frame.ts` | `quicParseFrame` and the frame writers |
| `std/net/quic-conn-params.ts` | `quicParseTransportParameters`, `quicEncodeTransportParameters`, and their in-place forms `quicParseTransportParametersInto`, `quicEncodeTransportParametersInto` |
| `std/net/quic-conn-ack.ts` | `QuicAckRanges` |
| `std/net/quic-conn-cid.ts` | `QuicCidTable` |
| `std/net/quic.ts` | `QuicConnection`: `receive`, `receiveWindow`, `sign`, `takeDatagram`, `takeDatagramInto`, `readStream`, `writeStream`, `nextStreamEvent`, `openStream`, `streamRead`, `streamWrite`, `streamReset`, `streamStopSending`, `sendDatagram`, `readDatagram`, `close`, `release`, `reset`, `acceptRetry`, `deadline`, `handleTimer`, `updateKeys`; `quicStatelessResetToken` |
| `std/net/quic-stream.ts` | `QuicStreams`: `onStream`, `onReset`, `onStopSending`, `onMaxStreamData`, `onStreamDataBlocked`, `onMaxData`, `onMaxStreams`, `open`, `write`, `read`, `resetStream`, `stopSending`, `putNextChunk`, `putNextControl`, `chunkAcked`, `chunkLost`, `controlAcked`, `controlLost`, `nextEvent` |
| `std/net/quic-datagram.ts` | `QuicDatagramQueue`: `push`, `pop`, `putFrame` |
| `std/net/quic-recovery.ts` | `QuicRecovery`: `onPacketSent`, `onAck`, `deadline`, `onTimeout`, `discardSpace`, `evictOldest`, `pacerDelay`, `onPaced`; `QuicSentPackets` |
| `std/net/quic-listener.ts` | `QuicListener`: `handleWindow`, and `handle` over it (Version Negotiation, Retry and its token, the stateless reset), and `release`; `QuicListenerAnswer.wipe`; `quicListenerTakePaced`, `quicListenerPaceTime`, `quicListenerTakeFlight`, `quicListenerReceiveSegments` |

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

Every ACK frame a client sends is attacker input to loss recovery too:
which packet numbers it names, its ACK Delay, and when it arrives. A win for
the attacker there is a panic or a loop it can make long, a timer it can push
out of range, a buffer of retransmissions it can grow without bound, or a
congestion window it can open wider than the path it is on, so that the
server sends faster toward it than the network carries (the optimistic ACK of
RFC 9000 §21.4). A client that acknowledges nothing at all is a win if it
makes the server send without limit.

Every stream frame and every DATAGRAM frame is attacker input too, and so is
the pace of it: a client opens streams, sends data out of order and past
what it was given, resets and stops streams, asks for credit it was not
given, and sends datagrams as fast as it likes. A win for the attacker there
is a buffer it can grow (a stream's, the connection's, the queue of
datagrams or of owed frames), a stream it can open past the limit or bring
back after it finished, data delivered past a final size, a state RFC 9000
§3 forbids, or arena memory the server keeps per packet, which over a long
connection is the same as a buffer without a bound.

## Findings

| Id | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| QUIC-1 | Low | `std/net/quic-packet.ts` (`quicKeys`, `quicKeysUpdate`, `quicKeyUpdateSecret`, `quicKeysWipe`, and the `QuicKeysSlot` the first two derive into) | *Rewritten by #430's secret-boundary stage and again by #674's secret-fields stage; it names functions rather than lines.* **What was open: the allocating key forms.** `quicKeys` and `quicKeysUpdate` take a Handshake or 1-RTT traffic secret and answer a `QuicKeys` that holds the packet key, the IV and the header-protection key, with both AES keys expanded; `quicKeyUpdateSecret` takes the current secret and answers the next generation's. They took and answered plain arrays, left their HKDF-Expand-Label outputs in arena memory, and answered a `QuicKeys` the module allocated and nothing zeroed. **What is wiped now.** All three take the traffic secret as a `Secret<u8[]>` from `nish:secret`, and `quicKeyUpdateSecret` answers one, so a caller holds its secrets under the language's rule that a `Secret` is wiped or returned on every path. Since #674, `quicKeys(slot, aead, secret)` and `quicKeysUpdate(slot, keys, next)` derive into a `QuicKeysSlot` the caller passes and answer its `keys` (D6 of #674's plan): the key, IV and header-protection key are expanded straight into the slot by `quicKeysInto` and `quicKeysUpdateInto` over an `HkdfScratch`, which wipes its keyed hashers and output blocks before each call returns, and the plain copy of the secret `expose` hands the derivation is zeroed before the call returns, so neither function leaves a key in arena memory: what each leaves there is the `HkdfScratch` it makes, wiped before it returns. `quicKeysUpdate` answers `null`, deriving nothing, for keys that live in the slot it is handed, which it would overwrite as it read them. `quicKeysWipe` zeroes a `QuicKeys` with volatile stores: its key, IV and header-protection key with `secureZero`, and both AES schedules with `aesKeyWipe`, H and the kernels' powers of it included; `QuicKeysSlot.wipe` does the same for the whole slot. A next generation from `quicKeysUpdate` holds its own copy of the header-protection key and its own schedule of it, so wiping one generation's slot leaves the other whole and usable. **The terms it is closed on.** A slot the caller owns is the caller's to wipe: the keys in it stay readable until the caller runs `QuicKeysSlot.wipe` or `quicKeysWipe`, as a buffer a caller hands `aesKeyInto` is the caller's, and the module keeps nothing of its own. A key in a register or a spill of one (AEAD-4), and anything a caller copies out, no wipe reaches. A connection does not use these forms: its keys go through the in-place `quicKeysInto`, `quicKeysUpdateInto` and `quicKeyUpdateSecretInto` into the slots of its own spaces, over its own `HkdfScratch`, and are wiped (QUIC-2). **What needs no wipe:** the Initial secrets and keys (`quicInitialSecrets`, which still answers plain arrays, and `quicKeys` of a copy of its answer) are not secret, because anyone who reads the client's first Destination Connection ID derives them (RFC 9001 §5.2). The Retry key and nonce are published constants (§5.8). **Tests:** `link/${name}: exits with ${wantCode} and stdout matches expected.out` for `net_quic_wipes` and `net_quic_wipes_f64` derive two generations from held secrets into slots of their own under each suite and read back as zero, after `quicKeysWipe`, the next generation's key, IV, header-protection key and schedules, then that the first generation's keys and schedules are still held, then the first's after its own `quicKeysWipe`; `quic: the one-shot key derivations' wipes survive opt -O2 (each HKDF output once copied out, and quicKeysWipe's keys and AES schedules)` (`tests/wipes/quic.js`) counts `quicKeys`' 13, `quicKeysUpdate`'s 13 and `quicKeysWipe`'s 7 volatile wipes after `opt -O2`; `reject_secret_quic_plain_key` refuses a plain array where `quicKeys` takes a `Secret`. | **Closed** (#430; the `QuicKeys` the module allocated, by #674's D6: a slot the caller owns is the caller's to wipe). |
| QUIC-2 | Low | `std/net/quic.ts` (`QuicConnection`, the `QuicConnSpace` of each level), `std/net/quic-packet.ts` (`QuicKeysSlot`, `quicSealInPlace`, `quicUnprotectHeader`, `quicDecryptPayload`) | *Rewritten by #674's secret-fields stage; it names functions rather than lines.* **What a connection holds between calls.** A connection keeps each level's `QuicKeys` (packet key, IV, header-protection key, and for the AES suites both keys expanded) in its space's `QuicKeysSlot`s, its `TlsServer` (whose `Secret` fields hold the ephemeral key and the handshake, traffic, exporter and resumption secrets, TLS-1, closed by #674), the seed its connection IDs are derived from, both sides' stateless reset tokens, and for key update (RFC 9001 §6) the current 1-RTT read and write secrets, the next generation's read secret and read keys, and for a probe timeout after an update the previous generation's read keys, for as long as the connection lives. Since #674 the ephemeral key and the 1-RTT secrets are `Secret` fields of the connection (`ephemeral`, and `readSecret`, `nextReadSecret` and `writeSecret` at each of the two widths, 256 and 384), which are read only as a call's argument (NL2544, `reject_secret_field_quic_read`), rewritten in place through `exposeWith`, and ended by `QuicConnection.wipe()`, which the checker refuses to compile if it leaves one unwiped. **What is wiped, and when.** Every wipe is a store no optimiser removes: `secureZero` for a byte array, and `aesKeyWipe` for an AES schedule (a volatile `llvm.memset` over the whole of `roundKeys`, the kernels' powers of H included, and over H), which replaced the ordinary stores of `quicPacketClearAes`. *A level*, when it is discarded (the Initial keys on the first Handshake packet, the Handshake keys when the handshake is confirmed, RFC 9001 §4.9): `discard` wipes the read and write keys and every `QuicKeysSlot` of the space, all four schedules of each, and discarding the Handshake level also wipes `TlsServer`'s client and server handshake traffic secrets, which nothing reads after it (TLS wipes the handshake secret itself). *A key generation*: `updateWriteKeys` wipes the replaced write key, IV and packet-key schedule at once and ratchets the write secret in place, so the replaced secret is overwritten rather than kept, and `prepareNextReadKeys` the previous read generation's the same way a probe timeout later; the header-protection key and its schedule, which every generation shares, go with the level. *The connection*: `release()`, `reset`, the idle timeout, and the end of the closing or draining period run `wipeAll`, which takes every level, the next generation's read keys, the Initial secrets, the connection's `Secret` fields through `QuicConnection.wipe()` (the key-update secrets and the ephemeral key), the seed, both sides' stateless reset tokens (`QuicCidEntry.resetToken`, the client's parameters' `stateless_reset_token`, and the server's encoded transport parameters, which carry its first ID's token) and every secret `TlsServer` holds, its expected client Finished and its resumption master secret among them, which `TlsServer.wipe` zeroes whether or not the handshake has derived them yet. A connection that closes keeps its keys through the closing or draining period, three probe timeouts (RFC 9000 §10.2), and `runClocks` wipes them at the period's end, which `deadline()` names, so a connection that has taken its CONNECTION_CLOSE, or owes none, does not keep them for the rest of the process even if it is never released. The module sends the CONNECTION_CLOSE once and never again in the closing state (it answers nothing there, as RFC 9000 §10.2.1 permits), so the period is kept for its timing, and the keys outlive their last use by those three probe timeouts. After `close` or `fail` the closing period starts only when `takeCloseInto` hands out the CONNECTION_CLOSE, not when the connection closes: until then `deadline()` answers -1, so however long the caller waits before its next `takeDatagram`, the close it owes is still sealed with keys the connection holds, and nothing a connection sends changes. The draining period on the client's CONNECTION_CLOSE, and a `begin` refused for its entropy or configuration, which owe nothing, start theirs at once. *Each packet*: the nonce, which is the IV with a public packet number XORed in and so gives the IV away, and the header-protection mask are wiped once used, by `quicSealInPlace`, `quicUnprotectHeader` and `quicDecryptPayload`. The caller's entropy is wiped as soon as it is copied (`begin`), each derived connection ID's and stateless reset token's HMAC output and scratch hasher once it is split (`deriveConnectionId`, `quicConnResetTokenInto`, `quicStatelessResetToken`), the first ID's token once it is in the transport parameters (`establish`), the Initial secret once both directions' are expanded (`quicInitialSecretsInto`), the next read secret once the peer's key update is confirmed (`applyPhase`), the plain copy of a secret `expose` hands each derivation (`keysFrom`, `nextKeys`), the ephemeral key once `TlsServer` holds its own copy (`establish`), and every derivation runs in the slot's `HkdfScratch`, which wipes its keyed hashers and output blocks before each call returns. **What no wipe reaches:** a key while it sits in a register or a spill of one (AEAD-4); a `QuicKeysSlot` the caller owns and does not wipe, and the next secret `quicKeyUpdateSecret` answers until the caller wipes it (QUIC-1), and `quicStatelessResetToken`'s output (QUIC-5); a close owed and never taken, whose keys stay until `release()` or `reset` because they must still seal it (`runClocks` starts no idle timeout in that state); the plaintext of each sent packet (whose NEW_CONNECTION_ID frames carry tokens) and of `TlsServer`'s EncryptedExtensions until that arena memory is reused; and anything a caller copies out. **Tests:** `link/${name}: exits with ${wantCode} and stdout matches expected.out` for `net_quic_wipes` and `net_quic_wipes_f64` read back as zero the arrays a server connection exposes to them: each level's keys, IVs, header-protection keys and AES schedules after it is discarded (the handshake traffic secrets with the Handshake level, and `TlsServer`'s copies of the application traffic secrets once the connection takes them), the replaced write key, IV and schedule and the replaced read secret after a key update, at every end of life (the end of the closing period after a close and after a failure, the end of the draining period, the idle timeout, `release()` and `reset`) every key slot, the 1-RTT read and write secrets, the Initial secrets, the connection-ID seed, the ephemeral key and `TlsServer`'s secrets, which the connection still holds (`qwConnZero`); at `release()` and `reset` only, besides those, the server's own reset tokens and the encoded transport parameters, which a snapshot taken before the end keeps (`QwSnapshot`); and the caller's entropy once a connection takes it, under each of the three suites; they read the keys still held a millisecond before the period ends, and check that the CONNECTION_CLOSE still goes out when the caller next asks ten probe timeouts after the close or failure; `quic: the wipes survive opt -O2 (a key slot's keys and AES schedules, each packet's nonce and mask, a key update's replaced generation, a discarded level and its handshake secrets, the reset tokens, connection IDs and entropy once used, and every key at release, reset, the idle timeout and the end of the closing or draining period)` (`tests/wipes/quic.js`) counts each root's volatile wipes after `opt -O2` over the QUIC, AES and HMAC modules. Each of the 66 wipe lines in `quic.ts` and `quic-packet.ts` was deleted in turn by #674's secret-fields stage (#430 had done the same for the 64 there were): 56 lower at least one of the 23 roots' counts in `tests/wipes/quic.js`; the seven `wipe(this.f)` lines of `QuicConnection.wipe()` the checker refuses to delete, since a holder's `wipe()` that can leave a `Secret` field unwiped does not compile; and three lower none: `wipeAll`'s call to `TlsServer.wipe` and `afterTls`' two calls to `TlsServer.wipeSecret` for the handshake traffic secrets, whose wipes are in `nish/net/tls`, which `opt` does not inline into this group, and are counted by `tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words; a resumed handshake's PSK, early secret, binder key and salt)` (`tests/wipes/tls.js`). Deleting any of the three fails the read-backs instead (`qwConnZero` reads every field back as zero, and the Handshake level's discard reads `TlsServer`'s handshake secrets). `afterTls`' two calls for the application secrets, which lowered no count before #674, now each lower `afterTls` by 13, because the connection takes the secrets into its fields where `opt` sees the call. The wipes no read-back sees, pinned by the count alone: `wipeAll`'s loop over the peer's connection-ID tokens and its wipe of the peer's `stateless_reset_token` (a client never issues the tokens the server tests would need), its wipe of the other read generation and `prepareNextReadKeys`' (whose slot the same call refills), the plain copy of a secret `keysFrom` and `nextKeys` hand each derivation, and the next read secret and the ephemeral key `quicConnZeroHeld` zeroes in place (`applyPhase`, `establish`). `wipeAll`'s loops over the read and write secret pools are gone: the fields they held are `QuicConnection.wipe()`'s, which `qwSecretsZero` reads back; so is `updateWriteKeys`' wipe of the replaced write secret, which the ratchet now overwrites in place. Anchors are function names. | **Closed** (#430). |
| QUIC-3 | Medium | `std/net/quic.ts` (`receive`, `takeDatagram`) | **Per-packet allocation.** Every datagram a connection read and every one it wrote allocated from the arena (the parsed header, the packet's plaintext, the reassembly runs, the sealed packet), and nothing was given back while the connection lived, so a connection's memory grew with the traffic its peer sent: 174 bytes kept for each 100-byte stream packet in and its echo out, measured on `main` before Q4 over 300 such rounds, on top of 29,056 bytes for each new `QuicConnection` (Q3's record of packets in flight) and 105,408 for its handshake's server calls. **What Q4 changed.** A connection is a slot: every buffer it uses is made by the constructor, sized by the configuration, and reused — the record of packets in flight, one CRYPTO reassembly buffer for all levels, the connection-ID table's slots, the PATH_CHALLENGE ring, the datagram rings — and `reset(entropy)` makes it a new connection for the next client after wiping the last one's secrets. A packet is opened (`receiveWindow`) and a datagram built and sealed (`takeDatagramInto`) inside a `using a = arena()` block: the AEAD's and header protection's temporaries are released when it ends, and the compiler refuses the block (NL2424) if anything it reaches could store an allocation, which is the proof. Headers are read as windows (`quicParseHeaderInto`), frames written in place (the `put` writers), NEW_CONNECTION_ID's ID and token copied into the table's slots, and TLS handed its CRYPTO bytes from the reassembly buffer itself. **Measured** (`tests/link/net_quic_stream`, `arena.ts`, every server call measured on its own): 300 rounds of a stream packet in and its echo out, with ACKs and credit updates, keep **0** bytes; 200 datagrams in and their echoes out keep **0** (`net_quic_datagram`); `reset` keeps **0**; and through one slot, a connection keeps **0** after its handshake, while the handshake keeps **88,344** bytes of server calls, exactly the same for every connection from the second on (the first, 89,624, grows the CRYPTO stream's array once). A slot costs 49,600 bytes made once under the echo configuration without streams; a stream's receive and send buffers and their bitmaps (36,960 bytes for a 16 KiB stream) are not the slot's but **lent**: fixed-size buffers taken from a `QuicStreamPools` the first time a side of a stream is used, and given back, zeroed over the extent written, when the receive side has been read to its end or reset and the send side has every byte up to its final size acknowledged or is reset (`std/net/quic-stream.ts` at `462b0092`: `:359` `keep`, `:803` `giveRecv`, `:832` `giveSend`, `:1933` in `chunkAcked`), so retransmission always reads a send buffer still held. No pool is touched inside a packet's arena block, where the compiler would refuse a free-list push or pop: before the block, `prime` (`:274`, called from `std/net/quic.ts:1781` for 0-RTT and 1-RTT packets) readies a fixed-length reserve beside the free lists, and inside it a first STREAM byte takes a buffer from the reserve (`lend`, `:321`) and a give-back puts it there zeroed (`keep`), by index alone. `prime` first gives the reserve back down to `hold` buffers (one connection's stream count) and then tops it up to as many receive sides as the packet could start, which is no more than the sides holding none, nor than one per three bytes. The peer's remaining stream credit is not used as a tighter bound: an ACK earlier in the same packet can finish a stream, and `release` raises the limit before a later STREAM frame opens a stream past the old one, so a reserve sized by the credit would come up short and the lend would panic. `prime` runs before the packet is authenticated, on its length alone, so a 0-RTT or 1-RTT packet that then fails its AEAD check can still pull buffers into the reserve; nothing lends them, and the next `prime`, or the `drain` before a read or `release` keeps into the reserve, gives them back down to `hold`, all within the ceiling. Once warm, `prime` takes and gives nothing and costs a handful of comparisons. The reserve is three times `hold` long, so a packet that takes back every buffer its connection held still fits, and the pools count the reserve's buffers as lent: `prime` and the `drain` before each give-back outside a packet trim it to `hold` for the whole server, while `keep` inside a packet can raise it to three times `hold` until the next `prime` or `drain`. Since those idle buffers count against the ceiling, a send side that borrows when the pools are out (the free list empty and every buffer made) takes the reserve's last pair instead (`lendSend`, `:339`): a side that wants a buffer holds none, so not every buffer is lent and the reserve has one. A read that finishes a receive side, and `release`, run outside any block and trim the reserve before keeping into it (`:766` `giveBack`, `:1523` in `read`). `Http3Server` shares one pair of pools across its slots, made by its constructor for the stream table its configuration gives every slot and lent to each slot's `QuicConnection` as the slot is built on the first Initial accepted into it (`std/net/http3-server.ts` `build`, from `unowned`, at `0fcab5c`, #779), with a ceiling of slots × streams × 2 so a take never fails — the slots, and so the stream buffers they lend, reach their full count at run time, one slot per accepted Initial, never past `size`, as H3-1 records — and a standalone `QuicConnection` makes a private pair, every buffer its slots could hold made at once by its first packet (`ownPools`, `:725`; `std/net/quic.ts:1783`), so that how many it holds, which turns on the peer's acknowledgements, never allocates after it; an idle server slot holds none, and a standalone connection that `share`s a server's pools leaves its private ones behind, made once and unused. **The give-back zeroes with `BufferPool.give`'s plain fill, not `giveSecret`'s `secureZero`:** the next borrower reads the buffer, so `-O2` cannot drop the fill as a dead store; `secureZero` clears the whole buffer, 16 KiB for a stream that wrote 10 bytes, where the fill costs the bytes written; and the bytes are stream data under the packet keys, not keys. Before this change no stream buffer was wiped at all: each slot's buffers held the last connection's bytes until a new stream overwrote them. `cryptoIn` (18,432 bytes), the datagram rings (19,264 at a 1,200-byte frame) and the eight key slots (27,488) stay the slot's own, 65,184 bytes of arrays; a carrier sizes `maxStreamData` and the stream limits for what it holds, and a configuration whose stream buffers would pass `QUIC_CONN_MAX_STREAM_BUFFERS` (64 MiB a connection) is refused rather than allocated. The datagram rings are made only when `maxDatagramFrameSize` offers DATAGRAM frames, up to 1,500 bytes, and each receive entry holds a whole frame of the size offered. **What still allocates**, once a connection and bounded: the handshake's 88,344 bytes — `TlsServer` and its key schedule (TLS-3 in [tls.md](tls.md)), the packet keys of each level (HKDF, which stores allocations of its own until N9's TLS memory work gives it caller-owned scratch), the stateless reset token and each new connection ID (HMAC), and the transport parameters both ways; a first Initial that does not authenticate costs its Initial key derivation before anything else is made; a key update the client starts (QUIC-4, capped at 64); and a connection ID the client retires, which is replaced with two HMACs, capped at `QUIC_CONN_MAX_ISSUED_CIDS` (64) IDs a connection. The allocating forms `takeDatagram`, `readStream` and `writeStream` stay for tests and recordings and say so. **The handshake's remainder (H3-1), closed by N9's QUIC stage.** The handshake now keeps its state in the slot as TLS over TCP does since #467: one `TlsServer` a slot, made by its first handshake and `restart`ed for each after it; each level's packet keys, the next read keys and a key update's keys derived in place by `quicKeysInto` and `quicKeysUpdateInto` into `QuicKeysSlot`s the space made once (both key sizes, the IV, both AES schedule sizes, through `HkdfScratch` and `aesKeyInto`), the generations of a key update taking turns in two slots and two secrets a direction; the Initial secrets derived by `quicInitialSecretsInto` from the DCID read in place; the stateless reset tokens and connection IDs computed in the HMAC scratch inside arena blocks and copied into the table; the server's transport parameters encoded, and the client's parsed, into the slot's own objects and arrays (`quicEncodeTransportParametersInto`, `quicParseTransportParametersInto`); and TLS's flight read out of its output buffers in place. **Measured** (`tests/link/net_quic_memory`, every server call metered from a chunk of its own, so a call that crosses chunks is counted whole; then `Arena.mark()` read across a hundred more): after two warm-up connections, a connection through one slot kept **109,776** bytes before and keeps **0** after under aioquic's AES-128-GCM recording, **87,328** → **0** under ChaCha20-Poly1305 and **127,312** → **0** under AES-256-GCM-SHA384, the last two each with a key update the client starts and the probe timeout after it; over a hundred more connections each, `Arena.mark()` does not move; and every datagram the server writes is the first connection's, byte for byte. The last allocation to go was `TlsServer.handleClientHello`'s copy of the client's `quic_transport_parameters` (56 or 96 bytes here), which it now refills into an array the `TlsServer` keeps, as the connection does with the server's (TLS-3). The slot costs more instead, once: about 42 KB more a `QuicConnection` (eight key slots with both AES schedule sizes, the HKDF scratch, the secret pools, the parameter objects), and the slot's `TlsServer`, 30,904 bytes, made by its first handshake where every handshake used to make one. | **Closed** (WP34 Q4; the handshake's remainder by N9's QUIC stage). |
| QUIC-4 | Low | `std/net/quic.ts` (`notePhase`, `updateWriteKeys`, `prepareNextReadKeys`) | **What a key update leaves in the arena, and what it costs.** Each key update the client starts makes the server derive two generations of keys: its own next write keys at once (RFC 9001 §6.2) and, a probe timeout later, the next read keys after that (§6.3). `quicKeyUpdateSecret` and `quicKeysUpdate` leave their HKDF and HMAC state and the AES schedule `aesKey` answers in the arena, as T2's record install does (TLS-3), and for the same reason: `Arena.release` is deprecated (#428), `std/` may call nothing deprecated, and a `using a = arena()` block is refused (NL2424) while those callees store allocations. Measured under AES-128-GCM over sixty-four updates in `net_quic_lifecycle`, an update the client starts, its packet read and both derivations made, leaves 11,200 bytes behind (of which reading any 1-RTT packet is about 640, QUIC-3). The 1-RTT keys' install derives one generation ahead too, once a connection. **The bound:** a connection follows at most `QUIC_CONN_MAX_KEY_UPDATES` (64) updates from its client and closes on the next with KEY_UPDATE_ERROR, having derived nothing for it, so a client can make the server derive at most 64 × 11,200 = 716,800 bytes a connection this way; and since the next read keys exist only a probe timeout after the last update, a client can update at most once per probe timeout (RFC 9002's: 1,022 ms before the first RTT sample, about a round trip plus 25 ms after it). The cap, not the rate, is what bounds the total. A packet whose Key Phase bit is flipped but that does not authenticate under the next keys, which were derived in advance, derives nothing at all (608 bytes, the cost of any dropped packet). **The cap is an interoperability trade-off, like TLS-3's:** RFC 9001 sets no limit on how many key updates a peer starts, so a conforming long-lived client that updates on a schedule of its own, more than 64 times, is disconnected. A client that updates only when an AEAD's confidentiality limit requires it (§6.6) reaches the cap after 2^29 packets. **Since the handshake moved into the slot** (QUIC-3's remainder), the generations take turns in two `QuicKeysSlot`s and two secret arrays a direction, derived in place by `quicKeyUpdateSecretInto` and `quicKeysUpdateInto` inside arena blocks, so an update leaves nothing: measured the same way over the same sixty-four updates, **11,200 → 0** bytes each (`net_quic_lifecycle`), and a ChaCha20-Poly1305 or AES-256-GCM-SHA384 connection with an update keeps nothing more than one without (`net_quic_memory`). The cap stays: it no longer bounds memory, but still bounds the derivations a client can ask a connection for, at the interoperability cost above. | **Closed** for memory (N9's QUIC stage); the cap remains as a bound on work, and lifting it is a separate decision. Updates the server starts with `updateKeys()` are the application's to bound, besides the one `beforeDatagram` now starts itself at three quarters of the confidentiality limit (QUIC-6, #784), at most one per 6,291,456 (3 × 2^21) packets sealed, since the count restarts at each update. |
| QUIC-5 | Low | `std/net/quic.ts` (`QuicServerConfig`), `std/net/quic-listener.ts` (`QuicListener.release`), `std/net/http3-server.ts` (`Http3Server.stop`) | **The static keys and the listener's seed.** The stateless reset key and the Retry token key (`statelessResetKey`, `retryTokenKey`) are fields of the caller's `QuicServerConfig`, and the listener's 32-byte seed a field of `QuicListener`, for the server's whole life: a reset key has to outlive a restart to be any use (RFC 9000 §10.3.2), and `QuicServerConfig` and the listener are not yet holders of `Secret` fields (`nish:secret`'s `Secret` fields lifted NL2430; making them holders is left to a follow-up of #674). Since H3-3 ([http3.md](http3.md)) the listener computes each token's MAC, each reset token and each of the generator's blocks in its own `HkdfScratch`'s HMAC scratch inside an arena block, wiping the keyed hashers and the full tag after each, and the generator's block is one 32-byte pool refilled in place, each byte zeroed as it is taken. The Initial keys an INVALID_TOKEN close is sealed with stay in the listener's two key slots until the next such close: anyone who saw the client's DCID can derive them (RFC 9001 §5.2). **What is wiped, and when.** `QuicListener.release()` wipes the seed, the generator's pool, the tag, the `HkdfScratch` (its HMAC-SHA256 and HMAC-SHA384 hashers and blocks), both Initial secrets, both key slots and `handle`'s spare `QuicListenerAnswer`, which holds the last answer (a Retry's token, a reset's token, the IDs), across each array's whole room rather than its length; from then on `handle` and `handleWindow` answer nothing and drop every datagram. The listener's other methods (`refill`, `randomByte`, `retry`, `statelessReset`, `tokenMac`) still run after it, `refill` under the zeroed seed, and are its caller's not to call. `Http3Server.stop()` releases every slot's connection (`QuicConnection.release`, QUIC-2) and the listener, then wipes the configuration's `statelessResetKey` and `retryTokenKey`, the connection-ID index's salt, the connections' entropy scratch and the server's own `QuicListenerAnswer`, across its room; the server drops every datagram after it. The configuration's two keys are the server's once it is made with them, as `Http3Server.stop`'s doc comment says, and `stop` zeroes them in place: any other listener, connection or server made with the same `QuicServerConfig` then MACs Retry tokens and derives stateless reset tokens under an all-zero key, which anyone can forge. One configuration serves one server, and its `stop` ends the configuration for every other user, as `stop`'s doc comment and the user guide say. Nothing a server sends before release changes: the wipes run only at release. **What no wipe reaches:** a copy of either key the caller keeps (to start the next server with, the reset key has to be kept), which is the caller's to wipe; a server driven by `QuicListener` and `QuicConnection` without `Http3Server`, whose program wipes the configuration's keys itself when it stops; the keys while they sit in a register or a spill of one (AEAD-4); the digests `Sha256` answers inside `finishInto`, wiped there, and the arena block's other temporaries, released unwiped (K1's record); the token `quicStatelessResetToken` answers, in a plain array that is its caller's (tests and vectors use it; the listener and every connection derive theirs with `quicConnResetTokenInto` instead, QUIC-2), which wipes its full MAC but not the token it returns; the `QuicListenerAnswer` `handle` returns, a copy of the spare that is its caller's to wipe; the bytes of an answer that grew past its room beyond the longest length its `wipe` reaches (the listener's and the server's are made with `QUIC_LISTENER_ANSWER_SIZE`, which no answer exceeds); and `Http3Server`'s TLS signing key, the caller's `Secret` handed to each `receive` (TLS's record). The listener's Retry integrity key is RFC 9001 §5.8's published constant, not a secret. A memory disclosure of the reset key while the server runs lets the reader end any of its connections; of the token key, forge Retry tokens for any address, which undoes the address validation Retry is for, though not the TLS handshake after it. **Tests:** `link/${name}: exits with ${wantCode} and stdout matches expected.out` for `net_quic_server_wipes` and `net_quic_server_wipes_f64` drive a listener through a Retry, a stateless reset, an accepted token and a forged one (an INVALID_TOKEN close), check that the seed, the pool, both Initial secrets, both key slots, the HMAC-SHA384 hashers and the spare answer's reply read non-zero before `release()` and every one of them zero after it, the reply across its whole room and both IDs across their 20 bytes; the tag, the HKDF block and the HMAC-SHA256 hashers already read zero before it, wiped after each use, so their wipes at release are shown by the -O2 count alone, as are the spare's IDs beyond their length; that a released listener answers none of five kinds of datagram, and that a second listener on the same configuration answers the same Retry and reset byte for byte; and drive an `Http3Server` through a handshake, check that both keys, the salt, the listener's seed and the connection in use read non-zero before `stop()` and zero after it; that the entropy scratch (zero before, wiped by `begin` once taken), the listener's pool and key slots, the unused slot's connection and the server's answer across its room read zero after it, though on this drive none of them is shown non-zero first, so their wipes are shown by the -O2 count and by the standalone listener's drive; and that it then accepts no new Initial. `quic-server: the wipes survive opt -O2 (the listener's seed, generator, scratch, INVALID_TOKEN keys and last answer at release, and the stateless reset and Retry token keys, the index's salt, the server's last answer and every connection at stop)` (`tests/wipes/quic-server.js`) counts each root's volatile wipes after `opt -O2`: 3 in `QuicListenerAnswer.wipe`, 47 in `QuicListener.release` and 228 in `Http3Server.stop`. Each of the 21 wipe lines in `QuicListenerAnswer.wipe`, `QuicListener.release` and `Http3Server.stop` was deleted in turn, and every one lowered a count: each `secureZero` in `release` and `stop` by one, `kdf.wipe()` and either key slot's `wipe()` by 13 in both roots, `listener.release()` by 47 in `stop`, either arm of `stop`'s loop by 87, `spare.wipe()` and `answer.wipe()` by 3, each of the answer's three array wipes by one in `QuicListenerAnswer.wipe` and `release` and by two in `stop`, and the `secureZero` they share by 3, 3 and 6. Anchors are function names. | **Closed** (#430) for what the modules hold; a key the caller copies out stays the caller's to wipe. |
| QUIC-6 | Low | (rewritten, anchors at `15ee55f`) `std/net/quic.ts:385` (`QUIC_CONN_CONFIDENTIALITY_LIMIT` and the integrity limits after it), `:2701` (`afterTls` sets them per suite), `:3334` (`beforeDatagram`, the key update), `:3650` (`sealAt`: the check at `:3654`, the count at `:3698`), `:2058` (`updateWriteKeys` zeroes the count), `:1908` (`openScoped`: the failed-open count at `:1927`) | **The AEAD limits of RFC 9001 §6.6 were not enforced.** The connection did not count the packets it seals under one key, so it did not start a key update itself before AES-GCM's confidentiality limit of 2^23 packets, and it did not count packets that fail authentication against the integrity limit (2^52 for AES-GCM, 2^36 for ChaCha20-Poly1305), so it did not close with AEAD_LIMIT_REACHED. Before Q4 a connection carried at most `maxData` plus its own `maxStreamData` per stream, far under 2^23 packets; with credit raised as the application reads it can carry any amount, and 2^23 packets of 1,200 bytes is about 10 GB; a forgery attempt rate high enough to approach 2^36 over one connection's life is not a loopback scenario, but it is one the RFC asks to be bounded. | **Closed.** *What changed.* `sealedUnderKey` counts the packets sealed under the current 1-RTT write key, and `updateWriteKeys` zeroes it. Before each datagram is built, outside its arena block because a key update stores the keys it derives, `beforeDatagram` calls `updateKeys()` once the count is at three quarters of `confidentialityLimit` (2^23 under AES-GCM), so the update goes as soon as §6.1 allows one: within a quarter of the limit, 2^21 packets, the client has to acknowledge a packet of the current phase. If it never does, `sealAt` seals up to the limit and then closes with AEAD_LIMIT_REACHED, sealing nothing more under the key, its CONNECTION_CLOSE included: the close cannot be sent without breaking the limit it reports, and the closing period ends the connection. ChaCha20-Poly1305 has no confidentiality limit, so its `confidentialityLimit` is `QUIC_MAX_VARINT`, which no packet number reaches. `authFailures` counts every packet whose AEAD fails to open, at every level and under every key, over the connection's life, and the next past `integrityLimit` (2^52 for AES-GCM, 2^36 for ChaCha20-Poly1305) closes it with AEAD_LIMIT_REACHED. The suite is known only once the 1-RTT keys are in, so until `afterTls` sets the limit the count is held to AES-GCM's 2^52, which no handshake comes near; a packet whose header protection cannot be removed opened nothing and is not counted, nor is a first Initial that fails, since no connection was started and the slot starts afresh on the next. `reset` returns all four fields to AES-GCM's limits and zero, and forgets the skipped numbers (QUIC-7). The limits are fields so a test can lower them; nothing else sets them. Tests: Pinned in `link/${name}: exits with ${wantCode} and stdout matches expected.out` for `net_quic_lifecycle` and `net_quic_lifecycle_f64`: "under AES-GCM a write key seals at most 2^23 packets and 2^52 may fail to authenticate (RFC 9001 §6.6)", "under ChaCha20-Poly1305 2^36 may fail to authenticate, and no count of packets reaches its confidentiality limit", "at three quarters of the confidentiality limit, 6 packets of 8, the server starts a key update (RFC 9001 §6.6)", "with no update possible, the key seals up to the limit and the connection closes with AEAD_LIMIT_REACHED, sealing nothing more, its close included", "packets that fail to authenticate are counted, and up to the integrity limit the connection stays", "the next past the limit closes it with AEAD_LIMIT_REACHED (RFC 9001 §6.6)", "a first Initial that fails to authenticate is not counted: no connection is started" and "reset forgets the skipped numbers and zeroes the counts, and the limits are AES-GCM's again". |
| QUIC-7 | Low | (rewritten, anchors at `15ee55f`) `std/net/quic.ts:400` (`QUIC_CONN_SKIP_RING`, `QUIC_CONN_SKIP_MIN`, `QUIC_CONN_SKIP_SPREAD`), `:3048` (`scheduleSkip`), `:2703` (the first draw, in `afterTls`), `:3334` (`beforeDatagram`, the skip), `:2331` (`receiveAck`), `:2360` (`acksSkipped`) | **An optimistic ACK was not detected.** RFC 9000 §21.4 describes a client that acknowledges packets before it receives them, to open the server's congestion window wider than its path, and suggests skipping packet numbers now and then to catch it: a client that acknowledges a number never sent is lying. The connection refused an ACK of a number at or past the next one it would send (PROTOCOL_VIOLATION, §13.1), but sent every number in order, so an ACK of one in flight could not be told from a real one. What bounds the effect: the anti-amplification limit until the address is validated, the credit the client itself gave, and the Application Data record of 128 packets in flight, which caps what the server has outstanding toward any one client at about 150 KiB however wide the window is. | **Closed.** *What changed.* Once the 1-RTT keys are in, `scheduleSkip` draws the next Application Data packet number to skip, 128 to 1024 packets on: the distance is the first four bytes of the ID seed's HMAC under a counter past any connection ID's sequence number, modulo 897, so a client that saw where the last gaps fell learns nothing of the next, and the scratch it is read from is zeroed. `beforeDatagram` skips the number when it comes up: it is never sealed nor recorded in loss recovery, it goes into a ring of the last `QUIC_CONN_SKIP_RING` (8) skipped, and the next is drawn from the number after it. `receiveAck` refuses with PROTOCOL_VIOLATION an Application Data ACK whose stored ranges, every one of them and not only the first, take in any number in the ring: the client acknowledged a packet it never received. The ring reaches back at least 903 packets (seven gaps of at least 129), seven times the Application Data record of 128 in flight, so a number is forgotten only long after an honest ACK could name it. *What a client can still do*: acknowledge a packet in flight that was sent, which no sender can tell from a real ACK; the skips make each such lie a gamble that ends the connection once a gap falls inside the range it claims, and the bounds this row named before still cap what it gains. The Initial and Handshake spaces skip nothing: their packets are few and the anti-amplification limit bounds them. Tests: Pinned in `link/${name}: exits with ${wantCode} and stdout matches expected.out` for `net_quic_lifecycle` and `net_quic_lifecycle_f64`: "once the 1-RTT keys are in, a packet number is due to be skipped 128 to 1024 packets on (RFC 9000 §21.4)", "the number due is never sent: the next packet carries the one after", "and the next skip is drawn 128 to 1024 packets on again", "and its distance is not the last one's: each is drawn afresh", "an ACK of the packets sent around it is read", "an ACK that takes in the skipped number is PROTOCOL_VIOLATION, an optimistic ACK", "an ACK of two ranges, neither taking in the skipped number, is read", "an ACK that takes in the skipped number in its second range is PROTOCOL_VIOLATION too", "two numbers skipped on one connection are both remembered, and an ACK of the packets around them is read", "an ACK that takes in the older skipped number and not the newer is PROTOCOL_VIOLATION", "reset forgets the skipped numbers and zeroes the counts, and the limits are AES-GCM's again" and "on the reused slot the next connection sends the number the last one skipped, and an ACK of it is read"; the scratch the draw is read from is a wipe root, `nish.QuicConnection.scheduleSkip`, in `tests/wipes/quic.js`'s "quic: the wipes survive opt -O2 (a key slot's keys and AES schedules, each packet's nonce and mask, a key update's replaced generation, a discarded level and its handshake secrets, the reset tokens, connection IDs and entropy once used, and every key at release, reset, the idle timeout and the end of the closing or draining period)" check. |
| QUIC-8 | Low | `std/net/quic.ts` (`probe`, `resendEarly`, `recordSent`) | **A lost handshake flight was sent again once a probe timeout, and only then.** The interop runner's `handshakeloss` case against quic-go's client (30% loss each way, 50 connections) failed about one run in three. The server's first flight, ServerHello through Finished, is one 1,200-byte datagram; when it was lost, the probe timeout sent it again as one datagram, and with no RTT sample that timeout is about a second and doubles, so the copies left at t, t+1, t+3 and t+7 s. Meanwhile the client's ClientHello had been acknowledged, so its probes were PINGs, which drew ACKs and nothing more. At 30% loss all four copies are lost about once in 120 connections (0.3⁴), and quic-go's handshake timer expired first. The run's simulator captures showed exactly that: the flight left at 21.025 s and was probed at 22.020, 24.015 and 28.003 s, and none of the four reached the client. Nothing here is unsafe; a client on a lossy path simply could not connect. | **Closed** (#463's handshake-probe stage). **Two probes** (RFC 9002 §6.2.4, which allows two full-size datagrams a probe timeout and asks for unacknowledged data in them): in the Initial and Handshake spaces a probe timeout now sends two ack-eliciting datagrams, each carrying the oldest CRYPTO data not acknowledged (`QUIC_CONN_HANDSHAKE_PROBES`), so a lost flight's copies are lost together only 0.3⁸ of the time over the same four timeouts. **Early resend** (§6.2.3, "for a limited number of times per connection"): a client Initial carrying CRYPTO data the server already read, or an ack-eliciting Handshake packet, while the server's own packets at that level are in flight, sends the oldest one's CRYPTO data again at once, one datagram, at most `QUIC_CONN_EARLY_RESENDS` (2) times a connection and never while a probe is still owed. A counter bounds it, not a scan, and a PING-only Initial asks for nothing, since §6.2.3 names repeated CRYPTO data. **Accepted:** an actor who saw the client's first Initial can derive its Initial keys and forge two Initials repeating its CRYPTO data, which spends `QUIC_CONN_EARLY_RESENDS` early; the connection then falls back to the two-datagram probes at the probe timeout, and every datagram either way stays within the anti-amplification limit. **The anti-amplification limit** (RFC 9000 §8.1) holds both: a one-datagram flight and its two probes fill the 3,600 bytes a 1,200-byte ClientHello allows exactly, and a probe the limit forbids waits, owed, until the client sends more. Pinned by `tests/link/net_quic_recovery`'s `handshake.ts` (and its `_f64` twin): the flight and the first probe lost, the second completes the handshake at the first probe timeout, which fails on the code before; both probe datagrams elicit an ACK and carry CRYPTO data; two repeated ClientHellos bring two immediate copies and a third only an ACK; a PING, a repeat once the flight is acknowledged and a Handshake packet acknowledging everything bring none; and the limit lets one of two probes go and the other once the client sends more. |
| QUIC-9 | Low | `std/net/quic-recovery.ts` (`micros`, `fineNow`, `fineSample`, `updatePacerRtt`, `pacerRefill`, `pacerDelay`, `pacerQuantum`) | **The pacer counted whole milliseconds.** With a round trip under a millisecond, `smoothedRtt` truncated to 0, the pacer took 1 ms for it, earned nothing until the millisecond changed and answered a wait of at least 1 ms, so a response's second flight waited for the next millisecond (H3-8 in [http3.md](http3.md), and [h3-latency.md](../h3-latency.md)). *What changed.* A caller with a finer clock sets `micros`; the pacer's budget, its time and its own smoothed RTT, `pacerRtt`, count microseconds, and each packet's send time is kept on that clock too (`QuicSentPackets.fineSent`). `pacerRtt` follows §5.3's UpdateRtt on the same samples as `smoothedRtt`: the first sample is taken whole, a later one less the peer's ACK delay when that leaves it at or above min_rtt, the delay bounded by max_ack_delay once the handshake is confirmed, and an Initial ACK's delay ignored. `smoothedRtt`, `rttvar`, `minRtt`, the loss delay and the probe timeout are unchanged and still count milliseconds, at least kGranularity, so §6.1.2's and §6.2.1's floors hold whatever the pacer measures; max_ack_delay enters the probe timeout only for Application Data once the handshake is confirmed, as before. The burst stays at most the initial window. *What a peer can do with it*: raise the pacing rate by acknowledging quickly, up to what the congestion window allows in flight (H3-8 weighs it). *Bounds.* A `micros` outside the millisecond `now` names is not read, so a stale or missing one paces on `now × 1000` exactly as before; the refill counts at most 60 s and a window of at most 4 GiB, which keeps `elapsed × window × 5` inside an `i64`; the wait is rounded up to whole milliseconds for the caller's timers, at least 1. *The flight quantum.* `pacerQuantum` answers what the pacer earns in a millisecond, `window × 5 × 1000 / (pacerRtt × 4)`, clamped to the caller's bounds. The listener waits for that much credit before it starts a flight (H3-8). The window it reads is at most 4 GiB, so the product stays inside an `i64`. Before an RTT sample it is 45 bytes, so the lower bound, one datagram, holds. | **Closed.** Pinned in `link/${name}: exits with ${wantCode} and stdout matches expected.out` for `net_quic_recovery` and `net_quic_recovery_f64`: "the pacer's RTT is the 200 µs the clock measured", "20 µs later, inside the same millisecond, it may go", "the pacer still holds the datagram past a burst of the initial window (§7.7)", "an idle of milliseconds refills only the initial window, though the window is 13200", "so the loss delay still floors at kGranularity, 1 ms (§6.1.2)", "and the probe timeout at kGranularity plus max_ack_delay: 5 + 1 + 25", "before confirmation a sub-millisecond Handshake probe timeout is kGranularity alone, no max_ack_delay", "an ACK delay past max_ack_delay counts only max_ack_delay once confirmed (§5.3)", "a micros outside the millisecond now names is not read", "with no micros a round trip inside one millisecond counts as kGranularity, as it always did", "before an RTT sample a flight starts on one datagram: 12000 × 5/4 per 333 ms is 45 bytes a millisecond", "at a 5 ms RTT on a millisecond's earning: 12000 × 5/4 / 5" and "and under a millisecond on at most four datagrams"; the millisecond pacer's checks run unchanged, "and restarts the pacer's clock there, in microseconds" reading its 50 ms as 50,000 µs. Anchors are function names. |
| QUIC-10 | Low | `std/net/quic-recovery.ts` (`ecnCodepoint`, `onEctSent`, `onAckEcn`, `processEcn`, `packetsLost`), `std/net/quic.ts` (`ecnMarking`, `datagramEcn`, `takeDatagramInto`, `sealAt`, `recordSent`, `receiveAck`) | **ECN counts were parsed and ignored** (#474). `quic-frame.ts` read ACK_ECN's ECT(0), ECT(1) and ECN-CE counts, and recovery threw them away, so a peer on a path whose routers mark congestion with CE instead of dropping saw the window never shrink for it (RFC 9002 §7.1), and nothing checked that a path or peer that claims ECN handles it (RFC 9000 §13.4.2). *What changed.* Recovery keeps, per packet-number space, how many packets went out ECT(0) and which recorded ones did, and the counts last validated. `onAckEcn` validates an ACK's counts before it uses them, after the RTT sample and before loss detection as A.7 orders it: an ACK that newly acknowledges a marked packet without counts, a count that falls, a count (or the sum of ECT(1) and CE, or of all three) past the packets marked, or ECT(0) and CE together rising by less than the marked packets newly acknowledged fails validation; so does every recorded packet of the testing period being lost (RFC 9000 A.4). A failed path is marked no more for the connection's life and its counts are not read again. Counts on an ACK that does not raise the largest acknowledged are neither validated nor used, as §13.4.2.1 allows: they may be older than those read. An ACK that raises it to a packet recovery never recorded (one that elicits no ACK) acknowledges nothing recorded, and its counts are still read, or a peer could report a CE rise there and have it skipped for good; its event is timed from the next recorded packet's send, or the ACK's arrival. A rise in ECN-CE that validates is a congestion event from the send time of the largest packet newly acknowledged (B.7), so it halves the window once per recovery period, as a loss does. Only the first 10 packets are marked until one validates (`QUIC_RECOVERY_ECN_TESTING_PACKETS`). *What a peer can do with it*: report CE to halve the window, at most once a round trip, which a peer can always do by not acknowledging; report counts that fail validation, which turns ECN off for its own connection and nothing else. Each count is a varint, so the bounds are checked by subtraction and no sum overflows an `i64`. *What is left to the carrier.* The connection marks only when its carrier says it sends the ECN bits it is given: `ecnMarking`, false by default, and `datagramEcn`, the codepoint of the datagram `takeDatagramInto` just wrote. `http3-server.ts` and `quic-listener.ts` still send with ECN 0 and leave `ecnMarking` false, so nothing is marked today, and a peer's counts, being past the zero packets marked, fail validation and are ignored; wiring the carriers to `datagramEcn` is a follow-up outside this stage. The server writes no ECN counts in its own ACKs (the receive side, §13.4.1). | **Partial**: recovery validates ECN counts and reacts to CE (#474's ECN part), but no carrier marks ECT yet, so in production every ACK_ECN's counts fail validation and a CE rise is never used; wiring `http3-server.ts` and `quic-listener.ts` to `ecnMarking` and `datagramEcn` closes it. Pinned by `tests/link/net_quic_recovery` (and its `_f64` twin), `unit.ts`'s `rcEcnChecks`: a CE rise halves the window, a second within the recovery period does not and one for a packet sent after it does; counts on an ACK that raises nothing are not read, and a CE rise on one that raises the largest to an unrecorded packet is; ECT(1) beside enough ECT(0) validates; a plain ACK of a marked packet, counts past the packets marked, a short increase, ECT(1) for ECT(0) packets, a falling CE count and the whole testing period lost each fail validation; ten packets acknowledged as ECT(0) validate an unknown path; and `conn.ts`'s `rcEcn`: a connection that does not mark sends Not-ECT and fails a peer's CE count, one that marks validates, halves its window on a CE rise, and stops marking after a plain ACK of a marked packet. Anchors are function names. |

## Fuzzing

Fuzzed by `tests/fuzz/targets/quic-header.ts`, `tests/fuzz/targets/quic-frame.ts`.

| Target | What it drives | Executions |
| --- | --- | ---: |
| `quic-header` | `quicParseHeaderInto` and `quicParseHeader` over coalesced packets, every window checked against the packet, and packet-number decoding checked against RFC 9000 A.3 for the truncated number and length the prefix chooses | 231,221,793 |
| `quic-frame` | `quicParseFrame` in a loop over one payload, with its windows and ACK ranges checked, and `quicFrameAllowed` and `quicFrameAckEliciting` on every frame | 366,275,647 |

Each target ran for 31 minutes (1,861 s, one core each, four at a time) on commit `b52b765`, starting from its seed corpus in `tests/fuzz/corpus/<target>/`, with libFuzzer's `-timeout=1 -rss_limit_mb=2048`; every panic, sanitizer report, timeout and OOM counts as a finding. **None found**: no crash, timeout or OOM (a target's own contract check fails by panicking, so it counts too). The libFuzzer harness these targets build against lands with the harness stage of #888; a new finding adds a row to Findings above, with its input kept as a regression and a link check that replays it.

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
- **The keys are wiped as their level is discarded, by `release()`, and at
  the end of the closing or draining period**, AES schedules included, with
  stores no optimiser removes (QUIC-2; `data.ts` checks the bytes are zero,
  and `net_quic_wipes` every end of life).
- **A real client agrees.** aioquic 1.3.0 completed a handshake and a stream
  echo against the server, and the replay sends its recorded datagrams from a
  Nish UDP client and requires every answer byte for byte
  (`net_quic_conn_replay`).

### Q3: loss recovery

Each property is pinned by a check in `tests/link/net_quic_recovery`, which
also runs under `--number-mode f64` (`net_quic_recovery_f64`); the aioquic
replays of Q2 (`net_quic_conn_replay`, `net_quic_lifecycle_replay` and their
`_f64` twins) are unchanged, byte for byte, with recovery in.

- **The arithmetic is RFC 9002's.** Appendix A's RTT estimate (the first
  sample, the ACK delay taken off only above `min_rtt`, capped at
  `max_ack_delay` once the handshake is confirmed, ignored for Initial
  packets), loss by packet threshold (3, counted from the largest
  acknowledged) and by time threshold (9/8 of the larger RTT, at least 1 ms),
  the probe timeout with `max_ack_delay` for Application Data only and only
  once confirmed, and Appendix B's NewReno (slow start, one halving per
  recovery period, congestion avoidance, the 2400-byte floor, persistent
  congestion over three probe timeouts with nothing acknowledged between)
  are each worked by hand in the test, figure by figure.
- **Nothing a client acknowledges loops, overflows or grows a buffer.** An
  ACK's ranges are read only up to its count and the array; an ACK of a
  number never sent is still PROTOCOL_VIOLATION; an ACK Delay too large to
  scale, or an exponent past 20, is held at a bound before any arithmetic;
  the backoff stops doubling at 16, so no deadline overflows; and a client
  that acknowledges nothing gets a probe per probe timeout, each twice as
  far apart, until the idle timeout ends the connection after a handful.
  One Application Data packet number in every 128 to 1024 is skipped, and an
  ACK that names one is PROTOCOL_VIOLATION, an optimistic ACK (QUIC-7,
  `net_quic_lifecycle`).
- **What is lost is sent again, and only what may be.** A lost handshake
  flight is sent again from the CRYPTO bytes the level kept and completes
  the handshake; lost stream bytes go again at their offsets, with the FIN;
  HANDSHAKE_DONE, NEW_CONNECTION_ID and RETIRE_CONNECTION_ID go again once
  each, but not a NEW_CONNECTION_ID for an ID the client has retired, not a
  PATH_RESPONSE (RFC 9000 §13.3), and not a stream's data after the client's
  STOP_SENDING.
- **A lost handshake flight goes twice a probe timeout, and early when the
  client shows it lacks it** (QUIC-8). A probe timeout sends two
  ack-eliciting datagrams in the Initial and Handshake spaces, each with the
  oldest CRYPTO data not acknowledged (RFC 9002 §6.2.4); a repeated
  ClientHello or an ack-eliciting Handshake packet brings the flight again
  at once, at most twice a connection (§6.2.3); and the anti-amplification
  limit holds every one of them, a probe it forbids waiting until the
  client sends more.
- **The window and the record hold sending back, never acknowledging.**
  With the window full an ACK still goes, and with the Application Data
  record full new data waits while a probe still gets out, by giving up the
  oldest record.
- **The pacer** lets a burst of at most the initial window go, then one
  datagram as its credit allows, and time handed in backwards earns it
  nothing. Given a clock in microseconds it counts them, and lets a
  datagram go inside the millisecond its credit is earned, while loss
  detection and the probe timeout keep their 1 ms floor (QUIC-9).
- **ECN counts are validated before they are used** (QUIC-10). An ACK_ECN's
  counts pass RFC 9000 §13.4.2.1's checks against the packets marked, or ECN
  is off for the connection and its counts are read no more; a rise in
  ECN-CE then halves the window once per recovery period, as a loss does
  (RFC 9002 §7.1, B.7). Nothing is marked unless the carrier says it sends
  the codepoint (`ecnMarking`), and no carrier does yet: until one does,
  this holds in the tests only, and a deployed server ignores ECN.

### Q4: streams, datagrams and the slot

Each property is pinned by a check in `tests/link/net_quic_stream` or
`tests/link/net_quic_datagram`, each of which also runs under
`--number-mode f64` (`*_f64`); the aioquic replays of Q2
(`net_quic_conn_replay`, `net_quic_lifecycle_replay` and their `_f64`
twins) are unchanged, byte for byte, with all of it in.

- **No stream frame breaks the state machines** (`refusals.ts`). STREAM,
  RESET_STREAM and STREAM_DATA_BLOCKED on the server's unidirectional
  stream, MAX_STREAM_DATA and STOP_SENDING on the client's, and any frame
  for a server stream not yet opened are STREAM_STATE_ERROR; a client stream
  past the limit advertised is STREAM_LIMIT_ERROR; data past a stream's
  credit or the connection's, and a RESET_STREAM's final size past it, are
  FLOW_CONTROL_ERROR; data past a FIN, a second FIN at another size, a FIN
  or RESET_STREAM below what arrived, and a RESET_STREAM at another size
  than the FIN are FINAL_SIZE_ERROR. A frame for a stream that finished and
  left its slot is ignored, never reopened.
- **Every buffer a peer fills is fixed.** A stream's credit is never more
  than its buffer can hold past what the application read, so its buffer
  cannot overflow; the connection's is a window raised only as the
  application reads; MAX_STREAMS is raised only as the client's streams
  finish, so the slots, which are its limits, are never short; datagrams the
  receive ring cannot hold are dropped and counted; owed frames are flags,
  not queues.
- **No frame costs work that grows with the table per stream it opens**
  (`transfer.ts`). A frame naming a high stream ID opens every lower one of
  its type (§3.2), so one 10-byte STREAM frame for the client's 1,024th
  stream opens 1,024 at once, and `release` lets it do so again each time
  half the limit finishes. A stream is found through a hash index and its
  slot taken from a stack of free slots, so that frame costs 1,024 pops.
  Scanning the table for each slot, as the code first did, cost about
  525,000 slot comparisons (1,024 · 1,025 / 2). The check opens all 1,024
  with one frame, gives every slot back and opens the next 1,024 in them,
  each in a slot of its own.
- **Flow control works both ways** (`flow.ts`): a stream takes exactly its
  credit, MAX_STREAM_DATA and MAX_DATA follow reading half a buffer and half
  the window; the client's credit holds the server's data back, with
  STREAM_DATA_BLOCKED and DATA_BLOCKED once per limit, and MAX_STREAM_DATA
  and MAX_DATA let the rest go; a write larger than the send buffer is taken
  in part and the stream named again when acknowledgements free room.
- **A stream ends as §3 says** (`refusals.ts`): RESET_STREAM from the client
  reaches the application with its code; STOP_SENDING is answered with
  RESET_STREAM carrying its code and what was sent (§3.5), sent until
  acknowledged; the server's own RESET_STREAM and STOP_SENDING go out, and a
  stream finished both ways frees its slot.
- **DATAGRAM frames keep RFC 9221's rules** (`datagram.ts`): one exactly at
  the server's `max_datagram_frame_size` is taken and one byte over is
  PROTOCOL_VIOLATION, with and without a Length, as is any when none was
  offered; the server sends one exactly at the client's limit, or at what
  fits a 1200-byte packet, and refuses one byte over; one waits for the
  congestion window and counts as bytes in flight; a lost one is never sent
  again.
- **GSO and GRO** (`gso.ts`): the listener's flight is paced as a whole,
  written back to back and sent in one `udpSendTo` with `UDP_SEGMENT`, read
  back through a `UDP_GRO` socket over loopback byte for byte, and a GRO
  receive is handed to a connection segment by segment in place.
- **Nothing is kept per packet, and the slot does not grow** (`arena.ts`,
  `datagram.ts`): see QUIC-3 for the figures.
- **A stream's buffers are lent, kept until acknowledged and zeroed on the
  way back** (`tests/link/net_quic_stream`, `pool.ts`; `net_http3_server`,
  `loopback.ts`; `net_quic_memory`): a send buffer stays lent while any byte
  up to the final size is unacknowledged, and the bytes declared lost go
  again from it unchanged; a buffer taken again after a give-back reads as
  zeroes; a reset gives both sides back; after warm-up the shared pools make
  no more buffers, every buffer is back once every connection has ended, and
  1,024 idle slots have made none.
- **A resend range acknowledged before it went again does not stall the
  stream** (`resend.ts`): `putNextChunk` clears it and sends the stream's new
  bytes in the same packet, where it used to answer none and leave a flight
  empty (H3-7 in [http3.md](http3.md), fixed here at its source).
- **A handshake keeps its state in the slot** (`tests/link/net_quic_memory`,
  and `_f64`): connection after connection through one reset slot, under
  each of the three suites, keeps 0 bytes, with every server datagram the
  first connection's
  byte for byte; each in-place derivation and parameter codec equals its
  allocating form and refuses what it does; and `reset` zeroes every key
  slot, AES schedule and secret the last connection left. See QUIC-3.

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
  (QUIC-2), and an update leaves nothing in the arena, its generations
  taking turns in the slot's key slots (QUIC-4). aioquic updates first and follows the server's update after.
- **The AEAD limits hold** (RFC 9001 §6.6, QUIC-6). From three quarters of
  AES-GCM's confidentiality limit the server starts an update itself; at the
  limit with none made it closes with AEAD_LIMIT_REACHED and seals nothing
  more under the key. Past the integrity limit of packets that fail to
  authenticate over the connection it closes with AEAD_LIMIT_REACHED too
  (`net_quic_lifecycle`, with the limits lowered).
