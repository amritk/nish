// `nish/net/tls-tcp`'s client and `nish/net/tls/verify` over loopback. With
// no arguments it runs the checks: a `TlsTcpClient` against a `TlsTcpServer`
// in one loop, `tlsConnect`'s failures below TLS, and the CertificateVerify
// check on its own. With `connect <port> <name> <alpn> <groups>` it is a
// client alone for a third-party server: it runs `tlsConnectWith` to
// 127.0.0.1:<port> and prints one line of what the handshake reached. The
// `net_tls_client_tcp` block of tests/run.js drives that mode against
// openssl s_server.
//
// Until `nish/crypto/pki` lands (#1027) the chain step refuses every chain
// with `unknown_ca`, so no handshake here opens: what is checked is that the
// handshake reaches the verdict, that the signature is checked before the
// chain, and that the refusal reaches the server as an alert.
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
  TLS_ALERT_UNKNOWN_CA,
  TlsClientTrust,
  tlsClientChain,
  tlsClientSystemTrust,
  tlsVerifyCertificateVerify,
} from "nish/net/tls/verify";
import { TLS_TCP_TIMED_OUT, TlsTcpClient, tlsConnect, tlsConnectWith } from "nish/net/tls-tcp";
import { X509Certificate, x509ParseCertificate } from "nish/crypto/x509";
import { leafCertificate, leafPrivate, tcpConfig } from "../net_tls_common/server";
import { Loop, SIGN_OTHER } from "./loop";

const CONNECTION_REFUSED: i32 = -111;
const INVALID: i32 = -22;

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

/** The loopback handshakes, each ending at the client's verdict or before it. */
const loopbackChecks = (t: Suite): void => {
  const none: X509Certificate[] = [];
  const trust = new TlsClientTrust(none);

  // A good chain and signature: the signature verifies, the stub refuses the chain.
  const lb = new Loop(tcpConfig(["http/1.1"]));
  const good: TlsTcpClient = lb.run(new TlsClientConfig("localhost", ["h2", "http/1.1"]), trust);
  t.eqBool("verdict: not open", good.open(), false);
  t.eqI32("verdict: the stub's unknown_ca", good.failure(), TLS_ALERT_UNKNOWN_CA);
  t.eqI32("verdict: the server reads it", lb.peerAlert, TLS_ALERT_UNKNOWN_CA);
  t.eqBool("verdict: suite negotiated", good.conn.tls.suite !== 0, true);
  t.eqBool("verdict: alpn read before the verdict", good.conn.tls.alpnChosen === "http/1.1", true);
  t.eqBool("verdict: the server chose it", lb.chose === "http/1.1", true);
  t.eqBool("verdict: the server saw the name", lb.sawName === "localhost", true);
  t.eqI32("verdict: socket closed", good.fd(), -1);
  t.eqI32("verdict: done", good.interest(), TLS_RECORD_DONE);
  t.eqBool("verdict: no wake lost", lb.failure === "", true);

  // An IP literal is never sent as server_name.
  const literal: TlsTcpClient = lb.run(new TlsClientConfig("127.0.0.1", ["http/1.1"]), trust);
  t.eqI32("literal: refused at the chain", literal.failure(), TLS_ALERT_UNKNOWN_CA);
  t.eqBool("literal: no server_name", lb.sawName === "", true);

  // A protocol the server does not speak: its alert, read by the client.
  const alpn: TlsTcpClient = lb.run(new TlsClientConfig("localhost", ["h2"]), trust);
  t.eqI32("alpn: the server's no_application_protocol", alpn.failure(), TLS_ALERT_NO_APPLICATION_PROTOCOL);
  t.eqBool("alpn: no wake lost", lb.failure === "", true);

  // A CertificateVerify over other bytes: decrypt_error before the chain is looked at.
  lb.signing = SIGN_OTHER;
  const forged: TlsTcpClient = lb.run(new TlsClientConfig("localhost", ["http/1.1"]), trust);
  t.eqI32("forged: decrypt_error", forged.failure(), TLS_ALERT_DECRYPT_ERROR);
  t.eqI32("forged: the server reads it", lb.peerAlert, TLS_ALERT_DECRYPT_ERROR);
  t.eqBool("forged: no wake lost", lb.failure === "", true);
  lb.shutdown();
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

/** The CertificateVerify check and the chain stub on their own. */
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

  const trust: TlsClientTrust = tlsClientSystemTrust();
  const empty: u8[][] = [];
  const chain: u8[][] = [leafCertificate()];
  t.eqI32("chain: none is bad_certificate", tlsClientChain(empty, "localhost", toI64(0), trust), TLS_ALERT_BAD_CERTIFICATE);
  t.eqI32("chain: the stub refuses", tlsClientChain(chain, "localhost", toI64(1767225600) * toI64(1000), trust), TLS_ALERT_UNKNOWN_CA);
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

export const main = (): i32 => {
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
