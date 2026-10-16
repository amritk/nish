// What a QUIC connection wipes, read back as zero at each point a level, a key
// generation or the connection ends (QUIC-2 in docs/security/quic.md): the
// Initial and Handshake levels when they are discarded, the write keys a key
// update replaces, and every key and secret once the closing period after a
// close or a failure ends, once the draining period after the client's close
// ends, at the idle timeout and at `release()`. Each runs under the three
// suites, against the test client of `net_quic_conn`. `tests/wipes/quic.js`
// compiles this program to count the same wipes after `opt -O2`.
import { Suite } from "nish/testing";
import { AesKey } from "nish/crypto/aes";
import { QuicKeys, QuicKeysSlot, quicKeyUpdateSecret, quicKeysUpdate } from "nish/net/quic-packet";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import {
  QUIC_STATE_CLOSING,
  QUIC_STATE_CONNECTED,
  QUIC_STATE_DRAINING,
  QUIC_STATE_TIMED_OUT,
  QuicConnection,
} from "nish/net/quic";
import { TlsServer } from "nish/net/tls";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { fromHex } from "../crypto_x509/hex";
import { n64 } from "../net_quic_frame/typed";
import { CLIENT_SCID, QcClient, qcAead, qcConnect, qcDrain, qcExchange, qcHello, qcParams, qcShort, qcShortWith } from "../net_quic_conn/client";
import { qcDefaultConfig, qcServer } from "../net_quic_conn/common";

/** Whether every byte of `bytes` is zero. */
const qwZero = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (b !== toU8(0)) {
      return false;
    }
  }
  return true;
};

/** Whether every word of an AES schedule, the kernels' powers of H included, and both words of H are zero. */
const qwZeroAes = (key: AesKey): boolean => {
  for (const w of key.roundKeys) {
    if (w !== toU64(0)) {
      return false;
    }
  }
  return key.h[0] === toU64(0) && key.h[1] === toU64(0);
};

/** Whether every key `slot` holds is zero: both key sizes, both header-protection sizes, the IV and all four schedules. */
const qwSlotZero = (slot: QuicKeysSlot): boolean =>
  qwZero(slot.key16) &&
  qwZero(slot.key32) &&
  qwZero(slot.hp16) &&
  qwZero(slot.hp32) &&
  qwZero(slot.keys.iv) &&
  qwZeroAes(slot.packet128) &&
  qwZeroAes(slot.packet256) &&
  qwZeroAes(slot.hp128) &&
  qwZeroAes(slot.hp256);

/** Whether every slot of `slots` is zero. */
const qwSlotsZero = (slots: QuicKeysSlot[]): boolean => {
  let zero: boolean = true;
  for (const slot of slots) {
    zero = zero && qwSlotZero(slot);
  }
  return zero;
};

/** Whether `secrets` are all zero. */
const qwAllZero = (secrets: u8[][]): boolean => {
  let zero: boolean = true;
  for (const secret of secrets) {
    zero = zero && qwZero(secret);
  }
  return zero;
};

/** The schedule of `slot` the suite's packet key uses, or `null` under ChaCha20-Poly1305. */
const qwPacketAes = (slot: QuicKeysSlot, suite: i32): AesKey | null => {
  if (suite === TLS_CHACHA20_POLY1305_SHA256) {
    return null;
  }
  return suite === TLS_AES_256_GCM_SHA384 ? slot.packet256 : slot.packet128;
};

/** The packet key of `slot` the suite uses. */
const qwPacketKey = (slot: QuicKeysSlot, suite: i32): u8[] => (suite === TLS_AES_128_GCM_SHA256 ? slot.key16 : slot.key32);

/** The header-protection key of `slot` the suite uses. */
const qwHpKey = (slot: QuicKeysSlot, suite: i32): u8[] => (suite === TLS_AES_128_GCM_SHA256 ? slot.hp16 : slot.hp32);

/**
 * Whether everything secret `conn` held is zero: every key slot of every
 * space, the key-update and Initial secrets, the seed, the ephemeral key, and
 * every secret field of its `TlsServer`, the resumption secret included.
 */
const qwConnZero = (conn: QuicConnection): boolean => {
  const tls: TlsServer | null = conn.tlsSlot;
  const tlsZero: boolean =
    tls !== null &&
    qwZero(tls.handshakeSecret) &&
    qwZero(tls.clientHandshakeSecret) &&
    qwZero(tls.serverHandshakeSecret) &&
    qwZero(tls.clientApplicationSecret) &&
    qwZero(tls.serverApplicationSecret) &&
    qwZero(tls.exporterSecret) &&
    qwZero(tls.resumptionSecret) &&
    qwZero(tls.expectedClientFinished);
  return (
    tlsZero &&
    qwSlotsZero(conn.initial.keySlots) &&
    qwSlotsZero(conn.handshake.keySlots) &&
    qwSlotsZero(conn.application.keySlots) &&
    qwAllZero(conn.readSecrets) &&
    qwAllZero(conn.writeSecrets) &&
    qwZero(conn.initialClient) &&
    qwZero(conn.initialServer) &&
    qwZero(conn.cidSeed) &&
    qwZero(conn.ephemeralPrivate)
  );
};

/** Whether the current 1-RTT keys, both ways, and the resumption secret are still held. */
const qwHeld = (conn: QuicConnection, suite: i32): boolean => {
  const tls: TlsServer | null = conn.tlsSlot;
  const read: QuicKeys | null = conn.application.readKeys;
  const write: QuicKeys | null = conn.application.writeKeys;
  return (
    tls !== null &&
    !qwZero(tls.resumptionSecret) &&
    read !== null &&
    write !== null &&
    !qwZero(read.key) &&
    !qwZero(write.key) &&
    (suite === TLS_CHACHA20_POLY1305_SHA256 || !qwSlotsZero(conn.application.keySlots))
  );
};

/** A connection under `suite` and the client that completed its handshake. */
class QwPair {
  conn: QuicConnection;
  client: QcClient;
  connected: boolean = false;

  constructor(suite: i32) {
    this.conn = qcServer(qcDefaultConfig());
    const scid: u8[] = fromHex(CLIENT_SCID);
    this.client = new QcClient(suite, scid);
    this.connected = qcConnect(
      this.conn,
      this.client,
      qcHello([suite], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))))
    );
  }
}

/** `release()` wipes everything at once. */
const qwRelease = (t: Suite, name: string, conn: QuicConnection, suite: i32): void => {
  const held: boolean = qwHeld(conn, suite);
  conn.release();
  t.ok(`${name}: release() leaves every key and secret zero`, held && qwConnZero(conn) && conn.deadline() === n64(-1));
};

/** The Initial and Handshake levels are wiped as each is discarded, and the 1-RTT keys are not. */
const qwDiscard = (t: Suite, name: string, suite: i32): void => {
  const p = new QwPair(suite);
  const conn: QuicConnection = p.conn;
  t.ok(`${name}: the handshake completes`, p.connected && conn.state === QUIC_STATE_CONNECTED);
  t.ok(`${name}: the Initial level's slots, schedules included, read zero once it is discarded`, conn.initial.discarded && qwSlotsZero(conn.initial.keySlots));
  t.ok(`${name}: and the Handshake level's, once the handshake is confirmed`, conn.handshake.discarded && qwSlotsZero(conn.handshake.keySlots));
  const tls: TlsServer | null = conn.tlsSlot;
  t.ok(
    `${name}: with TlsServer's handshake traffic secrets`,
    tls !== null && qwZero(tls.handshakeSecret) && qwZero(tls.clientHandshakeSecret) && qwZero(tls.serverHandshakeSecret)
  );
  t.ok(`${name}: while the 1-RTT keys are held`, qwHeld(conn, suite));
};

/**
 * The client updates its keys: the server's write keys follow, and the slot
 * of the generation they replace reads zero but for the header-protection
 * key every generation shares; a probe timeout later the previous read
 * generation goes, and the slot is the next generation's.
 */
const qwKeyUpdate = (t: Suite, name: string, suite: i32): void => {
  const p = new QwPair(suite);
  const conn: QuicConnection = p.conn;
  const c: QcClient = p.client;
  const keys: QuicKeys | null = c.appWrite;
  const next: u8[] | null = quicKeyUpdateSecret(qcAead(suite), c.appWriteSecret);
  if (!p.connected || keys === null || next === null) {
    t.ok(`${name}: the client updates its keys`, false);
    return;
  }
  const oldWrite: QuicKeysSlot = conn.application.keySlot(2 + conn.appWriteSlot);
  const oldRead: QuicKeysSlot = conn.application.keySlot(conn.appReadSlot);
  const oldAes: AesKey | null = qwPacketAes(oldWrite, suite);
  const wasHeld: boolean = !qwZero(qwPacketKey(oldWrite, suite)) && (oldAes === null || !qwZeroAes(oldAes));
  const readKey: u8[] = [];
  for (const b of qwPacketKey(oldRead, suite)) {
    readKey.push(b);
  }
  const updated: QuicKeys | null = quicKeysUpdate(keys, next);
  qcExchange(conn, c, qcShortWith(c, updated, true, c.appPn, fromHex("01")));
  c.appPn = c.appPn + n64(1);
  t.ok(`${name}: the server follows the client's key update`, conn.keyUpdates === 1 && conn.writePhase && conn.state === QUIC_STATE_CONNECTED);
  t.ok(
    `${name}: the write slot the update replaced reads zero: packet key, IV and its schedule`,
    wasHeld &&
      qwZero(qwPacketKey(oldWrite, suite)) &&
      qwZero(oldWrite.keys.iv) &&
      (oldAes === null || qwZeroAes(oldAes))
  );
  t.ok(`${name}: but for the header-protection key, which every generation shares`, !qwZero(qwHpKey(oldWrite, suite)));
  t.ok(`${name}: the previous read generation is kept for a probe timeout`, !qwZero(qwPacketKey(oldRead, suite)));
  c.now = c.now + conn.recovery.probeTimeout() * n64(2);
  qcExchange(conn, c, qcShortWith(c, updated, true, c.appPn, fromHex("01")));
  c.appPn = c.appPn + n64(1);
  let same: boolean = toI32(readKey.length) === toI32(qwPacketKey(oldRead, suite).length);
  for (let k: i32 = 0; k < toI32(readKey.length) && k < toI32(qwPacketKey(oldRead, suite).length); k++) {
    same = same && readKey[k] === qwPacketKey(oldRead, suite)[k];
  }
  t.ok(`${name}: then its slot holds the next generation instead`, conn.otherIsNext && !same && !qwZero(qwPacketKey(oldRead, suite)));
  qwRelease(t, name, conn, suite);
};

/**
 * What a closed connection keeps through its closing or draining period
 * (RFC 9000 §10.2) and wipes at its end: held at one millisecond before
 * `deadline()`, every key and secret zero at it, and nothing more to send.
 */
const qwPeriod = (t: Suite, label: string, conn: QuicConnection, suite: i32, state: i32): void => {
  const end: i64 = conn.deadline();
  const period: i64 = end - conn.now;
  const pto: i64 = conn.recovery.probeTimeout();
  conn.handleTimer(end - n64(1));
  const kept: boolean = qwHeld(conn, suite);
  conn.handleTimer(end);
  t.ok(`${label}: the keys are kept through the period, three probe timeouts`, kept && pto > n64(0) && period === pto * n64(3));
  t.ok(`${label}: and at its end every key and secret reads zero`, qwConnZero(conn));
  t.ok(`${label}: in the same state, with nothing more to send or time`, conn.state === state && conn.takeDatagram(end) === null && conn.deadline() === n64(-1));
};

/** The server closes: the CONNECTION_CLOSE goes out under the keys, which go at the end of the closing period. */
const qwClose = (t: Suite, name: string, suite: i32): void => {
  const p = new QwPair(suite);
  p.conn.close(n64(0));
  const sent: i32 = qcDrain(p.conn, p.client);
  t.ok(`${name}, closed: the CONNECTION_CLOSE goes out`, p.connected && sent === 1);
  qwPeriod(t, `${name}, closed`, p.conn, suite, QUIC_STATE_CLOSING);
};

/** The client breaks the protocol (HANDSHAKE_DONE to a server, RFC 9000 §19.20): the connection fails, and closes as `qwClose` does. */
const qwFail = (t: Suite, name: string, suite: i32): void => {
  const p = new QwPair(suite);
  const sent: i32 = qcExchange(p.conn, p.client, qcShort(p.client, fromHex("1e")));
  t.ok(`${name}, failed: the CONNECTION_CLOSE goes out`, p.connected && sent === 1 && p.conn.state === QUIC_STATE_CLOSING);
  qwPeriod(t, `${name}, failed`, p.conn, suite, QUIC_STATE_CLOSING);
};

/** The client closes (CONNECTION_CLOSE, no error): the server drains, sending nothing, and wipes at the end. */
const qwDrain = (t: Suite, name: string, suite: i32): void => {
  const p = new QwPair(suite);
  const sent: i32 = qcExchange(p.conn, p.client, qcShort(p.client, fromHex("1c000000")));
  t.ok(`${name}, drained: nothing goes out`, p.connected && sent === 0 && p.conn.state === QUIC_STATE_DRAINING);
  qwPeriod(t, `${name}, drained`, p.conn, suite, QUIC_STATE_DRAINING);
};

/** The idle timeout passes: the connection closes silently and every key goes at once. */
const qwIdle = (t: Suite, name: string, suite: i32): void => {
  const p = new QwPair(suite);
  const idle: i64 = p.conn.idleDeadline();
  p.conn.handleTimer(idle);
  t.ok(`${name}, idle: past the idle timeout every key and secret reads zero`, p.connected && idle > n64(0) && p.conn.state === QUIC_STATE_TIMED_OUT && qwConnZero(p.conn));
};

/** Every check, and the exit code. */
export const quicWipeChecks = (): i32 => {
  const t = new Suite("quic wipes");
  const suites: i32[] = [TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256];
  const names: string[] = ["AES-128-GCM", "AES-256-GCM", "ChaCha20-Poly1305"];
  for (let k: i32 = 0; k < toI32(suites.length) && k < toI32(names.length); k++) {
    qwDiscard(t, names[k], suites[k]);
    qwKeyUpdate(t, names[k], suites[k]);
    qwClose(t, names[k], suites[k]);
    qwFail(t, names[k], suites[k]);
    qwDrain(t, names[k], suites[k]);
    qwIdle(t, names[k], suites[k]);
  }
  return t.done();
};
