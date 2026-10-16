// The QUIC connection's wipes after `opt -O2` (`index.js` says what a group is
// and how a root's count is read). The counts are as LLVM 18's `opt -O2` leaves
// them, and each wipe this group pins was deleted in turn to show its roots'
// counts drop.

/**
 * The modules that define the QUIC connection, its packet protection, AES, or
 * HMAC: `HmacSha256Scratch.wipe`, which the connection ID and reset-token
 * derivations call, is in `nish/crypto/hmac`.
 */
const QUIC_MODULES = /^define [^\n]*@"?nish\.(Quic|quic|Aes|aes|Hmac|hmac)/m

export const wipeChecks = [
  // `nish/net/quic-packet`'s key slots and packet protection, and
  // `nish/net/quic`'s connection (#430). `net_quic_wipes` imports both. A
  // slot's `wipe` 13: its five byte arrays with `secureZero` and its four AES
  // schedules with `aesKeyWipe`, 2 each. Sealing a packet wipes its nonce and
  // its header-protection mask once each is used; `opt` copies each wipe into
  // the two arms of the AEAD's branch, so `quicSealInPlace` reaches 4 of its
  // own, besides `aesGcmSeal`'s 7 and `aesHeaderMask`'s 2, 13; opening, the
  // mask's 1 and `aesHeaderMask`'s 2 in `quicUnprotectHeader`, 3, and the
  // nonce's 2 and `aesGcmOpen`'s 8 in `quicDecryptPayload`, 10. (ChaCha20's
  // functions are in a module this group does not run through `opt`.) A key
  // update: `updateWriteKeys` 12 (the replaced key, IV and secret, the next
  // secret on the failure path, the replaced packet key's schedule 2, and
  // the next generation's `aesKeyInto`, 6), `prepareNextReadKeys` 10 (the
  // previous read generation's key and IV, its schedule 2, and `aesKeyInto`
  // 6). Discarding a level, `discard` 23: the read and write keys' key, IV
  // and header-protection key, 6, their packet schedules, 4, and one slot's
  // `wipe` in the loop over the space's slots, 13. `wipeAll` 95: three
  // `discard`s, the previous generation's packet schedule 2, and 24 wipes of
  // its own (a loop's one call site counted once), `TlsServer`'s resumption
  // secret among them; `release` is `wipeAll`. `runClocks` 200: `wipeAll` at the idle timeout and again at
  // the end of the closing or draining period, each copy counted, and
  // `prepareNextReadKeys` once a key update's previous keys have had their
  // probe timeout. `afterTls` 134: once the handshake is confirmed, the
  // Handshake level's `discard`, 23, and `TlsServer`'s two handshake traffic
  // secrets, 2, besides the wipes of the derivations it runs as each level's
  // keys arrive, the connection IDs' and reset tokens' HMACs among them.
  //
  // The roots below pin the wipes the ones above do not reach.
  // `applyPhase` 13: the read secret a key update replaces, 1, and
  // `updateWriteKeys`, 12. The stateless reset token: `quicStatelessResetToken`
  // 14, its HMAC output among them, and `quicConnResetTokenInto` 25, the
  // scratch HMAC's `wipe` and the tag; `deriveConnectionId` 25, the same for
  // a connection ID. `begin` 2: the entropy once it is copied, and the
  // failure path's. `establish` 28: the first ID's reset token once it is in
  // the transport parameters, besides its derivation. `openPacket` 266: the
  // Initial level's `discard` on the first Handshake packet, besides the
  // derivations and wipes of every level it opens. `quicInitialSecretsInto`
  // 1: the Initial secret once both directions' are expanded. `reset` 101:
  // `wipeAll`, 95, and `begin`'s wipes of the next connection's entropy.
  {
    name: "quic: the wipes survive opt -O2 (a key slot's keys and AES schedules, each packet's nonce and mask, a key update's replaced generation, a discarded level and its handshake secrets, the reset tokens, connection IDs and entropy once used, and every key at release, reset, the idle timeout and the end of the closing or draining period)",
    program: "tests/link/net_quic_wipes/main.ts",
    modules: QUIC_MODULES,
    roots: [
      ["nish.QuicKeysSlot.wipe", 13],
      ["nish.quicSealInPlace", 13],
      ["nish.quicUnprotectHeader", 3],
      ["nish.quicDecryptPayload", 10],
      ["nish.QuicConnection.updateWriteKeys", 12],
      ["nish.QuicConnection.prepareNextReadKeys", 10],
      ["nish.QuicConnection.discard", 23],
      ["nish.QuicConnection.wipeAll", 95],
      ["nish.QuicConnection.release", 95],
      ["nish.QuicConnection.runClocks", 200],
      ["nish.QuicConnection.afterTls", 134],
      ["nish.QuicConnection.applyPhase", 13],
      ["nish.quicStatelessResetToken", 14],
      ["nish.quicConnResetTokenInto", 25],
      ["nish.QuicConnection.deriveConnectionId", 25],
      ["nish.QuicConnection.begin", 2],
      ["nish.QuicConnection.establish", 28],
      ["nish.QuicConnection.openPacket", 266],
      ["nish.quicInitialSecretsInto", 1],
      ["nish.QuicConnection.reset", 101],
    ],
  },
]
