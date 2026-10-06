// The interop server's HTTP/2: `nish/net/http2-tls` on a listener of its own
// in the server's loop, signing with the key the loop holds, for the chain it
// was given. A GET answers the file from `www` (404 when it is not there), or
// `hello from nish interop` when no `www` was given; any other request
// answers, once its body has ended, how many bytes the body carried. A body
// the peer's flow-control window holds back is kept and written again on
// `H2_WINDOW`, and whenever its connection is served, until it is all out — what
// `h2spec`'s flow-control cases (§6.9) look for.
import { Secret } from "nish:secret";
import { netClose, netLocalPort, pollAdd, pollModify, tcpListen } from "nish:net";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TlsServerConfig } from "nish/net/tls";
import { TLS_RECORD_DONE, TLS_RECORD_SIGN } from "nish/net/tls/record-server";
import { TLS_TCP_POOL_FULL } from "nish/net/tls-tcp";
import { httpFieldBytes, httpFieldIs } from "nish/net/http-fields";
import { H2_AGAIN, H2_DATA, H2_TRAILERS, H2_ERROR, H2_NEED_MORE, H2_REQUEST, H2_WINDOW, Http2Config, Http2Connection } from "nish/net/http2";
import { H2_ALPN, Http2TlsServer } from "nish/net/http2-tls";
import { InteropFiles } from "./files";

/** The tokens of the listener and of slot 0; slot `k` is `H2_SLOT_TOKEN + k`. */
export const H2_LISTEN_TOKEN: i32 = 5;
export const H2_SLOT_TOKEN: i32 = 1000;

/** The statuses answered, typed: a bare literal is an `f64` under `--number-mode f64`. */
const STATUS_OK: i32 = 200;
const STATUS_NOT_FOUND: i32 = 404;

/** One response being written: its stream and the bytes still owed. */
class H2Pending {
  stream: i32 = 0;
  /** The request body's bytes so far, for a request that is not a GET. */
  received: i64 = 0;
  out: u8[];
  at: i32 = 0;
  /** Waiting for the request body to end (0), writing (1), or free (2). */
  phase: i32 = 2;

  constructor() {
    this.out = [];
  }
}

/** A TLS configuration offering `h2` with `chain`. */
export const h2TlsConfig = (chain: u8[][]): TlsServerConfig => {
  const none: u8[] = [];
  return {
    certificateChain: chain,
    alpn: [H2_ALPN],
    quicTransportParameters: none,
    extraExtensions: none,
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    quic: false,
  };
};

/** HTTP/2 over TLS in the interop server's loop. */
export class InteropH2 {
  server: Http2TlsServer;
  files: InteropFiles;
  /** Each slot's responses, `perSlot` of them. */
  pending: H2Pending[];
  names: u8[][];
  randomBuffer: u8[];
  keyBuffer: u8[];
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  perSlot: i32 = 0;
  /** Connections accepted and closed, and requests answered, for a log or a test. */
  accepted: i32 = 0;
  closed: i32 = 0;
  answered: i32 = 0;
  logging: boolean = false;

  /** Listens on `host`:`port` (0 for any) with `size` slots, its descriptors in `loop`. */
  constructor(loop: i32, host: string, port: i32, chain: u8[][], files: InteropFiles, size: i32) {
    const config = new Http2Config();
    this.loop = loop;
    this.files = files;
    this.listener = tcpListen(host, port, toI32(64));
    this.port = this.listener >= 0 ? netLocalPort(this.listener) : 0;
    this.server = new Http2TlsServer(h2TlsConfig(chain), config, this.listener, size);
    this.perSlot = config.maxStreams;
    this.pending = [];
    for (let k: i32 = 0; k < this.perSlot * size; k++) {
      this.pending.push(new H2Pending());
    }
    this.names = [httpFieldBytes("content-type"), httpFieldBytes("server")];
    this.randomBuffer = new Array<u8>(32);
    this.keyBuffer = new Array<u8>(32);
    if (this.listener >= 0) {
      pollAdd(loop, this.listener, toI32(1), H2_LISTEN_TOKEN);
    }
  }

  /** Accepts every waiting connection into a slot, each with fresh randomness. */
  acceptAll(): void {
    while (true) {
      crypto.getRandomValues(this.randomBuffer);
      crypto.getRandomValues(this.keyBuffer);
      const slot: i32 = this.server.accept(this.randomBuffer, this.keyBuffer);
      if (slot >= 0) {
        this.accepted = this.accepted + 1;
        for (let k: i32 = slot * this.perSlot; k < (slot + 1) * this.perSlot; k++) {
          this.pending[k].phase = 2;
        }
        pollAdd(this.loop, this.server.fd(slot), toI32(1), H2_SLOT_TOKEN + slot);
      } else if (slot !== TLS_TCP_POOL_FULL) {
        return;
      }
    }
  }

  /** Slot `slot`'s descriptor is ready with `events`: drive it, answer it, then re-arm or close it. */
  serve(slot: i32, events: i32, key: Secret<u8[]>): void {
    if (!this.server.holds(slot)) {
      return;
    }
    let wants: i32 = (events & 5) !== 0 ? this.server.readable(slot) : this.server.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      this.server.signP256(slot, key);
    }
    const conn: Http2Connection = this.server.connection(slot);
    let event: i32 = this.server.next(slot);
    while (event !== H2_NEED_MORE && event !== H2_ERROR) {
      this.answer(slot, conn, event);
      event = this.server.next(slot);
    }
    // A body held back by a full output goes on once `flush` has drained it,
    // and no event says when that is: push and flush until a pass moves nothing.
    wants = this.server.flush(slot);
    for (let pass: i32 = 0; pass < 4096 && this.server.holds(slot) && this.pushAll(slot, conn) > 0; pass++) {
      wants = this.server.flush(slot);
    }
    if (!this.server.holds(slot)) {
      return;
    }
    if ((wants & TLS_RECORD_DONE) !== 0) {
      if (this.logging) {
        console.log(`h2 connection closed: streams ${conn.lastPeerStream} error ${conn.errorCode}`);
      }
      this.server.close(slot);
      this.closed = this.closed + 1;
      return;
    }
    pollModify(this.loop, this.server.fd(slot), wants & 3, H2_SLOT_TOKEN + slot);
  }

  /** The entry for a new response on `stream` in `slot`, or `null` when every one is busy. */
  take(slot: i32, stream: i32): H2Pending | null {
    for (let k: i32 = slot * this.perSlot; k < (slot + 1) * this.perSlot; k++) {
      if (this.pending[k].phase === 2) {
        const p: H2Pending = this.pending[k];
        p.stream = stream;
        p.received = 0;
        p.out = [];
        p.at = 0;
        p.phase = 0;
        return p;
      }
    }
    return null;
  }

  /** The response being made on `stream` in `slot`, or `null`. */
  find(slot: i32, stream: i32): H2Pending | null {
    for (let k: i32 = slot * this.perSlot; k < (slot + 1) * this.perSlot; k++) {
      if (this.pending[k].phase !== 2 && this.pending[k].stream === stream) {
        return this.pending[k];
      }
    }
    return null;
  }

  /** The program's answer to one event. */
  answer(slot: i32, conn: Http2Connection, event: i32): void {
    if (event === H2_REQUEST) {
      const p: H2Pending | null = this.take(slot, conn.stream);
      if (p === null) {
        return;
      }
      if (httpFieldIs(conn.fields.method, "GET")) {
        const body: u8[] | null = this.files.get(conn.fields.path);
        if (body === null) {
          this.start(conn, p, STATUS_NOT_FOUND, "text/plain", httpFieldBytes("not found\n"));
        } else {
          this.start(conn, p, STATUS_OK, this.files.type, body);
        }
      } else if (conn.endStream) {
        this.start(conn, p, STATUS_OK, "text/plain", httpFieldBytes("received 0 bytes\n"));
      }
    } else if (event === H2_DATA || event === H2_TRAILERS) {
      // A body ends with END_STREAM on its last DATA frame, or on its trailers.
      const p: H2Pending | null = this.find(slot, conn.stream);
      if (p !== null && p.phase === 0) {
        if (event === H2_DATA) {
          p.received = p.received + toI64(conn.dataLength);
        }
        if (conn.endStream || event === H2_TRAILERS) {
          this.start(conn, p, STATUS_OK, "text/plain", httpFieldBytes(`received ${p.received} bytes\n`));
        }
      }
    } else if (event === H2_WINDOW) {
      this.pushAll(slot, conn);
    }
  }

  /** Sends the head of `p`'s response, of content type `type`, and as much of `body` as the windows take. */
  start(conn: Http2Connection, p: H2Pending, status: i32, type: string, body: u8[]): void {
    const values: u8[][] = [httpFieldBytes(type), httpFieldBytes("nish")];
    if (conn.respond(p.stream, status, this.names, values, false) < 0) {
      p.phase = 2;
      return;
    }
    p.out = body;
    p.phase = 1;
    this.answered = this.answered + 1;
    this.push(conn, p);
  }

  /**
   * Writes what `p` still owes and its END_STREAM, as far as the windows and
   * the output let it; answers how many bytes went, counting an END_STREAM
   * alone as one.
   */
  push(conn: Http2Connection, p: H2Pending): i32 {
    const length: i32 = toI32(p.out.length);
    let moved: i32 = 0;
    while (p.phase === 1) {
      const n: i32 = conn.writeData(p.stream, p.out, p.at, length - p.at, true);
      if (n < 0) {
        // H2_AGAIN waits for a window or for room in the output; anything else ends the response.
        if (n !== H2_AGAIN) {
          p.phase = 2;
        }
        return moved;
      }
      p.at = p.at + n;
      moved = moved + (n > 0 ? n : 1);
      if (p.at >= length) {
        p.phase = 2;
      }
    }
    return moved;
  }

  /** `push` for every response of `slot` still writing; answers how many bytes went. */
  pushAll(slot: i32, conn: Http2Connection): i32 {
    let moved: i32 = 0;
    for (let k: i32 = slot * this.perSlot; k < (slot + 1) * this.perSlot; k++) {
      if (this.pending[k].phase === 1) {
        moved = moved + this.push(conn, this.pending[k]);
      }
    }
    return moved;
  }

  /** Closes every connection and the listener. */
  shutdown(): void {
    for (let slot: i32 = 0; slot < this.server.size(); slot++) {
      this.server.close(slot);
    }
    if (this.listener >= 0) {
      netClose(this.listener);
    }
  }
}
