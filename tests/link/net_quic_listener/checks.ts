// The checks of `nish/net/quic-listener`'s window form, run by `main.ts` in
// the default number mode and by `tests/link/net_quic_listener_f64` under
// `--number-mode f64`. `handleWindow` reads a datagram where it lies, inside
// a larger buffer, and answers into one `QuicListenerAnswer` made once: it
// answers exactly what `handle` answers for the same datagram on its own,
// byte for byte, and a thousand datagrams of each kind leave the arena's
// mark where it was (H3-3). The refusals themselves are
// `tests/link/net_quic_lifecycle`'s, through `handle`, which is this form
// over a whole array.
import { Suite } from "nish/testing";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QuicHeader, quicParseHeader } from "nish/net/quic-packet";
import {
  QUIC_LISTEN_ACCEPT,
  QUIC_LISTEN_DROP,
  QUIC_LISTEN_INVALID_TOKEN,
  QUIC_LISTEN_RETRY,
  QUIC_LISTEN_STATELESS_RESET,
  QUIC_LISTEN_VERSION_NEGOTIATION,
  QUIC_LISTENER_ANSWER_SIZE,
  QuicListener,
  QuicListenerAnswer,
} from "nish/net/quic-listener";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex, sameBytes } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { CLIENT_SCID, QC_T0, QcClient, qcCrypto, qcHello, qcInitial, qcParams, qcRetried } from "../net_quic_conn/client";
import { lcClientAddress, lcConfig, lcKindName, lcListenerEntropy, lcOtherVersion, lcShortTo } from "../net_quic_lifecycle/common";

/** Where each datagram is put in the larger buffer `handleWindow` reads. */
const AT: i32 = 37;

/** The client's ClientHello, with its transport parameters. */
const qlHello = (): u8[] => {
  const scid: u8[] = fromHex(CLIENT_SCID);
  return qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
};

/** A buffer of `d` at `AT`, with 0xaa before it and after it, which the listener must not read. */
const qlFramed = (d: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(AT + toI32(d.length) + 64);
  for (let k: i32 = 0; k < toI32(out.length); k++) {
    out[k] = toU8(0xaa);
  }
  for (let k: i32 = 0; k < toI32(d.length); k++) {
    out[AT + k] = d[k];
  }
  return out;
};

/**
 * Two listeners made alike, which answer the same datagrams in the same
 * order: `whole` with `handle`, `window` with `handleWindow` into `answer`.
 */
class QlPair {
  whole: QuicListener;
  window: QuicListener;
  answer: QuicListenerAnswer;
  /** What `whole` answered last. */
  last: QuicListenerAnswer;

  constructor(retry: boolean) {
    this.whole = new QuicListener(lcConfig(retry), lcListenerEntropy());
    this.window = new QuicListener(lcConfig(retry), lcListenerEntropy());
    this.answer = new QuicListenerAnswer(QUIC_LISTENER_ANSWER_SIZE);
    this.last = new QuicListenerAnswer(n32(0));
  }

  /** Hands `d` to both at `now`; answers whether the two answers are the same, every field and byte. */
  same(d: u8[], now: i64): boolean {
    this.last = this.whole.handle(d, lcClientAddress(), now);
    const kind: i32 = this.window.handleWindow(qlFramed(d), AT, toI32(d.length), lcClientAddress(), now, this.answer);
    const a: QuicListenerAnswer = this.answer;
    const b: QuicListenerAnswer = this.last;
    return (
      kind === a.kind &&
      a.kind === b.kind &&
      a.retried === b.retried &&
      sameBytes(a.reply, b.reply) &&
      sameBytes(a.originalDcid, b.originalDcid) &&
      sameBytes(a.retryScid, b.retryScid)
    );
  }
}

/** Every kind of answer, from a window, the same as from the whole datagram. */
const qlSame = (t: Suite): void => {
  const p = new QlPair(true);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  t.ok("a Version Negotiation, from a window, is the whole datagram's", p.same(lcOtherVersion("6b3343cf", c.odcid, c.scid, n32(1200)), QC_T0) && p.answer.kind === QUIC_LISTEN_VERSION_NEGOTIATION);
  t.ok("a stateless reset of 99 bytes and more", p.same(lcShortTo(fromHex("d0d1d2d3d4d5d6d7"), n32(100)), QC_T0) && p.answer.kind === QUIC_LISTEN_STATELESS_RESET && toI32(p.answer.reply.length) >= n32(43));
  t.ok("then one of 29 bytes, in the same answer's room", p.same(lcShortTo(fromHex("d0d1d2d3d4d5d6d7"), n32(30)), QC_T0) && toI32(p.answer.reply.length) === n32(29));
  t.ok("a Retry", p.same(qcInitial(c, qcCrypto(n64(0), qlHello()), n32(1200)), QC_T0) && p.answer.kind === QUIC_LISTEN_RETRY);
  const retry: QuicHeader = quicParseHeader(p.last.reply, n32(0), n32(8));
  qcRetried(c, retry.scid, retry.token);
  t.ok("the Initial carrying its token: accepted as retried, with the same original DCID and Retry SCID", p.same(qcInitial(c, qcCrypto(n64(0), qlHello()), n32(1200)), QC_T0 + n64(30)) && p.answer.kind === QUIC_LISTEN_ACCEPT && p.answer.retried && sameBytes(p.answer.originalDcid, fromHex("0001020304050607")) && sameBytes(p.answer.retryScid, retry.scid));
  const forged = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  p.same(qcInitial(forged, qcCrypto(n64(0), qlHello()), n32(1200)), QC_T0);
  const again: QuicHeader = quicParseHeader(p.last.reply, n32(0), n32(8));
  qcRetried(forged, again.scid, again.token);
  forged.token[33] = forged.token[33] ^ toU8(1);
  t.ok("an Initial whose token's MAC is changed: the same INVALID_TOKEN close", p.same(qcInitial(forged, qcCrypto(n64(0), qlHello()), n32(1200)), QC_T0) && p.answer.kind === QUIC_LISTEN_INVALID_TOKEN);
  t.ok("a datagram that does not parse: dropped, and the answer emptied", p.same(new Array<u8>(1200), QC_T0) && p.answer.kind === QUIC_LISTEN_DROP && toI32(p.answer.reply.length) === n32(0));
  const off = new QlPair(false);
  const plain = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  t.ok("with Retry off, an Initial accepted unvalidated", off.same(qcInitial(plain, qcCrypto(n64(0), qlHello()), n32(1200)), QC_T0) && off.answer.kind === QUIC_LISTEN_ACCEPT && !off.answer.retried);
};

/** How far `count` calls of `handleWindow` on `buf[AT ..)`, `len` bytes, move `Arena.mark()`, the clock moving `step` a call. */
const qlMoved = (l: QuicListener, buf: u8[], len: i32, answer: QuicListenerAnswer, count: i32, now: i64, step: i64): i64 => {
  const address: u8[] = lcClientAddress();
  const before: i64 = Arena.mark();
  for (let k: i32 = 0; k < count; k++) {
    l.handleWindow(buf, AT, len, address, now + toI64(k) * step, answer);
  }
  return Arena.mark() - before;
};

/** The same with `handle`, which makes an answer each time: what the window form saves. */
const qlMovedWhole = (l: QuicListener, d: u8[], count: i32, now: i64): i64 => {
  const address: u8[] = lcClientAddress();
  const kept: QuicListenerAnswer[] = [];
  const before: i64 = Arena.mark();
  for (let k: i32 = 0; k < count; k++) {
    kept.push(l.handle(d, address, now));
  }
  return toI32(kept.length) === count ? Arena.mark() - before : n64(-1);
};

/** A thousand datagrams of each kind through one answer: the arena's mark never moves. */
const qlArena = (t: Suite): void => {
  const l = new QuicListener(lcConfig(true), lcListenerEntropy());
  const answer = new QuicListenerAnswer(QUIC_LISTENER_ANSWER_SIZE);
  const n: i32 = n32(1000);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const vn: u8[] = qlFramed(lcOtherVersion("6b3343cf", c.odcid, c.scid, n32(1200)));
  const reset: u8[] = qlFramed(lcShortTo(fromHex("d0d1d2d3d4d5d6d7"), n32(1300)));
  const first: u8[] = qcInitial(c, qcCrypto(n64(0), qlHello()), n32(1200));
  const initial: u8[] = qlFramed(first);
  const garbage: u8[] = qlFramed(new Array<u8>(1200));
  // Warm: the first of each fills what the listener made once.
  l.handleWindow(initial, AT, n32(1200), lcClientAddress(), QC_T0, answer);
  const retry: QuicHeader = quicParseHeader(answer.reply, n32(0), n32(8));
  qcRetried(c, retry.scid, retry.token);
  const second: u8[] = qcInitial(c, qcCrypto(n64(0), qlHello()), n32(1200));
  const accepted: u8[] = qlFramed(second);
  c.token[33] = c.token[33] ^ toU8(1);
  const third: u8[] = qcInitial(c, qcCrypto(n64(0), qlHello()), n32(1200));
  const forged: u8[] = qlFramed(third);
  const forgedKind: i32 = l.handleWindow(forged, AT, toI32(third.length), lcClientAddress(), QC_T0, answer);
  const acceptedKind: i32 = l.handleWindow(accepted, AT, toI32(second.length), lcClientAddress(), QC_T0, answer);
  t.eqStr("the Initial with its token is accepted, the one with a byte of it changed is INVALID_TOKEN", `${lcKindName(acceptedKind)}, ${lcKindName(forgedKind)}`, "accept, invalid token");
  t.eqI64("a thousand Version Negotiations: the arena's mark never moves", qlMoved(l, vn, n32(1200), answer, n, QC_T0, n64(0)), n64(0));
  const sent: i32 = l.resetsSent;
  t.eqI64("a thousand stateless resets, each earned by 100 ms", qlMoved(l, reset, n32(1300), answer, n, QC_T0, n64(100)), n64(0));
  t.ok("all of them sent", l.resetsSent - sent === n);
  const limited: i32 = l.resetsLimited;
  t.eqI64("a thousand more with the clock still, past the rate limit", qlMoved(l, reset, n32(1300), answer, n, QC_T0 + n64(100000), n64(0)), n64(0));
  t.ok("at most sixteen of them sent", l.resetsLimited - limited >= n - n32(16));
  t.eqI64("a thousand Retries", qlMoved(l, initial, n32(1200), answer, n, QC_T0, n64(0)), n64(0));
  t.eqI64("a thousand Initials carrying a valid token, accepted", qlMoved(l, accepted, toI32(second.length), answer, n, QC_T0, n64(0)), n64(0));
  t.eqI64("a thousand carrying a forged one, each answered with INVALID_TOKEN", qlMoved(l, forged, toI32(third.length), answer, n, QC_T0, n64(0)), n64(0));
  t.eqI64("and a thousand that do not parse", qlMoved(l, garbage, n32(1200), answer, n, QC_T0, n64(0)), n64(0));
  t.ok("where a thousand through `handle`, which makes each answer, move it", qlMovedWhole(l, first, n, QC_T0) > n64(0));
};

/** Every check, in one suite. */
export const listenerChecks = (): i32 => {
  const t = new Suite("quic listener");
  qlSame(t);
  qlArena(t);
  return t.done();
};
