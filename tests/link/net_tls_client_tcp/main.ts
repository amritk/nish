// `nish/net/tls-tcp`'s client and `nish/net/tls/verify` over loopback. With
// no arguments it runs the checks: a `TlsTcpClient` against a `TlsTcpServer`
// in one loop, `tlsConnect`'s failures below TLS, and the CertificateVerify
// check on its own. With `connect <port> <name> <alpn> <groups>` it is a
// client alone for a third-party server: it runs `tlsConnectWith` to
// 127.0.0.1:<port> and prints one line of what the handshake reached. The
// `net_tls_client_tcp` block of tests/run.js drives that mode against
// openssl s_server. With `exchange <port> <reply> <last>` it runs
// `tlsConnect` to that port with the blocking calls alone, as `exchange`
// below says.
//
// The loopback server sends `chain.ts`'s leaves, and the client trusts only
// its root: a good chain opens and carries data both ways to close_notify;
// a wrong name, an expired leaf, an untrusted root and a CertificateVerify
// over other bytes each fail with their own alert, which the server reads.
import { Suite } from "nish/testing";
import { netAddress, netClose, netLocalPort, tcpListen } from "nish:net";
import { monotonicNanos } from "nish:process";
import { Secret, secret, wipe } from "nish:secret";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import {
  TLS_ALERT_BAD_CERTIFICATE,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_NO_APPLICATION_PROTOCOL,
  TLS_GROUP_SECP256R1,
  TLS_GROUP_X25519,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_SIGNATURE_ECDSA_SECP384R1_SHA384,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
} from "nish/net/tls/codec";
import { TlsClientConfig } from "nish/net/tls/client";
import { TLS_RECORD_DONE } from "nish/net/tls/record-server";
import {
  TLS_ALERT_CERTIFICATE_EXPIRED,
  TLS_ALERT_UNKNOWN_CA,
  TlsClientTrust,
  tlsClientChain,
  tlsClientSystemTrust,
  tlsVerifyCertificateVerify,
} from "nish/net/tls/verify";
import { TLS_TCP_TIMED_OUT, TlsTcpClient, tlsConnect, tlsConnectWith } from "nish/net/tls-tcp";
import { X509Certificate, x509ParseCertificate } from "nish/crypto/x509";
import { leafCertificate, leafPrivate } from "../net_tls_common/server";
import { chainConfig, expiredLeaf, goodLeaf, loopbackRoot } from "./chain";
import { Loop, SIGN_OTHER } from "./loop";

const CONNECTION_REFUSED: i32 = -111;
const INVALID: i32 = -22;
const PIPE: i32 = -32;
const INTERNAL_ERROR: i32 = 80;

/** The decimal number `text` spells, or -1. */
const decimal = (text: string): i32 => {
  let n: i32 = 0;
  const length: i32 = toI32(text.length);
  if (length === 0 || length > 6) {
    return -1;
  }
  for (let k: i32 = 0; k < length; k++) {
    const digit: i32 = toI32(text.charCodeAt(k)) - 48;
    if (digit < 0 || digit > 9) {
      return -1;
    }
    n = n * 10 + digit;
  }
  return n;
};

/** An address on loopback that refuses connections: a port that was listening and is no longer. */
const refusingAddress = (): u8[] => {
  const listener: i32 = tcpListen("127.0.0.1", 0, 1);
  const port: i32 = netLocalPort(listener);
  netClose(listener);
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", port);
  return addr;
};

/** The trust holding the loopback root alone. */
const rootTrust = (t: Suite): TlsClientTrust => {
  const roots: X509Certificate[] = [];
  const root: X509Certificate | null = x509ParseCertificate(loopbackRoot());
  if (root === null) {
    t.fail("chain: the root parses", "");
  } else {
    roots.push(root);
  }
  return new TlsClientTrust(roots);
};

/** The loopback handshakes, each opening or ending at the client's verdict. */
const loopbackChecks = (t: Suite): void => {
  const trust: TlsClientTrust = rootTrust(t);
  const none: X509Certificate[] = [];
  const untrusted = new TlsClientTrust(none);

  // A good chain and signature: open, and data both ways until the server's close_notify.
  const lb = new Loop(chainConfig([goodLeaf()], ["http/1.1"]));
  const good: TlsTcpClient = lb.run(new TlsClientConfig("localhost", ["h2", "http/1.1"]), trust);
  t.eqBool("open: opened", lb.opened, true);
  t.eqBool("open: suite negotiated", good.conn.tls.suite !== 0, true);
  t.eqBool("open: alpn chosen", good.conn.tls.alpnChosen === "http/1.1", true);
  t.eqBool("open: the server chose it", lb.chose === "http/1.1", true);
  t.eqBool("open: the server saw the name", lb.sawName === "localhost", true);
  t.eqBool("open: the server read the ping, then data under each next key of the client's", lb.serverGot === "ping!?", true);
  t.eqBool("open: the client read the pong", lb.clientGot === "pong", true);
  t.eqBool("open: close_notify ends the client's stream", lb.clientEnded, true);
  t.eqI32("open: socket closed", good.fd(), -1);
  t.eqI32("open: done", good.interest(), TLS_RECORD_DONE);
  t.eqI32("open: a read after close is -32", good.read(lb.buf, 0, 4), PIPE);
  t.eqI32("keyupdate: the client read the server's answer and its request", lb.clientUpdates, 2);
  t.eqI32("keyupdate: the server read the client's request and its answer", lb.serverUpdates, 2);
  t.eqBool("open: no wake lost", lb.failure === "", true);

  // An IP literal is never sent as server_name, and is matched against the SAN's address.
  lb.run(new TlsClientConfig("127.0.0.1", ["http/1.1"]), trust);
  t.eqBool("literal: opened on the SAN's address", lb.opened, true);
  t.eqBool("literal: no server_name", lb.sawName === "", true);

  // A name the leaf does not carry.
  const host: TlsTcpClient = lb.run(new TlsClientConfig("other.test", ["http/1.1"]), trust);
  t.eqBool("host: not opened", lb.opened, false);
  t.eqI32("host: bad_certificate", host.failure(), TLS_ALERT_BAD_CERTIFICATE);
  t.eqI32("host: the server reads it", lb.peerAlert, TLS_ALERT_BAD_CERTIFICATE);

  // A root the client does not trust.
  const unknown: TlsTcpClient = lb.run(new TlsClientConfig("localhost", ["http/1.1"]), untrusted);
  t.eqBool("untrusted: not opened", lb.opened, false);
  t.eqI32("untrusted: unknown_ca", unknown.failure(), TLS_ALERT_UNKNOWN_CA);
  t.eqI32("untrusted: the server reads it", lb.peerAlert, TLS_ALERT_UNKNOWN_CA);
  t.eqBool("untrusted: no wake lost", lb.failure === "", true);

  // A protocol the server does not speak: its alert, read by the client.
  const alpn: TlsTcpClient = lb.run(new TlsClientConfig("localhost", ["h2"]), trust);
  t.eqI32("alpn: the server's no_application_protocol", alpn.failure(), TLS_ALERT_NO_APPLICATION_PROTOCOL);
  t.eqBool("alpn: no wake lost", lb.failure === "", true);

  // A CertificateVerify over other bytes, on a chain that would pass: decrypt_error.
  lb.signing = SIGN_OTHER;
  const forged: TlsTcpClient = lb.run(new TlsClientConfig("localhost", ["http/1.1"]), trust);
  t.eqBool("forged: not opened", lb.opened, false);
  t.eqI32("forged: decrypt_error", forged.failure(), TLS_ALERT_DECRYPT_ERROR);
  t.eqI32("forged: the server reads it", lb.peerAlert, TLS_ALERT_DECRYPT_ERROR);
  t.eqBool("forged: no wake lost", lb.failure === "", true);
  lb.shutdown();

  // The root sent after the leaf: still one path, and it opens.
  const sent = new Loop(chainConfig([goodLeaf(), loopbackRoot()], ["http/1.1"]));
  sent.run(new TlsClientConfig("localhost", ["http/1.1"]), trust);
  t.eqBool("root sent: opened", sent.opened, true);
  t.eqBool("root sent: no wake lost", sent.failure === "", true);
  sent.shutdown();

  // A leaf past its notAfter.
  const old = new Loop(chainConfig([expiredLeaf()], ["http/1.1"]));
  const expired: TlsTcpClient = old.run(new TlsClientConfig("localhost", ["http/1.1"]), trust);
  t.eqBool("expired: not opened", old.opened, false);
  t.eqI32("expired: certificate_expired", expired.failure(), TLS_ALERT_CERTIFICATE_EXPIRED);
  t.eqI32("expired: the server reads it", old.peerAlert, TLS_ALERT_CERTIFICATE_EXPIRED);
  old.shutdown();
};

/** `tlsConnect`'s failures below TLS. */
const connectChecks = (t: Suite): void => {
  const none: X509Certificate[] = [];
  const trust = new TlsClientTrust(none);
  const refused: TlsTcpClient = tlsConnect(refusingAddress(), "localhost", ["h2"], 2000);
  t.eqI32("connect: refused", refused.failure(), CONNECTION_REFUSED);
  t.eqBool("connect: refused, not open", refused.open(), false);
  t.eqI32("connect: refused, closed", refused.fd(), -1);

  const short: u8[] = [1, 2, 3];
  const invalid: TlsTcpClient = tlsConnect(short, "localhost", ["h2"], 2000);
  t.eqI32("connect: a short address", invalid.failure(), INVALID);
  t.eqI32("connect: a short address is done", invalid.interest(), TLS_RECORD_DONE);

  // A config the client refuses (an empty protocol) is never dialled: its alert, not the refusal.
  const badName: TlsTcpClient = tlsConnect(refusingAddress(), "localhost", [""], 2000);
  t.eqI32("connect: a refused config is not dialled", badName.failure(), INTERNAL_ERROR);
  t.eqI32("connect: a refused config has no socket", badName.fd(), -1);

  // A listener that never answers: the kernel completes the connection, the ClientHello waits.
  const silent: i32 = tcpListen("127.0.0.1", 0, 4);
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", netLocalPort(silent));
  const before: i64 = monotonicNanos();
  const waited: TlsTcpClient = tlsConnectWith(addr, new TlsClientConfig("localhost", ["h2"]), trust, 300);
  const elapsedMs: i64 = (monotonicNanos() - before) / toI64(1000000);
  t.eqI32("connect: timed out", waited.failure(), TLS_TCP_TIMED_OUT);
  t.eqBool("connect: waited the timeout", elapsedMs >= toI64(300), true);
  t.eqBool("connect: and not much more", elapsedMs < toI64(3000), true);
  t.eqI32("connect: timed out, closed", waited.fd(), -1);
  netClose(silent);
};

/** The CertificateVerify check and the chain step on their own. */
const verifyChecks = (t: Suite): void => {
  const parsed: X509Certificate | null = x509ParseCertificate(leafCertificate());
  if (parsed === null) {
    t.fail("verify: the leaf parses", "");
    return;
  }
  const leaf: X509Certificate = parsed;
  const content: u8[] = [9, 8, 7, 6, 5];
  const key: Secret<u8[]> = secret(leafPrivate());
  const signed: u8[] | null = tlsSignEcdsaP256(key, content);
  wipe(key);
  const none: u8[] = [];
  const signature: u8[] = signed === null ? none : signed;
  t.eqBool("verify: P-256 verifies", tlsVerifyCertificateVerify(leaf, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, content, signature), true);
  const other: u8[] = [9, 8, 7, 6, 4];
  t.eqBool("verify: other content", tlsVerifyCertificateVerify(leaf, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, other, signature), false);
  t.eqBool("verify: P-384 scheme on a P-256 key", tlsVerifyCertificateVerify(leaf, TLS_SIGNATURE_ECDSA_SECP384R1_SHA384, content, signature), false);
  t.eqBool("verify: RSA-PSS scheme on a P-256 key", tlsVerifyCertificateVerify(leaf, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256, content, signature), false);
  t.eqBool("verify: ed25519, never offered", tlsVerifyCertificateVerify(leaf, 0x0807, content, signature), false);
  t.eqBool("verify: an empty signature", tlsVerifyCertificateVerify(leaf, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, content, none), false);

  const empty: u8[][] = [];
  t.eqI32("chain: none is bad_certificate", tlsClientChain(empty, "localhost", toI64(0), tlsClientSystemTrust()), TLS_ALERT_BAD_CERTIFICATE);
  const trust: TlsClientTrust = rootTrust(t);
  const roots: X509Certificate[] = [];
  const untrusted = new TlsClientTrust(roots);
  const june2026: i64 = toI64(1780272000) * toI64(1000);
  const june2025: i64 = toI64(1748736000) * toI64(1000);
  const good: u8[][] = [goodLeaf()];
  const expired: u8[][] = [expiredLeaf()];
  t.eqI32("chain: good", tlsClientChain(good, "localhost", june2026, trust), 0);
  t.eqI32("chain: by its address", tlsClientChain(good, "127.0.0.1", june2026, trust), 0);
  t.eqI32("chain: another name", tlsClientChain(good, "other.test", june2026, trust), TLS_ALERT_BAD_CERTIFICATE);
  t.eqI32("chain: not yet valid", tlsClientChain(good, "localhost", june2025, trust), TLS_ALERT_CERTIFICATE_EXPIRED);
  t.eqI32("chain: expired", tlsClientChain(expired, "localhost", june2026, trust), TLS_ALERT_CERTIFICATE_EXPIRED);
  t.eqI32("chain: an unknown root", tlsClientChain(good, "localhost", june2026, untrusted), TLS_ALERT_UNKNOWN_CA);
  const selfSigned: u8[][] = [leafCertificate()];
  t.eqI32("chain: a self-signed leaf with no extensions is bad_certificate", tlsClientChain(selfSigned, "localhost", toI64(1767225700) * toI64(1000), trust), TLS_ALERT_BAD_CERTIFICATE);
};

/** Connect mode: one handshake against a third-party server, and one line of what it reached. */
const connect = (port: i32, name: string, alpn: string, groups: string): i32 => {
  const protocols: string[] = [];
  if (alpn !== "-") {
    let start: i32 = 0;
    let comma: i32 = toI32(alpn.indexOf(","));
    while (comma >= 0) {
      protocols.push(alpn.substring(start, comma));
      start = comma + 1;
      comma = toI32(alpn.indexOf(",", start));
    }
    protocols.push(alpn.substring(start, toI32(alpn.length)));
  }
  const config = new TlsClientConfig(name, protocols);
  if (groups === "both") {
    config.groups = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1];
  } else if (groups === "p256") {
    config.groups = [TLS_GROUP_SECP256R1];
    config.shareGroup = TLS_GROUP_SECP256R1;
  }
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", port);
  const client: TlsTcpClient = tlsConnectWith(addr, config, tlsClientSystemTrust(), 10000);
  const tls = client.conn.tls;
  const chose: string = tls.alpnChosen === "" ? "-" : tls.alpnChosen;
  const state: string = client.open() ? "open" : `failed ${client.failure()}`;
  console.log(`${state} suite ${tls.suite} group ${tls.shareGroup} retried ${tls.retried} scheme ${tls.scheme} alpn ${chose}`);
  client.close();
  return 0;
};

/** The bytes of ASCII `text`. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(toI32(text.charCodeAt(k))));
  }
  return out;
};

/**
 * Exchange mode: `tlsConnect` to a third-party server for `localhost`, with
 * the blocking calls alone. Writes "ping", sends a KeyUpdate asking for the
 * server's and writes "after" under its new key; reads until `reply` comes
 * (the server's KeyUpdates handled on the way), writes `last` under the key
 * it answered any request with, and reads to the end of the server's
 * stream. Prints one line of how far it got: each call's answer, the
 * KeyUpdates it read, and how the stream ended.
 */
const exchange = (port: i32, reply: string, last: string): i32 => {
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", port);
  const client: TlsTcpClient = tlsConnect(addr, "localhost", [], 10000);
  if (!client.open()) {
    console.log(`failed ${client.failure()}`);
    return 0;
  }
  const ping: u8[] = ascii("ping\n");
  const after: u8[] = ascii("after\n");
  const wrote: i32 = client.writeAll(ping, 0, toI32(ping.length), 10000);
  const updated: i32 = client.keyUpdate(true);
  const wroteAfter: i32 = client.writeAll(after, 0, toI32(after.length), 10000);
  const buf: u8[] = new Array<u8>(64);
  let got: string = "";
  let n: i32 = 1;
  while (n > 0 && got.indexOf(reply) < 0) {
    n = client.readWait(buf, 0, 64, 10000);
    for (let k: i32 = 0; k < n; k++) {
      got = got + String.fromCharCode(buf[k]);
    }
  }
  const updates: i32 = client.conn.keyUpdates;
  const bye: u8[] = ascii(`${last}\n`);
  const wroteBye: i32 = client.writeAll(bye, 0, toI32(bye.length), 10000);
  let end: i32 = 1;
  while (end > 0) {
    end = client.readWait(buf, 0, 64, 10000);
  }
  console.log(
    `open wrote ${wrote} update ${updated} wrote ${wroteAfter} read ${got.indexOf(reply) >= 0 ? reply : "-"} server updates ${updates} wrote ${wroteBye} end ${end}`
  );
  client.close();
  return 0;
};

export const main = (): i32 => {
  if (process.argv.length === 5 && process.argv[1] === "exchange") {
    const port: i32 = decimal(process.argv[2]);
    return port > 0 ? exchange(port, process.argv[3], process.argv[4]) : 2;
  }
  if (process.argv.length === 6 && process.argv[1] === "connect") {
    const port: i32 = decimal(process.argv[2]);
    return port > 0 ? connect(port, process.argv[3], process.argv[4], process.argv[5]) : 2;
  }
  const t = new Suite("tls client tcp");
  loopbackChecks(t);
  connectChecks(t);
  verifyChecks(t);
  return t.done();
};
