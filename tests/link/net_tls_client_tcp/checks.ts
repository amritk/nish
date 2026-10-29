// `nish/net/tls-tcp-client` over loopback:
//
//   1. The calls a client answers before it is connected, and the connects
//      that fail: a name that is not an address, a second connect, a port
//      nobody listens on, a deadline already gone.
//   2. A handshake against the Nish carrier in this process, with the
//      authenticator a test supplies. The client blocks, so it is driven
//      with short deadlines and the server served between them: each timeout
//      leaves the handshake where it was. Then an echo, a read with nothing
//      to read, the server's close_notify, and a close.
//   3. Refusals: a chain the authenticator refuses (`unknown_ca`), a
//      TLS 1.2 server (`protocol_version`), a server that hangs up mid
//      handshake, and one that never answers, whose timeout is measured.
//
// openssl s_server drives the same client from the `net_tls_client`
// block of tests/run.js.
import { Suite } from "nish/testing";
import { monotonicNanos } from "nish:process";
import {
  netAddress,
  netClose,
  netLocalPort,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpListen,
} from "nish:net";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import {
  TLS_RECORD_CLIENT_AGAIN,
  TLS_RECORD_CLIENT_INVALID,
  TLS_RECORD_CLIENT_RESET,
  TLS_RECORD_CLIENT_STATE_FAILED,
  TLS_RECORD_CLIENT_STATE_OPEN,
  tlsRecordClientAuthenticate,
} from "nish/net/tls/record-client";
import {
  TLS_TCP_CLIENT_AUTHENTICATE,
  TLS_TCP_CLIENT_NOT_CONNECTED,
  TLS_TCP_CLIENT_TIMEOUT,
  TlsTcpClient,
  tlsTcpClientHandshake,
} from "nish/net/tls-tcp-client";
import { tcpConfig } from "../net_tls_common/server";
import { PinnedLeaf, UNKNOWN_CA, clientConfig, newClient, pinnedChain, pinnedSignature } from "../net_tls_client/harness";
import { CLIENTS, LISTENER, Loopback, SIGN_LEAF } from "../net_tls_record_tcp/harness";
import { ZERO, ascii, range } from "../net_tls_record_common/bytes";
import { sameBytes } from "../crypto_x509/hex";

const MILLISECOND: i64 = 1000000;
const PROTOCOL_VERSION: i32 = 70;
const REFUSED: i32 = -111;

/** The monotonic clock `ms` milliseconds from now. */
const after = (ms: i32): i64 => monotonicNanos() + toI64(ms) * MILLISECOND;

/** No ALPN offered. */
const noAlpn = (): string[] => {
  const none: string[] = [];
  return none;
};

/** A client for "localhost" offering every suite, not yet connected. */
const fresh = (alpn: string[]): TlsTcpClient =>
  new TlsTcpClient(newClient(clientConfig([toI32(0x1301), toI32(0x1302), toI32(0x1303)], alpn, false)));

/**
 * Serves whatever the loop has ready without blocking: the client in this
 * process blocks in its own calls, so the server only moves between them.
 */
const pump = (lb: Loopback): void => {
  const n: i32 = pollWait(lb.loop, lb.ready, toI32(1));
  for (let i: i32 = 0; i < n; i++) {
    const who: i32 = lb.ready[2 * i];
    const events: i32 = lb.ready[2 * i + 1];
    if (who === LISTENER) {
      lb.acceptAll();
    } else if (who < CLIENTS) {
      lb.serve(who, events);
    }
  }
};

/**
 * Runs `client`'s handshake against `lb` in short waits, answering the
 * verdict on the server with `auth` through the record layer's call: the
 * handshake's answer, never a timeout unless two hundred rounds pass.
 */
const drive = (lb: Loopback, client: TlsTcpClient, auth: PinnedLeaf): i32 => {
  for (let round: i32 = 0; round < 200; round++) {
    const answer: i32 = client.handshake(after(toI32(2)));
    if (answer === TLS_TCP_CLIENT_AUTHENTICATE) {
      tlsRecordClientAuthenticate(client.conn, auth, pinnedChain, pinnedSignature);
    } else if (answer !== TLS_TCP_CLIENT_TIMEOUT) {
      return answer;
    }
    pump(lb);
  }
  return TLS_TCP_CLIENT_TIMEOUT;
};

/** `drive`, through `tlsTcpClientHandshake`, which never answers `TLS_TCP_CLIENT_AUTHENTICATE`. */
const driveWhole = (lb: Loopback, client: TlsTcpClient, auth: PinnedLeaf): i32 => {
  for (let round: i32 = 0; round < 200; round++) {
    const answer: i32 = tlsTcpClientHandshake(client, auth, pinnedChain, pinnedSignature, after(toI32(2)));
    if (answer !== TLS_TCP_CLIENT_TIMEOUT) {
      return answer;
    }
    pump(lb);
  }
  return TLS_TCP_CLIENT_TIMEOUT;
};

/** Reads into `buf` in short waits, serving `lb` between them: what `read` answers. */
const readFrom = (lb: Loopback, client: TlsTcpClient, buf: u8[]): i32 => {
  for (let round: i32 = 0; round < 200; round++) {
    const n: i32 = client.read(buf, ZERO, toI32(buf.length), after(toI32(2)));
    if (n !== TLS_TCP_CLIENT_TIMEOUT) {
      return n;
    }
    pump(lb);
  }
  return TLS_TCP_CLIENT_TIMEOUT;
};

/** A port nothing listens on: a listener's, closed. */
const closedPort = (): i32 => {
  const fd: i32 = tcpListen("127.0.0.1", toI32(0), toI32(1));
  const port: i32 = netLocalPort(fd);
  netClose(fd);
  return port;
};

/** A listener of its own and the one connection a test takes from it. */
class Raw {
  listener: i32 = -1;
  loop: i32 = -1;
  fd: i32 = -1;
  port: i32 = 0;
  ready: i32[];

  constructor() {
    this.ready = new Array<i32>(2);
    this.listener = tcpListen("127.0.0.1", toI32(0), toI32(4));
    this.port = netLocalPort(this.listener);
    this.loop = pollCreate();
    pollAdd(this.loop, this.listener, toI32(1), toI32(1));
  }

  /** Takes the waiting connection, waiting a second at most; true when there was one. */
  accept(): boolean {
    if (pollWait(this.loop, this.ready, toI32(1000)) <= 0) {
      return false;
    }
    const peer: u8[] = new Array<u8>(18);
    this.fd = tcpAccept(this.listener, peer);
    return this.fd >= 0;
  }

  close(): void {
    if (this.fd >= 0) {
      netClose(this.fd);
    }
    netClose(this.listener);
    netClose(this.loop);
  }
}

/** A TLS 1.2 ServerHello record: ECDHE-RSA-AES128-GCM-SHA256, no session id, no extensions. */
const tls12ServerHello = (): u8[] => {
  const out: u8[] = [toU8(22), toU8(3), toU8(3), toU8(0), toU8(44), toU8(2), toU8(0), toU8(0), toU8(40), toU8(3), toU8(3)];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(7));
  }
  const tail: u8[] = [toU8(0), toU8(0xc0), toU8(0x2f), toU8(0), toU8(0), toU8(0)];
  for (let k: i32 = 0; k < toI32(tail.length); k++) {
    out.push(tail[k]);
  }
  return out;
};

/** What a client answers before it is connected, and the connects that fail. */
const checkConnect = (t: Suite): void => {
  const buf: u8[] = new Array<u8>(8);
  const idle: TlsTcpClient = fresh(noAlpn());
  t.eqI32("handshake before connect", idle.handshake(after(toI32(100))), TLS_TCP_CLIENT_NOT_CONNECTED);
  t.eqI32("read before connect", idle.read(buf, ZERO, toI32(8), after(toI32(100))), TLS_TCP_CLIENT_NOT_CONNECTED);
  t.eqI32("write before connect", idle.write(buf, ZERO, toI32(8), after(toI32(100))), TLS_TCP_CLIENT_NOT_CONNECTED);
  t.eqI32("a name, not an address", idle.connect("localhost", toI32(443), after(toI32(100))), TLS_RECORD_CLIENT_INVALID);
  t.eqI32("and no socket kept", idle.fd, toI32(-1));
  idle.close();
  idle.close();
  t.ok("close before connect, twice", idle.fd === -1);

  const refused: TlsTcpClient = fresh(noAlpn());
  t.eqI32("a port nobody listens on", refused.connect("127.0.0.1", closedPort(), after(toI32(1000))), REFUSED);
  t.eqI32("and its socket closed", refused.fd, toI32(-1));
  refused.close();

  const raw: Raw = new Raw();
  const late: TlsTcpClient = fresh(noAlpn());
  t.eqI32("a deadline already gone", late.connect("127.0.0.1", raw.port, monotonicNanos() - MILLISECOND), TLS_TCP_CLIENT_TIMEOUT);
  t.eqI32("and its socket closed", late.fd, toI32(-1));
  late.close();

  const twice: TlsTcpClient = fresh(noAlpn());
  t.eqI32("connect", twice.connect("127.0.0.1", raw.port, after(toI32(1000))), toI32(0));
  t.eqI32("a second connect", twice.connect("127.0.0.1", raw.port, after(toI32(1000))), TLS_RECORD_CLIENT_INVALID);
  t.ok("keeps the first socket", twice.fd >= 0);
  t.eqI32("read during the handshake", twice.read(buf, ZERO, toI32(8), after(toI32(100))), TLS_RECORD_CLIENT_AGAIN);

  // The listener takes the connection into its backlog but nobody answers:
  // the handshake times out, no sooner than its deadline.
  const before: i64 = monotonicNanos();
  t.eqI32("a server that never answers", twice.handshake(before + toI64(50) * MILLISECOND), TLS_TCP_CLIENT_TIMEOUT);
  const waited: i64 = monotonicNanos() - before;
  t.ok("waited the deadline out", waited >= toI64(50) * MILLISECOND);
  t.ok("and not much longer", waited < toI64(2000) * MILLISECOND);
  t.ok("and the socket kept", twice.fd >= 0);
  twice.close();
  t.eqI32("write after close", twice.write(buf, ZERO, toI32(8), after(toI32(100))), TLS_TCP_CLIENT_NOT_CONNECTED);
  t.eqI32("handshake after close", twice.handshake(after(toI32(100))), TLS_TCP_CLIENT_NOT_CONNECTED);
  raw.close();
};

/** A handshake against the Nish carrier, an echo, a timed-out read, and both closes. */
const checkCarrier = (t: Suite): void => {
  const lb: Loopback = new Loopback(tcpConfig(noAlpn()), toI32(4), SIGN_LEAF);
  const auth: PinnedLeaf = new PinnedLeaf();
  const client: TlsTcpClient = fresh(noAlpn());
  t.eqI32("carrier: connect", client.connect("127.0.0.1", lb.port, after(toI32(1000))), toI32(0));
  t.eqI32("carrier: a handshake that cannot finish yet", client.handshake(after(toI32(1))), TLS_TCP_CLIENT_TIMEOUT);
  t.eqI32("carrier: handshake", drive(lb, client, auth), toI32(0));
  t.eqI32("carrier: open", client.conn.state, TLS_RECORD_CLIENT_STATE_OPEN);
  t.eqI32("carrier: suite", client.conn.tls.suite, TLS_AES_128_GCM_SHA256);
  t.eqI32("carrier: one chain check", auth.chainCalls, toI32(1));
  t.eqI32("carrier: one signature check", auth.signatureCalls, toI32(1));
  t.eqI32("carrier: handshake again", client.handshake(after(toI32(100))), toI32(0));

  const hello: u8[] = ascii("hello over tcp");
  t.eqI32("carrier: write", client.write(hello, ZERO, toI32(hello.length), after(toI32(1000))), toI32(hello.length));
  const buf: u8[] = new Array<u8>(64);
  const n: i32 = readFrom(lb, client, buf);
  t.eqI32("carrier: the echo's length", n, toI32(hello.length));
  t.ok("carrier: the echo", n === toI32(hello.length) && sameBytes(range(buf, ZERO, n), hello));

  const before: i64 = monotonicNanos();
  t.eqI32("carrier: a read with nothing sent", client.read(buf, ZERO, toI32(64), before + toI64(20) * MILLISECOND), TLS_TCP_CLIENT_TIMEOUT);
  t.ok("carrier: waited the deadline out", monotonicNanos() - before >= toI64(20) * MILLISECOND);
  t.eqI32("carrier: still open", client.conn.state, TLS_RECORD_CLIENT_STATE_OPEN);
  t.eqI32("carrier: a read of nothing", client.read(buf, ZERO, toI32(0), after(toI32(100))), toI32(0));

  const again: u8[] = ascii("and again");
  t.eqI32("carrier: write after a timeout", client.write(again, ZERO, toI32(again.length), after(toI32(1000))), toI32(again.length));
  t.eqI32("carrier: echoed after a timeout", readFrom(lb, client, buf), toI32(again.length));

  lb.server.close(lb.latest);
  t.eqI32("carrier: the server's close_notify", readFrom(lb, client, buf), toI32(0));
  t.ok("carrier: seen as closed", client.conn.peerClosed);
  t.eqI32("carrier: and again", client.read(buf, ZERO, toI32(64), after(toI32(100))), toI32(0));
  client.close();
  client.close();
  t.eqI32("carrier: closed", client.fd, toI32(-1));
  t.ok("carrier: keys wiped", !client.conn.readProtection.isProtected() && !client.conn.writeProtection.isProtected());
  t.eqStr("carrier: no failure in the server", lb.failure, "");
  lb.shutdown();
};

/** ALPN through `tlsTcpClientHandshake`, then a close from the client the server answers. */
const checkWhole = (t: Suite): void => {
  const lb: Loopback = new Loopback(tcpConfig(["h2", "http/1.1"]), toI32(4), SIGN_LEAF);
  const auth: PinnedLeaf = new PinnedLeaf();
  const client: TlsTcpClient = fresh(["http/1.1"]);
  t.eqI32("whole: connect", client.connect("127.0.0.1", lb.port, after(toI32(1000))), toI32(0));
  t.eqI32("whole: handshake", driveWhole(lb, client, auth), toI32(0));
  t.eqStr("whole: ALPN", client.conn.tls.alpn, "http/1.1");
  const closedBefore: i32 = lb.closed;
  client.close();
  for (let round: i32 = 0; round < 50 && lb.closed === closedBefore; round++) {
    pump(lb);
  }
  t.eqI32("whole: the server saw the close_notify", lb.closed, closedBefore + 1);
  t.eqStr("whole: no failure in the server", lb.failure, "");
  lb.shutdown();
};

/** A chain the authenticator refuses, a TLS 1.2 server, and a server that hangs up. */
const checkRefusals = (t: Suite): void => {
  const lb: Loopback = new Loopback(tcpConfig(noAlpn()), toI32(4), SIGN_LEAF);
  const auth: PinnedLeaf = new PinnedLeaf();
  auth.certificate = ascii("not the leaf");
  const client: TlsTcpClient = fresh(noAlpn());
  t.eqI32("refused chain: connect", client.connect("127.0.0.1", lb.port, after(toI32(1000))), toI32(0));
  t.eqI32("refused chain: unknown_ca", driveWhole(lb, client, auth), UNKNOWN_CA);
  t.eqI32("refused chain: failed", client.conn.state, TLS_RECORD_CLIENT_STATE_FAILED);
  t.eqI32("refused chain: the signature not checked", auth.signatureCalls, toI32(0));
  const buf: u8[] = new Array<u8>(8);
  t.eqI32("refused chain: a read", client.read(buf, ZERO, toI32(8), after(toI32(100))), UNKNOWN_CA);
  t.eqI32("refused chain: a write", client.write(buf, ZERO, toI32(8), after(toI32(100))), UNKNOWN_CA);
  t.eqI32("refused chain: handshake again", client.handshake(after(toI32(100))), UNKNOWN_CA);
  client.close();
  lb.shutdown();

  const old: Raw = new Raw();
  const toOld: TlsTcpClient = fresh(noAlpn());
  t.eqI32("TLS 1.2 server: connect", toOld.connect("127.0.0.1", old.port, after(toI32(1000))), toI32(0));
  t.ok("TLS 1.2 server: accepted", old.accept());
  const hello: u8[] = tls12ServerHello();
  netWrite(old.fd, hello, ZERO, toI32(hello.length));
  t.eqI32("TLS 1.2 server: protocol_version", toOld.handshake(after(toI32(2000))), PROTOCOL_VERSION);
  toOld.close();
  old.close();

  const gone: Raw = new Raw();
  const toGone: TlsTcpClient = fresh(noAlpn());
  t.eqI32("a server that hangs up: connect", toGone.connect("127.0.0.1", gone.port, after(toI32(1000))), toI32(0));
  t.ok("a server that hangs up: accepted", gone.accept());
  netClose(gone.fd);
  gone.fd = -1;
  t.eqI32("a server that hangs up: reset", toGone.handshake(after(toI32(2000))), TLS_RECORD_CLIENT_RESET);
  toGone.close();
  gone.close();
};

export const tcpClientChecks = (): i32 => {
  const t = new Suite("nish/net/tls-tcp-client");
  checkConnect(t);
  checkCarrier(t);
  checkWhole(t);
  checkRefusals(t);
  return t.done();
};
