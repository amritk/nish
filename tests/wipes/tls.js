// The TLS holders' wipes after `opt -O2` (`index.js` says what a group is and
// how a root's count is read). The counts are as LLVM 18's `opt -O2` leaves
// them, and each wipe this group pins was deleted in turn to show its root's
// count move (#430).

/** The modules that define the TLS server, its record layer and carrier, and the AEADs they seal with. */
const TLS_MODULES = /^define [^\n]*@nish\.(Tls|tls|Aes|aes|ghash|chacha20|poly1305)/m

export const wipeChecks = [
  // `nish/net/tls`, `nish/net/tls/record`, `nish/net/tls/record-server` and
  // `nish/net/tls-tcp` wipe every key a connection holds when it ends.
  // `net_tls_wipes` imports all four and reads each array back as zero.
  //
  // A direction's `clear` 7: its two keys and IV (`secureZero`, 3) and both
  // AES schedules (`aesKeyWipe`, 2 each); with ordinary stores in place of
  // `aesKeyWipe` it is 3. `wipeWrite` 9 (the server's two secret arrays and
  // `clear`), `wipeTraffic` 18 (the client's two, `clear` and `wipeWrite`),
  // `wipeHandshake` 9 (`TlsServer`'s eight arrays and `wipeResumption`'s 1),
  // so `wipeKeys` 27. `fail` 41: the alert sealed first (`sendAlert`'s seal,
  // 14) and then `wipeKeys`, once, after the branch on whether the alert is
  // sent, so that `opt` has no two wipes to merge; a truncated stream and
  // `abort` 27 each, `wipeKeys`. `sealClose` 23: the `close_notify`'s seal and
  // then `wipeWrite`; `close` 24, `wipeResumption` and `sealClose`.
  // `TlsServer`: `exchangeKeys` 5 (the exchange's copy of the ephemeral key,
  // the ECDHE secret on each of its two paths, the handshake secret's bytes,
  // and the words, wiped whole once after the branch on the alert; with the
  // words zeroed by ordinary stores it is 4), `fail` and `wipeResumption` 1,
  // and `restart` 2 (each pool's arrays, in one loop). The carrier's `close`
  // 404 (the record server's `close`, the flush after it and `wipeKeys`).
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
      ["nish.TlsRecordServer.wipeTraffic", 18],
      ["nish.TlsRecordServer.wipeHandshake", 9],
      ["nish.TlsRecordServer.wipeKeys", 27],
      ["nish.TlsRecordServer.fail", 41],
      ["nish.TlsRecordServer.checkTruncation", 27],
      ["nish.TlsRecordServer.abort", 27],
      ["nish.TlsRecordServer.sealClose", 23],
      ["nish.TlsRecordServer.close", 24],
      ["nish.TlsServer.exchangeKeys", 5],
      ["nish.TlsServer.fail", 1],
      ["nish.TlsServer.wipeResumption", 1],
      ["nish.TlsServer.restart", 2],
      ["nish.TlsTcpServer.close", 404],
    ],
  },
]
