// The checks of `nish/net/quic`'s paths (RFC 9000 §8.2, §9), run by
// `main.ts` in the default number mode and by `tests/link/net_quic_path_f64`
// under `--number-mode f64`: a client whose NAT rebinds its port or its
// address mid-connection, validated with PATH_CHALLENGE and PATH_RESPONSE,
// and everything a forged source might try instead. Each rule has a case
// where it holds and one where it does not.
import { Suite } from "nish/testing";
import { QUIC_FRAME_PATH_CHALLENGE, QUIC_FRAME_PATH_RESPONSE, QUIC_FRAME_PING, quicPushPathData } from "nish/net/quic-frame";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_STATE_CONNECTED, QuicConnection } from "nish/net/quic";
import { QUIC_RECOVERY_ECN_FAILED, QUIC_RECOVERY_ECN_TESTING, QUIC_RECOVERY_INITIAL_RTT, QUIC_RECOVERY_INITIAL_WINDOW } from "nish/net/quic-recovery";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import {
  CLIENT_SCID,
  QcClient,
  qcConnect,
  qcDrain,
  qcExchange,
  qcFinishedPacket,
  qcHello,
  qcParams,
  qcPushAppAck,
  qcReadFlight,
  qcReceive,
  qcSendHello,
  qcShort,
} from "../net_quic_conn/client";
import { QcFound, qcConnected, qcData, qcDefaultConfig, qcFind, qcServer } from "../net_quic_conn/common";
import { qcStream } from "../net_quic_conn/data";

/** `::ffff:10.0.0.<host>` port `port`, in `nish:net`'s 18-byte form. */
const pAddr = (host: i32, port: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 18; k++) {
    out.push(toU8(0));
  }
  out[10] = toU8(255);
  out[11] = toU8(255);
  out[12] = toU8(10);
  out[15] = toU8(host);
  out[16] = toU8((port >> 8) & 255);
  out[17] = toU8(port & 255);
  return out;
};

/** Where the client starts. */
const pHome = (): u8[] => pAddr(n32(1), n32(4433));

/** A connection and its client, connected from `pHome()`. */
class PPair {
  conn: QuicConnection;
  c: QcClient;

  constructor(conn: QuicConnection, c: QcClient) {
    this.conn = conn;
    this.c = c;
  }
}

/** A fresh client, its datagrams from `pHome()`. */
const pClient = (): QcClient => {
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  c.address = pHome();
  return c;
};

/** The client's ClientHello. */
const pHello = (c: QcClient): u8[] =>
  qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(c.scid, n64(65536))));

/** A connection whose handshake came from `pHome()`, and stream 0 open. */
const pPair = (): PPair => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = pClient();
  qcConnect(conn, c, pHello(c));
  qcExchange(conn, c, qcShort(c, qcStream(n64(0), n64(0), "hi", false)));
  return new PPair(conn, c);
};

/** `frames`, then PADDING to `size` bytes. */
const pPadded = (frames: u8[], size: i32): u8[] => {
  const out: u8[] = [];
  for (const b of frames) {
    out.push(b);
  }
  while (toI32(out.length) < size) {
    out.push(toU8(0));
  }
  return out;
};

/** An ACK of what the client holds, a PING, and padding to a 1200-byte datagram. */
const pPing = (c: QcClient): u8[] => {
  const frames: u8[] = [];
  qcPushAppAck(frames, c);
  frames.push(toU8(QUIC_FRAME_PING));
  return pPadded(frames, n32(1171));
};

/** A PING alone, unpadded: the smallest non-probing packet. */
const pBarePing = (): u8[] => {
  const frames: u8[] = [];
  frames.push(toU8(QUIC_FRAME_PING));
  return frames;
};

/** A frame of `type` with `data`. */
const pPathFrame = (type: i32, data: u8[]): u8[] => {
  const out: u8[] = [];
  quicPushPathData(out, type, data, n32(0));
  return out;
};

/** The client sends `payload` in a 1-RTT packet from `address`, and reads every answer. */
const pFrom = (p: PPair, address: u8[], payload: u8[]): i32 => {
  p.c.address = address;
  return qcExchange(p.conn, p.c, qcShort(p.c, payload));
};

/** The client sends `datagram` from `address`, and reads every answer. */
const pDeliver = (p: PPair, address: u8[], datagram: u8[]): i32 => {
  p.c.address = address;
  return qcExchange(p.conn, p.c, datagram);
};

/** The data of the newest PATH_CHALLENGE the client has read, or none. */
const pLastChallenge = (c: QcClient): u8[] => {
  for (let k: i32 = toI32(c.appPayloads.length) - 1; k >= 0; k--) {
    const f: QcFound = qcFind([c.appPayloads[k]], QUIC_FRAME_PATH_CHALLENGE);
    if (f.found) {
      return qcData(f);
    }
  }
  const none: u8[] = [];
  return none;
};

/** The length of the last datagram the server sent. */
const pLastLength = (c: QcClient): i32 => {
  const n: i32 = toI32(c.datagrams.length);
  return n > 0 ? toI32(c.datagrams[n - 1].length) : n32(0);
};

/** The bytes of every datagram from index `from` on. */
const pSentSince = (c: QcClient, from: i32): i64 => {
  let total: i64 = 0;
  for (let k: i32 = from; k < toI32(c.datagrams.length); k++) {
    total = total + toI64(c.datagrams[k].length);
  }
  return total;
};

/** Whether the server sends to `address` now. */
const pSendsTo = (conn: QuicConnection, address: u8[]): boolean => toHex(conn.sendAddress()) === toHex(address);

/** The client answers the newest challenge from `address`. */
const pAnswer = (p: PPair, address: u8[]): void => {
  pFrom(p, address, pPadded(pPathFrame(QUIC_FRAME_PATH_RESPONSE, pLastChallenge(p.c)), n32(1171)));
};

/** Recovery state no new path would start from, to see whether it is kept. */
const pMarkRecovery = (conn: QuicConnection): void => {
  conn.recovery.congestionWindow = 99999;
  conn.recovery.smoothedRtt = 7;
  conn.recovery.ecnState = QUIC_RECOVERY_ECN_FAILED;
};

/** The handshake's address, and a carrier that passes none. */
const homeChecks = (t: Suite): void => {
  const p: PPair = pPair();
  t.ok("the handshake's address is where the connection sends", pSendsTo(p.conn, pHome()) && p.conn.pathKnown);
  t.ok("validated by the handshake, so nothing is being validated", toHex(p.conn.pathValidated) === toHex(pHome()) && !p.conn.pathValidating);
  pFrom(p, pHome(), pPing(p.c));
  t.ok("a packet from the same address moves nothing and challenges nothing", pSendsTo(p.conn, pHome()) && p.conn.challengesDrawn === n64(0));
  const bare: QuicConnection = qcServer(qcDefaultConfig());
  qcConnected(bare, n64(65536));
  t.ok("a connection fed by receiveWindow knows no address, and follows none", !bare.pathKnown && toHex(bare.sendAddress()) === toHex(new Array<u8>(18)));
};

/** A NAT rebinding the client's port: followed, validated, recovery kept. */
const portChecks = (t: Suite): void => {
  const p: PPair = pPair();
  pMarkRecovery(p.conn);
  const rebound: u8[] = pAddr(n32(1), n32(50000));
  pFrom(p, rebound, pPing(p.c));
  t.ok("after the client's port changes, the server sends to the new port", pSendsTo(p.conn, rebound));
  t.ok("and validates it", p.conn.pathValidating && p.conn.challengesDrawn === n64(1));
  t.eqI32("with a PATH_CHALLENGE of eight bytes", toI32(pLastChallenge(p.c).length), n32(8));
  t.eqI32("in a datagram padded to 1200 bytes (§8.2.1)", pLastLength(p.c), n32(1200));
  t.ok("the last validated address is still the first", toHex(p.conn.pathValidated) === toHex(pHome()));
  pAnswer(p, rebound);
  t.ok("the PATH_RESPONSE validates the new port", !p.conn.pathValidating && toHex(p.conn.pathValidated) === toHex(rebound));
  t.ok(
    "a port-only change keeps the congestion window and the RTT estimate (§9.4)",
    p.conn.recovery.congestionWindow === n64(99999) && p.conn.recovery.smoothedRtt === n64(7)
  );
  t.eqI32("but tests ECN again (§13.4.2)", p.conn.recovery.ecnState, QUIC_RECOVERY_ECN_TESTING);
  t.ok("and the connection carries on there", p.conn.state === QUIC_STATE_CONNECTED && pSendsTo(p.conn, rebound));
};

/** A new address: followed, validated, and congestion control starts again. */
const addressChecks = (t: Suite): void => {
  const p: PPair = pPair();
  pMarkRecovery(p.conn);
  const moved: u8[] = pAddr(n32(2), n32(4433));
  pFrom(p, moved, pPing(p.c));
  t.ok("a new address is followed and challenged", pSendsTo(p.conn, moved) && p.conn.pathValidating);
  t.ok("nothing is reset before the path is validated", p.conn.recovery.congestionWindow === n64(99999));
  pAnswer(p, moved);
  t.ok("validated, a new address", !p.conn.pathValidating && toHex(p.conn.pathValidated) === toHex(moved));
  t.ok(
    "starts the congestion window and the RTT estimate again (§9.4)",
    p.conn.recovery.congestionWindow === QUIC_RECOVERY_INITIAL_WINDOW && p.conn.recovery.smoothedRtt === QUIC_RECOVERY_INITIAL_RTT
  );
  t.eqI32("and ECN's test", p.conn.recovery.ecnState, QUIC_RECOVERY_ECN_TESTING);
  t.ok("stream data still flows, to the new address", pFrom(p, moved, qcStream(n64(0), n64(2), "!", false)) > 0 && pSendsTo(p.conn, moved));
};

/** PATH_RESPONSE: any path, the right data, the last three challenges. */
const responseChecks = (t: Suite): void => {
  const p: PPair = pPair();
  const moved: u8[] = pAddr(n32(2), n32(4433));
  pFrom(p, moved, pPing(p.c));
  pFrom(p, moved, pPadded(pPathFrame(QUIC_FRAME_PATH_RESPONSE, fromHex("0000000000000000")), n32(1171)));
  t.ok("a PATH_RESPONSE with other data validates nothing", p.conn.pathValidating && p.conn.state === QUIC_STATE_CONNECTED);
  t.ok("and closes nothing: it may be late (§8.2.3)", p.conn.error === n64(0));
  pAnswer(p, pHome());
  t.ok("the right one is accepted on any path, here the old one", !p.conn.pathValidating && toHex(p.conn.pathValidated) === toHex(moved));
  t.ok("and arriving there, probing only, moves nothing back", pSendsTo(p.conn, moved));

  const r: PPair = pPair();
  pFrom(r, moved, pPing(r.c));
  const first: u8[] = pLastChallenge(r.c);
  r.c.now = r.conn.challengeResendAt;
  r.conn.handleTimer(r.c.now);
  pFrom(r, moved, pPing(r.c));
  const second: u8[] = pLastChallenge(r.c);
  t.ok("a probe timeout later the challenge goes again", r.conn.challengesDrawn === n64(2) && r.conn.pathValidating);
  t.ok("with fresh data (§8.2.1)", toI32(second.length) === 8 && toHex(second) !== toHex(first));
  pFrom(r, moved, pPadded(pPathFrame(QUIC_FRAME_PATH_RESPONSE, first), n32(1171)));
  t.ok("an answer to the earlier one still validates the path", !r.conn.pathValidating && toHex(r.conn.pathValidated) === toHex(moved));

  const s: PPair = pPair();
  pFrom(s, moved, pPing(s.c));
  const oldest: u8[] = pLastChallenge(s.c);
  while (s.conn.pathValidating && s.conn.challengesDrawn < n64(4)) {
    s.c.now = s.conn.challengeResendAt;
    s.conn.handleTimer(s.c.now);
    pFrom(s, moved, pPing(s.c));
  }
  t.ok("four challenges fit in the validation period", s.conn.pathValidating && s.conn.challengesDrawn === n64(4));
  pFrom(s, moved, pPadded(pPathFrame(QUIC_FRAME_PATH_RESPONSE, oldest), n32(1171)));
  t.ok("past the last three, an answer to the first validates nothing", s.conn.pathValidating && s.conn.error === n64(0));
  pAnswer(s, moved);
  t.ok("an answer to the newest does", !s.conn.pathValidating);
};

/** A forged source: limited, timed out, and taken back by the client's next packet. */
const forgedChecks = (t: Suite): void => {
  const p: PPair = pPair();
  const forger: u8[] = pAddr(n32(66), n32(6666));
  const copy: u8[] = qcShort(p.c, pBarePing());
  const from: i32 = toI32(p.c.datagrams.length);
  pDeliver(p, forger, copy);
  t.ok("a copy of the client's packet from a forged source moves the connection there", pSendsTo(p.conn, forger) && p.conn.pathValidating);
  t.ok(
    "but sends there at most three times what came from it (§9.3.1)",
    pSentSince(p.c, from) <= toI64(copy.length) * n64(3) && pSentSince(p.c, from) > n64(0)
  );
  p.conn.writeStream(n64(0), new Array<u8>(3000), false);
  qcDrain(p.conn, p.c);
  t.ok("and no stream data written then goes past the limit", pSentSince(p.c, from) <= toI64(copy.length) * n64(3));
  t.ok("the path's count agrees", p.conn.pathSent <= p.conn.pathReceived * n64(3));
  pDeliver(p, pHome(), copy);
  t.ok("the real packet, arriving second, is a duplicate and moves nothing", pSendsTo(p.conn, forger));
  pFrom(p, pHome(), pPing(p.c));
  t.ok("the client's next packet takes the connection back at once (§9.3.3)", pSendsTo(p.conn, pHome()) && !p.conn.pathValidating);
  qcDrain(p.conn, p.c);
  t.ok("so the stream data held back goes out, to the client", pSentSince(p.c, from) > n64(3000) && p.conn.state === QUIC_STATE_CONNECTED);

  const q: PPair = pPair();
  const start: i64 = q.c.now;
  pFrom(q, forger, pPing(q.c));
  const until: i64 = q.conn.challengeUntil;
  t.ok("a validation lasts at least max(3 PTO, 6 kInitialRtt) (§8.2.4)", until - start >= n64(1998) && until - start >= q.conn.recovery.probeTimeout() * n64(3));
  q.c.now = until - n64(1);
  q.conn.handleTimer(q.c.now);
  t.ok("just before it ends, the new path is still being validated", q.conn.pathValidating && pSendsTo(q.conn, forger));
  q.c.now = until;
  q.conn.handleTimer(q.c.now);
  t.ok("unanswered, it fails, and the connection goes back to the last validated address", !q.conn.pathValidating && pSendsTo(q.conn, pHome()));
  t.ok("still connected", q.conn.state === QUIC_STATE_CONNECTED);

  const r: PPair = pPair();
  const sent: u8[] = qcShort(r.c, pPing(r.c));
  pDeliver(r, pHome(), sent);
  pDeliver(r, forger, sent);
  t.ok("a replay of a packet already read, from elsewhere, is dropped and moves nothing", pSendsTo(r.conn, pHome()) && !r.conn.pathValidating);
};

/** The packet that moves a connection is the newest non-probing one. */
const orderChecks = (t: Suite): void => {
  const p: PPair = pPair();
  const moved: u8[] = pAddr(n32(2), n32(4433));
  const older: u8[] = qcShort(p.c, pPing(p.c));
  const newer: u8[] = qcShort(p.c, pPing(p.c));
  pDeliver(p, moved, newer);
  pAnswer(p, moved);
  pDeliver(p, pHome(), older);
  t.ok("a late packet from the old address, numbered below the newest, does not move it back", pSendsTo(p.conn, moved) && !p.conn.pathValidating);
  pFrom(p, pHome(), pPing(p.c));
  t.ok("a newer one does, and is validated again", pSendsTo(p.conn, pHome()) && p.conn.pathValidating);
};

/** Before the handshake is confirmed, another address's datagram is dropped. */
const handshakeChecks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = pClient();
  const from: i32 = qcSendHello(conn, c, pHello(c), n64(0), pHello(c));
  qcReadFlight(c, from, n32(0));
  const dropped: i32 = conn.dropped;
  c.address = pAddr(n32(2), n32(4433));
  qcExchange(conn, c, qcFinishedPacket(c));
  t.ok("a client Finished from another address mid-handshake is dropped unread", !conn.handshakeComplete && conn.dropped === dropped + 1);
  t.ok("and moves nothing", toHex(conn.sendAddress()) === toHex(pHome()));
  c.address = pHome();
  qcExchange(conn, c, qcFinishedPacket(c));
  t.ok("from the handshake's address it completes the handshake", conn.handshakeComplete && pSendsTo(conn, pHome()));
};

/** A packet of probing frames only moves nothing: its challenge is answered on its own path. */
const probeChecks = (t: Suite): void => {
  const p: PPair = pPair();
  const probe: u8[] = pAddr(n32(3), n32(9999));
  pFrom(p, probe, pPadded(pPathFrame(QUIC_FRAME_PATH_CHALLENGE, fromHex("0123456789abcdef")), n32(1171)));
  t.ok("a probing packet from another address moves nothing", pSendsTo(p.conn, pHome()) && !p.conn.pathValidating);
  t.ok("its challenge is owed on its own path", p.conn.probeOwed && toHex(p.conn.probeAddress) === toHex(probe));
  const out: u8[] = new Array<u8>(1500);
  const n: i32 = p.conn.takeProbeInto(out, n32(0), p.c.now);
  t.eqI32("answered alone in a datagram padded to 1200 bytes", n, n32(1200));
  const datagram: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    datagram.push(out[k]);
  }
  qcReceive(p.c, datagram);
  const response: QcFound = qcFind([p.c.appPayloads[toI32(p.c.appPayloads.length) - 1]], QUIC_FRAME_PATH_RESPONSE);
  t.ok("with a PATH_RESPONSE of the same eight bytes", response.found && toHex(qcData(response)) === "0123456789abcdef");
  t.eqI32("and once (§13.3)", p.conn.takeProbeInto(out, n32(0), p.c.now), n32(0));

  const small: u8[] = qcShort(p.c, pPathFrame(QUIC_FRAME_PATH_CHALLENGE, fromHex("1111111111111111")));
  pDeliver(p, probe, small);
  const m: i32 = p.conn.takeProbeInto(out, n32(0), p.c.now);
  t.ok("a small probe's answer stays within three times its size (§8.1)", m > 0 && m <= toI32(small.length) * 3);

  const q: PPair = pPair();
  const both: u8[] = pPathFrame(QUIC_FRAME_PATH_CHALLENGE, fromHex("2222222222222222"));
  both.push(toU8(QUIC_FRAME_PING));
  pFrom(q, probe, pPadded(both, n32(1171)));
  const answer: QcFound = qcFind([q.c.appPayloads[toI32(q.c.appPayloads.length) - 1]], QUIC_FRAME_PATH_RESPONSE);
  t.ok("a challenge in a packet that moved the connection is answered on the new path", pSendsTo(q.conn, probe) && answer.found && !q.conn.probeOwed);
  t.ok("with its data", toHex(qcData(answer)) === "2222222222222222");
};

/** Repeated rebinds keep no arena memory once warm. */
const arenaChecks = (t: Suite): void => {
  const p: PPair = pPair();
  const out: u8[] = new Array<u8>(1500);
  let kept: i64 = 0;
  for (let k: i32 = 0; k < 60; k++) {
    const address: u8[] = pAddr(n32(2) + (k % n32(2)), n32(1000) + k);
    for (let step: i32 = 0; step < 2; step++) {
      const payload: u8[] = step === 0 ? pPing(p.c) : pPadded(pPathFrame(QUIC_FRAME_PATH_RESPONSE, pLastChallenge(p.c)), n32(1171));
      const datagram: u8[] = qcShort(p.c, payload);
      const before: i64 = Arena.used();
      p.conn.receiveWindowFrom(datagram, n32(0), toI32(datagram.length), address, p.c.now);
      let n: i32 = p.conn.takeDatagramInto(out, n32(0), p.c.now);
      const took: i64 = Arena.used() - before;
      if (k >= 10) {
        kept = kept + took;
      }
      while (n > 0) {
        const copy: u8[] = [];
        for (let j: i32 = 0; j < n; j++) {
          copy.push(out[j]);
        }
        qcReceive(p.c, copy);
        const again: i64 = Arena.used();
        n = p.conn.takeDatagramInto(out, n32(0), p.c.now);
        if (k >= 10) {
          kept = kept + (Arena.used() - again);
        }
      }
    }
  }
  t.ok("fifty rebinds, each challenged and answered, keep no arena memory", kept === n64(0) && !p.conn.pathValidating);
  t.ok("and the connection follows the last", pSendsTo(p.conn, pAddr(n32(3), n32(1059))));
};

/**
 * A window full when the client moves: the first datagram to the new path
 * still carries the PATH_CHALLENGE, as the interop runner's rebinding cases
 * ask, where before it was an ACK alone.
 */
const windowChecks = (t: Suite): void => {
  const p: PPair = pPair();
  p.conn.recovery.congestionWindow = 0;
  const from: i32 = toI32(p.c.appPayloads.length);
  const rebound: u8[] = pAddr(n32(1), n32(50001));
  pFrom(p, rebound, pPing(p.c));
  t.ok("a closed congestion window still lets the move's datagram go", toI32(p.c.appPayloads.length) > from);
  const first: QcFound = qcFind([p.c.appPayloads[from]], QUIC_FRAME_PATH_CHALLENGE);
  t.ok("and the first packet on the new path carries the PATH_CHALLENGE", first.found && pSendsTo(p.conn, rebound));
  pAnswer(p, rebound);
  t.ok("which the client's answer validates, the window still closed", !p.conn.pathValidating && toHex(p.conn.pathValidated) === toHex(rebound));
};

/** Runs every check and answers the exit code. */
export const quicPathChecks = (): i32 => {
  const t = new Suite("quic paths");
  homeChecks(t);
  portChecks(t);
  windowChecks(t);
  addressChecks(t);
  responseChecks(t);
  forgedChecks(t);
  orderChecks(t);
  handshakeChecks(t);
  probeChecks(t);
  arenaChecks(t);
  return t.done();
};
