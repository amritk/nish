// The resumption table of docs/security/tls.md ("Resumption"), row by row,
// through a `TlsRecordServer`: each row's fallback or refusal, and beside it
// the nearest offer that resumes. Then the wipes a resumed handshake and each
// way out of one leave, read back through `expose`; that QUIC never resumes;
// and a resumed handshake through a reused slot, which allocates nothing.
import { Suite } from "nish/testing";
import { Secret } from "nish:secret";
import { TlsServer, TlsSecretPool } from "nish/net/tls";
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_HANDSHAKE_FAILURE,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_MISSING_EXTENSION,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
} from "nish/net/tls/codec";
import { TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TLS_ALERT_BAD_RECORD_MAC, TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE } from "nish/net/tls/record";
import {
  TLS_RECORD_SIGN,
  TLS_RECORD_STATE_FAILED,
  TLS_RECORD_STATE_OPEN,
  TLS_RECORD_TICKET,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import { TlsTicketStrikes } from "nish/net/tls/ticket";
import { secretCopy } from "../net_tls_common/secrets";
import { quicConfig, serverPrivate, serverRandom, tcpConfig } from "../net_tls_common/server";
import { clearRecord } from "../net_tls_record_common/client";
import { ZERO, allZero, feed, filled, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import {
  H,
  HOUR,
  MINUTE,
  Offer,
  Ring,
  Run,
  START,
  SUITE,
  bindHello,
  buildHello,
  craftedPsk,
  offerOf,
  runOn,
  sealTicket,
  ticketState,
} from "./client";

/** A fresh connection with tickets on. */
const newConn = (): TlsRecordServer => {
  const conn = new TlsRecordServer(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()));
  conn.tls.enableTickets();
  return conn;
};

/** A ticket for `SUITE` under the crafted PSK, named `name`, its chain begun at `chainStart`, sealed under the ring's current key at `sealAt`. */
const crafted = (ring: Ring, name: string, chainStart: i64, sealAt: i64): u8[] =>
  sealTicket(ring.key, ring.info, ticketState(craftedPsk(), name, chainStart), sealAt);

/** A ticket sealed at START with no name, its chain begun then. */
const plain = (ring: Ring): u8[] => crafted(ring, "", START, START);

/** An offer of a crafted ticket. */
const offerCrafted = (ticket: u8[]): Offer => offerOf(ticket, craftedPsk());

/** One handshake on `conn` at `now`, to the client Finished, no ticket asked for. */
const runAt = (conn: TlsRecordServer, ring: Ring, offer: Offer, now: i64): Run => runOn(conn, ring, offer, now, true, false);

/** A full handshake that opened: signed, not resumed. */
const isFull = (run: Run): boolean => run.open && run.signed && !run.resumed && run.selected < 0;

/** A resumed handshake that opened: not signed, identity selected. */
const isResumed = (run: Run): boolean => run.open && run.resumed && !run.signed && run.selected >= 0;

/** Whether a secret reads back as zero. */
const zeroed = (s: Secret<u8[]>): boolean => allZero(secretCopy(s));

/** What a resumption leaves once it is decided: the PSK, the early secret, the binder key, the salt and the opened ticket's PSK all zero. */
const resumeWiped = (conn: TlsRecordServer): boolean => {
  const pool: TlsSecretPool = conn.tls.secrets();
  return zeroed(pool.psk) && zeroed(pool.early) && zeroed(pool.binderKey) && allZero(conn.tls.salt) && allZero(conn.tls.opened.psk);
};

/** What an opened or failed connection leaves: `resumeWiped`, and the handshake secret too. */
const handshakeWiped = (conn: TlsRecordServer): boolean => resumeWiped(conn) && zeroed(conn.tls.secrets().handshake);

/** Row 1, and what a resumed handshake leaves. */
const rowOne = (t: Suite): void => {
  const ring = new Ring(64);
  const firstConn: TlsRecordServer = newConn();
  const first: Run = runOn(firstConn, ring, new Offer(), START, true, true);
  t.ok("row 1: a full handshake opens", first.open);
  t.ok("row 1: a full handshake signs", first.signed);
  t.ok("row 1: a full handshake owes a ticket", first.ticketOwed);
  t.ok("row 1: the issued ticket reads back", first.ticket.ok);
  t.eqI64("row 1: a full handshake's ticket begins its chain now", firstConn.tls.issuing.chainStart, START);
  t.ok("row 1: the issued ticket's PSK and the resumption master secret are zero once issued", allZero(firstConn.tls.issuing.psk) && zeroed(firstConn.tls.secrets().resumption));
  const conn: TlsRecordServer = newConn();
  const again: Run = runOn(conn, ring, offerOf(first.ticket.ticket, first.ticket.psk), START, true, true);
  t.ok("row 1: the ticket is asked about", again.askedTicket);
  t.ok("row 1: the handshake resumes", again.resumed);
  t.ok("row 1: no signature", !again.signed);
  t.eqI32("row 1: identity 0 is selected", again.selected, ZERO);
  t.eqI32("row 1: the flight is EncryptedExtensions and Finished", again.session.messages, toI32(2));
  t.ok("row 1: the resumed connection opens", again.open);
  t.eqI32("row 1: one strike is live", ring.strikes.live(START), toI32(1));
  t.ok("row 1: a resumed connection is issued a ticket too", again.ticket.ok);
  t.ok("wipe: a resumed handshake leaves the PSK, early secret, binder key, salt and opened PSK zero", resumeWiped(conn));
  t.ok("wipe: and the handshake secret and resumption master secret", zeroed(conn.tls.secrets().handshake) && zeroed(conn.tls.secrets().resumption));

  const chained: TlsRecordServer = newConn();
  const chain: Run = runOn(chained, ring, offerCrafted(crafted(ring, "", START - HOUR, START)), START, true, true);
  t.ok("row 1: a crafted ticket resumes", isResumed(chain));
  t.eqI64("row 1: the ticket it is issued keeps the chain's start", chained.tls.issuing.chainStart, START - HOUR);

  const two: Offer = offerCrafted(plain(ring));
  const good: u8[] = two.tickets[0];
  two.tickets = [filled(40, 3), good];
  two.bindIndex = 1;
  const second: Run = runAt(newConn(), ring, two, START);
  t.ok("row 1: a garbage identity, then one that opens: resumes", isResumed(second));
  t.eqI32("row 1: and identity 1 is selected", second.selected, toI32(1));

  const old: u8[] = sealTicket(ring.previous, ring.previousInfo, ticketState(craftedPsk(), "", START), START);
  t.ok("row 1: a ticket sealed under the previous key resumes", isResumed(runAt(newConn(), ring, offerCrafted(old), START)));
  ring.wipe();
};

/** Rows 2 and 3: tickets that do not open, or open and do not hold. */
const rowsTwoThree = (t: Suite): void => {
  const ring = new Ring(64);
  const good: u8[] = plain(ring);
  const tampered: u8[] = range(good, ZERO, toI32(good.length));
  tampered[toI32(tampered.length) - 3] = toU8(toI32(tampered[toI32(tampered.length) - 3]) ^ 1);
  const conn: TlsRecordServer = newConn();
  t.ok("row 2: a tampered ticket: full handshake", isFull(runAt(conn, ring, offerCrafted(tampered), START)));
  t.ok("wipe: row 2 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(conn));
  t.ok("row 2: a truncated ticket: full handshake", isFull(runAt(newConn(), ring, offerCrafted(range(good, ZERO, toI32(good.length) - 1)), START)));
  const other = new Ring(4);
  const foreign: u8[] = crafted(other, "", START, START);
  other.wipe();
  t.ok("row 2: a ticket under an unknown key: full handshake", isFull(runAt(newConn(), ring, offerCrafted(foreign), START)));
  t.eqI32("row 2: nothing is recorded", ring.strikes.live(START), ZERO);
  t.ok("row 2 negative: the untouched ticket resumes", isResumed(runAt(newConn(), ring, offerCrafted(good), START)));

  const expiredConn: TlsRecordServer = newConn();
  t.ok("row 3: a ticket past its lifetime: full handshake", isFull(runAt(expiredConn, ring, offerCrafted(plain(ring)), START + 2 * HOUR + 1)));
  t.ok("wipe: row 3 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(expiredConn));
  t.ok("row 3 negative: at the last nanosecond of its lifetime it resumes", isResumed(runAt(newConn(), ring, offerCrafted(plain(ring)), START + 2 * HOUR)));
  t.ok("row 3: a ticket dated in the future: full handshake", isFull(runAt(newConn(), ring, offerCrafted(crafted(ring, "", START + HOUR, START + HOUR)), START + MINUTE)));
  const late: i64 = START + HOUR + 2 * MINUTE;
  t.ok("row 3: a chain begun over 24 hours ago: full handshake", isFull(runAt(newConn(), ring, offerCrafted(crafted(ring, "", START - 23 * HOUR, START + HOUR)), late)));
  t.ok("row 3 negative: a chain begun 23 hours ago resumes", isResumed(runAt(newConn(), ring, offerCrafted(crafted(ring, "", START - 22 * HOUR, START + HOUR)), late)));
  const long = ticketState(craftedPsk(), "", START);
  long.lifetime = 7201;
  t.ok("row 3: a lifetime over the server's: full handshake", isFull(runAt(newConn(), ring, offerCrafted(sealTicket(ring.key, ring.info, long, START)), START)));
  t.ok("row 3: a chain start after the issue time: full handshake", isFull(runAt(newConn(), ring, offerCrafted(crafted(ring, "", START + HOUR, START)), START)));
  ring.wipe();
};

/** Rows 4 to 8: identities passed over, and a full handshake in their place. */
const rowsFourToEight = (t: Suite): void => {
  const ring = new Ring(64);
  const wide = ticketState(filled(48, 9), "", START);
  wide.suite = TLS_AES_256_GCM_SHA384;
  const wideConn: TlsRecordServer = newConn();
  t.ok("row 4: a SHA-384 ticket on a SHA-256 suite: full handshake", isFull(runAt(wideConn, ring, offerCrafted(sealTicket(ring.key, ring.info, wide, START)), START)));
  t.ok("wipe: row 4 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(wideConn));
  const chacha = ticketState(craftedPsk(), "", START);
  chacha.suite = TLS_CHACHA20_POLY1305_SHA256;
  t.ok("row 4 negative: a ChaCha20 ticket, SHA-256 too, resumes on AES-128", isResumed(runAt(newConn(), ring, offerCrafted(sealTicket(ring.key, ring.info, chacha, START)), START)));

  const named: Offer = offerCrafted(crafted(ring, "a.example", START, START));
  named.name = "b.example";
  const namedConn: TlsRecordServer = newConn();
  t.ok("row 5: a ticket for another server name: full handshake", isFull(runAt(namedConn, ring, named, START)));
  t.ok("wipe: row 5 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(namedConn));
  t.ok("row 5: a named ticket offered with no name: full handshake", isFull(runAt(newConn(), ring, offerCrafted(crafted(ring, "a.example", START, START)), START)));
  const unnamed: Offer = offerCrafted(plain(ring));
  unnamed.name = "a.example";
  t.ok("row 5: an unnamed ticket offered with a name: full handshake", isFull(runAt(newConn(), ring, unnamed, START)));
  const same: Offer = offerCrafted(crafted(ring, "a.example", START, START));
  same.name = "a.example";
  t.ok("row 5 negative: the same name resumes", isResumed(runAt(newConn(), ring, same, START)));

  const once: u8[] = plain(ring);
  t.ok("row 6 negative: a ticket's first use resumes", isResumed(runAt(newConn(), ring, offerCrafted(once), START)));
  const replayConn: TlsRecordServer = newConn();
  const liveBefore: i32 = ring.strikes.live(START);
  t.ok("row 6: its second use: full handshake", isFull(runAt(replayConn, ring, offerCrafted(once), START)));
  t.ok("wipe: row 6 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(replayConn));
  t.eqI32("row 6: and the replay records no second strike", ring.strikes.live(START), liveBefore);

  const small = new Ring(1);
  t.ok("row 7 negative: a register with room resumes", isResumed(runAt(newConn(), small, offerCrafted(plain(small)), START)));
  const fullConn: TlsRecordServer = newConn();
  t.ok("row 7: a full register: full handshake", isFull(runAt(fullConn, small, offerCrafted(plain(small)), START)));
  t.ok("wipe: row 7 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(fullConn));
  t.eqI64("row 7: and it is counted", small.strikes.refusedFull, toI64(1));
  small.wipe();
  const roomy = new Ring(2);
  runAt(newConn(), roomy, offerCrafted(plain(roomy)), START);
  t.ok("row 7 negative: a second ticket in a register of two resumes", isResumed(runAt(newConn(), roomy, offerCrafted(plain(roomy)), START)));
  roomy.wipe();

  const keOnly: Offer = offerCrafted(plain(ring));
  keOnly.modes = [toU8(0)];
  const keConn: TlsRecordServer = newConn();
  const ke: Run = runAt(keConn, ring, keOnly, START);
  t.ok("row 8: psk_ke alone: full handshake", isFull(ke));
  t.ok("row 8: and no ticket is owed", !ke.ticketOwed);
  t.ok("wipe: row 8 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(keConn));
  t.ok("wipe: and the resumption master secret of a connection no ticket is wanted for", zeroed(keConn.tls.secrets().resumption));
  const both: Offer = offerCrafted(plain(ring));
  both.modes = [toU8(0), toU8(1)];
  t.ok("row 8 negative: psk_ke and psk_dhe_ke resumes", isResumed(runAt(newConn(), ring, both, START)));
  ring.wipe();
};

/** Rows 9 to 14: the refusals. */
const rowsNineToFourteen = (t: Suite): void => {
  const ring = new Ring(64);
  const unbound: Offer = offerOf(plain(ring), []);
  const unboundConn: TlsRecordServer = newConn();
  const zero: Run = runAt(unboundConn, ring, unbound, START);
  t.eqI32("row 9: a binder that does not verify: decrypt_error", zero.alert, TLS_ALERT_DECRYPT_ERROR);
  t.ok("row 9: and the connection fails", zero.state === TLS_RECORD_STATE_FAILED && zero.askedTicket);
  t.eqI32("row 9: nothing is recorded", ring.strikes.live(START), ZERO);
  t.ok("wipe: row 9 leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero", handshakeWiped(unboundConn));
  const wideBinder: Offer = offerCrafted(plain(ring));
  wideBinder.binderLengths = [48];
  t.eqI32("row 9: a binder of the wrong length: decrypt_error", runAt(newConn(), ring, wideBinder, START).alert, TLS_ALERT_DECRYPT_ERROR);
  const bare: Offer = offerOf(plain(ring), []);
  bare.sigalgs = false;
  t.eqI32("row 9: with no signature_algorithms too", runAt(newConn(), ring, bare, START).alert, TLS_ALERT_DECRYPT_ERROR);
  t.eqI32("row 9: and still nothing is recorded", ring.strikes.live(START), ZERO);

  const noModes: Offer = offerCrafted(plain(ring));
  noModes.hasModes = false;
  t.eqI32("row 10: pre_shared_key without psk_key_exchange_modes: missing_extension", runAt(newConn(), ring, noModes, START).alert, TLS_ALERT_MISSING_EXTENSION);
  const notLast: Offer = offerCrafted(plain(ring));
  notLast.pskLast = false;
  t.eqI32("row 11: pre_shared_key not last: illegal_parameter", runAt(newConn(), ring, notLast, START).alert, TLS_ALERT_ILLEGAL_PARAMETER);
  const more: Offer = offerCrafted(plain(ring));
  more.binderCountDelta = 1;
  t.eqI32("row 12: a binder more than identities: illegal_parameter", runAt(newConn(), ring, more, START).alert, TLS_ALERT_ILLEGAL_PARAMETER);
  const fewer: Offer = offerCrafted(plain(ring));
  fewer.tickets.push(filled(40, 3));
  fewer.binderCountDelta = -1;
  t.eqI32("row 12: a binder fewer: illegal_parameter", runAt(newConn(), ring, fewer, START).alert, TLS_ALERT_ILLEGAL_PARAMETER);

  const short: Offer = offerCrafted(plain(ring));
  short.binderLengths = [31];
  t.eqI32("row 13: a 31-byte binder: decode_error", runAt(newConn(), ring, short, START).alert, TLS_ALERT_DECODE_ERROR);
  const empty = new Offer();
  empty.pskAlways = true;
  t.eqI32("row 13: no identities: decode_error", runAt(newConn(), ring, empty, START).alert, TLS_ALERT_DECODE_ERROR);
  const blank: Offer = offerCrafted([]);
  t.eqI32("row 13: an empty identity: decode_error", runAt(newConn(), ring, blank, START).alert, TLS_ALERT_DECODE_ERROR);
  const noMode: Offer = offerCrafted(plain(ring));
  noMode.modes = [];
  t.eqI32("row 13: an empty mode list: decode_error", runAt(newConn(), ring, noMode, START).alert, TLS_ALERT_DECODE_ERROR);
  const noModeAlone = new Offer();
  noModeAlone.modes = [];
  t.eqI32("row 13: an empty mode list with no pre_shared_key: decode_error", runAt(newConn(), ring, noModeAlone, START).alert, TLS_ALERT_DECODE_ERROR);
  const keAlone = new Offer();
  keAlone.modes = [toU8(0)];
  t.ok("row 13 negative: psk_ke alone with no pre_shared_key: full handshake", isFull(runAt(newConn(), ring, keAlone, START)));

  const unsigned: Offer = offerCrafted(filled(40, 3));
  unsigned.sigalgs = false;
  t.eqI32("row 14: no signature_algorithms, a ticket that does not open: missing_extension", runAt(newConn(), ring, unsigned, START).alert, TLS_ALERT_MISSING_EXTENSION);
  const rsa: Offer = offerCrafted(filled(40, 3));
  rsa.schemes = [TLS_SIGNATURE_RSA_PSS_RSAE_SHA256];
  t.eqI32("row 14: not the server's scheme, a ticket that does not open: handshake_failure", runAt(newConn(), ring, rsa, START).alert, TLS_ALERT_HANDSHAKE_FAILURE);
  const resumable: Offer = offerCrafted(plain(ring));
  resumable.sigalgs = false;
  t.ok("row 14 negative: no signature_algorithms with a ticket that opens resumes", isResumed(runAt(newConn(), ring, resumable, START)));
  ring.wipe();
};

/** Rows 15 to 18: a retry, early data, a resumed connection that fails, and one ClientHello on two slots. */
const rowsFifteenToEighteen = (t: Suite): void => {
  const ring = new Ring(64);
  const retry: Offer = offerCrafted(plain(ring));
  retry.retry = true;
  t.ok("row 15: after a HelloRetryRequest, binders over both hellos and the retry resume", isResumed(runAt(newConn(), ring, retry, START)));
  const alone: Offer = offerCrafted(plain(ring));
  alone.retry = true;
  alone.bindAlone = true;
  t.eqI32("row 15 negative: a binder over the second hello alone: decrypt_error", runAt(newConn(), ring, alone, START).alert, TLS_ALERT_DECRYPT_ERROR);

  const early: Offer = offerCrafted(plain(ring));
  early.earlyData = true;
  const earlyConn: TlsRecordServer = newConn();
  const earlyRun: Run = runOn(earlyConn, ring, early, START, false, false);
  t.ok("row 16: early_data is ignored and the handshake resumes", earlyRun.resumed && earlyRun.session.serverFinished && earlyRun.selected === 0);
  feed(earlyConn, sealOne(protectionFor(SUITE, filled(H, 7)), TLS_CONTENT_APPLICATION_DATA, filled(16, 1), ZERO));
  t.eqI32("row 16: a 0-RTT record after it: bad_record_mac", earlyConn.alert, TLS_ALERT_BAD_RECORD_MAC);

  for (let way: i32 = 0; way < 4; way++) {
    const ticket: u8[] = plain(ring);
    const before: i32 = ring.strikes.live(START);
    const conn: TlsRecordServer = newConn();
    const run: Run = runOn(conn, ring, offerCrafted(ticket), START, false, false);
    let name: string = "";
    if (way === 0) {
      name = "a client Finished that fails";
      const bad: u8[] = range(run.session.finished, ZERO, toI32(run.session.finished.length));
      bad[toI32(bad.length) - 1] = toU8(toI32(bad[toI32(bad.length) - 1]) ^ 1);
      feed(conn, sealOne(protectionFor(4865, run.session.clientHandshake), TLS_CONTENT_HANDSHAKE, bad, ZERO));
      t.eqI32("row 17: a resumed connection's bad client Finished: decrypt_error", conn.alert, TLS_ALERT_DECRYPT_ERROR);
    } else if (way === 1) {
      name = "a stream cut";
      conn.end();
    } else if (way === 2) {
      name = "an abort";
      conn.abort();
    } else {
      name = "a slot closed";
      conn.close();
    }
    t.ok(`row 17: ${name} after resuming: the connection does not open`, run.resumed && conn.state !== TLS_RECORD_STATE_OPEN);
    t.eqI32(`row 17: ${name}: the id stays recorded`, ring.strikes.live(START), before + 1);
    t.ok(`wipe: row 17, ${name}, leaves the PSK, early secret, binder key, salt, opened PSK and handshake secret zero`, handshakeWiped(conn));
    t.ok(`row 17: ${name}: a later offer is a full handshake`, isFull(runAt(newConn(), ring, offerCrafted(ticket), START)));
  }

  const hello: u8[] = clearRecord(bindHello(buildHello(offerCrafted(plain(ring)), false), [], ZERO, craftedPsk()));
  const a: TlsRecordServer = newConn();
  const b: TlsRecordServer = newConn();
  feed(a, hello);
  feed(b, hello);
  t.ok("row 18: two slots both ask about the ticket", (a.interest() & TLS_RECORD_TICKET) !== 0 && (b.interest() & TLS_RECORD_TICKET) !== 0);
  a.resume(ring.key, ring.info, ring.previous, ring.previousInfo, ring.strikes, START);
  b.resume(ring.key, ring.info, ring.previous, ring.previousInfo, ring.strikes, START);
  t.ok("row 18: the first resumes", a.tls.resumed);
  t.ok("row 18: the second goes on to a full handshake", !b.tls.resumed && (b.interest() & TLS_RECORD_SIGN) !== 0);
  ring.wipe();
};

/** A low-order share on a resumed hello, and QUIC. */
const edges = (t: Suite): void => {
  const ring = new Ring(64);
  const low: Offer = offerCrafted(plain(ring));
  low.lowOrder = true;
  const lowConn: TlsRecordServer = newConn();
  const lowRun: Run = runAt(lowConn, ring, low, START);
  t.ok("a resumed hello with a low-order share fails", !lowRun.open && lowConn.state === TLS_RECORD_STATE_FAILED);
  t.ok("wipe: and leaves the salt, PSK, early secret, binder key and opened PSK zero", resumeWiped(lowConn));
  const quic = new TlsServer(quicConfig([], [toU8(1), toU8(0)]), serverRandom(), serverPrivate());
  quic.enableTickets();
  t.ok("QUIC: enableTickets leaves tickets off", !quic.tickets);
  ring.wipe();
};

/** A slot's key, refilled for each restart, which wipes the array it is handed. */
const refill = (into: u8[], from: u8[]): void => {
  for (let k: i32 = 0; k < toI32(into.length) && k < toI32(from.length); k++) {
    into[k] = from[k];
  }
};

/** How many resumptions the slot runs, and where it is measured from. */
const ROUNDS: i32 = 100;

/** A resumed handshake through one reused slot allocates nothing. */
const slot = (t: Suite): void => {
  const ring = new Ring(256);
  const hellos: u8[][] = [];
  const finishes: u8[][] = [];
  for (let round: i32 = 0; round < ROUNDS; round++) {
    const run: Run = runAt(newConn(), ring, offerCrafted(plain(ring)), START);
    hellos.push(run.helloRecord);
    finishes.push(run.finishedRecord);
  }
  ring.strikes = new TlsTicketStrikes(256);
  const random: u8[] = serverRandom();
  const key: u8[] = serverPrivate();
  const slotKey: u8[] = serverPrivate();
  const tls = new TlsServer(tcpConfig([]), random, slotKey);
  tls.enableTickets();
  const conn = new TlsRecordServer(tls);
  let resumed: i32 = 0;
  let mark: i64 = 0;
  for (let round: i32 = 0; round < ROUNDS; round++) {
    if (round === 1) {
      mark = Arena.mark();
    }
    refill(slotKey, key);
    tls.restart(random, slotKey);
    conn.start(tls);
    feed(conn, hellos[round]);
    conn.resume(ring.key, ring.info, ring.previous, ring.previousInfo, ring.strikes, START);
    conn.consume(conn.outputEnd - conn.outputStart);
    feed(conn, finishes[round]);
    if (tls.resumed && conn.state === TLS_RECORD_STATE_OPEN) {
      resumed = resumed + 1;
    }
    conn.close();
    conn.consume(conn.outputEnd - conn.outputStart);
  }
  const after: i64 = Arena.mark();
  t.eqI32("slot: a hundred resumptions through one restarted slot all open", resumed, ROUNDS);
  t.eqI64("slot: and after the first, Arena.mark() does not move", after - mark, toI64(0));
  ring.wipe();
};

export const resumeChecks = (): i32 => {
  const t = new Suite("tls resume");
  rowOne(t);
  rowsTwoThree(t);
  rowsFourToEight(t);
  rowsNineToFourteen(t);
  rowsFifteenToEighteen(t);
  edges(t);
  slot(t);
  return t.done();
};
