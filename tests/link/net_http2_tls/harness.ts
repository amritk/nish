// A Nish HTTP/2 server on `nish/net/http2-tls` and its Nish clients, in one
// readiness loop over loopback. The server side is what a program built on
// the carrier looks like: accept into a slot, re-arm each descriptor with the
// interest the carrier answers, sign when asked, take the connection's events
// and answer them — a GET with a short body, any other request by echoing its
// body back — and close the slot when it is done. The client side is plain
// `nish:net`, the record layer and `nish/net/http2-frame`. Every wait is
// bounded: five seconds without a wake is a failure, never a hang.
import { Secret, secret, wipe } from "nish:secret";
import { netAddress, netClose, netLocalPort, netRead, netWrite, connectResult, pollAdd, pollCreate, pollModify, pollRemove, pollWait, tcpConnect, tcpListen } from "nish:net";
import { TlsServerConfig } from "nish/net/tls";
import { TLS_RECORD_DONE, TLS_RECORD_SIGN } from "nish/net/tls/record-server";
import { TLS_TCP_POOL_FULL } from "nish/net/tls-tcp";
import { httpFieldBytes, httpFieldIs } from "nish/net/http-fields";
import { H2_DATA, H2_ERROR, H2_NEED_MORE, H2_REQUEST, Http2Config, Http2Connection } from "nish/net/http2";
import { Http2TlsServer } from "nish/net/http2-tls";
import { leafPrivate, serverPrivate } from "../net_tls_common/server";
import { ZERO } from "../net_tls_record_common/bytes";
import { CLIENTS, LISTENER, Peer } from "../net_tls_record_tcp/harness";

const WOULD_BLOCK: i32 = -11;

/** The loop, the server, its clients, and what happened. */
export class H2Loop {
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  server: Http2TlsServer;
  ready: i32[];
  peers: Peer[];
  buf: u8[];
  keyBuffer: u8[];
  randomBuffer: u8[];
  /** The response's one field, made once so that answering allocates nothing. */
  names: u8[][];
  values: u8[][];
  /** A GET's body. */
  body: u8[];
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  accepted: i32 = 0;
  refused: i32 = 0;
  closed: i32 = 0;
  requests: i32 = 0;
  /** While set, how far the server's calls moved the arena, summed. */
  measuring: boolean = false;
  growth: i64 = 0;
  /** Serve mode, for a third-party client: randomness from the system and a line for every connection closed. */
  serving: boolean = false;

  constructor(tls: TlsServerConfig, config: Http2Config, poolSize: i32) {
    this.ready = new Array<i32>(32);
    this.peers = [];
    this.buf = new Array<u8>(20000);
    this.keyBuffer = new Array<u8>(32);
    this.randomBuffer = new Array<u8>(32);
    this.names = [httpFieldBytes("content-type")];
    this.values = [httpFieldBytes("text/plain")];
    this.body = httpFieldBytes("hello from nish/net/http2\n");
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", 0, 16);
    this.port = netLocalPort(this.listener);
    this.server = new Http2TlsServer(tls, config, this.listener, poolSize);
    pollAdd(this.loop, this.listener, 1, LISTENER);
  }

  /** Notes the first failure only. */
  fail(what: string): void {
    if (this.failure === "") {
      this.failure = what;
    }
  }

  /** A new client, connected through the loop; its index, or -1. */
  connect(): i32 {
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", this.port);
    const index: i32 = toI32(this.peers.length);
    const peer = new Peer(CLIENTS + index);
    peer.fd = tcpConnect(addr);
    this.peers.push(peer);
    if (peer.fd < 0) {
      this.fail(`tcpConnect ${peer.fd}`);
      return -1;
    }
    pollAdd(this.loop, peer.fd, 2, peer.token);
    let connected: boolean = false;
    let rounds: i32 = 0;
    while (!connected && rounds < 100 && this.failure === "") {
      connected = this.step(peer.token);
      rounds = rounds + 1;
    }
    const result: i32 = connectResult(peer.fd);
    if (!connected || result !== 0) {
      this.fail(`connect: ${result}`);
      return -1;
    }
    pollModify(this.loop, peer.fd, 1, peer.token);
    return index;
  }

  /** One wait of the loop; true when `token` was among those ready. Five seconds with nothing is a failure. */
  step(token: i32): boolean {
    const n: i32 = pollWait(this.loop, this.ready, 5000);
    if (n <= 0) {
      this.fail("timed out: a wake was lost");
      return false;
    }
    let seen: boolean = false;
    for (let i: i32 = 0; i < n; i++) {
      const who: i32 = this.ready[2 * i];
      const events: i32 = this.ready[2 * i + 1];
      if (who === token) {
        seen = true;
      }
      if (who === LISTENER) {
        this.acceptAll();
      } else if (who >= CLIENTS) {
        this.readPeer(who - CLIENTS);
      } else {
        this.serve(who, events);
      }
    }
    return seen;
  }

  /** Everything waiting on a client's socket into its `got`. */
  readPeer(index: i32): void {
    const peer: Peer = this.peers[index];
    if (peer.ended || peer.fd < 0) {
      return;
    }
    while (true) {
      const n: i32 = netRead(peer.fd, this.buf, ZERO, toI32(this.buf.length));
      if (n <= 0) {
        if (n !== WOULD_BLOCK) {
          peer.ended = true;
          peer.failure = n;
          pollRemove(this.loop, peer.fd);
        }
        return;
      }
      for (let k: i32 = 0; k < n && k < toI32(this.buf.length); k++) {
        peer.got.push(this.buf[k]);
      }
    }
  }

  /** Accepts every waiting connection. */
  acceptAll(): void {
    while (true) {
      const key: u8[] = serverPrivate();
      for (let k: i32 = 0; k < 32 && k < toI32(key.length); k++) {
        this.keyBuffer[k] = key[k];
        this.randomBuffer[k] = toU8(0x40 + this.accepted);
      }
      if (this.serving) {
        crypto.getRandomValues(this.randomBuffer);
        crypto.getRandomValues(this.keyBuffer);
      }
      const slot: i32 = this.server.accept(this.randomBuffer, this.keyBuffer);
      if (slot >= 0) {
        this.accepted = this.accepted + 1;
        pollAdd(this.loop, this.server.fd(slot), 1, slot);
      } else if (slot === TLS_TCP_POOL_FULL) {
        this.refused = this.refused + 1;
      } else {
        return;
      }
    }
  }

  /** A connection's descriptor is ready: drive it, take its events, then re-arm it or close it. */
  serve(slot: i32, events: i32): void {
    const before: i64 = Arena.used();
    let wants: i32 = (events & 5) !== 0 ? this.server.readable(slot) : this.server.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      const key: Secret<u8[]> = secret(leafPrivate());
      this.server.signP256(slot, key);
      wipe(key);
    }
    let event: i32 = this.server.next(slot);
    while (event !== H2_NEED_MORE && event !== H2_ERROR) {
      this.answer(this.server.connection(slot), event);
      event = this.server.next(slot);
    }
    wants = this.server.flush(slot);
    if (this.measuring) {
      this.growth = this.growth + (Arena.used() - before);
    }
    if (!this.server.holds(slot)) {
      return;
    }
    if ((wants & TLS_RECORD_DONE) !== 0) {
      if (this.serving) {
        const alpn: string = this.server.alpn(slot) === "" ? "-" : this.server.alpn(slot);
        console.log(`closed: alpn ${alpn} streams ${this.server.connection(slot).lastPeerStream} error ${this.server.connection(slot).errorCode}`);
      }
      this.server.close(slot);
      this.closed = this.closed + 1;
      return;
    }
    pollModify(this.loop, this.server.fd(slot), wants & 3, slot);
  }

  /** The program's answer to one event: a GET gets the short body, anything else its own body back. */
  answer(conn: Http2Connection, event: i32): void {
    if (event === H2_REQUEST) {
      this.requests = this.requests + 1;
      conn.respond(conn.stream, toI32(200), this.names, this.values, false);
      if (httpFieldIs(conn.fields.method, "GET")) {
        conn.writeData(conn.stream, this.body, ZERO, toI32(this.body.length), true);
      } else if (conn.endStream) {
        conn.writeData(conn.stream, this.body, ZERO, ZERO, true);
      }
    } else if (event === H2_DATA) {
      conn.writeData(conn.stream, conn.data, conn.dataStart, conn.dataLength, conn.endStream);
    }
  }

  /** Sends every byte of `bytes` from client `index`. */
  send(index: i32, bytes: u8[]): void {
    const peer: Peer = this.peers[index];
    let sent: i32 = 0;
    const length: i32 = toI32(bytes.length);
    let rounds: i32 = 0;
    while (sent < length && rounds < 1000) {
      const w: i32 = netWrite(peer.fd, bytes, sent, length - sent);
      if (w > 0) {
        sent = sent + w;
      } else if (w !== WOULD_BLOCK) {
        this.fail(`client write ${w}`);
        return;
      } else {
        this.step(toI32(-1));
      }
      rounds = rounds + 1;
    }
  }

  /** Runs the loop until client `index` holds at least `n` bytes, or its stream has ended; false on a timeout. */
  awaitBytes(index: i32, n: i32): boolean {
    const peer: Peer = this.peers[index];
    while (toI32(peer.got.length) < n && !peer.ended) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return toI32(peer.got.length) >= n;
  }

  /** The next whole record client `index` receives, header and all; empty on a timeout or the end of its stream. */
  nextRecord(index: i32): u8[] {
    const none: u8[] = [];
    if (!this.awaitBytes(index, toI32(5))) {
      return none;
    }
    const got: u8[] = this.peers[index].got;
    const length: i32 = (toI32(got[3]) << 8) | toI32(got[4]);
    if (!this.awaitBytes(index, 5 + length)) {
      return none;
    }
    return this.peers[index].take(5 + length);
  }

  /** Runs the loop until the server has closed `count` connections in all. */
  awaitClosed(count: i32): boolean {
    while (this.closed < count) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return true;
  }

  /** Runs the loop until client `index`'s stream ends; false on a timeout. */
  awaitEnd(index: i32): boolean {
    const peer: Peer = this.peers[index];
    while (!peer.ended) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return true;
  }

  /** Closes client `index`'s socket without a word. */
  hangUp(index: i32): void {
    const peer: Peer = this.peers[index];
    if (peer.fd >= 0) {
      netClose(peer.fd);
      peer.fd = -1;
      peer.ended = true;
    }
  }

  /** Closes every socket the loop made. */
  shutdown(): void {
    for (let k: i32 = 0; k < toI32(this.peers.length); k++) {
      this.hangUp(k);
    }
    for (let slot: i32 = 0; slot < this.server.size(); slot++) {
      this.server.close(slot);
    }
    netClose(this.listener);
    netClose(this.loop);
  }
}
