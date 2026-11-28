// HTTP/3 against `HttpServer.listenHttp3` under an RSA certificate, in one
// process: a QUIC client over a real UDP socket that turns the server between
// its reads, the `net_http_server_carriers` client cut down to what one GET
// needs. The handshake keys and packets come from `net_quic_conn`'s client;
// the server's CertificateVerify is checked again here under the RSA key,
// since that client checks it under the P-256 leaf every other test serves.
import { Secret } from "nish:secret";
import { udpBind, udpRecvFrom, udpSendTo, netAddress } from "nish:net";
import { QUIC_FRAME_STREAM, QuicFrame, quicParseFrame, quicPushStream } from "nish/net/quic-frame";
import { QPACK_OK, QpackDecoder } from "nish/net/qpack";
import { H3_FRAME_DATA, H3_FRAME_HEADERS, Http3FrameHeader, h3ReadFrameHeader } from "nish/net/http3-frame";
import { HttpServer, HttpServerRequest } from "nish/net/http-server";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { n32, n64 } from "../net_quic_frame/typed";
import { ClientView, clientFinish } from "../net_tls_common/client";
import {
  CLIENT_SCID,
  QcClient,
  qcCrypto,
  qcFinishedPacket,
  qcHello,
  qcInitial,
  qcPushAppAck,
  qcReadFlight,
  qcReceive,
  qcShort,
} from "../net_quic_conn/client";
import { ZERO, ascii, range } from "../net_tls_record_common/bytes";
import { textAt } from "../net_http2/peer";
import { fromHex, textOf } from "../crypto_x509/hex";

/** The most turns one wait takes, at up to 5 ms each. */
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

/** Turns `h` once, signing with `key`, and answers every request it has ready with 200 "hello\n". */
export const turnServer = (h: HttpServer, key: Secret<u8[]>): void => {
  h.waitSigned(n32(5), key);
  while (h.ready()) {
    const r: HttpServerRequest = h.take();
    h.send(r, n32(200), ascii("text/plain"), ascii("hello\n"), ZERO, n32(6));
  }
};

/** One QUIC client of `h`, on its own UDP socket. */
export class RsaQuicClient {
  h: HttpServer;
  c: QcClient;
  frame: QuicFrame;
  received: Received[];
  sendIds: i64[];
  sendOffsets: i64[];
  to: u8[];
  rx: u8[];
  from: u8[];
  meta: i32[];
  fd: i32 = -1;
  seen: i32 = 0;
  /** The handshake as the client read it, verified under the key `connect` was given. */
  view: ClientView;

  constructor(h: HttpServer, port: i32) {
    this.h = h;
    this.c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
    this.frame = new QuicFrame();
    this.received = [];
    this.sendIds = [];
    this.sendOffsets = [];
    this.fd = udpBind("127.0.0.1", n32(0), n32(0));
    this.to = new Array<u8>(18);
    netAddress(this.to, "127.0.0.1", port);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.view = new ClientView();
  }

  /**
   * The handshake, offering `alpn` with `params`, then the server's flight
   * checked under `serverKey` (a PKCS#1 RSAPublicKey). `qcReadFlight` derives
   * the keys whatever its own P-256 check answers, so its verdict is not read:
   * `view` holds the one under `serverKey`.
   */
  connect(alpn: string, params: u8[], key: Secret<u8[]>, serverKey: u8[]): boolean {
    const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], alpn, params);
    this.c.before = hello;
    const from: i32 = toI32(this.c.datagrams.length);
    this.transmit(qcInitial(this.c, qcCrypto(n64(0), hello), n32(1200)));
    this.turnUntil(key, n64(-1));
    qcReadFlight(this.c, from, n32(0));
    this.view = clientFinish(this.c.hashLength, this.c.before, this.c.cryptoInitial, this.c.cryptoHandshake, serverKey);
    if (!this.view.signatureVerifies || !this.view.serverFinishedVerifies) {
      return false;
    }
    this.transmit(qcFinishedPacket(this.c));
    this.turnUntil(key, n64(-1));
    return true;
  }

  /** Sends `datagram` from the client's socket. */
  transmit(datagram: u8[]): void {
    udpSendTo(this.fd, datagram, n32(0), toI32(datagram.length), this.to, n32(0), n32(0));
  }

  /** `bytes` on stream `id`, with its FIN when `fin`, in one 1-RTT packet that acknowledges what was read. */
  send(id: i64, bytes: u8[], fin: boolean): void {
    let offset: i64 = n64(0);
    let found: boolean = false;
    for (let k: i32 = 0; k < toI32(this.sendIds.length); k++) {
      if (this.sendIds[k] === id) {
        offset = this.sendOffsets[k];
        this.sendOffsets[k] = offset + toI64(toI32(bytes.length));
        found = true;
      }
    }
    if (!found) {
      this.sendIds.push(id);
      this.sendOffsets.push(toI64(toI32(bytes.length)));
    }
    const frames: u8[] = [];
    if (this.c.largestApp >= 0) {
      qcPushAppAck(frames, this.c);
    }
    quicPushStream(frames, id, offset, bytes, n32(0), toI32(bytes.length), fin);
    this.transmit(qcShort(this.c, frames));
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

  /** Files the STREAM frames of every packet opened since the last call. */
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
        }
        at = f.end;
      }
    }
  }

  /**
   * Turns the server and reads what it sends until stream `id` has ended
   * (with `id` -1, until twenty turns in a row bring nothing); answers whether
   * it got there.
   */
  turnUntil(key: Secret<u8[]>, id: i64): boolean {
    let quiet: i32 = 0;
    for (let turn: i32 = 0; turn < TURNS; turn++) {
      turnServer(this.h, key);
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
      if (id >= 0 && this.stream(id).fin) {
        return true;
      }
      quiet = read === 0 ? quiet + 1 : 0;
      if (id < 0 && quiet >= 20) {
        return true;
      }
    }
    return false;
  }
}

/** The response on stream `r`: `:status`, a space, and its DATA joined. */
export const h3Answer = (r: Received): string => {
  const header = new Http3FrameHeader();
  const dec = new QpackDecoder(n32(4096));
  const body: u8[] = [];
  let status: string = "";
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
          status = textAt(dec.bytes, dec.valueStart[k], dec.valueLength[k]);
        }
      }
    } else if (header.type === H3_FRAME_DATA) {
      for (let k: i32 = start; k < start + length; k++) {
        body.push(r.data[k]);
      }
    }
    at = start + length;
  }
  return `${status} ${textOf(body)}`;
};
