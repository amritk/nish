// The QUIC server's long-lived keys' wipes after `opt -O2` (`index.js` says
// what a group is and how a root's count is read). The counts are as LLVM 18's
// `opt -O2` leaves them, and each wipe this group pins was deleted in turn to
// show its roots' counts drop.

/**
 * The modules that define the listener, the HTTP/3 server, the connection it
 * releases, its packet protection, AES, HMAC, or HKDF: `HkdfScratch.wipe`,
 * which `QuicListener.release` calls, is in `nish/crypto/hkdf`.
 */
const QUIC_SERVER_MODULES = /^define [^\n]*@"?nish\.(Quic|quic|Aes|aes|Hmac|hmac|Hkdf|hkdf|Http3|http3)/m

export const wipeChecks = [
  // `nish/net/quic-listener`'s `release` and `nish/net/http3-server`'s `stop`
  // (#430). `net_quic_server_wipes` imports both. The HMAC scratch's `wipe` 6:
  // each of its two hashers' state, block and schedule. `HkdfScratch.wipe` 13:
  // the previous block, 1, and both HMACs' `wipe`, 12. A key slot's `wipe` 13,
  // as `quic.js` counts it. `QuicListenerAnswer.wipe` 3: the reply and the two
  // IDs, each across its room. `QuicListener.release` 47: the seed, the
  // generator's pool, the tag and the two Initial secrets with `secureZero`, 5,
  // the scratch's `wipe`, 13, both key slots', 26, and the spare answer's, 3.
  // `QuicConnection.release` 94, `quic.js`'s `wipeAll`; `Http3Server.release`
  // frees one slot through it, 94. `Http3Server.stop` 242: the loop over the
  // slots calls `Http3Server.release` for a slot in use and
  // `QuicConnection.release` for a free one, 94 each (a loop's one call site
  // counted once), the listener's `release`, 47, the stateless reset key, the
  // Retry token key, the index's salt and the entropy scratch with
  // `secureZero`, 4, and the server's answer's `wipe`, 3.
  {
    name: "quic-server: the wipes survive opt -O2 (the listener's seed, generator, scratch, INVALID_TOKEN keys and last answer at release, and the stateless reset and Retry token keys, the index's salt, the server's last answer and every connection at stop)",
    program: "tests/link/net_quic_server_wipes/main.ts",
    modules: QUIC_SERVER_MODULES,
    roots: [
      ["nish.HmacSha256Scratch.wipe", 6],
      ["nish.HmacSha384Scratch.wipe", 6],
      ["nish.HkdfScratch.wipe", 13],
      ["nish.QuicKeysSlot.wipe", 13],
      ["nish.QuicListenerAnswer.wipe", 3],
      ["nish.QuicListener.release", 47],
      ["nish.QuicConnection.release", 94],
      ["nish.Http3Server.release", 94],
      ["nish.Http3Server.stop", 242],
    ],
  },
]
