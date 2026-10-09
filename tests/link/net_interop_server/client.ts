// The scripted clients of the smoke checks, against an `InteropServer` in the
// same process over loopback. Each sends, then turns the server's loop until
// the answer it waits for has come.
//
// - QUIC: `tests/link/net_quic_conn/client`'s `QcClient` (its handshake and
//   packet protection pinned against RFC 8448 and RFC 9001) on a UDP socket,
//   with STREAM and DATAGRAM frames written by `nish/net/quic-frame` and read
//   back from every 1-RTT packet the server sends; HTTP/3 on top through
//   `nish/net/http3-frame` and `nish/net/qpack`.
// - HTTP/2: the TLS 1.3 client of `tests/link/net_http2_tls` (the handshake of
//   `net_tls_common`, records of `net_tls_record_common`) on a TCP socket,
//   with frames from `tests/link/net_http2/peer`.
import { Secret } from "nish:secret";
import { netAddress, netRead, netWrite, tcpConnect, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import {
  QUIC_FRAME_DATAGRAM,
  QUIC_FRAME_DATAGRAM_LENGTH,
  QUIC_FRAME_STREAM,
  QuicFrame,
  quicDatagramSize,
  quicParseFrame,
  quicPushAck,
  quicPushStream,
  quicPutDatagram,
} from "nish/net/quic-frame";
import { QPACK_OK, QpackDecoder } from "nish/net/qpack";
import { H3_FRAME_DATA, H3_FRAME_HEADERS, Http3FrameHeader, h3ReadFrameHeader } from "nish/net/http3-frame";
import { TLS_AES_128_GCM_SHA256, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record";
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { H2_ALPN } from "nish/net/http2-tls";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPublic } from "../net_tls_common/server";
import { GROUP_SECP256R1, clientFinish, clientHello, clientShare, extAlpn, extKeyShare, extSignatureAlgorithms, extSupportedGroups, extSupportedVersions } from "../net_tls_common/client";
import { Opened, ZERO, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { clearRecord, clientKeysFor } from "../net_tls_record_common/client";
import { FrameLog, Wire, textAt } from "../net_http2/peer";
import { CLIENT_SCID, QcClient, qcCrypto, qcFinishedPacket, qcHello, qcInitial, qcReadFlight, qcReceive, qcShort } from "../net_quic_conn/client";
import { fromHex, textOf } from "../crypto_x509/hex";
import { InteropServer } from "./server";

/** What `netRead` answers when nothing is waiting. */
const WOULD_BLOCK: i32 = -11;

/** The most turns of the server's loop one wait takes, at up to 5 ms each. */
const TURNS: i32 = 2000;

/** What one stream of the server's has carried so far. */
export class Received {
  id: i64 = 0;
  data: u8[];
  fin: boolean = false;

  constructor(id: i64) {
    this.id = id;
    this.data = [];
  }
}

/** One QUIC client of the server: its socket, its connection state, and what it has read. */
export class QuicClient {
  server: InteropServer;
  c: QcClient;
  frame: QuicFrame;
  received: Received[];
  datagrams: u8[][];
  /** The client's next offset on each stream it writes. */
  sendIds: i64[];
  sendOffsets: i64[];
  to: u8[];
  rx: u8[];
  from: u8[];
  meta: i32[];
  fd: i32 = -1;
  /** How many of `c.appPayloads` have been read. */
  seen: i32 = 0;

  constructor(server: InteropServer) {
    this.server = server;
    this.c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
    this.frame = new QuicFrame();
    this.received = [];
    this.datagrams = [];
    this.sendIds = [];
    this.sendOffsets = [];
    this.fd = udpBind("127.0.0.1", n32(0), n32(0));
    this.to = new Array<u8>(18);
    netAddress(this.to, "127.0.0.1", server.quicPort);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
  }

  /** The handshake, offering `alpn` with transport parameters `params`; whether the server's flight verified. */
  connect(alpn: string, params: u8[], key: Secret<u8[]>): boolean {
    const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], alpn, params);
    this.c.before = hello;
    const from: i32 = toI32(this.c.datagrams.length);
    this.transmit(qcInitial(this.c, qcCrypto(n64(0), hello), n32(1200)));
    this.turnUntil(key, n64(-1), false);
    if (!qcReadFlight(this.c, from, n32(0))) {
      return false;
    }
    this.transmit(qcFinishedPacket(this.c));
    this.turnUntil(key, n64(-1), false);
    return true;
  }

  /** Sends `datagram` from the client's socket. */
  transmit(datagram: u8[]): void {
    udpSendTo(this.fd, datagram, n32(0), toI32(datagram.length), this.to, n32(0), n32(0));
  }

  /** One 1-RTT packet of `payload`, with an ACK of every packet read so far. */
  packet(payload: u8[]): void {
    const frames: u8[] = [];
    if (this.c.largestApp >= 0) {
      quicPushAck(frames, [n64(0), this.c.largestApp], n32(1), n64(0));
    }
    for (const b of payload) {
      frames.push(b);
    }
    this.transmit(qcShort(this.c, frames));
  }

  /** The client's next offset on stream `id`, moved past `n` more bytes. */
  advance(id: i64, n: i64): i64 {
    for (let k: i32 = 0; k < toI32(this.sendIds.length); k++) {
      if (this.sendIds[k] === id) {
        const at: i64 = this.sendOffsets[k];
        this.sendOffsets[k] = at + n;
        return at;
      }
    }
    this.sendIds.push(id);
    this.sendOffsets.push(n);
    return n64(0);
  }

  /** `bytes` on stream `id`, with its FIN when `fin`, in one packet. */
  send(id: i64, bytes: u8[], fin: boolean): void {
    const frames: u8[] = [];
    const offset: i64 = this.advance(id, toI64(toI32(bytes.length)));
    quicPushStream(frames, id, offset, bytes, n32(0), toI32(bytes.length), fin);
    this.packet(frames);
  }

  /** One DATAGRAM frame carrying `data`. */
  datagram(data: u8[]): void {
    const size: i32 = quicDatagramSize(toI32(data.length));
    const frame: u8[] = new Array<u8>(size);
    quicPutDatagram(frame, n32(0), size, data, n32(0), toI32(data.length));
    this.packet(frame);
  }

  /** What stream `id` has carried. */
  stream(id: i64): Received {
    for (const r of this.received) {
      if (r.id === id) {
        return r;
      }
    }
    const fresh = new Received(id);
    this.received.push(fresh);
    return fresh;
  }

  /** Files the STREAM and DATAGRAM frames of every packet opened since the last call. */
  absorb(): void {
    while (this.seen < toI32(this.c.appPayloads.length)) {
      const payload: u8[] = this.c.appPayloads[this.seen];
      this.seen = this.seen + 1;
      let at: i32 = 0;
      while (at < toI32(payload.length)) {
        const f: QuicFrame = this.frame;
        if (quicParseFrame(f, payload, at, toI32(payload.length)) !== n64(0) || f.end <= at) {
          break;
        }
        if (f.type === QUIC_FRAME_STREAM) {
          const r: Received = this.stream(f.streamId);
          const have: i64 = toI64(toI32(r.data.length));
          if (f.offset <= have) {
            for (let k: i32 = toI32(have - f.offset); k < f.dataLength; k++) {
              r.data.push(payload[f.dataStart + k]);
            }
            r.fin = r.fin || (f.fin && f.offset + toI64(f.dataLength) <= toI64(toI32(r.data.length)));
          }
        } else if (f.type === QUIC_FRAME_DATAGRAM || f.type === QUIC_FRAME_DATAGRAM_LENGTH) {
          this.datagrams.push(range(payload, f.dataStart, f.dataStart + f.dataLength));
        }
        at = f.end;
      }
    }
  }

  /**
   * Turns the server's loop and reads what it sends until stream `id` has
   * ended (with `id` -1, until twenty turns in a row bring nothing; with
   * `datagram`, until a datagram has come). Answers whether it got there.
   */
  turnUntil(key: Secret<u8[]>, id: i64, datagram: boolean): boolean {
    let quiet: i32 = 0;
    const had: i32 = toI32(this.datagrams.length);
    for (let turn: i32 = 0; turn < TURNS; turn++) {
      this.server.step(n32(5), key);
      let read: i32 = 0;
      let n: i32 = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
      while (n >= 0) {
        const d: u8[] = range(this.rx, ZERO, n);
        this.c.datagrams.push(d);
        qcReceive(this.c, d);
        read++;
        n = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
      }
      this.absorb();
      if (datagram && toI32(this.datagrams.length) > had) {
        return true;
      }
      if (id >= 0 && this.stream(id).fin) {
        return true;
      }
      quiet = read === 0 ? quiet + 1 : 0;
      if (id < 0 && !datagram && quiet >= 20) {
        return true;
      }
    }
    return false;
  }
}

/** An HTTP/3 response read from a stream's frames: its status and its body. */
export class H3Answer {
  status: string = "";
  body: string = "";
}

/** The response on stream `r`: the `:status` of its HEADERS and its DATA joined. */
export const h3Answer = (r: Received): H3Answer => {
  const out = new H3Answer();
  const header = new Http3FrameHeader();
  const dec = new QpackDecoder(n32(4096));
  const body: u8[] = [];
  let at: i32 = 0;
  const n: i32 = toI32(r.data.length);
  while (at < n) {
    const size: i32 = h3ReadFrameHeader(header, r.data, at, n - at);
    const length: i32 = toI32(header.length);
    if (size === 0 || at + size + length > n) {
      break;
    }
    const start: i32 = at + size;
    if (header.type === H3_FRAME_HEADERS && dec.decode(r.data, start, length) === QPACK_OK) {
      for (let k: i32 = 0; k < dec.count; k++) {
        if (textAt(dec.bytes, dec.nameStart[k], dec.nameLength[k]) === ":status") {
          out.status = textAt(dec.bytes, dec.valueStart[k], dec.valueLength[k]);
        }
      }
    } else if (header.type === H3_FRAME_DATA) {
      for (let k: i32 = start; k < start + length; k++) {
        body.push(r.data[k]);
      }
    }
    at = start + length;
  }
  out.body = textOf(body);
  return out;
};

// ---- HTTP/2 over TLS ----------------------------------------------------------------

/** One HTTP/2 client: its socket, record keys, and the frames it has read. */
export class H2TlsClient {
  server: InteropServer;
  read: TlsRecordProtection;
  write: TlsRecordProtection;
  wire: Wire;
  log: FrameLog;
  got: u8[];
  buf: u8[];
  fd: i32 = -1;
  verified: boolean = false;

  constructor(server: InteropServer) {
    this.server = server;
    this.read = new TlsRecordProtection();
    this.write = new TlsRecordProtection();
    this.wire = new Wire();
    this.log = new FrameLog();
    this.got = [];
    this.buf = new Array<u8>(16384);
  }

  /** Sends every byte of `bytes`, turning the server's loop while the socket is full. */
  send(bytes: u8[], key: Secret<u8[]>): void {
    let sent: i32 = 0;
    for (let turn: i32 = 0; turn < TURNS && sent < toI32(bytes.length); turn++) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent);
      if (w > 0) {
        sent = sent + w;
      } else {
        this.server.step(n32(5), key);
      }
    }
  }

  /** The next whole TLS record, turning the server's loop until it is in; empty if it never comes. */
  nextRecord(key: Secret<u8[]>): u8[] {
    for (let turn: i32 = 0; turn < TURNS; turn++) {
      if (toI32(this.got.length) >= 5) {
        const length: i32 = n32(5) + ((toI32(this.got[3]) << 8) | toI32(this.got[4]));
        if (toI32(this.got.length) >= length) {
          const record: u8[] = range(this.got, ZERO, length);
          this.got = range(this.got, length, toI32(this.got.length));
          return record;
        }
      }
      this.server.step(n32(5), key);
      let n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length));
      while (n > 0) {
        for (let k: i32 = 0; k < n; k++) {
          this.got.push(this.buf[k]);
        }
        n = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length));
      }
      if (n !== WOULD_BLOCK && n <= 0) {
        break;
      }
    }
    return [];
  }

  /** Connects to `port` and completes a TLS 1.3 handshake offering `h2`; false when anything went wrong. */
  handshake(port: i32, key: Secret<u8[]>): boolean {
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", port);
    this.fd = tcpConnect(addr);
    if (this.fd < 0) {
      return false;
    }
    const suite: i32 = TLS_CHACHA20_POLY1305_SHA256;
    const hello: u8[] = clientHello(
      [suite],
      [
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
        extAlpn([H2_ALPN]),
      ]
    );
    this.send(clearRecord(hello), key);
    const serverHello: u8[] = this.nextRecord(key);
    if (toI32(serverHello.length) < 5) {
      return false;
    }
    const helloBody: u8[] = range(serverHello, n32(5), toI32(serverHello.length));
    const keys = clientKeysFor(32, hello, helloBody);
    const flight: Opened = openOne(protectionFor(suite, keys.serverHandshake), this.nextRecord(key));
    const view = clientFinish(32, hello, helloBody, flight.content, leafPublic());
    this.verified = view.signatureVerifies && view.serverFinishedVerifies;
    keys.finishWith(flight.content);
    this.read.install(suite, keys.serverApplication);
    this.write.install(suite, keys.clientApplication);
    this.send(sealOne(protectionFor(suite, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO), key);
    return true;
  }

  /** Seals what `wire` holds into one application-data record and sends it. */
  flush(key: Secret<u8[]>): void {
    this.send(sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, this.wire.take(), ZERO), key);
  }

  /** Reads records until the log holds `n` frames; answers them joined. */
  awaitFrames(n: i32, key: Secret<u8[]>): string {
    while (toI32(this.log.frames.length) < n) {
      const record: u8[] = this.nextRecord(key);
      if (toI32(record.length) === 0) {
        break;
      }
      const opened: Opened = openOne(this.read, record);
      if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
        this.log.push(opened.content, ZERO, toI32(opened.content.length));
      }
    }
    return this.log.take();
  }
}
