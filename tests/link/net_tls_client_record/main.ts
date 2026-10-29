// `nish/net/tls/record-client` against `nish/net/tls/record-server`, both
// sans-IO, the bytes shuttled between them in one loop: a handshake per
// suite, a HelloRetryRequest, ALPN and SNI, application data both ways,
// KeyUpdate from each side and its limits, close_notify from each side, a
// close before the verdict, and what a failed connection answers.
import { Suite } from "nish/testing";
import { TLS_LEVEL_HANDSHAKE, TlsServer, tlsSignEcdsaP256 } from "nish/net/tls";
import { Secret, secret, wipe } from "nish:secret";
import {
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_GROUP_SECP256R1,
  TLS_GROUP_X25519,
} from "nish/net/tls/codec";
import { TLS_ALERT_CLOSE_NOTIFY, TLS_CONTENT_HANDSHAKE } from "nish/net/tls/record";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TLS_CLIENT_STATE_WAIT_AUTH, TlsClient, TlsClientConfig } from "nish/net/tls/client";
import { TLS_RECORD_AUTH, TlsRecordClient } from "nish/net/tls/record-client";
import {
  TLS_RECORD_AGAIN,
  TLS_RECORD_DATA,
  TLS_RECORD_DONE,
  TLS_RECORD_MAX_KEY_UPDATES,
  TLS_RECORD_RESET,
  TLS_RECORD_SIGN,
  TLS_RECORD_STATE_CLOSED,
  TLS_RECORD_STATE_FAILED,
  TLS_RECORD_STATE_OPEN,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import { ZERO, ascii } from "../net_tls_record_common/bytes";
import { leafPrivate, newServer, tcpConfig } from "../net_tls_common/server";
import { secretHex } from "../net_tls_common/secrets";

const CERTIFICATE_EXPIRED: i32 = 45;

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
  /** Whether `run` gives the client's verdict when it is asked for one. */
  authenticates: boolean = true;

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
      if (this.authenticates && (this.client.interest() & TLS_RECORD_AUTH) !== 0) {
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

/** A pair connected under the defaults. */
const opened = (): Pair => {
  const pair = new Pair(new TlsClientConfig("localhost", ["h2"]), ["h2"]);
  pair.run();
  return pair;
};

/** The server writes `line` and the bytes reach the client, unread. */
const serverSends = (pair: Pair, line: string): void => {
  const data: u8[] = ascii(line);
  pair.server.write(data, ZERO, toI32(data.length));
  pair.run();
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
  // The same retry under SHA-384: the transcript hash restarts as the suite's.
  const retry384Config = new TlsClientConfig("localhost", ["http/1.1"]);
  retry384Config.groups = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1];
  retry384Config.shareGroup = TLS_GROUP_SECP256R1;
  retry384Config.suites = [TLS_AES_256_GCM_SHA384];
  const retry384 = new Pair(retry384Config, ["http/1.1"]);
  retry384.run();
  t.ok("hrr sha384: retried", retry384.client.tls.retried);
  t.eqI32("hrr sha384: client open", retry384.client.state, TLS_RECORD_STATE_OPEN);
  t.eqI32("hrr sha384: suite", retry384.client.tls.suite, TLS_AES_256_GCM_SHA384);
  retry384.wipe();

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

  // close_notify before the server is authenticated is an error, not an end of stream.
  const early = new TlsRecordClient(new TlsClient(new TlsClientConfig("localhost", ["h2"]), bytes(1), bytes(0x40), bytes(0x60)));
  const closeNotify: u8[] = [0x15, 0x03, 0x03, 0x00, 0x02, 0x01, 0x00];
  early.receive(closeNotify, ZERO, toI32(closeNotify.length));
  t.eqI32("early close: failed", early.state, TLS_RECORD_STATE_FAILED);
  t.ok("early close: not an end of stream", !early.peerClosed);
  t.eqI32("early close: the server's alert", early.peerAlert, TLS_ALERT_CLOSE_NOTIFY);
  t.eqI32("early close: a verdict answers why", early.authenticate(true), TLS_ALERT_INTERNAL_ERROR);

  // A ChangeCipherSpec is dropped only between handshake messages, before the
  // server's Finished, and only as the one byte 1 (RFC 8446 §5).
  const ccs: u8[] = [0x14, 0x03, 0x03, 0x00, 0x01, 0x01];
  const first = new TlsRecordClient(new TlsClient(new TlsClientConfig("localhost", ["h2"]), bytes(1), bytes(0x40), bytes(0x60)));
  first.receive(ccs, ZERO, toI32(ccs.length));
  t.eqI32("ccs before any handshake: failed", first.state, TLS_RECORD_STATE_FAILED);
  t.eqI32("ccs before any handshake: its alert", first.failure(), TLS_ALERT_UNEXPECTED_MESSAGE);
  const split = new TlsRecordClient(new TlsClient(new TlsClientConfig("localhost", ["h2"]), bytes(1), bytes(0x40), bytes(0x60)));
  const partial: u8[] = [0x16, 0x03, 0x03, 0x00, 0x04, 0x02, 0x00, 0x00, 0x50];
  split.receive(partial, ZERO, toI32(partial.length));
  t.ok("ccs mid-message: a partial message waits", split.state !== TLS_RECORD_STATE_FAILED);
  split.receive(ccs, ZERO, toI32(ccs.length));
  t.eqI32("ccs mid-message: failed", split.state, TLS_RECORD_STATE_FAILED);
  t.eqI32("ccs mid-message: its alert", split.failure(), TLS_ALERT_UNEXPECTED_MESSAGE);
  const afterFinished = opened();
  afterFinished.client.receive(ccs, ZERO, toI32(ccs.length));
  t.eqI32("ccs after the server's Finished: failed", afterFinished.client.state, TLS_RECORD_STATE_FAILED);
  t.eqI32("ccs after the server's Finished: its alert", afterFinished.client.failure(), TLS_ALERT_UNEXPECTED_MESSAGE);
  afterFinished.wipe();

  // The server's KeyUpdate asks for the client's, which the client sends.
  const asked = opened();
  t.eqI32("ku asked: server asks", asked.server.keyUpdate(true), ZERO);
  asked.run();
  t.eqI32("ku asked: client counted", asked.client.keyUpdates, 1);
  t.eqI32("ku asked: the client's own reached the server", asked.server.keyUpdates, 1);
  const answered: u8[] = ascii("after the client's answer");
  asked.client.write(answered, ZERO, toI32(answered.length));
  asked.run();
  t.eqStr("ku asked: server reads", text(readServer(asked.server)), "after the client's answer");
  asked.wipe();

  // A KeyUpdate past the limit is unexpected_message; data between them keeps the idle count down.
  const many = opened();
  let taken: i32 = 0;
  for (let k: i32 = 0; k < TLS_RECORD_MAX_KEY_UPDATES; k++) {
    many.server.keyUpdate(false);
    serverSends(many, "x");
    taken = taken + toI32(readClient(many.client).length);
  }
  t.eqI32("ku limit: the first 64 are taken", many.client.keyUpdates, TLS_RECORD_MAX_KEY_UPDATES);
  t.eqI32("ku limit: data between them read", taken, TLS_RECORD_MAX_KEY_UPDATES);
  many.server.keyUpdate(false);
  many.run();
  t.eqI32("ku limit: the next fails", many.client.state, TLS_RECORD_STATE_FAILED);
  t.eqI32("ku limit: unexpected_message", many.client.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  many.wipe();

  // A request_update other than 0 or 1 is illegal_parameter (RFC 8446 §4.6.3).
  const odd = opened();
  const badUpdate: u8[] = [24, 0, 0, 1, 2];
  t.ok("ku request 2: sealed", odd.server.sealRecord(TLS_CONTENT_HANDSHAKE, badUpdate, ZERO, toI32(badUpdate.length)));
  odd.run();
  t.eqI32("ku request 2: failed", odd.client.state, TLS_RECORD_STATE_FAILED);
  t.eqI32("ku request 2: illegal_parameter", odd.client.alert, TLS_ALERT_ILLEGAL_PARAMETER);
  odd.wipe();

  // Data the caller has not read is gone once the connection fails: `read` answers the reset.
  const tiny: u8[] = new Array<u8>(8);
  const cut = opened();
  serverSends(cut, "never read");
  t.ok("truncation: data waits", (cut.client.interest() & TLS_RECORD_DATA) !== 0);
  cut.client.end();
  t.eqI32("truncation: failed", cut.client.state, TLS_RECORD_STATE_FAILED);
  t.eqI32("truncation: read is reset", cut.client.read(tiny, ZERO, toI32(tiny.length)), TLS_RECORD_RESET);
  t.ok("truncation: no data", (cut.client.interest() & TLS_RECORD_DATA) === 0);
  t.eqI32("truncation: a verdict answers why", cut.client.authenticate(true), TLS_ALERT_INTERNAL_ERROR);
  cut.wipe();
  const fatal = opened();
  serverSends(fatal, "never read");
  fatal.server.fail(TLS_ALERT_DECRYPT_ERROR);
  fatal.run();
  t.eqI32("fatal alert: the server's alert", fatal.client.peerAlert, TLS_ALERT_DECRYPT_ERROR);
  t.eqI32("fatal alert: read is reset", fatal.client.read(tiny, ZERO, toI32(tiny.length)), TLS_RECORD_RESET);
  t.eqI32("fatal alert: a verdict answers it", fatal.client.authenticate(true), TLS_ALERT_DECRYPT_ERROR);
  t.eqI32("fatal alert: a refusal answers it", fatal.client.reject(TLS_ALERT_INTERNAL_ERROR), TLS_ALERT_DECRYPT_ERROR);
  fatal.wipe();
  const aborted = opened();
  aborted.client.abort();
  t.eqI32("abort: a verdict answers why", aborted.client.authenticate(true), TLS_ALERT_INTERNAL_ERROR);
  aborted.wipe();

  // Before the verdict nothing of the client's Finished goes out, and data waits.
  const waiting = new Pair(new TlsClientConfig("localhost", ["h2"]), ["h2"]);
  waiting.authenticates = false;
  waiting.run();
  t.ok("verdict: asked for", (waiting.client.interest() & TLS_RECORD_AUTH) !== 0);
  t.eqI32("verdict: the handshake waits", waiting.client.tls.state, TLS_CLIENT_STATE_WAIT_AUTH);
  t.eqI32("verdict: nothing sealed", waiting.client.outputEnd - waiting.client.outputStart, ZERO);
  t.eqI32("verdict: no Finished queued", toI32(waiting.client.tls.takeOutput(TLS_LEVEL_HANDSHAKE).length), ZERO);
  const tooSoon: u8[] = ascii("too soon");
  t.eqI32("verdict: write waits", waiting.client.write(tooSoon, ZERO, toI32(tooSoon.length)), TLS_RECORD_AGAIN);
  t.eqI32("verdict: read waits", waiting.client.read(tiny, ZERO, toI32(tiny.length)), TLS_RECORD_AGAIN);
  const zeros: string = "0000000000000000000000000000000000000000000000000000000000000000";
  t.ok("verdict: the handshake secret is held", secretHex(waiting.client.tls.secrets().clientHandshake) !== zeros);

  // Closed before the verdict: the client reads nothing more and holds no read or handshake keys.
  waiting.client.close();
  t.eqI32("close before the verdict: closed", waiting.client.state, TLS_RECORD_STATE_CLOSED);
  t.ok("close before the verdict: read keys wiped", !waiting.client.readProtection.isProtected());
  t.eqStr("close before the verdict: handshake secret wiped", secretHex(waiting.client.tls.secrets().clientHandshake), zeros);
  t.ok("close before the verdict: no verdict asked", (waiting.client.interest() & TLS_RECORD_AUTH) === 0);
  t.eqI32("close before the verdict: a verdict is refused", waiting.client.authenticate(true), TLS_ALERT_INTERNAL_ERROR);
  const record: u8[] = [0x17, 0x03, 0x03, 0x00, 0x01, 0x00];
  t.eqI32("close before the verdict: the server's bytes are dropped", waiting.client.receive(record, ZERO, toI32(record.length)), toI32(record.length));
  waiting.run();
  t.eqI32("close before the verdict: still closed", waiting.client.state, TLS_RECORD_STATE_CLOSED);
  t.ok("close before the verdict: done", (waiting.client.interest() & TLS_RECORD_DONE) !== 0);
  waiting.wipe();

  // A refusal sends the caller's alert, and the server reads it.
  const refusing = new Pair(new TlsClientConfig("localhost", ["h2"]), ["h2"]);
  refusing.authenticates = false;
  refusing.run();
  t.eqI32("refusal: the caller's alert", refusing.client.reject(CERTIFICATE_EXPIRED), CERTIFICATE_EXPIRED);
  t.eqI32("refusal: failed", refusing.client.state, TLS_RECORD_STATE_FAILED);
  refusing.run();
  t.eqI32("refusal: the server reads it", refusing.server.peerAlert, CERTIFICATE_EXPIRED);
  refusing.wipe();
  return t.done();
};
