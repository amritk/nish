// GSO and GRO over loopback, with `nish:net`'s UDP_SEGMENT and UDP_GRO: the
// listener's `quicListenerTakeFlight` writes a paced flight of a connection's
// datagrams back to back, one `udpSendTo` sends it cut into 1200-byte
// segments, and a socket bound with UDP_GRO reads it back, coalesced, whose
// segments the client opens; the other way, a client's flight of 1200-byte
// packets sent the same way is handed to the server by
// `quicListenerReceiveSegments`. Where the platform has no segmentation
// offload (anything but Linux answers -95), each datagram is sent and read
// on its own, and every line below reads the same.
import { netAddress, netClose, netLocalPort, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { Suite } from "nish/testing";
import { quicPushPadding, quicPushStream } from "nish/net/quic-frame";
import { QUIC_CONN_DATAGRAM_SIZE } from "nish/net/quic";
import { QUIC_LISTENER_FLIGHT_MAX, QuicFlight, quicListenerReceiveSegments, quicListenerTakeFlight } from "nish/net/quic-listener";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { qcReceive, qcShort } from "../net_quic_conn/client";
import { NqLimits, NqPair, NqRead, nqPair, nqReadAll, nqReceived, nqSend, nqText } from "../net_quic_stream/common";
import { qcStream } from "../net_quic_conn/data";

const WOULD_BLOCK: i32 = -11;
const NOT_SUPPORTED: i32 = -95;

/** A loopback pair of sockets: `to` addresses the receiver, which has UDP_GRO when `gro` says so. */
class Loop {
  sender: i32 = -1;
  receiver: i32 = -1;
  to: u8[];
  gro: boolean = false;

  constructor() {
    this.to = new Array<u8>(18);
    this.sender = udpBind("127.0.0.1", n32(0), n32(0));
    this.receiver = udpBind("127.0.0.1", n32(0), n32(2));
    this.gro = this.receiver >= 0;
    if (!this.gro) {
      this.receiver = udpBind("127.0.0.1", n32(0), n32(0));
    }
    netAddress(this.to, "127.0.0.1", netLocalPort(this.receiver));
  }
}

/** Sends `buf[0 .. length)` as datagrams of `segment` bytes: one GSO send, or one send each where there is none. */
const sendFlight = (loop: Loop, buf: u8[], length: i32, segment: i32): void => {
  const sent: i32 = udpSendTo(loop.sender, buf, n32(0), length, loop.to, segment, n32(0));
  if (sent !== NOT_SUPPORTED) {
    return;
  }
  let at: i32 = 0;
  while (at < length) {
    const n: i32 = length - at < segment ? length - at : segment;
    udpSendTo(loop.sender, buf, at, n, loop.to, n32(0), n32(0));
    at = at + n;
  }
};

/** What one or more receives brought: every datagram, cut at the segment size each receive reported. */
class Arrived {
  datagrams: u8[][];
  bytes: i32 = 0;

  constructor() {
    this.datagrams = [];
  }
}

/** Reads from the receiver until `length` bytes have come, cutting each receive into its segments. */
const receiveFlight = (loop: Loop, length: i32): Arrived => {
  const out = new Arrived();
  const buf: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  for (let tries: i32 = 0; tries < 1000000 && out.bytes < length; tries++) {
    const n: i32 = udpRecvFrom(loop.receiver, buf, n32(0), n32(65536), from, meta);
    if (n !== WOULD_BLOCK && n > 0) {
      const segment: i32 = meta[0] > 0 ? meta[0] : n;
      let at: i32 = 0;
      while (at < n) {
        const size: i32 = n - at < segment ? n - at : segment;
        const one: u8[] = [];
        for (let k: i32 = 0; k < size; k++) {
          one.push(buf[at + k]);
        }
        out.datagrams.push(one);
        at = at + size;
      }
      out.bytes = out.bytes + n;
    }
  }
  return out;
};

/** The server's flight goes out in one GSO send and comes back through GRO to the client. */
const serverFlight = (t: Suite, loop: Loop): void => {
  const limits = new NqLimits();
  limits.maxStreamData = n64(16384);
  const p: NqPair = nqPair(limits);
  nqSend(p, qcStream(n64(0), n64(0), "send", false));
  nqReadAll(p.conn, n32(64), new NqRead());
  const data: u8[] = bytesOf(nqText(n32(8000)));
  p.conn.streamWrite(n64(0), data, n32(0), n32(8000), true);
  const buf: u8[] = new Array<u8>(QUIC_LISTENER_FLIGHT_MAX * QUIC_CONN_DATAGRAM_SIZE);
  const flight = new QuicFlight();
  const length: i32 = quicListenerTakeFlight(p.conn, p.c.now, buf, n32(0), toI32(buf.length), flight);
  t.ok("the flight is seven datagrams: 8000 bytes of stream", flight.count === n32(7));
  t.eqI32("every one 1200 bytes but the last: the segment size", flight.segment, n32(1200));
  t.ok("written back to back", length > n32(7200) && length < n32(8400));
  sendFlight(loop, buf, length, flight.segment);
  const back: Arrived = receiveFlight(loop, length);
  t.eqI32("read back, they are seven datagrams again", toI32(back.datagrams.length), n32(7));
  let intact: boolean = back.bytes === length;
  let at: i32 = 0;
  for (const d of back.datagrams) {
    for (let k: i32 = 0; k < toI32(d.length); k++) {
      intact = intact && d[k] === buf[at + k];
    }
    at = at + toI32(d.length);
    qcReceive(p.c, d);
  }
  t.ok("byte for byte", intact);
  t.eqStr("and the client opens them all: the stream arrives whole", nqReceived(p.c, n64(0)), `${nqText(n32(8000))} <fin>`);
  const more = new QuicFlight();
  t.eqI32("with the flight out and nothing new, the next flight is empty", quicListenerTakeFlight(p.conn, p.c.now, buf, n32(0), toI32(buf.length), more), n32(0));
};

/** The client's three 1200-byte packets go out in one GSO send; the server takes the GRO receive's segments. */
const clientFlight = (t: Suite, loop: Loop): void => {
  const p: NqPair = nqPair(new NqLimits());
  const buf: u8[] = new Array<u8>(3 * 1200);
  for (let k: i32 = 0; k < 3; k++) {
    // 1 + 8 + 4 header bytes and a 16-byte tag leave 1171 for the payload.
    const payload: u8[] = [];
    const part: u8[] = bytesOf(nqText(n32(1000)));
    quicPushStream(payload, n64(0), toI64(k) * n64(1000), part, n32(0), n32(1000), k === 2);
    quicPushPadding(payload, n32(1171) - toI32(payload.length));
    const packet: u8[] = qcShort(p.c, payload);
    for (let j: i32 = 0; j < toI32(packet.length) && j < 1200; j++) {
      buf[k * 1200 + j] = packet[j];
    }
  }
  sendFlight(loop, buf, n32(3600), n32(1200));
  const now: i64 = p.c.now;
  const fromSocket: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  let got: i32 = 0;
  for (let tries: i32 = 0; tries < 1000000 && got < 3600; tries++) {
    const n: i32 = udpRecvFrom(loop.receiver, fromSocket, n32(0), n32(65536), from, meta);
    if (n > 0) {
      quicListenerReceiveSegments(p.conn, fromSocket, n32(0), n, meta[0], now);
      got = got + n;
    }
  }
  const read = new NqRead();
  nqReadAll(p.conn, n32(4096), read);
  t.eqStr("the server reads the three packets' stream from the GRO receive, in place", read.of(n64(0)), `${nqText(n32(1000))}${nqText(n32(1000))}${nqText(n32(1000))} <fin>`);
  t.eqI32("having dropped none", p.conn.dropped, n32(0));
};

/** Every GSO and GRO check. */
export const gsoChecks = (t: Suite): void => {
  const loop = new Loop();
  if (!t.ok("two loopback sockets", loop.sender >= 0 && loop.receiver >= 0)) {
    return;
  }
  serverFlight(t, loop);
  clientFlight(t, loop);
  netClose(loop.sender);
  netClose(loop.receiver);
};
