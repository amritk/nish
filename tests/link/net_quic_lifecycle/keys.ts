// Key update in `nish/net/quic` (RFC 9001 §6), both ways: the client starts
// one and the server follows, the server starts one once it may, reordered
// packets under the previous keys, the order §6.4 requires, a forged Key
// Phase bit, and the cap on how many updates a client can make the server
// derive, with what each costs in the arena (QUIC-4).
import { Suite } from "nish/testing";
import {
  QUIC_PACKET_OK,
  QuicHeader,
  QuicKeys,
  QuicPacket,
  quicDecryptPacket,
  quicKeyUpdateSecret,
  quicKeysUpdate,
  quicParseHeader,
  quicRemoveHeaderProtection,
} from "nish/net/quic-packet";
import { QUIC_ERROR_KEY_UPDATE, quicPushAck } from "nish/net/quic-frame";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import {
  QUIC_CONN_MAX_KEY_UPDATES,
  QUIC_STATE_CLOSING,
  QuicConnection,
  QuicStreamData,
} from "nish/net/quic";
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { bytesOf, fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { CLIENT_SCID, QC_T0, QcClient, qcConnect, qcHello, qcParams, qcShortWith } from "../net_quic_conn/client";
import { qcConnected, qcDefaultConfig, qcServer } from "../net_quic_conn/common";
import { qcStream } from "../net_quic_conn/data";
import { lcAllZero, lcCloseIn } from "./common";

/**
 * One direction of the client's 1-RTT keys, a generation at a time: the
 * keys, the secret the next generation is derived from, and the Key Phase
 * bit they go with.
 */
class LcGeneration {
  keys: QuicKeys | null;
  secret: u8[];
  phase: boolean = false;

  constructor(keys: QuicKeys | null, secret: u8[], phase: boolean) {
    this.keys = keys;
    this.secret = secret;
    this.phase = phase;
  }
}

/** The generation after `g` (RFC 9001 §6.1), derived the way a client would. */
const lcNext = (g: LcGeneration): LcGeneration => {
  const none: u8[] = [];
  const keys: QuicKeys | null = g.keys;
  if (keys === null) {
    return new LcGeneration(null, none, !g.phase);
  }
  const secret: u8[] | null = quicKeyUpdateSecret(keys.aead, g.secret);
  if (secret === null) {
    return new LcGeneration(null, none, !g.phase);
  }
  return new LcGeneration(quicKeysUpdate(keys, secret), secret, !g.phase);
};

/** What the client made of one 1-RTT packet from the server: whether it opened, its Key Phase bit, its number and frames. */
class LcOpened {
  payload: u8[];
  pn: i64 = -1;
  ok: boolean = false;
  phase: boolean = false;

  constructor() {
    this.payload = [];
  }
}

/** Opens the server's 1-RTT `datagram` with `g`'s keys. */
const lcOpen = (c: QcClient, g: LcGeneration, datagram: u8[] | null): LcOpened => {
  const out = new LcOpened();
  const keys: QuicKeys | null = g.keys;
  if (datagram === null || keys === null) {
    return out;
  }
  const header: QuicHeader = quicParseHeader(datagram, n32(0), toI32(c.scid.length));
  const packet: QuicPacket = quicRemoveHeaderProtection(keys, datagram, header, n64(-1));
  out.phase = packet.keyPhase;
  out.pn = packet.packetNumber;
  out.ok = quicDecryptPacket(keys, datagram, header, packet) && packet.error === QUIC_PACKET_OK;
  out.payload = packet.payload;
  return out;
};

/** Sends `payload` under `g` with packet number `pn`, and answers the client's next number past it. */
const lcSend = (conn: QuicConnection, c: QcClient, g: LcGeneration, pn: i64, payload: u8[]): void => {
  conn.receive(qcShortWith(c, g.keys, g.phase, pn, payload), c.now);
  if (pn >= c.appPn) {
    c.appPn = pn + n64(1);
  }
};

/** The text of every stream run the server has for the application, joined. */
const lcRead = (conn: QuicConnection): string => {
  const parts: string[] = [];
  let data: QuicStreamData | null = conn.readStream();
  while (data !== null) {
    parts.push(textOf(data.data));
    data = conn.readStream();
  }
  return parts.join("+");
};

/** An ACK of the server's packet `pn` alone. */
const lcAck = (pn: i64): u8[] => {
  const out: u8[] = [];
  quicPushAck(out, [pn, pn], n32(1), n64(0));
  return out;
};

/** A client-started update, the server's answer, and an update the server starts in turn. */
const lcBothWays = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  const write0 = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  const read0 = new LcGeneration(c.appRead, c.appReadSecret, false);
  t.ok("once connected, both phases are 0 and the next read keys are ready (RFC 9001 §6.3)", !conn.readPhase && !conn.writePhase && conn.otherIsNext);
  t.ok("the server may not start an update before the client acknowledges a 1-RTT packet (§6.1)", !conn.updateKeys());

  const oldWrite: QuicKeys | null = conn.application.writeKeys;
  const write1: LcGeneration = lcNext(write0);
  const skipped: i64 = c.appPn;
  lcSend(conn, c, write1, skipped + n64(1), qcStream(n64(0), n64(0), "after", false));
  t.ok("a packet with the Key Phase bit flipped, under the next keys, is the client updating", conn.readPhase && conn.keyUpdates === 1);
  t.ok("the server's write keys follow at once (§6.2)", conn.writePhase);
  t.eqStr("and the packet's data is read", lcRead(conn), "after");
  t.ok("the old write key and IV are wiped; the header-protection key, which every generation shares, is not", oldWrite !== null && lcAllZero(oldWrite.key) && lcAllZero(oldWrite.iv) && !lcAllZero(oldWrite.hp));

  conn.writeStream(n64(0), bytesOf("echo"), false);
  const out: u8[] | null = conn.takeDatagram(c.now);
  const read1: LcGeneration = lcNext(read0);
  t.ok("the answer does not open under the old keys", !lcOpen(c, read0, out).ok);
  const opened: LcOpened = lcOpen(c, read1, out);
  t.ok("it opens under the next ones, with the Key Phase bit set", opened.ok && opened.phase);

  lcSend(conn, c, write0, skipped, qcStream(n64(0), n64(5), "late", false));
  t.eqStr("a packet the network delayed, under the previous keys and numbered below the update, is still read (§6.5)", lcRead(conn), "late");
  t.ok("the server may not start an update while it keeps the previous keys", !conn.updateKeys());
  const previous: QuicKeys | null = conn.otherReadKeys;
  const previousKey: u8[] = [];
  if (previous !== null) {
    for (const b of previous.key) {
      previousKey.push(b);
    }
  }
  conn.handleTimer(c.now + conn.recovery.probeTimeout());
  t.ok(
    "a probe timeout later the previous keys are gone, the next derived over them in their slot",
    conn.otherIsNext && previous !== null && toI32(previousKey.length) > 0 && !lcSameBytes(previous.key, previousKey)
  );
  t.ok("but until the client acknowledges a packet of the new phase, still not", !conn.updateKeys());

  lcSend(conn, c, write1, c.appPn, lcAck(opened.pn));
  t.ok("once it has, the server starts an update (§6.1)", conn.updateKeys());
  t.ok("its write phase moves on, its read phase waits for the client", !conn.writePhase && conn.readPhase);
  t.ok("and it cannot start another until the client answers", !conn.updateKeys());
  conn.writeStream(n64(0), bytesOf("again"), false);
  const out2: u8[] | null = conn.takeDatagram(c.now);
  const read2: LcGeneration = lcNext(read1);
  const opened2: LcOpened = lcOpen(c, read2, out2);
  t.ok("the server's next packet opens under the generation after, with the bit clear", !lcOpen(c, read1, out2).ok && opened2.ok && !opened2.phase);
  const write2: LcGeneration = lcNext(write1);
  lcSend(conn, c, write2, c.appPn, qcStream(n64(0), n64(9), "answer", false));
  t.ok("the client answers under its next keys, and the server reads it", lcRead(conn) === "answer" && !conn.readPhase);
  t.eqI32("an update the server started does not count against the client's", conn.keyUpdates, n32(1));

  conn.release();
  t.ok("release() wipes the 1-RTT secrets the next generations come from", lcAllZero(conn.appReadSecret) && lcAllZero(conn.appWriteSecret));
};

/** The order RFC 9001 §6.4 requires, and a Key Phase bit nobody can back. */
const lcOrder = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  const write0 = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  lcSend(conn, c, lcNext(write0), c.appPn, fromHex("01"));
  lcSend(conn, c, write0, c.appPn, fromHex("01"));
  t.ok("a packet under the previous keys numbered above one under the newer is KEY_UPDATE_ERROR (§6.4)", conn.state === QUIC_STATE_CLOSING && conn.error === QUIC_ERROR_KEY_UPDATE);
  const back: QuicConnection = qcServer(qcDefaultConfig());
  const b: QcClient = qcConnected(back, n64(65536));
  const bWrite0 = new LcGeneration(b.appWrite, b.appWriteSecret, false);
  lcSend(back, b, bWrite0, n64(10), fromHex("01"));
  lcSend(back, b, lcNext(bWrite0), n64(5), fromHex("01"));
  t.ok("so is one under the next keys numbered below one under the current", back.state === QUIC_STATE_CLOSING && back.error === QUIC_ERROR_KEY_UPDATE);
  t.eqStr("and the close says so", lcCloseIn([lcOpen(b, new LcGeneration(b.appRead, b.appReadSecret, false), back.takeDatagram(b.now)).payload]), `${QUIC_ERROR_KEY_UPDATE} 0`);

  const forged: QuicConnection = qcServer(qcDefaultConfig());
  const f: QcClient = qcConnected(forged, n64(65536));
  const dropped: i32 = forged.dropped;
  const packet: u8[] = qcShortWith(f, f.appWrite, true, f.appPn, fromHex("01"));
  let filled: i32 = 0;
  if (Arena.used() > toI64(49152)) {
    const filler: u8[] = new Array<u8>(16384);
    filled = toI32(filler.length);
  }
  const before: i64 = Arena.used();
  forged.receive(packet, f.now);
  const step: i64 = Arena.used() - before;
  t.ok("a flipped Key Phase bit under the current keys is dropped, changing nothing", forged.dropped === dropped + 1 && !forged.readPhase && forged.otherIsNext && filled >= 0);
  t.ok("and derives nothing: under 2 KB of the arena, the cost of reading any packet", step >= toI64(0) && step < toI64(2048));
};

/** Whether `a` and `b` hold the same bytes. */
const lcSameBytes = (a: u8[], b: u8[]): boolean => {
  if (toI32(a.length) !== toI32(b.length)) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(a.length) && k < toI32(b.length); k++) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};

/** A ChaCha20-Poly1305 connection updates the same way: no AES schedule to keep. */
const lcChaCha = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(TLS_CHACHA20_POLY1305_SHA256, scid);
  qcConnect(conn, c, qcHello([TLS_CHACHA20_POLY1305_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536)))));
  lcSend(conn, c, lcNext(new LcGeneration(c.appWrite, c.appWriteSecret, false)), c.appPn, qcStream(n64(0), n64(0), "chacha", false));
  conn.writeStream(n64(0), bytesOf("chacha"), false);
  const opened: LcOpened = lcOpen(c, lcNext(new LcGeneration(c.appRead, c.appReadSecret, false)), conn.takeDatagram(c.now));
  t.ok("under ChaCha20-Poly1305 a client's update is followed too", lcRead(conn) === "chacha" && opened.ok && opened.phase);
};

/**
 * The cap: `QUIC_CONN_MAX_KEY_UPDATES` updates from the client, each a probe
 * timeout after the last, are followed, and the next closes the connection.
 * Each update's cost in the arena is measured the way
 * `net_tls_record_refusals` measures a TLS KeyUpdate: `Arena.used()` counts
 * the current chunk, so before each step a filler that does not fit what is
 * left starts a new one, and a step that still crosses a chunk reads negative
 * and fails the check.
 */
const lcCap = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  let write: LcGeneration = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  let most: i64 = 0;
  let crossed: i32 = 0;
  let filled: i32 = 0;
  let followed: i32 = 0;
  for (let k: i32 = 0; k < QUIC_CONN_MAX_KEY_UPDATES; k++) {
    write = lcNext(write);
    const packet: u8[] = qcShortWith(c, write.keys, write.phase, c.appPn, fromHex("01"));
    c.appPn = c.appPn + n64(1);
    c.now = c.now + conn.recovery.probeTimeout();
    if (Arena.used() > toI64(49152)) {
      const filler: u8[] = new Array<u8>(16384);
      filled = filled + toI32(filler.length);
    }
    const before: i64 = Arena.used();
    conn.receive(packet, c.now);
    conn.handleTimer(c.now + conn.recovery.probeTimeout());
    const step: i64 = Arena.used() - before;
    if (step < toI64(0)) {
      crossed = crossed + 1;
    } else if (step > most) {
      most = step;
    }
    followed = followed + (conn.keyUpdates === k + 1 && conn.writePhase === write.phase ? 1 : 0);
  }
  t.eqI32(`all ${QUIC_CONN_MAX_KEY_UPDATES} of the client's updates are followed`, followed, QUIC_CONN_MAX_KEY_UPDATES);
  t.ok(
    "each, its packet read and the next keys derived in the slot, leaves nothing in the arena (QUIC-4)",
    crossed === 0 && filled > 0 && most === toI64(0)
  );
  write = lcNext(write);
  const last: u8[] = qcShortWith(c, write.keys, write.phase, c.appPn, fromHex("01"));
  if (Arena.used() > toI64(49152)) {
    const filler: u8[] = new Array<u8>(16384);
    filled = filled + toI32(filler.length);
  }
  const before65: i64 = Arena.used();
  conn.receive(last, c.now + conn.recovery.probeTimeout());
  const step65: i64 = Arena.used() - before65;
  t.eqStr(
    `the ${QUIC_CONN_MAX_KEY_UPDATES + 1}th is KEY_UPDATE_ERROR, deriving no key`,
    `${conn.state === QUIC_STATE_CLOSING} ${conn.error} ${step65 >= toI64(0) && step65 < toI64(2048)}`,
    `true ${QUIC_ERROR_KEY_UPDATE} true`
  );
};

/** Every key-update check. */
export const keyChecks = (t: Suite): void => {
  t.ok("a connection still in its handshake cannot start an update", !qcServer(qcDefaultConfig()).updateKeys());
  lcBothWays(t);
  lcOrder(t);
  lcChaCha(t);
  lcCap(t);
};
