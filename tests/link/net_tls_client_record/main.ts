// `nish/net/tls/record-client` against `nish/net/tls/record-server`, both
// sans-IO, the bytes shuttled between them in one loop: a handshake per
// suite, a HelloRetryRequest, ALPN and SNI, application data both ways,
// KeyUpdate from each side, and close_notify from each side.
import { Suite } from "nish/testing";
import { TlsServer, tlsSignEcdsaP256 } from "nish/net/tls";
import { Secret, secret, wipe } from "nish:secret";
import { TLS_GROUP_SECP256R1, TLS_GROUP_X25519 } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TlsClient, TlsClientConfig } from "nish/net/tls/client";
import { TLS_RECORD_AUTH, TlsRecordClient } from "nish/net/tls/record-client";
import {
  TLS_RECORD_DONE,
  TLS_RECORD_SIGN,
  TLS_RECORD_STATE_CLOSED,
  TLS_RECORD_STATE_OPEN,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import { ZERO, ascii } from "../net_tls_record_common/bytes";
import { leafPrivate, newServer, tcpConfig } from "../net_tls_common/server";

const bytes = (start: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(start + k));
  }
  return out;
};

const text = (data: u8[]): string => {
  const out: string[] = [];
  for (const b of data) {
    out.push(String.fromCharCode(toI32(b)));
  }
  return out.join("");
};

/** A client and a server, connected by a loop that moves every byte each has to send. */
class Pair {
  client: TlsRecordClient;
  server: TlsRecordServer;
  tlsServer: TlsServer;
  /** The leaf's signing key, for the server's CertificateVerify. */
  readonly key: Secret<u8[]>;

  constructor(config: TlsClientConfig, alpn: string[]) {
    this.tlsServer = newServer(tcpConfig(alpn));
    this.server = new TlsRecordServer(this.tlsServer);
    this.client = new TlsRecordClient(new TlsClient(config, bytes(1), bytes(0x40), bytes(0x60)));
    this.key = secret(leafPrivate());
  }

  wipe(): void {
    wipe(this.key);
  }

  /** Moves bytes both ways, signing and authenticating as asked, until neither side has anything to send. */
  run(): void {
    for (let round: i32 = 0; round < 64; round++) {
      let moved: boolean = false;
      if (this.client.outputEnd > this.client.outputStart) {
        const n: i32 = this.server.receive(this.client.output, this.client.outputStart, this.client.outputEnd - this.client.outputStart);
        this.client.consume(n);
        moved = true;
      }
      if ((this.server.interest() & TLS_RECORD_SIGN) !== 0) {
        const input: u8[] | null = this.server.signatureInput();
        const none: u8[] = [];
        const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(this.key, input);
        this.server.sign(signature === null ? none : signature);
        moved = true;
      }
      if (this.server.outputEnd > this.server.outputStart) {
        const n: i32 = this.client.receive(this.server.output, this.server.outputStart, this.server.outputEnd - this.server.outputStart);
        this.server.consume(n);
        moved = true;
      }
      if ((this.client.interest() & TLS_RECORD_AUTH) !== 0) {
        this.client.authenticate(true);
        moved = true;
      }
      if (!moved) {
        return;
      }
    }
  }
}

/** Every application byte `conn` holds. */
const readClient = (conn: TlsRecordClient): u8[] => {
  const buf: u8[] = new Array<u8>(256);
  const out: u8[] = [];
  let n: i32 = conn.read(buf, ZERO, toI32(buf.length));
  while (n > 0) {
    for (let k: i32 = 0; k < n && k < toI32(buf.length); k++) {
      out.push(buf[k]);
    }
    n = conn.read(buf, ZERO, toI32(buf.length));
  }
  return out;
};

const readServer = (conn: TlsRecordServer): u8[] => {
  const buf: u8[] = new Array<u8>(256);
  const out: u8[] = [];
  let n: i32 = conn.read(buf, ZERO, toI32(buf.length));
  while (n > 0) {
    for (let k: i32 = 0; k < n && k < toI32(buf.length); k++) {
      out.push(buf[k]);
    }
    n = conn.read(buf, ZERO, toI32(buf.length));
  }
  return out;
};

/** Connects under `suite`, echoes a line each way, and closes from the client. */
const suiteChecks = (t: Suite, name: string, suite: i32): void => {
  const config = new TlsClientConfig("localhost", ["h2"]);
  config.suites = [suite];
  const pair = new Pair(config, ["h2"]);
  pair.run();
  t.eqI32(`${name}: client open`, pair.client.state, TLS_RECORD_STATE_OPEN);
  t.eqI32(`${name}: server open`, pair.server.state, TLS_RECORD_STATE_OPEN);
  t.eqI32(`${name}: suite`, pair.client.tls.suite, suite);
  const ping: u8[] = ascii("ping from the client");
  t.eqI32(`${name}: write`, pair.client.write(ping, ZERO, toI32(ping.length)), toI32(ping.length));
  pair.run();
  t.eqStr(`${name}: server reads`, text(readServer(pair.server)), "ping from the client");
  const pong: u8[] = ascii("pong from the server");
  t.eqI32(`${name}: server writes`, pair.server.write(pong, ZERO, toI32(pong.length)), toI32(pong.length));
  pair.run();
  t.eqStr(`${name}: client reads`, text(readClient(pair.client)), "pong from the server");
  pair.client.close();
  pair.run();
  t.ok(`${name}: server saw close_notify`, pair.server.peerClosed);
  pair.server.close();
  pair.run();
  t.ok(`${name}: client saw close_notify`, pair.client.peerClosed);
  t.eqI32(`${name}: client closed`, pair.client.state, TLS_RECORD_STATE_CLOSED);
  t.ok(`${name}: client done`, (pair.client.interest() & TLS_RECORD_DONE) !== 0);
  pair.wipe();
};

export const main = (): i32 => {
  const t = new Suite("tls record client");
  suiteChecks(t, "aes128", TLS_AES_128_GCM_SHA256);
  suiteChecks(t, "aes256", TLS_AES_256_GCM_SHA384);
  suiteChecks(t, "chacha", TLS_CHACHA20_POLY1305_SHA256);

  // A first share the server does not take: one HelloRetryRequest, then x25519.
  const retryConfig = new TlsClientConfig("localhost", ["http/1.1"]);
  retryConfig.groups = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1];
  retryConfig.shareGroup = TLS_GROUP_SECP256R1;
  const retry = new Pair(retryConfig, ["http/1.1"]);
  retry.run();
  t.ok("hrr: retried", retry.client.tls.retried);
  t.eqI32("hrr: client open", retry.client.state, TLS_RECORD_STATE_OPEN);
  t.eqI32("hrr: share", retry.client.tls.shareGroup, TLS_GROUP_X25519);
  t.eqStr("hrr: alpn", retry.client.tls.alpn(), "http/1.1");
  retry.wipe();

  // ALPN: the server's pick of the client's list, and SNI as the server saw it.
  const alpn = new Pair(new TlsClientConfig("example.com", ["h2", "http/1.1"]), ["http/1.1"]);
  alpn.run();
  t.eqStr("alpn: client", alpn.client.tls.alpn(), "http/1.1");
  t.eqStr("sni: server saw", alpn.tlsServer.serverName, "example.com");
  t.ok("sni: sent", alpn.client.tls.sentServerName);
  alpn.wipe();

  // KeyUpdate both ways: the client's asks for the server's, then the server's own.
  const update = new Pair(new TlsClientConfig("localhost", ["h2"]), ["h2"]);
  update.run();
  t.eqI32("ku: client asks", update.client.keyUpdate(true), ZERO);
  update.run();
  t.eqI32("ku: client sequence reset", toI32(update.client.writeProtection.sequence), ZERO);
  t.eqI32("ku: server answered", update.client.keyUpdates, 1);
  const after: u8[] = ascii("after the client's update");
  update.client.write(after, ZERO, toI32(after.length));
  update.run();
  t.eqStr("ku: server reads", text(readServer(update.server)), "after the client's update");
  t.eqI32("ku: server updates", update.server.keyUpdate(false), ZERO);
  update.run();
  t.eqI32("ku: client counted", update.client.keyUpdates, 2);
  const late: u8[] = ascii("after the server's update");
  update.server.write(late, ZERO, toI32(late.length));
  update.run();
  t.eqStr("ku: client reads", text(readClient(update.client)), "after the server's update");
  update.wipe();

  // The server closes first: the client reads the end of its stream, then closes.
  const serverFirst = new Pair(new TlsClientConfig("localhost", ["h2"]), ["h2"]);
  serverFirst.run();
  serverFirst.server.close();
  serverFirst.run();
  t.ok("close: client saw it", serverFirst.client.peerClosed);
  const buf: u8[] = new Array<u8>(8);
  t.eqI32("close: read is end", serverFirst.client.read(buf, ZERO, toI32(buf.length)), ZERO);
  serverFirst.client.close();
  serverFirst.run();
  t.ok("close: server saw it", serverFirst.server.peerClosed);
  serverFirst.wipe();
  return t.done();
};
