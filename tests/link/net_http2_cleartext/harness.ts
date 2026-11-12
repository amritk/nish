// A Nish HTTP/2 server on `nish/net/http2-cleartext` and its Nish clients, in
// one readiness loop over loopback. The server side is what a program built on
// the carrier looks like: accept into a slot, re-arm each descriptor with the
// interest the carrier answers, take the connection's events and answer them —
// a GET with a short body, any other request by echoing its body back — and
// close the slot when it is done. The client side is plain `nish:net` and the
// raw frames of `../net_http2/peer`. Every wait is bounded: five seconds
// without a wake is a failure, never a hang.
import { netAddress, netClose, netLocalPort, netRead, netWrite, connectResult, pollAdd, pollCreate, pollModify, pollRemove, pollWait, tcpConnect, tcpListen } from "nish:net";
import { httpFieldBytes, httpFieldIs } from "nish/net/http-fields";
import { H2_DATA, H2_ERROR, H2_NEED_MORE, H2_REQUEST, Http2Config, Http2Connection } from "nish/net/http2";
import { H2C_DONE, H2C_POOL_FULL, Http2CleartextServer } from "nish/net/http2-cleartext";
import { ZERO } from "../net_tls_record_common/bytes";
import { CLIENTS, LISTENER, Peer } from "../net_tls_record_tcp/harness";

const WOULD_BLOCK: i32 = -11;

/** The loop, the server, its clients, and what happened. */
export class H2cLoop {
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  server: Http2CleartextServer;
  ready: i32[];
  peers: Peer[];
  buf: u8[];
  /** The response's one field, made once so that answering allocates nothing. */
  names: u8[][];
  values: u8[][];
  /** A GET's body. */
  body: u8[];
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  accepted: i32 = 0;
  /** The slot the last connection was accepted into, or -1. */
  lastSlot: i32 = -1;
  refused: i32 = 0;
  closed: i32 = 0;
  requests: i32 = 0;
  /** While set, how far the server's `serve` calls (not `accept` or `expire`) moved the arena, summed. */
  measuring: boolean = false;
  growth: i64 = 0;
  /** Serve mode, for a third-party client: a line for every connection closed. */
  serving: boolean = false;

  constructor(config: Http2Config, poolSize: i32, prefaceTimeout: i32) {
    this.ready = new Array<i32>(32);
    this.peers = [];
    this.buf = new Array<u8>(20000);
    this.names = [httpFieldBytes("content-type")];
    this.values = [httpFieldBytes("text/plain")];
    this.body = httpFieldBytes("hello from nish/net/http2\n");
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", 0, 64);
    this.port = netLocalPort(this.listener);
    this.server = new Http2CleartextServer(config, this.listener, poolSize, prefaceTimeout);
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
    const n: i32 = this.wait(toI32(5000));
    if (n <= 0) {
      this.fail("timed out: a wake was lost");
      return false;
    }
    let seen: boolean = false;
    for (let i: i32 = 0; i < n; i++) {
      if (this.ready[2 * i] === token) {
        seen = true;
      }
    }
    return seen;
  }

  /** One wait of at most `ms`, every ready descriptor handled; how many were ready. */
  wait(ms: i32): i32 {
    const n: i32 = pollWait(this.loop, this.ready, ms);
    for (let i: i32 = 0; i < n; i++) {
      const who: i32 = this.ready[2 * i];
      const events: i32 = this.ready[2 * i + 1];
      if (who === LISTENER) {
        this.acceptAll();
      } else if (who >= CLIENTS) {
        this.readPeer(who - CLIENTS);
      } else {
        this.serve(who, events);
      }
    }
    return n;
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
      const slot: i32 = this.server.accept();
      if (slot >= 0) {
        this.accepted = this.accepted + 1;
        this.lastSlot = slot;
        pollAdd(this.loop, this.server.fd(slot), 1, slot);
      } else if (slot === H2C_POOL_FULL) {
        this.refused = this.refused + 1;
      } else {
        return;
      }
    }
  }

  /**
   * A connection's descriptor is ready: drive it, take its events, then re-arm
   * it or close it. A slot the carrier closed itself — a preface that was not
   * HTTP/2's, or a client gone before its preface was whole — counts as closed.
   */
  serve(slot: i32, events: i32): void {
    const before: i64 = Arena.mark();
    let wants: i32 = (events & 5) !== 0 ? this.server.readable(slot) : this.server.writable(slot);
    let event: i32 = this.server.next(slot);
    while (event !== H2_NEED_MORE && event !== H2_ERROR) {
      this.answer(this.server.connection(slot), event);
      event = this.server.next(slot);
    }
    wants = this.server.flush(slot);
    if (this.measuring) {
      this.growth = this.growth + (Arena.mark() - before);
    }
    if (!this.server.holds(slot)) {
      this.closed = this.closed + 1;
      return;
    }
    if ((wants & H2C_DONE) !== 0) {
      if (this.serving) {
        console.log(`closed: streams ${this.server.connection(slot).lastPeerStream} error ${this.server.connection(slot).errorCode}`);
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

  /**
   * Runs the loop in waits of ten milliseconds, calling `expire` after each,
   * until it has closed a slot or `ms` have passed; the slots it closed.
   */
  awaitExpired(ms: i32): i32 {
    const start: i64 = monotonicNanos();
    const limit: i64 = toI64(ms) * toI64(1000000);
    while (monotonicNanos() - start < limit) {
      this.wait(toI32(10));
      const expired: i32 = this.server.expire(monotonicNanos());
      if (expired > 0) {
        this.closed = this.closed + expired;
        return expired;
      }
    }
    return 0;
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
