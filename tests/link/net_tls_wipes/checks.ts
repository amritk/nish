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
//      among them, read zero. The same after the client's own error alert.
//   2. A stream cut off without `close_notify`, and `abort`: the same.
//   3. `close`: the resumption master secret reads zero at once, and the
//      write direction once its `close_notify` is sealed — after it, when the
//      alert had to wait for room — while the read direction still opens what
//      the client sends, until the client's own `close_notify` wipes it; the
//      carrier's slot close (`wipeKeys`, as `TlsTcpServer.close` calls it)
//      wipes the rest.
//   4. The same close over loopback through `TlsTcpServer`: its `close`
//      leaves every key of the slot zero.
//   5. `restart` and `start`, the slot handed its next connection: every
//      secret array of both hashes reads zero.
//   6. The x25519 exchange's words (`TlsExchangeWords`), which carry the
//      ephemeral key in and the handshake secret out, read zero after a
//      handshake and after an exchange refused for a low-order share.
//   7. Midway: waiting for the signature, the ephemeral key already reads
//      zero; waiting for the client's Finished, the handshake secret and the
//      client's handshake secret do. An abort at the first point and a
//      Finished that does not verify at the second leave every key zero.
//   8. A client's KeyUpdate: both traffic secrets are the next generation,
//      written over the one they replace, and the next-secret scratch of both
//      directions reads zero; an abort after it leaves every key zero.
//
// Each "holds" precondition reads every array on its own, so a check that
// later reads zero is not passed by an array that was never filled.
//
// `tests/wipes/tls.js` compiles this program to count the same wipes after
// `opt -O2`, which is what shows they are volatile stores that survive it.
import { Suite } from "nish/testing";
import { netAddress, netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollWait, tcpConnect, tcpListen } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { TLS_STATE_CONNECTED, TLS_STATE_FAILED, TLS_STATE_WAIT_FINISHED, TLS_STATE_WAIT_SIGNATURE, TlsServer, tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_ALERT_DECRYPT_ERROR, TLS_ALERT_ILLEGAL_PARAMETER, TLS_GROUP_X25519, TLS_LEGACY_VERSION, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
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
import { Opened, ZERO, ascii, drain, feed, filled, join, keyUpdateMessage, openOne, protectionFor, range, readAll, sealOne } from "../net_tls_record_common/bytes";
import { ClientKeys, clearRecord, clientKeysFor, recordHello, splitRecords } from "../net_tls_record_common/client";
import { sameBytes } from "../crypto_x509/hex";
import { nextTrafficCopy } from "../net_tls_common/secrets";

/** `TlsServer`'s pool index of the handshake secret. */
const HANDSHAKE: i32 = 0;
/** Of the client's handshake traffic secret. */
const CLIENT_HANDSHAKE: i32 = 1;
/** Of the client's application traffic secret. */
const CLIENT_APPLICATION: i32 = 3;
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

/** What the secret array at pool index `k` holds, in either hash. */
const poolHeld = (tls: TlsServer, k: i32): i32 => bytesHeld(tls.secrets256[k]) + bytesHeld(tls.secrets384[k]);

/** What the secret arrays of both hashes hold, all but the one at `skip` (-1 for none). */
const poolsHeld = (tls: TlsServer, skip: i32): i32 => {
  let count: i32 = 0;
  for (let k: i32 = 0; k < toI32(tls.secrets256.length) && k < toI32(tls.secrets384.length); k++) {
    if (k !== skip) {
      count = count + bytesHeld(tls.secrets256[k]) + bytesHeld(tls.secrets384[k]);
    }
  }
  return count;
};

/**
 * Every secret `TlsServer` holds: the caller's ephemeral key, each secret
 * array of both hashes but the CertificateVerify input, and the exchange's
 * words.
 */
const serverHeld = (tls: TlsServer): i32 => bytesHeld(tls.ephemeralPrivate) + exchangeHeld(tls) + poolsHeld(tls, TO_BE_SIGNED);

/** Every key the slot and its `TlsServer` hold. */
const allHeld = (conn: TlsRecordServer): i32 => readHeld(conn) + writeHeld(conn) + serverHeld(conn.tls);

/** A connection through its handshake, and the client's side of it. */
class Live {
  conn: TlsRecordServer;
  tls: TlsServer;
  /** The client's reader of the server's application records, and its writer of its own. */
  reader: TlsRecordProtection;
  writer: TlsRecordProtection;
  /** The client's writer of its handshake records, and its Finished message, once the server's flight is read. */
  handshakeWriter: TlsRecordProtection;
  finished: u8[];
  /** Both sides reached the end of the handshake. */
  connected: boolean = false;

  constructor(tls: TlsServer) {
    this.tls = tls;
    this.conn = new TlsRecordServer(tls);
    this.reader = new TlsRecordProtection();
    this.writer = new TlsRecordProtection();
    this.handshakeWriter = new TlsRecordProtection();
    this.finished = [];
  }
}

/** A ClientHello offering `suite`, as the record-layer tests' client sends it. */
const helloFor = (suite: i32): u8[] => recordHello([suite], false, false);

/** The client's keys once it has read the server's two records (its ServerHello and flight) after sending `hello`, its Finished made. */
const clientKeysAfter = (suite: i32, hello: u8[], records: u8[][]): ClientKeys => {
  const header: i32 = 5;
  const keys: ClientKeys = clientKeysFor(tlsSuiteHashLength(suite), hello, range(records[0], header, toI32(records[0].length)));
  keys.finishWith(openOne(protectionFor(suite, keys.serverHandshake), records[1]).content);
  return keys;
};

/** The client's Finished in the one record it sends it in, under its handshake keys. */
const finishedRecord = (suite: i32, keys: ClientKeys): u8[] =>
  sealOne(protectionFor(suite, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO);

/** How far `reach` takes a handshake: the ClientHello fed, the flight signed and drained, or the client's Finished fed. */
const AT_SIGNATURE: i32 = 0;
const AT_FINISHED: i32 = 1;
const AT_CONNECTED: i32 = 2;

/**
 * A handshake under `suite` through a fresh slot, with the record-layer
 * tests' client on the other side, as far as `upTo`: the ServerHello and
 * flight drained, the flight opened, the client's Finished fed, and the
 * client's application keys installed on both of its protections.
 */
const reach = (suite: i32, upTo: i32): Live => {
  const live = new Live(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()));
  const conn: TlsRecordServer = live.conn;
  const hello: u8[] = helloFor(suite);
  feed(conn, clearRecord(hello));
  const input: u8[] | null = conn.signatureInput();
  if (input === null || upTo === AT_SIGNATURE) {
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
  const keys: ClientKeys = clientKeysAfter(suite, hello, records);
  live.handshakeWriter = protectionFor(suite, keys.clientHandshake);
  live.finished = keys.finished;
  if (upTo === AT_FINISHED) {
    return live;
  }
  feed(conn, finishedRecord(suite, keys));
  live.reader = protectionFor(suite, keys.serverApplication);
  live.writer = protectionFor(suite, keys.clientApplication);
  live.connected = conn.state === TLS_RECORD_STATE_OPEN && live.tls.state === TLS_STATE_CONNECTED;
  return live;
};

/** A handshake under `suite` through to its end. */
const connect = (suite: i32): Live => reach(suite, AT_CONNECTED);

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

/**
 * Whether every array of `p` that `suite` keys is not zero: the key of its
 * length, the IV, and an AES suite's schedule, round keys and H both.
 */
const protectionHoldsEach = (p: TlsRecordProtection, suite: i32): boolean => {
  const keyHeld: i32 = suite === TLS_AES_128_GCM_SHA256 ? bytesHeld(p.key16) : bytesHeld(p.key32);
  let scheduleHeld: boolean = true;
  if (suite === TLS_AES_128_GCM_SHA256) {
    scheduleHeld = wordsHeld(p.aes128.roundKeys) > 0 && wordsHeld(p.aes128.h) > 0;
  } else if (suite === TLS_AES_256_GCM_SHA384) {
    scheduleHeld = wordsHeld(p.aes256.roundKeys) > 0 && wordsHeld(p.aes256.h) > 0;
  }
  return keyHeld > 0 && bytesHeld(p.iv) > 0 && scheduleHeld;
};

/**
 * Whether `conn` holds, under `suite`, each array an end wipes, every one of
 * them not zero on its own: both directions' keys, IVs and AES schedules,
 * both application traffic secrets in the suite's hash, the resumption
 * master secret and the exporter secret, as an open connection does. A sum
 * would pass with one array empty, and a wipe of it would then show nothing.
 */
const holdsEach = (conn: TlsRecordServer, suite: i32): boolean => {
  const tls: TlsServer = conn.tls;
  const wide: boolean = tlsSuiteHashLength(suite) !== 32;
  const readSecret: u8[] = wide ? conn.readSecret384 : conn.readSecret256;
  const writeSecret: u8[] = wide ? conn.writeSecret384 : conn.writeSecret256;
  const resumption: u8[] = wide ? tls.secrets384[RESUMPTION] : tls.secrets256[RESUMPTION];
  return (
    protectionHoldsEach(conn.readProtection, suite) &&
    protectionHoldsEach(conn.writeProtection, suite) &&
    bytesHeld(readSecret) > 0 &&
    bytesHeld(writeSecret) > 0 &&
    bytesHeld(resumption) > 0 &&
    bytesHeld(tls.exporterSecret) > 0
  );
};

/** Whether `live` reached the end of its handshake holding each array an end wipes. */
const holdsEverything = (live: Live, suite: i32): boolean => live.connected && holdsEach(live.conn, suite);

/** The checks of `fail`, truncation and `abort` under `suite`, named after `name`. */
const failures = (t: Suite, name: string, suite: i32): void => {
  const zero: i32 = 0;
  // 1. A record whose tag does not verify: bad_record_mac.
  const failed: Live = connect(suite);
  t.ok(`${name}: the open connection holds both directions' keys, the resumption and exporter secrets`, holdsEverything(failed, suite));
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

  // The client's own error alert ends the connection the same way, with nothing sent back.
  const alerted: Live = connect(suite);
  const heldBefore: boolean = holdsEverything(alerted, suite);
  const decryptError: u8[] = [toU8(2), toU8(51)];
  feed(alerted.conn, sealOne(alerted.writer, TLS_CONTENT_ALERT, decryptError, ZERO));
  t.ok(`${name}: the client's error alert fails the connection`, heldBefore && alerted.conn.state === TLS_RECORD_STATE_FAILED && alerted.conn.peerAlert === 51);
  t.eqI32(`${name}: and every key the slot and its TlsServer hold reads zero after it`, allHeld(alerted.conn), zero);

  // 2. The client's stream cut off without close_notify, and the socket failing.
  const cut: Live = connect(suite);
  const held: boolean = holdsEverything(cut, suite);
  cut.conn.end();
  t.ok(`${name}: a stream cut off without close_notify fails the connection`, held && cut.conn.state === TLS_RECORD_STATE_FAILED);
  t.eqI32(`${name}: and every key the slot and its TlsServer hold reads zero`, allHeld(cut.conn), zero);
  const aborted: Live = connect(suite);
  const heldToo: boolean = holdsEverything(aborted, suite);
  aborted.conn.abort();
  t.ok(`${name}: abort fails the connection`, heldToo && aborted.conn.state === TLS_RECORD_STATE_FAILED);
  t.eqI32(`${name}: and every key reads zero after it too`, allHeld(aborted.conn), zero);
};

/** The checks of `close`, then the slot's close, under `suite`, named after `name`. */
const closes = (t: Suite, name: string, suite: i32): void => {
  const zero: i32 = 0;
  const live: Live = connect(suite);
  const conn: TlsRecordServer = live.conn;
  t.ok(`${name}: before close the connection holds everything`, holdsEverything(live, suite));
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
  t.eqI32(`${name}: and the read direction and the client's traffic secret read zero after it`, readHeld(conn), zero);
  t.ok(`${name}: the exporter secret is left for the slot's close`, bytesHeld(live.tls.exporterSecret) > 0);
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

/** Writes all of `bytes` on `fd`, retrying while it would block; false when it will not take them. */
const sendAll = (fd: i32, bytes: u8[]): boolean => {
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
    netClose(client);
    netClose(listener);
    netClose(loop);
    return;
  }
  pollAdd(loop, server.fd(slot), one, toI32(3));
  const hello: u8[] = helloFor(suite);
  sendAll(client, clearRecord(hello));
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
    sendAll(client, finishedRecord(suite, clientKeysAfter(suite, hello, records)));
    polls = 0;
    while (conn.state !== TLS_RECORD_STATE_OPEN && polls < 200) {
      pollWait(loop, ready, toI32(50));
      server.readable(slot);
      polls = polls + 1;
    }
  }
  t.ok(
    "the slot holds both directions' keys and the resumption master secret once its handshake is done",
    conn.state === TLS_RECORD_STATE_OPEN && holdsEach(conn, suite)
  );
  server.close(slot);
  t.ok("TlsTcpServer.close frees the slot", server.busy() === 0);
  t.eqI32("and leaves every key of the slot and its TlsServer zero", allHeld(conn), zero);
  netClose(client);
  netClose(listener);
  netClose(loop);
};

/**
 * A handshake that fails before it is done, under AES-256-GCM: aborted while
 * it waits for the CertificateVerify signature, and refused at the client's
 * Finished, whose verify data does not match. Each leaves every key the slot
 * and its `TlsServer` hold zero, the handshake's own included.
 */
const midway = (t: Suite): void => {
  const zero: i32 = 0;
  const suite: i32 = TLS_AES_256_GCM_SHA384;
  const waiting: Live = reach(suite, AT_SIGNATURE);
  t.ok(
    "waiting for the signature, the slot holds the client's handshake keys and TlsServer the handshake's secrets",
    waiting.tls.state === TLS_STATE_WAIT_SIGNATURE && readHeld(waiting.conn) > 0 && serverHeld(waiting.tls) > 0
  );
  t.eqI32("and the ephemeral key already reads zero, the ServerHello written", bytesHeld(waiting.tls.ephemeralPrivate), zero);
  waiting.conn.abort();
  t.ok("abort while waiting for the signature fails the connection", waiting.conn.state === TLS_RECORD_STATE_FAILED);
  t.eqI32("and every key the slot and its TlsServer hold reads zero after that abort", allHeld(waiting.conn), zero);

  const finishing: Live = reach(suite, AT_FINISHED);
  t.ok(
    "waiting for the client's Finished, the slot holds both directions' handshake keys",
    finishing.tls.state === TLS_STATE_WAIT_FINISHED && readHeld(finishing.conn) > 0 && writeHeld(finishing.conn) > 0
  );
  t.eqI32(
    "and the handshake secret and the client's handshake secret already read zero in TlsServer",
    poolHeld(finishing.tls, HANDSHAKE) + poolHeld(finishing.tls, CLIENT_HANDSHAKE),
    zero
  );
  const wrong: u8[] = range(finishing.finished, ZERO, toI32(finishing.finished.length));
  const last: i32 = toI32(wrong.length) - 1;
  wrong[last] = toU8(toI32(wrong[last]) ^ 1);
  feed(finishing.conn, sealOne(finishing.handshakeWriter, TLS_CONTENT_HANDSHAKE, wrong, ZERO));
  t.ok(
    "a Finished whose verify data does not match fails the handshake with decrypt_error",
    finishing.tls.state === TLS_STATE_FAILED && finishing.conn.state === TLS_RECORD_STATE_FAILED && finishing.conn.alert === TLS_ALERT_DECRYPT_ERROR
  );
  t.eqI32("and every key the slot and its TlsServer hold reads zero after the refused Finished", allHeld(finishing.conn), zero);
};

/** Whether `a` and `b` are the same length and hold the same bytes. */
const equalBytes = (a: u8[], b: u8[]): boolean => toI32(a.length) === toI32(b.length) && sameBytes(a, b);

/**
 * A KeyUpdate from the client that asks for one back, under AES-256-GCM:
 * both traffic secrets move to the next generation in place, the one they
 * replace gone, and the next-secret scratch of both directions reads zero.
 */
const keyUpdates = (t: Suite): void => {
  const zero: i32 = 0;
  const hashLength: i32 = 48;
  const live: Live = connect(TLS_AES_256_GCM_SHA384);
  const conn: TlsRecordServer = live.conn;
  const oldRead: u8[] = range(conn.readSecret384, ZERO, toI32(conn.readSecret384.length));
  const oldWrite: u8[] = range(conn.writeSecret384, ZERO, toI32(conn.writeSecret384.length));
  feed(conn, sealOne(live.writer, TLS_CONTENT_HANDSHAKE, keyUpdateMessage(1), ZERO));
  t.eqStr(
    "a client's KeyUpdate asking for one back is answered under the old write keys",
    shown(lastOpened(live.reader, drain(conn))),
    `${TLS_CONTENT_HANDSHAKE} 24 0 0 1 0`
  );
  const nextRead: u8[] = nextTrafficCopy(hashLength, oldRead);
  const nextWrite: u8[] = nextTrafficCopy(hashLength, oldWrite);
  t.ok(
    "both traffic secrets are the next generation, written over the one they replace",
    live.connected && bytesHeld(oldRead) > 0 && equalBytes(conn.readSecret384, nextRead) && equalBytes(conn.writeSecret384, nextWrite)
  );
  secureZero(nextRead);
  secureZero(nextWrite);
  secureZero(oldRead);
  secureZero(oldWrite);
  t.eqI32("and the next-secret scratch of both directions reads zero", bytesHeld(conn.readProtection.next) + bytesHeld(conn.writeProtection.next), zero);
  conn.abort();
  t.eqI32("abort after the update leaves every key reading zero", allHeld(conn), zero);
};

/** `restart` and `start`, the slot handed its next connection, under `suite`. */
const restarts = (t: Suite, name: string, suite: i32): void => {
  const zero: i32 = 0;
  const live: Live = connect(suite);
  const held: boolean = holdsEverything(live, suite);
  live.tls.restart(serverRandom(), serverPrivate());
  live.conn.start(live.tls);
  const none: i32 = -1;
  const pools: i32 = poolsHeld(live.tls, none);
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
  midway(t);
  keyUpdates(t);

  // 6. The exchange's words, after a handshake and after a refused exchange.
  const done: Live = connect(TLS_AES_256_GCM_SHA384);
  t.ok("after a handshake the exchange's words read zero, the handshake secret's and the ephemeral key's", done.connected && exchangeHeld(done.tls) + poolHeld(done.tls, HANDSHAKE) + bytesHeld(done.tls.ephemeralPrivate) === 0);
  t.eqI32(
    "and so do the client's handshake and application secrets TlsServer handed over",
    poolHeld(done.tls, CLIENT_HANDSHAKE) + poolHeld(done.tls, CLIENT_APPLICATION),
    zero
  );
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
