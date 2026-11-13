// The client side of `net_quic_prefork`: the client of
// `tests/link/net_quic_conn/client.ts` on a real UDP socket, talking HTTP/3
// to a prefork group it cannot see into. A `Wire` is one client socket and
// the clients that share it, each datagram handed to the client whose ID it
// names; a `Peer` is one connection on a wire. Every response the workers
// send is `worker <k>`, so a request answers which worker served it.
import { netAddress, netClose, pollAdd, pollCreate, pollWait, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { QUIC_FRAME_PATH_CHALLENGE, QUIC_FRAME_PATH_RESPONSE, QUIC_FRAME_PING, quicPushPadding, quicPushPathData, quicPushStream } from "nish/net/quic-frame";
import { QUIC_PACKET_OK, QUIC_PACKET_RETRY, QUIC_PACKET_SHORT, QuicHeader, quicParseHeader } from "nish/net/quic-packet";
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame";
import { QpackEncoder } from "nish/net/qpack";
import { n32, n64 } from "../net_quic_frame/typed";
import { QcFound, qcData, qcFind } from "../net_quic_conn/common";
import { QcClient, qcCrypto, qcFinishedPacket, qcHello, qcInitial, qcPushAppAck, qcReadFlight, qcReceive, qcRetried, qcShort } from "../net_quic_conn/client";
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientSettings, h3Frame, h3Section, h3Varint } from "../net_http3/peer";

/** How long a pump waits for the first datagram of an answer. */
const FIRST_MS: i32 = 2000;
/** How long the wire must stay quiet before a pump ends. */
const QUIET_MS: i32 = 150;

/** One client UDP socket to the group's port, and the connections on it. */
export class Wire {
  fd: i32 = -1;
  loop: i32 = -1;
  to: u8[];
  rx: u8[];
  from: u8[];
  meta: i32[];
  ready: i32[];
  peers: Peer[];

  constructor(port: i32) {
    this.to = new Array<u8>(18);
    netAddress(this.to, "127.0.0.1", port);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.ready = new Array<i32>(4);
    this.peers = [];
    this.rebind();
  }

  /** A new socket, so a new source port: a NAT rebinding. The old one is closed. */
  rebind(): void {
    if (this.fd >= 0) {
      netClose(this.fd);
      netClose(this.loop);
    }
    this.fd = udpBind("127.0.0.1", n32(0), n32(0));
    this.loop = pollCreate();
    pollAdd(this.loop, this.fd, n32(1), n32(0));
  }

  /**
   * Sends `datagram` to the group from a fresh port and closes it after
   * `QUIET_MS`; whether anything came back to that port. A rebinding during
   * the handshake: the owning worker drops what comes from a second address
   * before the handshake completes (RFC 9000 §9), so nothing should.
   */
  sendFromNewPort(datagram: u8[]): boolean {
    const fd: i32 = udpBind("127.0.0.1", n32(0), n32(0));
    const loop: i32 = pollCreate();
    pollAdd(loop, fd, n32(1), n32(0));
    udpSendTo(fd, datagram, n32(0), toI32(datagram.length), this.to, n32(0), n32(0));
    const answered: boolean = pollWait(loop, this.ready, QUIET_MS * 4) > 0;
    netClose(loop);
    netClose(fd);
    return answered;
  }

  /** Sends `datagram` to the group. */
  send(datagram: u8[]): void {
    udpSendTo(this.fd, datagram, n32(0), toI32(datagram.length), this.to, n32(0), n32(0));
  }

  /** Every datagram that arrives until the wire is quiet, each handed to its connection; how many. */
  pump(): i32 {
    let read: i32 = 0;
    let wait: i32 = FIRST_MS;
    while (pollWait(this.loop, this.ready, wait) > 0) {
      wait = QUIET_MS;
      let n: i32 = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
      while (n >= 0) {
        const datagram: u8[] = [];
        for (let k: i32 = 0; k < n; k++) {
          datagram.push(this.rx[k]);
        }
        const p: Peer | null = this.owner(datagram);
        if (p !== null) {
          p.take(datagram);
        }
        read++;
        n = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
      }
    }
    return read;
  }

  /** The connection whose client ID the datagram's DCID is. */
  owner(datagram: u8[]): Peer | null {
    if (toI32(datagram.length) < 14) {
      return this.peers.length > 0 ? this.peers[0] : null;
    }
    const at: i32 = (toI32(datagram[0]) & 0x80) !== 0 ? 6 : 1;
    for (const p of this.peers) {
      let same = true;
      for (let k: i32 = 0; k < 8; k++) {
        same = same && datagram[at + k] === p.c.scid[k];
      }
      if (same) {
        return p;
      }
    }
    // A stateless reset names no ID: on a wire of one connection it is that one's.
    return this.peers.length === 1 ? this.peers[0] : null;
  }
}

/** The client's transport parameters for HTTP/3, with `scid` as its initial SCID. */
const helloFor = (scid: u8[]): u8[] => {
  const limits = new H3Limits();
  const p = new QuicTransportParameters();
  p.initialScid = scid;
  p.hasInitialScid = true;
  p.initialMaxData = n64(67108864);
  p.initialMaxStreamDataBidiLocal = n64(16777216);
  p.initialMaxStreamDataBidiRemote = n64(65536);
  p.initialMaxStreamDataUni = n64(65536);
  p.initialMaxStreamsBidi = n64(0);
  p.initialMaxStreamsUni = limits.clientUniStreams;
  p.activeConnectionIdLimit = n64(4);
  return qcHello([TLS_AES_128_GCM_SHA256], limits.alpn, quicEncodeTransportParameters(p));
};

/** One HTTP/3 connection on a wire. */
export class Peer {
  wire: Wire;
  c: QcClient;
  hello: u8[];
  /** The SCID of the Retry this connection took, or empty. */
  retryScid: u8[];
  /** Raw datagrams that opened nothing, newest last: a stateless reset lands here. */
  unopened: u8[][];
  /** Whether a split handshake's Initial from another port drew any answer there. */
  strayAnswered: boolean = false;
  nextStream: i64 = 0;

  /** A client whose own ID ends in `tag`, whose first DCID starts with `first`. */
  constructor(wire: Wire, first: i32, tag: i32) {
    this.wire = wire;
    const scid: u8[] = [0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, toU8(tag)];
    this.c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
    const odcid: u8[] = [toU8(first), 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, toU8(tag)];
    // A Retry's re-keying with no token: the Initial keys of this first DCID.
    qcRetried(this.c, odcid, []);
    this.hello = helloFor(scid);
    this.c.before = this.hello;
    this.retryScid = [];
    this.unopened = [];
    wire.peers.push(this);
  }

  /** Files a datagram from the group; a Retry is taken and the ClientHello sent again. */
  take(datagram: u8[]): void {
    const header: QuicHeader = quicParseHeader(datagram, n32(0), n32(8));
    if (header.error === QUIC_PACKET_OK && header.type === QUIC_PACKET_RETRY) {
      if (toI32(this.retryScid.length) === 0) {
        this.retryScid = header.scid;
        qcRetried(this.c, header.scid, header.token);
        this.wire.send(qcInitial(this.c, qcCrypto(n64(0), this.hello), n32(1200)));
      }
      return;
    }
    this.c.datagrams.push(datagram);
    if (qcReceive(this.c, datagram) === 0) {
      this.unopened.push(datagram);
    }
  }

  /**
   * The handshake, its ClientHello in two Initials when `split`, the second
   * sent first from another port (`strayAnswered`) and then again from the
   * client's own; then the client's control and QPACK
   * streams. Answers whether the client read and accepted the server's flight.
   */
  handshake(split: boolean): boolean {
    if (split) {
      const half: i32 = toI32(this.hello.length) / 2;
      const head: u8[] = this.hello.slice(n32(0), half);
      const tail: u8[] = this.hello.slice(half);
      this.wire.send(qcInitial(this.c, qcCrypto(n64(0), head), n32(1200)));
      this.wire.pump();
      const second: u8[] = qcInitial(this.c, qcCrypto(toI64(half), tail), n32(1200));
      this.strayAnswered = this.wire.sendFromNewPort(second);
      this.wire.send(second);
    } else {
      this.wire.send(qcInitial(this.c, qcCrypto(n64(0), this.hello), n32(1200)));
    }
    this.wire.pump();
    if (toI32(this.c.cryptoInitial.length) === 0 || !qcReadFlight(this.c, n32(0), n32(0))) {
      return false;
    }
    this.wire.send(qcFinishedPacket(this.c));
    const control: u8[] = h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]);
    const open: u8[] = [];
    quicPushStream(open, CLIENT_CONTROL, n64(0), control, n32(0), toI32(control.length), false);
    quicPushStream(open, CLIENT_ENCODER, n64(0), h3Varint(H3_STREAM_QPACK_ENCODER), n32(0), n32(1), false);
    quicPushStream(open, CLIENT_DECODER, n64(0), h3Varint(H3_STREAM_QPACK_DECODER), n32(0), n32(1), false);
    this.packet(open);
    return true;
  }

  /** A 1-RTT packet of `payload`, an ACK of everything first, and the answers pumped. */
  packet(payload: u8[]): void {
    const all: u8[] = [];
    if (this.c.largestApp >= n64(0)) {
      qcPushAppAck(all, this.c);
    }
    for (const b of payload) {
      all.push(b);
    }
    this.wire.send(qcShort(this.c, all));
    this.wire.pump();
  }

  /**
   * A GET on the next request stream; answers the k of the `worker <k>` that
   * came back, -1 when none did. A PATH_CHALLENGE that came with it is answered.
   */
  get(): i32 {
    const from: i32 = toI32(this.c.appPayloads.length);
    const head: u8[] = h3Section(new QpackEncoder(), [":method", ":scheme", ":authority", ":path"], ["GET", "https", "localhost", "/"]);
    const request: u8[] = h3Frame(n64(1), head);
    const payload: u8[] = [];
    quicPushStream(payload, this.nextStream, n64(0), request, n32(0), toI32(request.length), true);
    this.nextStream = this.nextStream + n64(4);
    this.packet(payload);
    const since: u8[][] = this.c.appPayloads.slice(from);
    const challenge: QcFound = qcFind(since, QUIC_FRAME_PATH_CHALLENGE);
    if (challenge.found) {
      const answer: u8[] = [];
      quicPushPathData(answer, QUIC_FRAME_PATH_RESPONSE, qcData(challenge), n32(0));
      this.packet(answer);
    }
    return workerIn(since);
  }

  /** Whether a PATH_CHALLENGE arrived in the payloads from `from` on. */
  challenged(from: i32): boolean {
    return qcFind(this.c.appPayloads.slice(from), QUIC_FRAME_PATH_CHALLENGE).found;
  }

  /** A PING padded to 200 bytes, so a stateless reset can answer it (RFC 9000 §10.3). */
  ping(): void {
    const payload: u8[] = [toU8(QUIC_FRAME_PING)];
    quicPushPadding(payload, n32(180));
    this.wire.send(qcShort(this.c, payload));
    this.wire.pump();
  }
}

/** The k of the first `worker <k>` in `payloads`, or -1. */
export const workerIn = (payloads: u8[][]): i32 => {
  const word: string = "worker ";
  for (const p of payloads) {
    const n: i32 = toI32(p.length);
    for (let at: i32 = 0; at + 7 < n; at++) {
      let match = true;
      for (let k: i32 = 0; k < 7 && match; k++) {
        match = toI32(p[at + k]) === toI32(word.charCodeAt(k));
      }
      if (match) {
        let value: i32 = 0;
        let digits: i32 = 0;
        for (let k: i32 = at + 7; k < n && toI32(p[k]) >= 48 && toI32(p[k]) <= 57; k++) {
          value = value * 10 + toI32(p[k]) - 48;
          digits++;
        }
        return digits > 0 ? value : -1;
      }
    }
  }
  return -1;
};

/** Whether `datagram` is a short-header packet, the shape a stateless reset takes. */
export const shortShaped = (datagram: u8[]): boolean => {
  const header: QuicHeader = quicParseHeader(datagram, n32(0), n32(8));
  return toI32(datagram.length) >= 21 && (toI32(datagram[0]) & 0xc0) === 0x40 && (header.error !== QUIC_PACKET_OK || header.type === QUIC_PACKET_SHORT);
};
