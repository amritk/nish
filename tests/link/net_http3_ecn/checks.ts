// ECN across loopback (RFC 9000 §13.4): an `Http3Server` sends each
// connection's datagrams with the codepoint the connection marked them with,
// so a client that reads the ECN bits of what arrived and acknowledges with
// ACK_ECN validates the path, and a rise in ECN-CE is a congestion event at
// the server. Where the platform sends no ECN, the server finds out on its
// first marked send and sends every datagram unmarked.
import { udpBind, udpRecvFrom, udpSendTo, netAddress, netLocalPort } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { quicPushStream } from "nish/net/quic-frame";
import { quicVarintPush } from "nish/net/quic-packet";
import { QUIC_RECOVERY_APPLICATION, QUIC_RECOVERY_ECN_CAPABLE, QUIC_RECOVERY_ECN_TESTING_PACKETS, QuicSentPackets } from "nish/net/quic-recovery";
import { QuicConnection } from "nish/net/quic";
import { H3_ERROR, H3_NEED_MORE } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { CLIENT_SCID, QcClient, qcCrypto, qcFinishedPacket, qcInitial, qcPushAppAck, qcReadFlight, qcReceive, qcShort } from "../net_quic_conn/client";
import { H3Limits, H3Peer, H3Response, H3Wire, h3Hello, h3QuicConfig } from "../net_http3/peer";
import { LoopServer } from "../net_http3_server/loopback";

/** ECT(0), the codepoint a QUIC sender marks with. */
const ECT0: i32 = 2;

/** Whether this platform sends the ECN bits it is given, and a receiver reads them: a datagram to itself, marked ECT(0). */
const platformEcn = (): boolean => {
  const fd: i32 = udpBind("127.0.0.1", n32(0), n32(0));
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", netLocalPort(fd));
  const probe: u8[] = [toU8(1)];
  if (udpSendTo(fd, probe, n32(0), n32(1), to, n32(0), ECT0) < 0) {
    return false;
  }
  const rx: u8[] = new Array<u8>(16);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  return udpRecvFrom(fd, rx, n32(0), n32(16), from, meta) === n32(1) && meta[1] === ECT0;
};

/** The client's view of the server's datagrams: how many 1-RTT packets came in each codepoint. */
class Arrivals {
  /** 1-RTT packets that arrived marked ECT(0) and Not-ECT. */
  ect0: i64 = 0;
  plain: i64 = 0;
  /** ECN bits of every datagram from the server, first to last. */
  bits: i32[];

  constructor() {
    this.bits = [];
  }
}

/**
 * `H3Peer.pump`, reading the ECN bits of every datagram that comes back:
 * the server's loop and the client's reads until both sides are quiet.
 */
const drive = (p: H3Peer, wire: H3Wire, seen: Arrivals): void => {
  const server: Http3Server = wire.server;
  for (let round: i32 = 0; round < 2000; round++) {
    const key: Secret<u8[]> = secret(leafPrivate());
    const got: i32 = server.receive(p.c.now, key);
    wipe(key);
    server.tick(p.c.now);
    let slot: i32 = server.ready();
    while (slot >= 0) {
      if (wire.slot < 0) {
        wire.slot = slot;
        p.conn = server.quic(slot);
        p.h3 = server.connection(slot);
      }
      if (slot === wire.slot) {
        p.serve();
      } else {
        let event: i32 = server.connection(slot).next();
        while (event !== H3_NEED_MORE && event !== H3_ERROR) {
          event = server.connection(slot).next();
        }
      }
      slot = server.ready();
    }
    server.flush(p.c.now);
    let read: i32 = 0;
    let n: i32 = udpRecvFrom(wire.fd, wire.rx, n32(0), n32(65536), wire.from, wire.meta);
    while (n >= 0) {
      const datagram: u8[] = [];
      for (let k: i32 = 0; k < n; k++) {
        datagram.push(wire.rx[k]);
      }
      const before: i32 = toI32(p.c.appPayloads.length);
      p.c.datagrams.push(datagram);
      qcReceive(p.c, datagram);
      const packets: i64 = toI64(toI32(p.c.appPayloads.length) - before);
      seen.bits.push(wire.meta[1]);
      if (wire.meta[1] === ECT0) {
        seen.ect0 = seen.ect0 + packets;
      } else {
        seen.plain = seen.plain + packets;
      }
      read++;
      n = udpRecvFrom(wire.fd, wire.rx, n32(0), n32(65536), wire.from, wire.meta);
    }
    p.absorb();
    if (got === 0 && read === 0 && wire.wait.landed()) {
      continue;
    }
    if (got === 0 && read === 0) {
      const wait: i32 = server.timeout(p.c.now);
      if (wait < 0 || wait > 50) {
        return;
      }
      p.c.now = p.c.now + toI64(wait > 0 ? wait : n32(1));
    } else {
      p.c.now = p.c.now + n64(1);
    }
  }
};

/** One 1-RTT packet of `payload` from the client, and the loop run until quiet. */
const send = (p: H3Peer, wire: H3Wire, seen: Arrivals, payload: u8[]): void => {
  const datagram: u8[] = qcShort(p.c, payload);
  udpSendTo(wire.fd, datagram, n32(0), toI32(datagram.length), wire.to, n32(0), n32(0));
  drive(p, wire, seen);
};

/** An ACK_ECN of every 1-RTT packet the client has, with counts `ect0`, 0 and `ce`. */
const ackEcn = (p: H3Peer, ect0: i64, ce: i64): u8[] => {
  const out: u8[] = [];
  qcPushAppAck(out, p.c);
  out[0] = toU8(0x03);
  quicVarintPush(out, ect0);
  quicVarintPush(out, n64(0));
  quicVarintPush(out, ce);
  return out;
};

const bitsText = (bits: i32[]): string => {
  let s: string = "";
  for (const b of bits) {
    s = `${s}${b}`;
  }
  return s;
};

/** Every bit in `bits` is `want`. */
const all = (bits: i32[], want: i32): boolean => {
  for (const b of bits) {
    if (b !== want) {
      return false;
    }
  }
  return toI32(bits.length) > 0;
};

/** A client across loopback, the server it talks to, and what came back. */
class Rig {
  p: H3Peer;
  wire: H3Wire;
  seen: Arrivals;

  constructor(p: H3Peer, wire: H3Wire) {
    this.p = p;
    this.wire = wire;
    this.seen = new Arrivals();
  }
}

/** A client's handshake with `loop`'s server, by hand: its Initial and its Finished, acknowledging nothing the server sent. */
const connect = (loop: LoopServer, limits: H3Limits): Rig => {
  const server: Http3Server = loop.server;
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const p = new H3Peer(server.quic(n32(0)), server.connection(n32(0)), c);
  const wire = new H3Wire(server, loop.port);
  p.wire = wire;
  const r = new Rig(p, wire);
  const hello: u8[] = h3Hello(limits);
  c.before = hello;
  const initial: u8[] = qcInitial(c, qcCrypto(n64(0), hello), n32(1200));
  udpSendTo(wire.fd, initial, n32(0), toI32(initial.length), wire.to, n32(0), n32(0));
  drive(p, wire, r.seen);
  if (qcReadFlight(c, n32(0), n32(0))) {
    const finished: u8[] = qcFinishedPacket(c);
    udpSendTo(wire.fd, finished, n32(0), toI32(finished.length), wire.to, n32(0), n32(0));
    drive(p, wire, r.seen);
  }
  return r;
};

/** A GET of `path` on stream 0, in one packet. */
const get = (r: Rig, path: string): void => {
  const none: string[] = [];
  const request: u8[] = r.p.headers("GET", path, none, none);
  const stream: u8[] = [];
  quicPushStream(stream, n64(0), n64(0), request, n32(0), toI32(request.length), true);
  send(r.p, r.wire, r.seen, stream);
};

/** The bits of `bits` from `from` on. */
const since = (bits: i32[], from: i32): i32[] => {
  const out: i32[] = [];
  for (let k: i32 = from; k < toI32(bits.length); k++) {
    out.push(bits[k]);
  }
  return out;
};

/** A handshake, an ACK_ECN that validates, and one carrying CE: what the server marks and how it answers. */
const validated = (t: Suite, ecn: boolean): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(2), n32(0));
  const r: Rig = connect(loop, limits);
  const p: H3Peer = r.p;
  const wire: H3Wire = r.wire;
  const seen: Arrivals = r.seen;
  const quic: QuicConnection = p.conn;
  if (!t.ok("a handshake across loopback, the client acknowledging nothing yet", quic.handshakeComplete && wire.slot >= 0)) {
    return;
  }
  const app: QuicSentPackets = quic.recovery.spaces[QUIC_RECOVERY_APPLICATION];
  t.eqBool("the slot's connection marks where the platform sends ECN", quic.ecnMarking, ecn);
  t.ok(
    "every 1-RTT packet counted as marked arrived ECT(0), and the handshake's first flight too",
    ecn ? seen.ect0 > 0 && seen.ect0 === app.ectSent && seen.bits[0] === ECT0 : seen.ect0 === n64(0) && app.ectSent === n64(0) && all(seen.bits, n32(0))
  );
  send(p, wire, seen, ackEcn(p, seen.ect0, n64(0)));
  t.eqBool("an ACK_ECN counting them validates the path", quic.recovery.ecnState === QUIC_RECOVERY_ECN_CAPABLE, ecn);
  // Past the ten testing packets: a validated path marks every one.
  const from: i32 = toI32(seen.bits.length);
  get(r, "/big/40000");
  for (let k: i32 = 0; k < 64 && !p.stream(n64(0)).fin; k++) {
    send(p, wire, seen, ackEcn(p, seen.ect0, n64(0)));
  }
  const big: H3Response = p.response(n64(0));
  const response: i32[] = since(seen.bits, from);
  t.ok("40,000 bytes after validation, each acknowledged with ACK_ECN", toI32(big.body.length) === n32(40000) && big.fin);
  t.ok(
    "past the ten testing packets, every datagram of the response arrived marked where the platform sends ECN",
    ecn ? toI32(response.length) > 10 && all(response, ECT0) && seen.plain === n64(0) : all(response, n32(0))
  );
  t.eqBool("and the path is still capable", quic.recovery.ecnState === QUIC_RECOVERY_ECN_CAPABLE, ecn);
  // ECN-CE on the last of them: a congestion event, the window halved (RFC 9002 §7.1, B.7).
  const window: i64 = quic.recovery.congestionWindow;
  const events: i32 = quic.recovery.ecnCongestionEvents;
  send(p, wire, seen, ackEcn(p, seen.ect0 > 0 ? seen.ect0 - n64(1) : n64(0), n64(1)));
  t.eqBool("an ACK_ECN reporting one CE is a congestion event at the server", quic.recovery.ecnCongestionEvents === events + n32(1), ecn);
  t.eqBool("which shrinks its window", quic.recovery.congestionWindow < window, ecn);
};

/**
 * A path never validated: the ten testing packets go marked and the rest do
 * not. (The flight cut where the marking changes is
 * `tests/link/net_quic_ecn`'s: the server's window here sends one datagram
 * a flight.)
 */
const testing = (t: Suite, ecn: boolean): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(2), n32(0));
  const r: Rig = connect(loop, limits);
  const quic: QuicConnection = r.p.conn;
  if (!t.ok("another handshake, acknowledging nothing", quic.handshakeComplete && r.wire.slot >= 0)) {
    return;
  }
  const from: i32 = toI32(r.seen.bits.length);
  get(r, "/big/40000");
  const response: i32[] = since(r.seen.bits, from);
  let marked: i32 = 0;
  while (marked < toI32(response.length) && response[marked] === ECT0) {
    marked++;
  }
  const app: QuicSentPackets = quic.recovery.spaces[QUIC_RECOVERY_APPLICATION];
  t.ok(
    "the response's first window, unacknowledged: marked until the ten testing packets are spent, then unmarked to the end",
    ecn
      ? quic.recovery.ecnTestSent === QUIC_RECOVERY_ECN_TESTING_PACKETS && marked > 0 && marked < toI32(response.length) && all(since(response, marked), n32(0))
      : all(response, n32(0))
  );
  t.ok(
    "the datagrams that arrived ECT(0) are the packets the server counted as marked",
    r.seen.ect0 === app.ectSent && r.seen.plain > 0
  );
};

/**
 * What a marked send answered -95 turns off, on any platform: `unmark` stops
 * every slot marking, and a connection the server builds after it marks
 * nothing. (The -95 that calls it is Darwin's; see `docs/security/quic.md`,
 * QUIC-10.)
 */
const unmarked = (t: Suite): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(2), n32(0));
  const server: Http3Server = loop.server;
  server.unmark();
  t.ok(
    "unmark turns marking off for the server and every slot",
    !server.ecn && !server.quic(n32(0)).ecnMarking && !server.quic(n32(1)).ecnMarking
  );
  const r: Rig = connect(loop, limits);
  const quic: QuicConnection = r.p.conn;
  if (!t.ok("a handshake after it", quic.handshakeComplete && r.wire.slot >= 0)) {
    return;
  }
  get(r, "/big/40000");
  const app: QuicSentPackets = quic.recovery.spaces[QUIC_RECOVERY_APPLICATION];
  t.ok(
    "and its connection sends every datagram unmarked, counting none as marked",
    !quic.ecnMarking && all(r.seen.bits, n32(0)) && app.ectSent === n64(0)
  );
};

export const ecnChecks = (): i32 => {
  const t = new Suite("http3 ecn");
  const ecn: boolean = platformEcn();
  validated(t, ecn);
  testing(t, ecn);
  unmarked(t);
  return t.done();
};
