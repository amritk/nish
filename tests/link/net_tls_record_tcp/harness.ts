// A Nish TLS server on `nish/net/tls-tcp` and its Nish clients, in one
// readiness loop over loopback. The server side is what a program built on
// the carrier looks like: accept into a slot, re-arm each descriptor with the
// interest the carrier answers, sign when asked, echo what it reads, close
// when it is done. The client side is plain `nish:net` and the record layer.
// Every wait is bounded: five seconds without a wake is a failure, never a
// hang.
import { Secret, secret, wipe } from "nish:secret";
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net";
import { TlsServerConfig } from "nish/net/tls";
import {
  TLS_RECORD_DATA,
  TLS_RECORD_DONE,
  TLS_RECORD_SIGN,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import { TLS_TCP_POOL_FULL, TlsTcpServer } from "nish/net/tls-tcp";
import { rfc8448RsaPssSignature, rfc8448ServerPrivate, rfc8448ServerRandom } from "../net_tls_rfc8448/trace";
import { leafPrivate, serverPrivate } from "../net_tls_common/server";
import { ZERO, allZero, range } from "../net_tls_record_common/bytes";

const WOULD_BLOCK: i32 = -11;
/** The listener's token; a connection's token is its slot. */
export const LISTENER: i32 = 1000;
/** The first client's token; client `k` is `CLIENTS + k`. */
export const CLIENTS: i32 = 2000;

/** One client socket and every byte it has read that the test has not taken yet. */
export class Peer {
  fd: i32 = -1;
  token: i32 = 0;
  got: u8[];
  ended: boolean = false;
  /** A failed read: its errno, negated; 0 while none. */
  failure: i32 = 0;

  constructor(token: i32) {
    this.token = token;
    this.got = [];
  }

  /** The first `n` bytes it has read, taken out. */
  take(n: i32): u8[] {
    const out: u8[] = range(this.got, ZERO, n);
    this.got = range(this.got, n, toI32(this.got.length));
    return out;
  }
}

/** How the server signs: with RFC 8448's injected RSA-PSS signature, the P-256 leaf, or a key that is not one. */
export const SIGN_TRACE: i32 = 0;
export const SIGN_LEAF: i32 = 1;
export const SIGN_BROKEN: i32 = 2;

/** The loop, the server, its clients, and what happened. */
export class Loopback {
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  server: TlsTcpServer;
  ready: i32[];
  peers: Peer[];
  /** Each slot's echo that the carrier could not take yet. */
  pending: u8[][];
  buf: u8[];
  signing: i32 = 0;
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  accepted: i32 = 0;
  /** Accepts after which the one key buffer, refilled for every accept, read back as zeros. */
  keysWiped: i32 = 0;
  /** The one buffer every accept's ephemeral key is drawn into, as a server reusing it would. */
  keyBuffer: u8[];
  /**
   * The one buffer every accept's server random is drawn into. Off the
   * trace, each accept fills it with one byte repeated, 0x40 plus the count of
   * accepts so far, so a ServerHello says which accept its random came from.
   */
  randomBuffer: u8[];
  refused: i32 = 0;
  closed: i32 = 0;
  /** While set, how far the server's calls moved the arena, summed. */
  measuring: boolean = false;
  growth: i64 = 0;
  /**
   * Serve mode, for a third-party client: randomness from the system,
   * an HTTP answer to a request that starts `GET `, and a line on stdout
   * for every connection closed.
   */
  serving: boolean = false;
  /** Each slot's bytes so far, while it may still be an HTTP request. */
  requests: u8[][];

  constructor(config: TlsServerConfig, poolSize: i32, signing: i32) {
    this.signing = signing;
    this.ready = new Array<i32>(32);
    this.peers = [];
    this.pending = [];
    this.requests = [];
    this.buf = new Array<u8>(4096);
    this.keyBuffer = new Array<u8>(32);
    this.randomBuffer = new Array<u8>(32);
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", 0, 16);
    this.port = netLocalPort(this.listener);
    this.server = new TlsTcpServer(config, this.listener, poolSize);
    for (let k: i32 = 0; k < poolSize; k++) {
      const none: u8[] = [];
      this.pending.push(none);
      const unread: u8[] = [];
      this.requests.push(unread);
    }
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

  /**
   * One wait of the loop, serving the server's descriptors and reading the
   * clients'. True when `token` was among those ready. A wait of five
   * seconds with nothing is a failure.
   */
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
    let reading: boolean = true;
    while (reading) {
      const n: i32 = netRead(peer.fd, this.buf, ZERO, toI32(this.buf.length));
      if (n > 0) {
        for (let k: i32 = 0; k < n && k < toI32(this.buf.length); k++) {
          peer.got.push(this.buf[k]);
        }
      } else {
        if (n === 0 || (n < 0 && n !== WOULD_BLOCK)) {
          peer.ended = true;
          peer.failure = n;
          pollRemove(this.loop, peer.fd);
        }
        reading = false;
      }
    }
  }

  /** Accepts every waiting connection, with the randomness of the signing mode. */
  acceptAll(): void {
    let more: boolean = true;
    while (more) {
      const key: u8[] = this.signing === SIGN_TRACE ? rfc8448ServerPrivate() : serverPrivate();
      const traceRandom: u8[] = rfc8448ServerRandom();
      for (let k: i32 = 0; k < toI32(this.keyBuffer.length) && k < toI32(key.length); k++) {
        this.keyBuffer[k] = key[k];
      }
      for (let k: i32 = 0; k < toI32(this.randomBuffer.length) && k < toI32(traceRandom.length); k++) {
        this.randomBuffer[k] = this.signing === SIGN_TRACE ? traceRandom[k] : toU8(0x40 + this.accepted);
      }
      if (this.serving) {
        crypto.getRandomValues(this.randomBuffer);
        crypto.getRandomValues(this.keyBuffer);
      }
      const slot: i32 = this.server.accept(this.randomBuffer, this.keyBuffer);
      if (slot >= 0) {
        this.accepted = this.accepted + 1;
        this.keysWiped = this.keysWiped + (allZero(this.keyBuffer) ? 1 : 0);
        this.requests[slot] = [];
        pollAdd(this.loop, this.server.fd(slot), 1, slot);
      } else if (slot === TLS_TCP_POOL_FULL) {
        this.refused = this.refused + 1;
      } else {
        more = false;
      }
    }
  }

  /** A connection's descriptor is ready: drive it, then re-arm it or close it. */
  serve(slot: i32, events: i32): void {
    const before: i64 = Arena.used();
    let wants: i32 = (events & 5) !== 0 ? this.server.readable(slot) : this.server.writable(slot);
    this.track(before);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      wants = this.sign(slot);
    }
    if ((wants & TLS_RECORD_DATA) !== 0 || toI32(this.pending[slot].length) > 0) {
      wants = this.echo(slot);
    }
    if (!this.server.holds(slot)) {
      return;
    }
    if ((wants & TLS_RECORD_DONE) !== 0) {
      this.server.close(slot);
      this.closed = this.closed + 1;
      if (this.serving) {
        this.report(slot);
      }
      return;
    }
    pollModify(this.loop, this.server.fd(slot), wants & 3, slot);
  }

  /** While measuring, adds how far the arena moved since `before`: one carrier call's worth, the harness's own allocations left out. */
  track(before: i64): void {
    if (this.measuring) {
      this.growth = this.growth + (Arena.used() - before);
    }
  }

  /** Signs the CertificateVerify the way this loop was told to. */
  sign(slot: i32): i32 {
    if (this.signing === SIGN_TRACE) {
      return this.server.sign(slot, rfc8448RsaPssSignature());
    }
    const key: Secret<u8[]> = secret(this.signing === SIGN_LEAF ? leafPrivate() : new Array<u8>(3));
    const wants: i32 = this.server.signP256(slot, key);
    wipe(key);
    return wants;
  }

  /**
   * Writes back everything the client sent, as far as the carrier takes it,
   * keeping the rest for when the socket drains. The client's end of stream
   * is answered with the server's own close.
   */
  echo(slot: i32): i32 {
    while (true) {
      const held: u8[] = this.pending[slot];
      if (toI32(held.length) > 0) {
        const writing: i64 = Arena.used();
        const w: i32 = this.server.write(slot, held, ZERO, toI32(held.length));
        this.track(writing);
        if (w < 0) {
          return this.server.interest(slot);
        }
        this.pending[slot] = range(held, w, toI32(held.length));
        if (w < toI32(held.length)) {
          return this.server.interest(slot);
        }
      }
      const reading: i64 = Arena.used();
      const n: i32 = this.server.read(slot, this.buf, ZERO, toI32(this.buf.length));
      this.track(reading);
      if (n === 0) {
        // The client's close_notify: the server closes too, in `serve`.
        return TLS_RECORD_DONE;
      }
      if (n < 0) {
        return this.server.interest(slot);
      }
      if (this.serving && this.answersHttp(slot, n)) {
        return this.server.interest(slot);
      }
      this.pending[slot] = range(this.buf, ZERO, n);
    }
  }

  /**
   * In serve mode, a connection whose first bytes are `GET ` is an HTTP
   * request: once its head has ended the answer is written and the
   * connection closed. True when the bytes in `buf[0 .. n)` were taken
   * as part of a request.
   */
  answersHttp(slot: i32, n: i32): boolean {
    const so: u8[] = this.requests[slot];
    for (let k: i32 = 0; k < n && k < toI32(this.buf.length); k++) {
      so.push(this.buf[k]);
    }
    const text: u8[] = so;
    const isGet: boolean =
      toI32(text.length) >= 4 && text[0] === toU8(71) && text[1] === toU8(69) && text[2] === toU8(84) && text[3] === toU8(32);
    if (!isGet) {
      this.requests[slot] = [];
      return false;
    }
    let ended: boolean = false;
    for (let k: i32 = 3; k < toI32(text.length); k++) {
      if (text[k - 3] === toU8(13) && text[k - 2] === toU8(10) && text[k - 1] === toU8(13) && text[k] === toU8(10)) {
        ended = true;
      }
    }
    if (ended) {
      const body: string = "hello from nish/net/tls-tcp\n";
      const answer: string = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`;
      const bytes: u8[] = [];
      for (let k: i32 = 0; k < toI32(answer.length); k++) {
        bytes.push(toU8(answer.charCodeAt(k)));
      }
      this.server.write(slot, bytes, ZERO, toI32(bytes.length));
      this.server.close(slot);
      this.closed = this.closed + 1;
      this.report(slot);
    }
    return true;
  }

  /** Serve mode's line for a connection that has ended: what was negotiated and how it ended. */
  report(slot: i32): void {
    const conn: TlsRecordServer = this.server.connection(slot);
    const alpn: string = conn.tls.alpn === "" ? "-" : conn.tls.alpn;
    const name: string = conn.tls.serverName === "" ? "-" : conn.tls.serverName;
    console.log(
      `closed: suite ${conn.tls.suite} alpn ${alpn} sni ${name} sent ${conn.alert} received ${conn.peerAlert} client-closed ${conn.peerClosed}`
    );
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

  /** Stops reading client `index`'s socket, so what arrives stays unread and closing it resets the connection. */
  mute(index: i32): void {
    const peer: Peer = this.peers[index];
    if (peer.fd >= 0) {
      pollRemove(this.loop, peer.fd);
    }
  }

  /** Closes client `index`'s socket without a word of TLS. */
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
