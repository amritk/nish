// Every key a TLS connection holds, read back as zero at each way the
// connection ends (#430, TLS-1 and TLS-2 in docs/security/tls.md). A real
// handshake under each of the three suites, driven by the record-layer
// tests' client, fills both directions of a `TlsRecordServer` and the secrets
// `TlsServer` keeps; then each end is taken in turn and every array is read:
//
//   1. `fail`, on a record whose tag does not verify: the fatal alert is
//      sealed under the write keys first (the client opens it), and then both
//      directions' keys, IVs and AES schedules (every round-key word, the
//      kernels' powers of H included, and H), both application traffic
//      secrets and everything `TlsServer` holds, the resumption master secret
//      among them, read zero.
//   2. A stream cut off without `close_notify`, and `abort`: the same.
//   3. `close`: the resumption master secret reads zero at once, and the
//      write direction once its `close_notify` is sealed — after it, when the
//      alert had to wait for room — while the read direction still opens what
//      the client sends; the carrier's slot close (`wipeKeys`, as
//      `TlsTcpServer.close` calls it) wipes the rest.
//   4. The same close over loopback through `TlsTcpServer`: its `close`
//      leaves every key of the slot zero.
//   5. `restart` and `start`, the slot handed its next connection: every
//      secret array of both hashes reads zero.
//   6. The x25519 exchange's words (`TlsExchangeWords`), which carry the
//      ephemeral key in and the handshake secret out, read zero after a
//      handshake and after an exchange refused for a low-order share.
//
// `tests/wipes/tls.js` compiles this program to count the same wipes after
// `opt -O2`, which is what shows they are volatile stores that survive it.
import { Suite } from "nish/testing";
import { netAddress, netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollWait, tcpConnect, tcpListen } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { TLS_STATE_CONNECTED, TlsServer, tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_ALERT_ILLEGAL_PARAMETER, TLS_GROUP_X25519, TLS_LEGACY_VERSION, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256, tlsSuiteHashLength } from "nish/net/tls/schedule";
import {
  TLS_ALERT_BAD_RECORD_MAC,
  TLS_CONTENT_ALERT,
  TLS_CONTENT_APPLICATION_DATA,
  TLS_CONTENT_HANDSHAKE,
  TlsRecordProtection,
} from "nish/net/tls/record";
import { TLS_RECORD_STATE_CLOSED, TLS_RECORD_STATE_FAILED, TLS_RECORD_STATE_HANDSHAKE, TLS_RECORD_STATE_OPEN, TLS_RECORD_SIGN, TlsRecordServer } from "nish/net/tls/record-server";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { leafPrivate, serverPrivate, serverRandom, tcpConfig } from "../net_tls_common/server";
import { clientHelloRaw, extKeyShare, extSignatureAlgorithms, extSupportedGroups, extSupportedVersions } from "../net_tls_common/client";
import { Opened, ZERO, ascii, drain, feed, filled, join, openOne, protectionFor, range, readAll, sealOne } from "../net_tls_record_common/bytes";
import { ClientKeys, clearRecord, clientKeysFor, recordHello, splitRecords } from "../net_tls_record_common/client";
import { sameBytes } from "../crypto_x509/hex";

/** `TlsServer`'s pool index of the CertificateVerify input: public, so no end wipes it but `restart`. */
const TO_BE_SIGNED: i32 = 7;
/** Its pool index of the resumption master secret. */
const RESUMPTION: i32 = 8;

/** How many of `bytes` are not zero. */
const bytesHeld = (bytes: u8[]): i32 => {
  let count: i32 = 0;
  for (const b of bytes) {
    if (toI32(b) !== 0) {
      count = count + 1;
    }
  }
  return count;
};

/** How many of `words` are not zero. */
const wordsHeld = (words: u64[]): i32 => {
  let count: i32 = 0;
  for (const w of words) {
    if (w !== toU64(0)) {
      count = count + 1;
    }
  }
  return count;
};

/** What one direction holds that is not zero: both key arrays, the IV, both AES schedules (round keys and H) and its next-secret scratch. */
const protectionHeld = (p: TlsRecordProtection): i32 =>
  bytesHeld(p.key16) +
  bytesHeld(p.key32) +
  bytesHeld(p.iv) +
  wordsHeld(p.aes128.roundKeys) +
  wordsHeld(p.aes128.h) +
  wordsHeld(p.aes256.roundKeys) +
  wordsHeld(p.aes256.h) +
  bytesHeld(p.next);

/** The read direction and the client's application traffic secret, as the slot keeps it. */
const readHeld = (conn: TlsRecordServer): i32 =>
  protectionHeld(conn.readProtection) + bytesHeld(conn.readSecret256) + bytesHeld(conn.readSecret384);

/** The write direction and the server's application traffic secret. */
const writeHeld = (conn: TlsRecordServer): i32 =>
  protectionHeld(conn.writeProtection) + bytesHeld(conn.writeSecret256) + bytesHeld(conn.writeSecret384);

/** The resumption master secret, in its array of either hash. */
const resumptionHeld = (tls: TlsServer): i32 => bytesHeld(tls.secrets256[RESUMPTION]) + bytesHeld(tls.secrets384[RESUMPTION]);

/** The x25519 exchange's words: the ephemeral key's, the client's share, the server's public key and the handshake secret's. */
const exchangeHeld = (tls: TlsServer): i32 => {
  const words: u64[] = [
    tls.exchange.key0,
    tls.exchange.key1,
    tls.exchange.key2,
    tls.exchange.key3,
    tls.exchange.share0,
    tls.exchange.share1,
    tls.exchange.share2,
    tls.exchange.share3,
    tls.exchange.public0,
    tls.exchange.public1,
    tls.exchange.public2,
    tls.exchange.public3,
    tls.exchange.secret0,
    tls.exchange.secret1,
    tls.exchange.secret2,
    tls.exchange.secret3,
    tls.exchange.secret4,
    tls.exchange.secret5,
  ];
  return wordsHeld(words) + (tls.exchange.hashLength !== 0 ? 1 : 0);
};

/**
 * Every secret `TlsServer` holds: the caller's ephemeral key, each secret
 * array of both hashes but the CertificateVerify input, and the exchange's
 * words.
 */
const serverHeld = (tls: TlsServer): i32 => {
  let count: i32 = bytesHeld(tls.ephemeralPrivate) + exchangeHeld(tls);
  for (let k: i32 = 0; k < toI32(tls.secrets256.length) && k < toI32(tls.secrets384.length); k++) {
    if (k !== TO_BE_SIGNED) {
      count = count + bytesHeld(tls.secrets256[k]) + bytesHeld(tls.secrets384[k]);
    }
  }
  return count;
};

/** Every key the slot and its `TlsServer` hold. */
const allHeld = (conn: TlsRecordServer): i32 => readHeld(conn) + writeHeld(conn) + serverHeld(conn.tls);

/** A connection through its handshake, and the client's side of it. */
class Live {
  conn: TlsRecordServer;
  tls: TlsServer;
  keys: ClientKeys;
  /** The client's reader of the server's application records, and its writer of its own. */
  reader: TlsRecordProtection;
  writer: TlsRecordProtection;
  suite: i32 = 0;
  /** Both sides reached the end of the handshake. */
  connected: boolean = false;

  constructor(tls: TlsServer, suite: i32) {
    this.tls = tls;
    this.conn = new TlsRecordServer(tls);
    this.suite = suite;
    this.keys = new ClientKeys();
    this.reader = new TlsRecordProtection();
    this.writer = new TlsRecordProtection();
  }
}

/** A ClientHello offering `suite`, as the record-layer tests' client sends it. */
const helloFor = (suite: i32): u8[] => recordHello([suite], false, false);

/**
 * A handshake under `suite` through a fresh slot, with the record-layer
 * tests' client on the other side: the ServerHello and flight drained, the
 * flight opened, the client's Finished fed, and the client's application
 * keys installed on both of its protections.
 */
const connect = (suite: i32): Live => {
  const live = new Live(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()), suite);
  const conn: TlsRecordServer = live.conn;
  const hello: u8[] = helloFor(suite);
  feed(conn, clearRecord(hello));
  const input: u8[] | null = conn.signatureInput();
  if (input === null) {
    return live;
  }
  const leaf: Secret<u8[]> = secret(leafPrivate());
  const signature: u8[] | null = tlsSignEcdsaP256(leaf, input);
  wipe(leaf);
  if (signature === null) {
    return live;
  }
  conn.sign(signature);
  const records: u8[][] = splitRecords(drain(conn));
  if (toI32(records.length) !== 2) {
    return live;
  }
  const header: i32 = 5;
  const serverHello: u8[] = range(records[0], header, toI32(records[0].length));
  const keys: ClientKeys = clientKeysFor(tlsSuiteHashLength(suite), hello, serverHello);
  const flight: Opened = openOne(protectionFor(suite, keys.serverHandshake), records[1]);
  keys.finishWith(flight.content);
  feed(conn, sealOne(protectionFor(suite, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO));
  live.keys = keys;
  live.reader = protectionFor(suite, keys.serverApplication);
  live.writer = protectionFor(suite, keys.clientApplication);
  live.connected = conn.state === TLS_RECORD_STATE_OPEN && live.tls.state === TLS_STATE_CONNECTED;
  return live;
};

/** `type` and then `content` in hex, for one record opened, or the alert that refused it. */
const shown = (opened: Opened): string => {
  if (opened.alert !== 0) {
    return `alert ${opened.alert}`;
  }
  const parts: string[] = [`${opened.type}`];
  for (const b of opened.content) {
    parts.push(`${toI32(b)}`);
  }
  return parts.join(" ");
};

/** The last of the records in `stream`, each opened in order under `reader`. */
const lastOpened = (reader: TlsRecordProtection, stream: u8[]): Opened => {
  let last: Opened = new Opened();
  for (const one of splitRecords(stream)) {
    last = openOne(reader, one);
  }
  return last;
};

/** Whether `live` holds keys in both directions, the resumption master secret and the exporter secret, as an open connection does. */
const holdsEverything = (live: Live): boolean =>
  live.connected &&
  readHeld(live.conn) > 0 &&
  writeHeld(live.conn) > 0 &&
  resumptionHeld(live.tls) > 0 &&
  bytesHeld(live.tls.exporterSecret) > 0;

/** The checks of `fail`, truncation and `abort` under `suite`, named after `name`. */
const failures = (t: Suite, name: string, suite: i32): void => {
  const zero: i32 = 0;
  // 1. A record whose tag does not verify: bad_record_mac.
  const failed: Live = connect(suite);
  t.ok(`${name}: the open connection holds both directions' keys, the resumption and exporter secrets`, holdsEverything(failed));
  const forged: u8[] = sealOne(failed.writer, TLS_CONTENT_APPLICATION_DATA, ascii("forged"), ZERO);
  const last: i32 = toI32(forged.length) - 1;
  forged[last] = toU8(toI32(forged[last]) ^ 1);
  feed(failed.conn, forged);
  t.ok(`${name}: a record whose tag does not verify fails the connection`, failed.conn.state === TLS_RECORD_STATE_FAILED);
  t.eqStr(
    `${name}: the fatal bad_record_mac is sealed under the write keys before they go`,
    shown(lastOpened(failed.reader, drain(failed.conn))),
    `${TLS_CONTENT_ALERT} 2 ${TLS_ALERT_BAD_RECORD_MAC}`
  );
  t.eqI32(`${name}: after fail the read direction and the client's traffic secret read zero`, readHeld(failed.conn), zero);
  t.eqI32(`${name}: and the write direction and the server's`, writeHeld(failed.conn), zero);
  t.eqI32(`${name}: and every secret TlsServer holds, the resumption master secret included`, serverHeld(failed.tls), zero);

  // 2. The client's stream cut off without close_notify, and the socket failing.
  const cut: Live = connect(suite);
  const held: boolean = holdsEverything(cut);
  cut.conn.end();
  t.ok(`${name}: a stream cut off without close_notify fails the connection`, held && cut.conn.state === TLS_RECORD_STATE_FAILED);
  t.eqI32(`${name}: and every key the slot and its TlsServer hold reads zero`, allHeld(cut.conn), zero);
  const aborted: Live = connect(suite);
  const heldToo: boolean = holdsEverything(aborted);
  aborted.conn.abort();
  t.ok(`${name}: abort fails the connection`, heldToo && aborted.conn.state === TLS_RECORD_STATE_FAILED);
  t.eqI32(`${name}: and every key reads zero after it too`, allHeld(aborted.conn), zero);
};

/** The checks of `close`, then the slot's close, under `suite`, named after `name`. */
const closes = (t: Suite, name: string, suite: i32): void => {
  const zero: i32 = 0;
  const live: Live = connect(suite);
  const conn: TlsRecordServer = live.conn;
  t.ok(`${name}: before close the connection holds everything`, holdsEverything(live));
  conn.close();
  t.eqI32(`${name}: close wipes the resumption master secret at once`, resumptionHeld(live.tls), zero);
  t.eqStr(`${name}: the close_notify is sealed under the write keys`, shown(lastOpened(live.reader, drain(conn))), `${TLS_CONTENT_ALERT} 1 0`);
  t.eqI32(`${name}: and then the write direction and the server's traffic secret read zero`, writeHeld(conn), zero);
  t.ok(`${name}: while the read direction still holds its keys`, readHeld(conn) > 0);
  feed(conn, sealOne(live.writer, TLS_CONTENT_APPLICATION_DATA, ascii("after"), ZERO));
  t.ok(`${name}: and still opens what the client sends after the server's close_notify`, sameBytes(readAll(conn), ascii("after")));
  const closeNotify: u8[] = [toU8(1), toU8(0)];
  feed(conn, sealOne(live.writer, TLS_CONTENT_ALERT, closeNotify, ZERO));
  t.ok(`${name}: the client's close_notify ends its side`, conn.peerClosed && conn.state === TLS_RECORD_STATE_CLOSED);
  conn.wipeKeys();
  t.eqI32(`${name}: and the carrier's slot close wipes every key that was left`, allHeld(conn), zero);
};

/** A close whose `close_notify` waits for room in the output: the write keys stay until it is sealed. */
const closeWhenFull = (t: Suite): void => {
  const zero: i32 = 0;
  const live: Live = connect(TLS_AES_128_GCM_SHA256);
  const conn: TlsRecordServer = live.conn;
  const chunk: u8[] = filled(toI32(4096), toI32(7));
  let written: i32 = 0;
  let n: i32 = conn.write(chunk, ZERO, toI32(chunk.length));
  while (n > 0) {
    written = written + n;
    n = conn.write(chunk, ZERO, toI32(chunk.length));
  }
  conn.close();
  t.ok("a close with the output full leaves its close_notify owed", live.connected && written > 0 && conn.closeDue);
  t.ok("and the write keys held until it is sealed", writeHeld(conn) > 0);
  t.eqI32("but the resumption master secret wiped already", resumptionHeld(live.tls), zero);
  const first: u8[] = drain(conn);
  const second: u8[] = drain(conn);
  t.eqStr(
    "once there is room the close_notify follows the data, under the same keys",
    shown(lastOpened(live.reader, join([first, second]))),
    `${TLS_CONTENT_ALERT} 1 0`
  );
  t.ok("and then the write direction reads zero", !conn.closeDue && writeHeld(conn) === 0);
};

/** A socket would block. */
const WOULD_BLOCK: i32 = -11;

/** Writes all of `bytes` on `fd`, waiting on `loop` while it would block; false when it will not take them. */
const sendAll = (loop: i32, ready: i32[], fd: i32, bytes: u8[]): boolean => {
  let sent: i32 = 0;
  let tries: i32 = 0;
  while (sent < toI32(bytes.length) && tries < 200) {
    const n: i32 = netWrite(fd, bytes, sent, toI32(bytes.length) - sent);
    if (n > 0) {
      sent = sent + n;
    } else if (n !== WOULD_BLOCK) {
      return false;
    }
    tries = tries + 1;
  }
  return sent === toI32(bytes.length);
};

/** Reads `fd` onto `got` until it holds `records` whole records, waiting on `loop` while nothing is there. */
const takeRecords = (loop: i32, ready: i32[], fd: i32, got: u8[], records: i32): void => {
  const buf: u8[] = new Array<u8>(4096);
  let polls: i32 = 0;
  while (toI32(splitRecords(got).length) < records && polls < 200) {
    const n: i32 = netRead(fd, buf, ZERO, toI32(buf.length));
    if (n === 0) {
      return;
    }
    if (n > 0) {
      for (let k: i32 = 0; k < n && k < toI32(buf.length); k++) {
        got.push(buf[k]);
      }
    } else {
      pollWait(loop, ready, toI32(50));
      polls = polls + 1;
    }
  }
};

/**
 * One AES-256-GCM connection over loopback through a one-slot
 * `TlsTcpServer`, the client's side worked out as `connect` works it out,
 * through its handshake and then closed by the carrier: `close` leaves every
 * key of the slot and its `TlsServer` zero.
 */
const slotClose = (t: Suite): void => {
  const zero: i32 = 0;
  const one: i32 = 1;
  const suite: i32 = TLS_AES_256_GCM_SHA384;
  const loop: i32 = pollCreate();
  const listener: i32 = tcpListen("127.0.0.1", zero, toI32(4));
  const server = new TlsTcpServer(tcpConfig([]), listener, one);
  const address: u8[] = new Array<u8>(18);
  netAddress(address, "127.0.0.1", netLocalPort(listener));
  const ready: i32[] = new Array<i32>(8);
  pollAdd(loop, listener, one, one);
  const client: i32 = tcpConnect(address);
  pollAdd(loop, client, one, toI32(2));
  let slot: i32 = -1;
  let polls: i32 = 0;
  while (slot < 0 && polls < 200) {
    slot = server.accept(serverRandom(), serverPrivate());
    if (slot < 0) {
      pollWait(loop, ready, toI32(50));
      polls = polls + 1;
    }
  }
  if (!t.ok("TlsTcpServer accepts a loopback connection", slot >= 0 && client >= 0) || slot < 0) {
    return;
  }
  pollAdd(loop, server.fd(slot), one, toI32(3));
  const hello: u8[] = helloFor(suite);
  sendAll(loop, ready, client, clearRecord(hello));
  let wants: i32 = server.readable(slot);
  polls = 0;
  while ((wants & TLS_RECORD_SIGN) === 0 && polls < 200) {
    pollWait(loop, ready, toI32(50));
    wants = server.readable(slot);
    polls = polls + 1;
  }
  const leaf: Secret<u8[]> = secret(leafPrivate());
  server.signP256(slot, leaf);
  wipe(leaf);
  const flight: u8[] = [];
  takeRecords(loop, ready, client, flight, toI32(2));
  const records: u8[][] = splitRecords(flight);
  const conn: TlsRecordServer = server.connection(slot);
  if (toI32(records.length) === 2) {
    const header: i32 = 5;
    const keys: ClientKeys = clientKeysFor(tlsSuiteHashLength(suite), hello, range(records[0], header, toI32(records[0].length)));
    keys.finishWith(openOne(protectionFor(suite, keys.serverHandshake), records[1]).content);
    sendAll(loop, ready, client, sealOne(protectionFor(suite, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO));
    polls = 0;
    while (conn.state !== TLS_RECORD_STATE_OPEN && polls < 200) {
      pollWait(loop, ready, toI32(50));
      server.readable(slot);
      polls = polls + 1;
    }
  }
  t.ok(
    "the slot holds both directions' keys and the resumption master secret once its handshake is done",
    conn.state === TLS_RECORD_STATE_OPEN && readHeld(conn) > 0 && writeHeld(conn) > 0 && resumptionHeld(conn.tls) > 0
  );
  server.close(slot);
  t.ok("TlsTcpServer.close frees the slot", server.busy() === 0);
  t.eqI32("and leaves every key of the slot and its TlsServer zero", allHeld(conn), zero);
  netClose(client);
  netClose(listener);
  netClose(loop);
};

/** `restart` and `start`, the slot handed its next connection, under `suite`. */
const restarts = (t: Suite, name: string, suite: i32): void => {
  const zero: i32 = 0;
  const live: Live = connect(suite);
  const held: boolean = holdsEverything(live);
  live.tls.restart(serverRandom(), serverPrivate());
  live.conn.start(live.tls);
  let pools: i32 = 0;
  for (let k: i32 = 0; k < toI32(live.tls.secrets256.length) && k < toI32(live.tls.secrets384.length); k++) {
    pools = pools + bytesHeld(live.tls.secrets256[k]) + bytesHeld(live.tls.secrets384[k]);
  }
  t.ok(`${name}: restart and start, for the slot's next connection`, held && live.conn.state === TLS_RECORD_STATE_HANDSHAKE);
  t.eqI32(`${name}: every secret array of both hashes reads zero, the CertificateVerify input's too`, pools, zero);
  t.eqI32(`${name}: and both directions read zero`, readHeld(live.conn) + writeHeld(live.conn), zero);
};

/** Runs every check and answers the exit code; `net_tls_wipes_f64` runs them under `--number-mode f64`. */
export const tlsWipeChecks = (): i32 => {
  const t = new Suite("tls wipes");
  const zero: i32 = 0;
  failures(t, "AES-128-GCM", TLS_AES_128_GCM_SHA256);
  failures(t, "AES-256-GCM", TLS_AES_256_GCM_SHA384);
  failures(t, "ChaCha20-Poly1305", TLS_CHACHA20_POLY1305_SHA256);
  closes(t, "AES-128-GCM", TLS_AES_128_GCM_SHA256);
  closes(t, "AES-256-GCM", TLS_AES_256_GCM_SHA384);
  closes(t, "ChaCha20-Poly1305", TLS_CHACHA20_POLY1305_SHA256);
  closeWhenFull(t);
  slotClose(t);
  restarts(t, "AES-128-GCM", TLS_AES_128_GCM_SHA256);
  restarts(t, "AES-256-GCM", TLS_AES_256_GCM_SHA384);

  // 6. The exchange's words, after a handshake and after a refused exchange.
  const done: Live = connect(TLS_AES_256_GCM_SHA384);
  t.ok("after a handshake the exchange's words read zero, the handshake secret's and the ephemeral key's", done.connected && exchangeHeld(done.tls) === 0);
  const none: u8[] = [];
  const lowOrder: u8[] = clientHelloRaw(TLS_LEGACY_VERSION, none, [TLS_AES_128_GCM_SHA256], [toU8(0)], [
    extSupportedVersions([TLS_VERSION_13]),
    extSupportedGroups([TLS_GROUP_X25519]),
    extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
    extKeyShare([TLS_GROUP_X25519], [filled(toI32(32), zero)]),
  ]);
  const refused = new TlsRecordServer(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()));
  feed(refused, clearRecord(lowOrder));
  t.eqI32("an all-zero x25519 share is refused with illegal_parameter", refused.alert, TLS_ALERT_ILLEGAL_PARAMETER);
  t.eqI32("and the exchange's words read zero after the refusal too", exchangeHeld(refused.tls), zero);
  t.eqI32("with every other key the refused connection held", allHeld(refused), zero);
  return t.done();
};
