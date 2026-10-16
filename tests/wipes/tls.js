// The TLS holders' wipes after `opt -O2` (`index.js` says what a group is and
// how a root's count is read). The counts are as LLVM 18's `opt -O2` leaves
// them, and each wipe this group pins was deleted in turn to show its root's
// count move (#430).

/** The modules that define the TLS server, its record layer and carrier, and the AEADs they seal with. */
const TLS_MODULES = /^define [^\n]*@nish\.(Tls|tls|Aes|aes|ghash|chacha20|poly1305)/m

/** The ticket module, the ChaCha20-Poly1305 it seals with, and the test program's exports, `ticketRotationTurns` among them. */
const TICKET_MODULES = /^define [^\n]*@(nish\.(tlsTicket|TlsTicket|chacha20|poly1305)|ticket)/m

/** The schedule's module and the HMAC and HKDF it derives with. */
const SCHEDULE_MODULES = /^define [^\n]*@nish\.(tls|Tls|hmac|Hmac|hkdf|Hkdf)/m

export const wipeChecks = [
  // `nish/net/tls`, `nish/net/tls/record`, `nish/net/tls/record-server` and
  // `nish/net/tls-tcp` wipe every key a connection holds when it ends.
  // `net_tls_wipes` imports all four and reads each array back as zero.
  //
  // A direction's `clear` 7: its two keys and IV (`secureZero`, 3) and both
  // AES schedules (`aesKeyWipe`, 2 each); with ordinary stores in place of
  // `aesKeyWipe` it is 3. `wipeWrite` 9 (the server's two secret arrays and
  // `clear`), `wipeRead` 9 (the client's), `wipeTraffic` 18 (both),
  // `wipeHandshake` 9 (`TlsServer`'s eight arrays and `wipeResumption`'s 1),
  // so `wipeKeys` 27. `fail` 41: the alert sealed first (`sendAlert`'s seal,
  // 14) and then `wipeKeys`, once, after the branch on whether the alert is
  // sent, so that `opt` has no two wipes to merge; a truncated stream and
  // `abort` 27 each, `wipeKeys`; `handleAlert` 36, `wipeRead` on the
  // client's `close_notify` and `wipeKeys` on its error alert.
  // `sealClose` 23: the `close_notify`'s seal and then `wipeWrite`; `close`
  // 24, `wipeResumption` and `sealClose`.
  // `TlsServer`: `exchangeKeys` 5 (the exchange's copy of the ephemeral key,
  // the ECDHE secret on each of its two paths, the handshake secret's bytes,
  // and the words, wiped whole once after the branch on the alert; with the
  // words zeroed by ordinary stores it is 4), `fail` and `wipeResumption` 1,
  // and `restart` 2 (each pool's arrays, in one loop). The carrier's `close`
  // 404 (the record server's `close`, the flush after it and `wipeKeys`).
  //
  // The handshake's own wipes, each a root of its own: a record's `open` 16
  // (its nonce, 1, and the AEADs' own wipes), `TlsServer.sign` 5 (the master
  // secret, 1, and the transcript's), `handleFinished` 1 (the handshake
  // secret), the record server's `start` 59 (the last connection's traffic
  // keys, `wipeTraffic`'s 18, and the handshake it begins) and `advance` 397
  // (the ephemeral key, the handshake and client handshake secrets and the
  // client's application secret, 1 each, besides the `fail` it can reach).
  // Deleting any one of these wipes lowers its root's count by its own share.
  //
  // `fail` calls `sendAlert`, whose seal can call `fail` again, so a root's
  // count depends on which root of this cycle is counted first: the roots are
  // counted in the order below, and each count was read in that order.
  {
    name: "tls: the wipes survive opt -O2 (both directions' keys, IVs and AES schedules; the traffic, handshake, exporter and resumption secrets; the exchange's words)",
    program: "tests/link/net_tls_wipes/main.ts",
    modules: TLS_MODULES,
    roots: [
      ["nish.TlsRecordProtection.clear", 7],
      ["nish.TlsRecordServer.wipeWrite", 9],
      ["nish.TlsRecordServer.wipeRead", 9],
      ["nish.TlsRecordServer.wipeTraffic", 18],
      ["nish.TlsRecordServer.wipeHandshake", 9],
      ["nish.TlsRecordServer.wipeKeys", 27],
      ["nish.TlsRecordServer.fail", 41],
      ["nish.TlsRecordServer.checkTruncation", 27],
      ["nish.TlsRecordServer.abort", 27],
      ["nish.TlsRecordServer.handleAlert", 36],
      ["nish.TlsRecordServer.sealClose", 23],
      ["nish.TlsRecordServer.close", 24],
      ["nish.TlsServer.exchangeKeys", 5],
      ["nish.TlsServer.fail", 1],
      ["nish.TlsServer.wipeResumption", 1],
      ["nish.TlsServer.restart", 2],
      ["nish.TlsTcpServer.close", 404],
      ["nish.TlsRecordProtection.open", 16],
      ["nish.TlsServer.sign", 5],
      ["nish.TlsServer.handleFinished", 1],
      ["nish.TlsRecordServer.start", 59],
      ["nish.TlsRecordServer.advance", 397],
    ],
  },
  // `nish/net/tls/schedule`'s one-shot derivations take and answer `Secret`s
  // and wipe what they derive on the way (#430's secret-boundary stage).
  // `net_tls_rfc8448` calls each of them on the RFC 8448 trace. Each root's
  // own share stays in its optimised body: `tlsEarlySecret` 2 (the zero salt
  // and input), `tlsHandshakeSecret` 1 (the "derived" salt),
  // `tlsMasterSecret` 2 (the "derived" salt and the zero input) and
  // `tlsFinishedVerifyData` 1 (`finished_key`); the rest of each count is the
  // HMAC and HKDF wipes under it (`crypto.js`), both hash lengths' calls.
  {
    name: "tls: the one-shot derivations' wipes survive opt -O2 (the early secret's zero salt and input, the derived salts, the master secret's zero input, finished_key)",
    program: "tests/link/net_tls_rfc8448/main.ts",
    modules: SCHEDULE_MODULES,
    roots: [
      ["nish.tlsEarlySecret", 28],
      ["nish.tlsHandshakeSecret", 57],
      ["nish.tlsMasterSecret", 58],
      ["nish.tlsFinishedVerifyData", 57],
    ],
  },
  // `nish/net/tls/ticket` seals and opens session tickets under a borrowed
  // `Secret` key; `net_tls_ticket` calls both and rotates the keys.
  // `tlsTicketSeal` 8: the plaintext, built after the key id and nonce in the
  // one array `exposeWith` hands its function, wiped with `secureZero` once
  // after the seal and its refusals (1), and the exposed function's 7 — the
  // `wipe` of the plaintext copy it hands the AEAD (1, a `wipe` since
  // `secureZero` is C, which that function may not reach) and
  // `chacha20Poly1305Seal`'s own 6. `tlsTicketOpen` 9: the opened plaintext,
  // wiped once after the branch on the tag and the parse (1), the state's PSK
  // array on a failed parse (1), and `chacha20Poly1305Open`'s own 7. Deleting
  // any one of these four wipes lowers its root's count by 1.
  //
  // `ticketRotationTurns` is the test program's rotation turn, an export of
  // `checks.ts` and so named without the `nish.` prefix: 55, its own 3 `wipe`s
  // (the previous key on each turn, and both keys at the end) besides the 2
  // seals (8 each) and 4 opens (9 each) it calls. It is pinned at its total.
  {
    name: "tls: the wipes survive opt -O2 (a session ticket's plaintext on seal and open, the PSK of a failed open, the rotation turn's keys)",
    program: "tests/link/net_tls_ticket/main.ts",
    modules: TICKET_MODULES,
    roots: [
      ["nish.tlsTicketSeal", 8],
      ["nish.tlsTicketOpen", 9],
      ["ticketRotationTurns", 55],
    ],
  },
]
