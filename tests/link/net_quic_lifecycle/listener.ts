// `nish/net/quic-listener`: Version Negotiation, Retry with its token, and
// the stateless reset, each answered (or refused) for a datagram built to
// reach that rule alone.
import { Suite } from "nish/testing";
import { hmacSha256 } from "nish/crypto/hmac";
import { QUIC_PACKET_INITIAL, QUIC_PACKET_OK, QUIC_PACKET_RETRY, QuicHeader, quicParseHeader, quicRetryVerify } from "nish/net/quic-packet";
import { QUIC_ERROR_INVALID_TOKEN } from "nish/net/quic-frame";
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import {
  QUIC_LISTEN_ACCEPT,
  QUIC_LISTEN_DROP,
  QUIC_LISTEN_INVALID_TOKEN,
  QUIC_LISTEN_STATELESS_RESET,
  QUIC_LISTENER_RESET_BURST,
  QuicListener,
  QuicListenerAnswer,
} from "nish/net/quic-listener";
import {
  QUIC_STATE_CONNECTED,
  QuicConnection,
  QuicServerConfig,
  quicStatelessResetToken,
} from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { leafCertificate } from "../net_tls_common/server";
import { fromHex, sameBytes, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { fixedEntropy, resetKey, tokenKey } from "../net_quic_conn_replay/server";
import {
  CLIENT_ODCID,
  CLIENT_SCID,
  QC_T0,
  QcClient,
  qcCrypto,
  qcExchange,
  qcFinishedPacket,
  qcHello,
  qcInitial,
  qcParams,
  qcReadFlight,
  qcReceive,
  qcRetried,
  qcShortTo,
} from "../net_quic_conn/client";
import { qcConnected, qcDefaultConfig, qcServer } from "../net_quic_conn/common";
import { serverParamsOf } from "../net_quic_conn/checks";
import {
  LcIssuedId,
  lcClientAddress,
  lcCloseIn,
  lcIssuedIds,
  lcKindName,
  lcConfig,
  lcListenerEntropy,
  lcOtherAddress,
  lcOtherVersion,
  lcShortTo,
  lcTail,
} from "./common";

/** The client's ClientHello, with its transport parameters. */
const lcHello = (): u8[] => {
  const scid: u8[] = fromHex(CLIENT_SCID);
  return qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
};

/** A fresh client that sent its first Initial to `listener` at `now` from `address`, and took the Retry it got. */
const lcRetriedClient = (listener: QuicListener, address: u8[], now: i64): QcClient => {
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const answer: QuicListenerAnswer = listener.handle(qcInitial(c, qcCrypto(n64(0), lcHello()), n32(1200)), address, now);
  const retry: QuicHeader = quicParseHeader(answer.reply, n32(0), n32(8));
  qcRetried(c, retry.scid, retry.token);
  return c;
};

/** The client's second Initial, the ClientHello again with its token. */
const lcSecondInitial = (c: QcClient): u8[] => qcInitial(c, qcCrypto(n64(0), lcHello()), n32(1200));

/** The configuration with its static keys and lifetime replaced, for the constructor's refusals. */
const lcWithKeys = (reset: u8[], token: u8[], lifetime: i64): QuicServerConfig => {
  const config: QuicServerConfig = lcConfig(true);
  config.statelessResetKey = reset;
  config.retryTokenKey = token;
  config.retryTokenLifetime = lifetime;
  return config;
};

/** Version Negotiation (RFC 9000 §5.2.2, §6.1, §17.2.1). */
const lcVersionChecks = (t: Suite): void => {
  const listener = new QuicListener(lcConfig(false), lcListenerEntropy());
  const dcid: u8[] = fromHex(CLIENT_ODCID);
  const scid: u8[] = fromHex(CLIENT_SCID);
  const a: QuicListenerAnswer = listener.handle(lcOtherVersion("6b3343cf", dcid, scid, n32(1200)), lcClientAddress(), QC_T0);
  t.eqStr("a 1200-byte datagram in version 2 gets Version Negotiation", lcKindName(a.kind), "version negotiation");
  const vn: u8[] = a.reply;
  t.ok("its first byte has the long-header and fixed bits set (§17.2.1)", toI32(vn.length) > 0 && (toI32(vn[0]) & 0xc0) === 0xc0);
  t.eqStr(
    "then version 0, the client's SCID as the DCID, its DCID as the SCID, and version 1 alone",
    toHex(lcTail(vn, toI32(vn.length) - 1)),
    `0000000008${CLIENT_SCID}08${CLIENT_ODCID}00000001`
  );
  const grease: QuicListenerAnswer = listener.handle(lcOtherVersion("1a2a3a4a", dcid, scid, n32(1500)), lcClientAddress(), QC_T0);
  t.eqStr("so does a reserved version (§6.3)", lcKindName(grease.kind), "version negotiation");
  const long: u8[] = new Array<u8>(30);
  const wide: QuicListenerAnswer = listener.handle(lcOtherVersion("6b3343cf", long, scid, n32(1200)), lcClientAddress(), QC_T0);
  t.ok(
    "a 30-byte DCID, too long for version 1, is echoed all the same: version 1's rules decide nothing here",
    wide.kind === a.kind && toI32(wide.reply.length) === toI32(vn.length) + 22
  );
  t.eqStr("a 1199-byte datagram is dropped (§5.2.2)", lcKindName(listener.handle(lcOtherVersion("6b3343cf", dcid, scid, n32(1199)), lcClientAddress(), QC_T0).kind), "drop");
  t.eqStr("and Version Negotiation is never answered with one (§6.1)", lcKindName(listener.handle(lcOtherVersion("00000000", dcid, scid, n32(1200)), lcClientAddress(), QC_T0).kind), "drop");
};

/** A Retry, then the connection the client's token opens (RFC 9000 §8.1.2, §7.3). */
const lcRetryChecks = (t: Suite): void => {
  const config: QuicServerConfig = lcConfig(true);
  config.certificateChain = [leafCertificate(), new Array<u8>(4000)];
  const listener = new QuicListener(config, lcListenerEntropy());
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const ch: u8[] = lcHello();
  const a: QuicListenerAnswer = listener.handle(qcInitial(c, qcCrypto(n64(0), ch), n32(1200)), lcClientAddress(), QC_T0);
  t.eqStr("with Retry on, a client's first Initial gets a Retry", lcKindName(a.kind), "retry");
  const retry: QuicHeader = quicParseHeader(a.reply, n32(0), n32(8));
  t.ok("which parses as one", retry.error === QUIC_PACKET_OK && retry.type === QUIC_PACKET_RETRY);
  t.ok("and whose integrity tag holds for the client's original DCID (RFC 9001 §5.8)", quicRetryVerify(fromHex(CLIENT_ODCID), a.reply, retry));
  t.eqStr("it goes to the client's SCID", toHex(retry.dcid), CLIENT_SCID);
  t.eqI32("from a new 8-byte ID", toI32(retry.scid.length), n32(8));
  t.eqI32("with a 34-byte token: a marker, the time, the original DCID and a 16-byte MAC", toI32(retry.token.length), n32(34));
  t.ok("far smaller than the 1200 bytes it answers", toI32(a.reply.length) < 120);

  qcRetried(c, retry.scid, retry.token);
  const second: u8[] = lcSecondInitial(c);
  const b: QuicListenerAnswer = listener.handle(second, lcClientAddress(), QC_T0 + n64(30));
  t.eqStr("the Initial that returns the token is accepted", lcKindName(b.kind), "accept");
  t.ok("as a retried connection, naming the original DCID and the Retry's SCID", b.retried && toHex(b.originalDcid) === CLIENT_ODCID && sameBytes(b.retryScid, retry.scid));

  const conn = new QuicConnection(config, fixedEntropy());
  t.ok("the connection takes them", conn.acceptRetry(b.originalDcid, b.retryScid));
  c.before = ch;
  qcExchange(conn, c, second);
  t.ok("the token validated the client's address, so the server is not held to three times what it received (§8.1)", conn.addressValidated);
  t.eqI32("and its whole flight leaves at once: five datagrams, where Q2a's unvalidated client got three", toI32(c.datagrams.length), n32(5));
  t.ok("the client accepts the flight", qcReadFlight(c, n32(0), n32(0)));
  qcExchange(conn, c, qcFinishedPacket(c));
  t.eqI32("and the handshake completes", conn.state, QUIC_STATE_CONNECTED);
  const p: QuicTransportParameters = serverParamsOf(c);
  t.eqStr("original_destination_connection_id is the DCID before the Retry (§7.3)", toHex(p.originalDcid), CLIENT_ODCID);
  t.ok("retry_source_connection_id is the Retry's SCID", p.hasRetryScid && sameBytes(p.retryScid, retry.scid));
  t.ok("and initial_source_connection_id the server's own", sameBytes(p.initialScid, c.serverScid));
  t.ok("a connection that has started takes no Retry", !conn.acceptRetry(b.originalDcid, b.retryScid));
  t.ok("nor does one handed an ID over 20 bytes", !new QuicConnection(config, fixedEntropy()).acceptRetry(new Array<u8>(21), b.retryScid));

  const off = new QuicListener(lcConfig(false), lcListenerEntropy());
  const plain = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const accepted: QuicListenerAnswer = off.handle(qcInitial(plain, qcCrypto(n64(0), ch), n32(1200)), lcClientAddress(), QC_T0);
  t.ok("with Retry off, a first Initial is accepted as it is", accepted.kind === b.kind && !accepted.retried);
  const later = lcRetriedClient(listener, lcClientAddress(), QC_T0);
  const fromRetry: QuicListenerAnswer = off.handle(lcSecondInitial(later), lcClientAddress(), QC_T0 + n64(60));
  t.ok("though a valid token still counts there", fromRetry.retried && toHex(fromRetry.originalDcid) === CLIENT_ODCID);
};

/** Whether `answer` is INVALID_TOKEN's Initial, which `c` opens and finds the close in. */
const lcInvalidTokenClose = (c: QcClient, answer: QuicListenerAnswer): string => {
  if (answer.kind !== QUIC_LISTEN_INVALID_TOKEN) {
    return lcKindName(answer.kind);
  }
  const header: QuicHeader = quicParseHeader(answer.reply, n32(0), n32(8));
  const fromRetryId: boolean = header.type === QUIC_PACKET_INITIAL && sameBytes(header.scid, c.odcid);
  c.longPayloads = [];
  qcReceive(c, answer.reply);
  return `${fromRetryId ? "from the Retry's ID" : "from elsewhere"}, ${lcCloseIn(c.longPayloads)}`;
};

/** Every way a token fails (RFC 9000 §8.1.2-§8.1.4), each closing the attempt with INVALID_TOKEN. */
const lcTokenChecks = (t: Suite): void => {
  const config: QuicServerConfig = lcConfig(true);
  const listener = new QuicListener(config, lcListenerEntropy());
  const invalid: string = `from the Retry's ID, ${QUIC_ERROR_INVALID_TOKEN} 0`;
  const lifetime: i64 = config.retryTokenLifetime;

  const late = lcRetriedClient(listener, lcClientAddress(), QC_T0);
  t.eqStr("a token returned just inside its lifetime is accepted", lcKindName(listener.handle(lcSecondInitial(late), lcClientAddress(), QC_T0 + lifetime - n64(1)).kind), "accept");
  const expired = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime);
  t.eqStr(
    "one returned a lifetime after it was issued is INVALID_TOKEN, in an Initial the client reads",
    lcInvalidTokenClose(expired, listener.handle(lcSecondInitial(expired), lcClientAddress(), QC_T0 + lifetime + lifetime)),
    invalid
  );
  const ahead = new QuicListener(config, lcListenerEntropy());
  const future = lcRetriedClient(ahead, lcClientAddress(), QC_T0 + lifetime + lifetime + n64(5000));
  const behind = new QuicListener(config, lcListenerEntropy());
  t.eqStr("one issued later than now, by a clock ahead of this one, is too", lcInvalidTokenClose(future, behind.handle(lcSecondInitial(future), lcClientAddress(), QC_T0)), invalid);

  const moved = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  t.eqStr("so is one returned from another address or port (§8.1.4)", lcInvalidTokenClose(moved, listener.handle(lcSecondInitial(moved), lcOtherAddress(), QC_T0 + lifetime + lifetime)), invalid);

  const forged = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  forged.token[33] = forged.token[33] ^ toU8(1);
  t.eqStr("one with a changed MAC byte", lcInvalidTokenClose(forged, listener.handle(lcSecondInitial(forged), lcClientAddress(), QC_T0 + lifetime + lifetime)), invalid);
  const backdated = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  backdated.token[8] = backdated.token[8] ^ toU8(1);
  t.eqStr("one with a changed time", lcInvalidTokenClose(backdated, listener.handle(lcSecondInitial(backdated), lcClientAddress(), QC_T0 + lifetime + lifetime)), invalid);
  const cut = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  cut.token = [cut.token[0], toU8(1), toU8(2)];
  t.eqStr("one cut short", lcInvalidTokenClose(cut, listener.handle(lcSecondInitial(cut), lcClientAddress(), QC_T0 + lifetime + lifetime)), invalid);
  const odd = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  odd.token[9] = toU8(30);
  t.eqStr("one whose DCID length runs past it", lcInvalidTokenClose(odd, listener.handle(lcSecondInitial(odd), lcClientAddress(), QC_T0 + lifetime + lifetime)), invalid);
  const elsewhere = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  qcRetried(elsewhere, fromHex("0909090909090909"), elsewhere.token);
  t.eqStr(
    "and one sent to an ID other than the Retry's, which the MAC binds",
    lcInvalidTokenClose(elsewhere, listener.handle(lcSecondInitial(elsewhere), lcClientAddress(), QC_T0 + lifetime + lifetime)),
    invalid
  );

  const noisy = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  noisy.token[33] = noisy.token[33] ^ toU8(1);
  const garbled: u8[] = lcSecondInitial(noisy);
  garbled[600] = garbled[600] ^ toU8(1);
  t.eqStr("an Initial that does not authenticate gets no close, only silence", lcKindName(listener.handle(garbled, lcClientAddress(), QC_T0 + lifetime + lifetime).kind), "drop");

  const foreign = lcRetriedClient(listener, lcClientAddress(), QC_T0 + lifetime + lifetime);
  foreign.token[0] = toU8(0);
  t.eqStr("a token without this server's marker, another server's, is no token: a Retry again (§8.1.3)", lcKindName(listener.handle(lcSecondInitial(foreign), lcClientAddress(), QC_T0 + lifetime + lifetime).kind), "retry");
  const off = new QuicListener(lcConfig(false), lcListenerEntropy());
  const foreignOff: QuicListenerAnswer = off.handle(lcSecondInitial(foreign), lcClientAddress(), QC_T0);
  t.ok("and, with Retry off, an unvalidated accept", foreignOff.kind === QUIC_LISTEN_ACCEPT && !foreignOff.retried);
};

/** What the listener drops, and the configurations it refuses. */
const lcDropChecks = (t: Suite): void => {
  const listener = new QuicListener(lcConfig(true), lcListenerEntropy());
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  t.eqStr("an Initial in a datagram under 1200 bytes is dropped (§14.1)", lcKindName(listener.handle(qcInitial(c, qcCrypto(n64(0), lcHello()), n32(0)), lcClientAddress(), QC_T0).kind), "drop");
  const short = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  short.odcid = fromHex("01020304050607");
  qcRetried(short, short.odcid, short.token);
  t.eqStr("so is one to a DCID under 8 bytes (§7.2)", lcKindName(listener.handle(qcInitial(short, qcCrypto(n64(0), lcHello()), n32(1200)), lcClientAddress(), QC_T0).kind), "drop");
  t.eqStr("and a datagram that does not parse", lcKindName(listener.handle(new Array<u8>(1200), lcClientAddress(), QC_T0).kind), "drop");
  const handshake: u8[] = fromHex(`e00000000108${CLIENT_ODCID}08${CLIENT_SCID}4016`);
  for (let k: i32 = 0; k < 22; k++) {
    handshake.push(toU8(0));
  }
  t.eqStr("and a Handshake packet no connection owns (§5.2.2)", lcKindName(listener.handle(handshake, lcClientAddress(), QC_T0).kind), "drop");

  const key: u8[] = resetKey();
  const refused: QuicServerConfig[] = [
    lcWithKeys(fromHex("01"), tokenKey(), n64(10000)),
    lcWithKeys(key, new Array<u8>(31), n64(10000)),
    lcWithKeys(key, tokenKey(), n64(0)),
    lcWithKeys(key, tokenKey(), n64(60001)),
  ];
  let allDrop: boolean = true;
  for (const config of refused) {
    const l = new QuicListener(config, lcListenerEntropy());
    allDrop = allDrop && l.handle(lcOtherVersion("6b3343cf", fromHex(CLIENT_ODCID), fromHex(CLIENT_SCID), n32(1200)), lcClientAddress(), QC_T0).kind === QUIC_LISTEN_DROP;
  }
  t.ok("a key of the wrong length, or a lifetime outside 1 to 60000 ms, makes a listener that drops everything", allDrop);
  const shortEntropy = new QuicListener(lcConfig(true), new Array<u8>(31));
  t.eqStr("so does entropy of the wrong length", lcKindName(shortEntropy.handle(lcOtherVersion("6b3343cf", fromHex(CLIENT_ODCID), fromHex(CLIENT_SCID), n32(1200)), lcClientAddress(), QC_T0).kind), "drop");
  const entropy: u8[] = lcListenerEntropy();
  new QuicListener(lcConfig(true), entropy);
  let wiped: boolean = true;
  for (const b of entropy) {
    wiped = wiped && toI32(b) === 0;
  }
  t.ok("the caller's entropy is wiped once it is copied", wiped);
};

/** The length of the reset `listener` answers an `n`-byte short-header datagram with, or "none". */
const lcResetSize = (listener: QuicListener, n: i32): string => {
  const r: QuicListenerAnswer = listener.handle(lcShortTo(fromHex("d0d1d2d3d4d5d6d7"), n), lcClientAddress(), QC_T0);
  return r.kind === QUIC_LISTEN_DROP ? "none" : `${toI32(r.reply.length)}`;
};

/** Whether `listener` answers a 100-byte short-header datagram at `now` with a reset. */
const lcResetAt = (listener: QuicListener, now: i64): boolean =>
  listener.handle(lcShortTo(fromHex("d0d1d2d3d4d5d6d7"), n32(100)), lcClientAddress(), now).kind === QUIC_LISTEN_STATELESS_RESET;

/** Stateless resets (RFC 9000 §10.3): the token, the size rules, and the rate limit. */
const lcResetChecks = (t: Suite): void => {
  const key: u8[] = resetKey();
  const direct: u8[] = hmacSha256(key, fromHex(CLIENT_ODCID));
  t.eqStr("a reset token is HMAC-SHA256 of the connection ID under the static key, cut to 16 bytes (§10.3.2)", toHex(quicStatelessResetToken(key, fromHex(CLIENT_ODCID))), toHex(direct).substring(0, 32));

  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  const p: QuicTransportParameters = serverParamsOf(c);
  t.ok("the server's transport parameters carry the token for its first ID (§18.2)", p.hasStatelessResetToken && sameBytes(p.statelessResetToken, quicStatelessResetToken(key, c.serverScid)));
  const issued: LcIssuedId[] = lcIssuedIds(c.appPayloads);
  let derived: boolean = toI32(issued.length) === 3;
  for (const id of issued) {
    derived = derived && sameBytes(id.token, quicStatelessResetToken(key, id.cid));
  }
  t.ok("and each NEW_CONNECTION_ID carries the token the static key gives its ID", derived);

  // The server loses the connection; the client's next packet reaches the listener.
  const listener = new QuicListener(qcDefaultConfig(), lcListenerEntropy());
  const lost: u8[] = qcShortTo(c, c.serverScid, qcCrypto(n64(0), fromHex("01")), n32(0));
  const a: QuicListenerAnswer = listener.handle(lost, lcClientAddress(), QC_T0);
  t.eqStr("a packet for a connection the server lost gets a stateless reset", lcKindName(a.kind), "stateless reset");
  t.ok("ending in the token the server gave for that ID", sameBytes(lcTail(a.reply, n32(16)), p.statelessResetToken));
  t.ok("shaped as a short header: 01 in the top bits", toI32(a.reply.length) > 0 && (toI32(a.reply[0]) & 0xc0) === 0x40);
  t.ok("and shorter than the packet it answers (§10.3.3)", toI32(a.reply.length) < toI32(lost.length));
  if (toI32(issued.length) > 0) {
    const toNew: QuicListenerAnswer = listener.handle(lcShortTo(issued[0].cid, n32(60)), lcClientAddress(), QC_T0);
    t.ok("one sent to a later ID ends in that ID's token", sameBytes(lcTail(toNew.reply, n32(16)), issued[0].token));
  }
  const again: QuicListenerAnswer = listener.handle(lost, lcClientAddress(), QC_T0);
  t.ok("the rest of a reset is unpredictable: the same packet twice gets different bytes, the same token", !sameBytes(again.reply, a.reply) && sameBytes(lcTail(again.reply, n32(16)), p.statelessResetToken));

  const sizes = new QuicListener(qcDefaultConfig(), lcListenerEntropy());
  t.eqStr("a 21-byte datagram gets none: a reset of 21 bytes or more would not be shorter (§10.3)", lcResetSize(sizes, n32(21)), "none");
  t.eqStr("22 bytes get 21, 30 get 29, 43 get 42: one byte shorter", `${lcResetSize(sizes, n32(22))} ${lcResetSize(sizes, n32(30))} ${lcResetSize(sizes, n32(43))}`, "21 29 42");
  t.eqStr("44 bytes get 43, the shortest past that", lcResetSize(sizes, n32(44)), "43");
  let ranged: boolean = true;
  for (let k: i32 = 0; k < 8; k++) {
    const r: QuicListenerAnswer = sizes.handle(lcShortTo(fromHex("d0d1d2d3d4d5d6d7"), n32(1300)), lcClientAddress(), QC_T0 + toI64(k) * n64(1000));
    ranged = ranged && toI32(r.reply.length) >= 43 && toI32(r.reply.length) <= 1200;
  }
  t.ok("a large datagram gets between 43 and 1200 bytes, never three times what came in", ranged);
  const longHeader: u8[] = qcInitial(new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID)), qcCrypto(n64(0), fromHex("01")), n32(0));
  t.eqStr("a long-header packet no connection owns gets no reset", lcKindName(sizes.handle(longHeader, lcClientAddress(), QC_T0).kind), "drop");

  const limited = new QuicListener(qcDefaultConfig(), lcListenerEntropy());
  let burst: i32 = 0;
  for (let k: i32 = 0; k < 20; k++) {
    burst = burst + (lcResetAt(limited, QC_T0) ? 1 : 0);
  }
  t.eqI32("at once, the burst of resets goes out and the rest are held back", burst, QUIC_LISTENER_RESET_BURST);
  t.eqI32("each one counted", limited.resetsLimited, n32(4));
  t.ok("99 ms later there is still none", !lcResetAt(limited, QC_T0 + n64(99)));
  t.ok("100 ms later there is one", lcResetAt(limited, QC_T0 + n64(100)) && !lcResetAt(limited, QC_T0 + n64(100)));
  let refilled: i32 = 0;
  for (let k: i32 = 0; k < 20; k++) {
    refilled = refilled + (lcResetAt(limited, QC_T0 + n64(60000)) ? 1 : 0);
  }
  t.eqI32("and a quiet minute fills the budget again, no further", refilled, QUIC_LISTENER_RESET_BURST);
  t.eqI32("so many have gone in all", limited.resetsSent, QUIC_LISTENER_RESET_BURST + QUIC_LISTENER_RESET_BURST + n32(1));
};

/** Every listener check. */
export const listenerChecks = (t: Suite): void => {
  lcVersionChecks(t);
  lcRetryChecks(t);
  lcTokenChecks(t);
  lcDropChecks(t);
  lcResetChecks(t);
};
