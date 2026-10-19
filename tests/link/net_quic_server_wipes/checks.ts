// What a QUIC server wipes when it ends, read back as zero (QUIC-5 in
// docs/security/quic.md): `QuicListener.release()`, and `Http3Server.stop()`,
// which releases every slot's connection and the listener and wipes the
// configuration's stateless reset key and Retry token key and the
// connection-ID index's salt. Each array is first shown to hold something,
// or, where the listener already wipes it after each use, shown to read zero
// before as well as after. `tests/link/net_quic_server_wipes_f64` runs the
// same checks under `--number-mode f64`, and `tests/wipes/quic-server.js`
// compiles this program to count the same wipes after `opt -O2`.
import { Secret, expose, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { HkdfScratch } from "nish/crypto/hkdf";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QuicHeader, QuicKeysSlot, quicParseHeader } from "nish/net/quic-packet";
import {
  QUIC_LISTEN_ACCEPT,
  QUIC_LISTEN_DROP,
  QUIC_LISTEN_INVALID_TOKEN,
  QUIC_LISTEN_RETRY,
  QUIC_LISTEN_STATELESS_RESET,
  QUIC_LISTENER_ANSWER_SIZE,
  QuicListener,
  QuicListenerAnswer,
} from "nish/net/quic-listener";
import { QuicConnection, QuicServerConfig } from "nish/net/quic";
import { Http3Server } from "nish/net/http3-server";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex, sameBytes } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { CLIENT_SCID, QC_T0, QcClient, qcCrypto, qcHello, qcInitial, qcParams, qcRetried } from "../net_quic_conn/client";
import { lcClientAddress, lcConfig, lcListenerEntropy, lcOtherVersion, lcShortTo } from "../net_quic_lifecycle/common";
import { H3Limits, H3Peer, h3Hello, h3QuicConfig, h3WireConnect } from "../net_http3/peer";
import { LoopServer } from "../net_http3_server/loopback";

/** Whether every byte of `bytes` is zero. */
const swZero = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (b !== toU8(0)) {
      return false;
    }
  }
  return true;
};

/** Whether every word of `words` is zero. */
const swZero32 = (words: u32[]): boolean => {
  for (const w of words) {
    if (w !== toU32(0)) {
      return false;
    }
  }
  return true;
};

/** Whether every word of `words` is zero. */
const swZero64 = (words: u64[]): boolean => {
  for (const w of words) {
    if (w !== toU64(0)) {
      return false;
    }
  }
  return true;
};

/** Whether every key `slot` holds is zero: both key sizes, both header-protection sizes, the IV and all four schedules. */
const swSlotZero = (slot: QuicKeysSlot): boolean =>
  swZero(slot.key16) &&
  swZero(slot.key32) &&
  swZero(slot.hp16) &&
  swZero(slot.hp32) &&
  swZero(slot.keys.iv) &&
  swZero64(slot.packet128.roundKeys) &&
  swZero64(slot.packet256.roundKeys) &&
  swZero64(slot.hp128.roundKeys) &&
  swZero64(slot.hp256.roundKeys);

/** Whether every slot of `slots` is zero. */
const swSlotsZero = (slots: QuicKeysSlot[]): boolean => {
  let zero: boolean = true;
  for (const slot of slots) {
    zero = zero && swSlotZero(slot);
  }
  return zero;
};

/** Whether the HKDF scratch's previous block and both HMACs' hashers, state, block and schedule, are zero. */
const swKdfZero = (kdf: HkdfScratch): boolean =>
  swZero(kdf.previous) &&
  swZero32(kdf.sha256.inner.state) &&
  swZero(kdf.sha256.inner.block) &&
  swZero32(kdf.sha256.inner.schedule) &&
  swZero32(kdf.sha256.outer.state) &&
  swZero(kdf.sha256.outer.block) &&
  swZero32(kdf.sha256.outer.schedule) &&
  swZero64(kdf.sha384.inner.engine.state) &&
  swZero(kdf.sha384.inner.engine.block) &&
  swZero64(kdf.sha384.inner.engine.schedule) &&
  swZero64(kdf.sha384.outer.engine.state) &&
  swZero(kdf.sha384.outer.engine.block) &&
  swZero64(kdf.sha384.outer.engine.schedule);

/** Whether the keys of every space of `conn`, the key-update and Initial secrets and the connection-ID seed are zero. */
const swConnZero = (conn: QuicConnection): boolean => {
  return (
    expose(conn.readSecret256, swZero) &&
    expose(conn.nextReadSecret256, swZero) &&
    expose(conn.writeSecret256, swZero) &&
    expose(conn.readSecret384, swZero) &&
    expose(conn.nextReadSecret384, swZero) &&
    expose(conn.writeSecret384, swZero) &&
    swSlotsZero(conn.initial.keySlots) &&
    swSlotsZero(conn.handshake.keySlots) &&
    swSlotsZero(conn.application.keySlots) &&
    swZero(conn.initialClient) &&
    swZero(conn.initialServer) &&
    swZero(conn.cidSeed)
  );
};

/** The client's ClientHello, with its transport parameters. */
const swHello = (): u8[] => {
  const scid: u8[] = fromHex(CLIENT_SCID);
  return qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
};

/** A short-header datagram of `size` bytes to an ID no connection owns: the listener answers it with a stateless reset. */
const swShort = (size: i32): u8[] => lcShortTo(fromHex("d0d1d2d3d4d5d6d7"), size);

/** Whether `l` answers `d` with nothing: dropped, and no reply. */
const swDropped = (l: QuicListener, d: u8[], now: i64): boolean => {
  const a: QuicListenerAnswer = l.handle(d, lcClientAddress(), now);
  return a.kind === QUIC_LISTEN_DROP && toI32(a.reply.length) === n32(0);
};

/**
 * A listener that has answered a Retry, a stateless reset and an
 * INVALID_TOKEN close, released: everything it held reads zero, it drops
 * every datagram after, and a listener sharing its configuration answers
 * on, byte for byte what the released one answered.
 */
const swListener = (t: Suite): void => {
  const config: QuicServerConfig = lcConfig(true);
  const l = new QuicListener(config, lcListenerEntropy());
  const twin = new QuicListener(config, lcListenerEntropy());
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const first: u8[] = qcInitial(c, qcCrypto(n64(0), swHello()), n32(1200));
  const retry: QuicListenerAnswer = l.handle(first, lcClientAddress(), QC_T0);
  t.ok("a Retry", retry.kind === QUIC_LISTEN_RETRY);
  const reset: QuicListenerAnswer = l.handle(swShort(n32(100)), lcClientAddress(), QC_T0);
  t.ok("a stateless reset", reset.kind === QUIC_LISTEN_STATELESS_RESET);
  const header: QuicHeader = quicParseHeader(retry.reply, n32(0), n32(8));
  qcRetried(c, header.scid, header.token);
  const accepted: u8[] = qcInitial(c, qcCrypto(n64(0), swHello()), n32(1200));
  t.ok("the Initial carrying its token is accepted", l.handle(accepted, lcClientAddress(), QC_T0 + n64(30)).kind === QUIC_LISTEN_ACCEPT);
  const forged = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  qcRetried(forged, header.scid, header.token);
  forged.token[33] = forged.token[33] ^ toU8(1);
  const bad: u8[] = qcInitial(forged, qcCrypto(n64(0), swHello()), n32(1200));
  t.ok("and one whose token's MAC is changed is closed with INVALID_TOKEN", l.handle(bad, lcClientAddress(), QC_T0 + n64(30)).kind === QUIC_LISTEN_INVALID_TOKEN);

  t.ok("before release: the seed is held", !swZero(l.seed));
  t.ok("so are the generator's unused bytes", !swZero(l.pool) && l.poolHead < n32(32));
  t.ok("and the INVALID_TOKEN close's Initial secrets and both key slots", !swZero(l.initialClient) && !swZero(l.initialServer) && !swSlotZero(l.readSlot) && !swSlotZero(l.writeSlot));
  t.ok("the tag, the HKDF block and the HMAC-SHA256 hashers already read zero between datagrams, wiped after each use", swZero(l.tag) && swZero(l.kdf.previous) && swZero32(l.kdf.sha256.inner.state) && swZero32(l.kdf.sha256.outer.state));
  t.ok("the HMAC-SHA384 hashers, which the listener never keys, hold SHA-384's initial state", !swZero64(l.kdf.sha384.inner.engine.state) && !swZero64(l.kdf.sha384.outer.engine.state));
  t.ok("and handle's spare answer holds the INVALID_TOKEN close it last answered", l.spare.kind === QUIC_LISTEN_INVALID_TOKEN && !swZero(l.spare.reply));
  l.release();
  t.ok("after release: the seed reads zero", swZero(l.seed));
  t.ok("so do the generator's unused bytes", swZero(l.pool));
  t.ok("the Initial secrets", swZero(l.initialClient) && swZero(l.initialServer));
  t.ok("both key slots, schedules included", swSlotZero(l.readSlot) && swSlotZero(l.writeSlot));
  t.ok("and the tag and the HMAC and HKDF scratch, both hashes' hashers included", swZero(l.tag) && swKdfZero(l.kdf));
  t.ok("and the spare answer, across its whole room and both IDs' 20 bytes", l.spare.kind === QUIC_LISTEN_DROP && toI32(l.spare.reply.length) === QUIC_LISTENER_ANSWER_SIZE && swZero(l.spare.reply) && toI32(l.spare.originalDcid.length) === n32(20) && swZero(l.spare.originalDcid) && toI32(l.spare.retryScid.length) === n32(20) && swZero(l.spare.retryScid));

  const sent: i32 = l.resetsSent;
  t.ok("a released listener drops a Version Negotiation's Initial", swDropped(l, lcOtherVersion("6b3343cf", c.odcid, c.scid, n32(1200)), QC_T0 + n64(40)));
  t.ok("a first Initial, which would be a Retry", swDropped(l, first, QC_T0 + n64(40)));
  t.ok("the Initial carrying its token", swDropped(l, accepted, QC_T0 + n64(40)));
  t.ok("the forged one", swDropped(l, bad, QC_T0 + n64(40)));
  t.ok("and a short header, which would be a stateless reset", swDropped(l, swShort(n32(100)), QC_T0 + n64(400)) && l.resetsSent === sent);

  t.ok("its configuration's keys are not the listener's: they are still held", !swZero(config.statelessResetKey) && !swZero(config.retryTokenKey));
  const again: QuicListenerAnswer = twin.handle(first, lcClientAddress(), QC_T0);
  t.ok("so a listener sharing them answers the same Retry, byte for byte", again.kind === QUIC_LISTEN_RETRY && sameBytes(again.reply, retry.reply));
  const twinReset: QuicListenerAnswer = twin.handle(swShort(n32(100)), lcClientAddress(), QC_T0);
  t.ok("and the same stateless reset", twinReset.kind === QUIC_LISTEN_STATELESS_RESET && sameBytes(twinReset.reply, reset.reply));
};

/**
 * A server with a connection across loopback, stopped: the configuration's
 * keys, the index's salt, the listener and every slot's connection read
 * zero, the slot is free, and an Initial is no longer accepted.
 */
const swServer = (t: Suite): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(2), n32(0));
  const server: Http3Server = loop.server;
  const p: H3Peer = h3WireConnect(server, loop.port, limits);
  if (!t.ok("a server with a connection across loopback", server.busy() === n32(1) && p.conn.handshakeComplete)) {
    return;
  }
  const config: QuicServerConfig = server.quicConfig;
  t.ok("before stop: the stateless reset key and the Retry token key are held", !swZero(config.statelessResetKey) && !swZero(config.retryTokenKey));
  t.ok("so are the index's salt and the listener's seed", !swZero(server.index.salt) && !swZero(server.listener.seed));
  t.ok("and the connection's keys", !swConnZero(server.quic(n32(0))));
  t.ok("the entropy a connection is begun with already reads zero, wiped once it is taken", swZero(server.entropy));
  server.stop();
  t.ok("after stop: the stateless reset key and the Retry token key read zero", swZero(config.statelessResetKey) && swZero(config.retryTokenKey));
  t.ok("so do the index's salt and the entropy scratch", swZero(server.index.salt) && swZero(server.entropy));
  t.ok("the listener's seed, generator and key slots", swZero(server.listener.seed) && swZero(server.listener.pool) && swSlotZero(server.listener.readSlot) && swSlotZero(server.listener.writeSlot));
  t.ok("and every slot's connection, the one in use and the one never used", swConnZero(server.quic(n32(0))) && swConnZero(server.quic(n32(1))));
  t.ok("and the listener's last answer, across its whole room", toI32(server.answer.reply.length) === QUIC_LISTENER_ANSWER_SIZE && swZero(server.answer.reply) && swZero(server.answer.originalDcid) && swZero(server.answer.retryScid));
  t.eqI32("the slot is free", server.busy(), n32(0));
  const accepted: i32 = server.accepted;
  const key: Secret<u8[]> = secret(leafPrivate());
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const initial: u8[] = qcInitial(c, qcCrypto(n64(0), h3Hello(limits)), n32(1200));
  server.datagram(initial, n32(0), toI32(initial.length), lcClientAddress(), QC_T0, key);
  wipe(key);
  t.ok("and a new client's Initial is dropped: no slot taken, none accepted", server.busy() === n32(0) && server.accepted === accepted);
};

/** Every check, in one suite. */
export const serverWipeChecks = (): i32 => {
  const t = new Suite("quic server wipes");
  swListener(t);
  swServer(t);
  return t.done();
};
