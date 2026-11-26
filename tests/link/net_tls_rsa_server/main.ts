// The TLS and QUIC servers under an RSA-2048 certificate, signing their
// CertificateVerify with RSA-PSS (`rsa_pss_rsae_sha256`). With no arguments it
// runs the checks: the key loads from PKCS#1 and PKCS#8 PEM and a short one is
// refused, a `TlsClient` completes a handshake with a `TlsServer` and the
// signature verifies under the certificate's key, a hello that offers no
// RSA-PSS is refused, and a GET over HTTP/3 through `HttpServer` is answered.
// With `serve h1 <n>` or `serve h2 <n>` it is the server alone for `openssl
// s_client` and `curl`: it prints `port <p>`, serves `n` HTTP/1.1 connections
// or HTTP/2 requests over TLS, answering every request 200 "hello\n", and
// exits 0. With `serve h3 <n>` it is the HTTP/3 listener alone, for `openssl
// s_client -quic`: it prints `port <p>` (a UDP port), prints `open <k>` as the
// k-th QUIC connection opens, and exits 0 once `n` have opened and every one
// has closed, or 1 after about 45 seconds.
import { Secret, wipe } from "nish:secret";
import {
  netLocalPort,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpListen,
  udpBind,
} from "nish:net";
import { Suite } from "nish/testing";
import { RSA_HASH_SHA256, RsaPublicKey, rsaParsePublicKey, rsaVerifyPss } from "nish/crypto/rsa";
import { RSA_PSS_SHA256_SALT_SIZE, rsaPrivateKeyBits, rsaPrivateKeyModulus } from "nish/crypto/rsa-sign";
import { x509ParseRsaPrivateKey } from "nish/crypto/x509";
import { TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TLS_STATE_CONNECTED, TlsKeySigner, TlsServer, TlsServerConfig } from "nish/net/tls";
import { TLS_ALERT_HANDSHAKE_FAILURE, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256 } from "nish/net/tls/codec";
import { TLS_CLIENT_STATE_CONNECTED, TlsClient, TlsClientConfig } from "nish/net/tls/client";
import { TLS_RECORD_SIGN } from "nish/net/tls/record-server";
import { H1_DONE, H1_ERROR, H1_NEED_MORE, H1_REQUEST, Http1Connection, Http1TlsServer } from "nish/net/http1-server";
import { HttpServer, HttpServerLimits } from "nish/net/http-server";
import { Http2Config } from "nish/net/http2";
import { H2_ALPN } from "nish/net/http2-tls";
import { H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER, H3_FRAME_HEADERS } from "nish/net/http3-frame";
import { QpackEncoder } from "nish/net/qpack";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { Router, RouterLimits } from "nish/net/router";
import { n32, n64 } from "../net_quic_frame/typed";
import { clientHello, clientShare, extKeyShare, extSignatureAlgorithms, extSupportedGroups, extSupportedVersions, sendHello } from "../net_tls_common/client";
import { newServer, serverPrivate, tcpConfig } from "../net_tls_common/server";
import { ZERO, ascii } from "../net_tls_record_common/bytes";
import { testConfig } from "../net_http1_server/checks";
import {
  CLIENT_CONTROL,
  CLIENT_DECODER,
  CLIENT_ENCODER,
  H3Limits,
  h3Cat,
  h3ClientParams,
  h3ClientSettings,
  h3Config,
  h3Frame,
  h3QuicConfig,
  h3Section,
  h3Varint,
} from "../net_http3/peer";
import { toHex } from "../crypto_x509/hex";
import { rsaCertPem, rsaKeyPkcs1, rsaKeyPkcs8, rsaKeySmall, rsaCertificate, rsaPublicKey } from "./fixtures";
import { RsaQuicClient, h3Answer, turnServer } from "./h3";

/** The poll token of the HTTP/1.1 listener: above every slot. */
const LISTENER: i32 = 1000;

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

/** `config` serving the RSA certificate and signing with RSA-PSS. */
const rsaConfig = (config: TlsServerConfig): TlsServerConfig => {
  config.certificateChain = [rsaCertificate()];
  config.signatureScheme = TLS_SIGNATURE_RSA_PSS_RSAE_SHA256;
  return config;
};

/** The RSA key from its PKCS#1 PEM; the test fixture always parses. */
const loadKey = (): Secret<u8[]> => {
  const key: Secret<u8[]> | null = x509ParseRsaPrivateKey(rsaKeyPkcs1());
  if (key === null) {
    panic("net_tls_rsa_server: the RSA fixture key did not parse");
  }
  return key;
};

/** The modulus `key` holds, as hex; "" for none. */
const modulusOf = (key: Secret<u8[]> | null): string => (key === null ? "" : toHex(rsaPrivateKeyModulus(key)));

/** The key loads from both PEM forms; a 1024-bit key and a certificate are refused with `null`. */
const keyChecks = (t: Suite, key: Secret<u8[]>): void => {
  t.eqI32("PKCS#1: a 2048-bit key", rsaPrivateKeyBits(key), n32(2048));
  const pkcs8: Secret<u8[]> | null = x509ParseRsaPrivateKey(rsaKeyPkcs8());
  t.ok("PKCS#8: the same key loads", pkcs8 !== null);
  t.eqStr("PKCS#8: the same modulus as PKCS#1", modulusOf(pkcs8), modulusOf(key));
  if (pkcs8 !== null) {
    wipe(pkcs8);
  }
  const pub: RsaPublicKey | null = rsaParsePublicKey(rsaPublicKey());
  t.eqStr("the modulus is the certificate's", modulusOf(key), pub === null ? "-" : toHex(pub.n));
  const small: Secret<u8[]> | null = x509ParseRsaPrivateKey(rsaKeySmall());
  t.ok("a 1024-bit key is refused, without a panic", small === null);
  if (small !== null) {
    wipe(small);
  }
  const cert: Secret<u8[]> | null = x509ParseRsaPrivateKey(rsaCertPem());
  t.ok("a certificate is not a key", cert === null);
  if (cert !== null) {
    wipe(cert);
  }
};

/** A `TlsClient` against a `TlsServer` under the RSA certificate, in memory. */
const handshakeChecks = (t: Suite, key: Secret<u8[]>): void => {
  const zero: i32 = 0;
  const server: TlsServer = newServer(rsaConfig(tcpConfig(["h2"])));
  const seed: u8[] = new Array<u8>(32);
  const client = new TlsClient(new TlsClientConfig("localhost", ["h2"]), seed, serverPrivate(), serverPrivate());
  t.eqI32("start", client.start(), zero);
  const ch: u8[] = client.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32("the server reads the ClientHello", server.receive(TLS_LEVEL_INITIAL, ch, zero, toI32(ch.length)), zero);
  const sh: u8[] = server.takeOutput(TLS_LEVEL_INITIAL);
  const input: u8[] | null = server.signatureInput();
  const signature: u8[] | null = input === null ? null : new TlsKeySigner(TLS_SIGNATURE_RSA_PSS_RSAE_SHA256).sign(key, input);
  const none: u8[] = [];
  t.ok("the RSA signer signs", signature !== null);
  t.eqI32("the server takes the signature", server.sign(signature === null ? none : signature), zero);
  const flight: u8[] = server.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("the client reads the ServerHello", client.receive(TLS_LEVEL_INITIAL, sh, zero, toI32(sh.length)), zero);
  t.eqI32("the client reads the flight", client.receive(TLS_LEVEL_HANDSHAKE, flight, zero, toI32(flight.length)), zero);
  const certs: u8[][] = client.peerCertificates();
  t.eqStr("the chain is the RSA certificate", toI32(certs.length) === 1 ? toHex(certs[0]) : "", toHex(rsaCertificate()));
  t.eqI32("CertificateVerify: rsa_pss_rsae_sha256", client.verifyScheme(), TLS_SIGNATURE_RSA_PSS_RSAE_SHA256);
  const pub: RsaPublicKey | null = rsaParsePublicKey(rsaPublicKey());
  const verifies: boolean =
    pub !== null && rsaVerifyPss(pub, RSA_HASH_SHA256, RSA_PSS_SHA256_SALT_SIZE, client.verifyContent(), client.verifySignature());
  t.ok("the signature verifies under the certificate's key, salt 32", verifies);
  const forged: u8[] = client.verifySignature();
  forged[0] = toU8(toI32(forged[0]) ^ 1);
  t.ok("a signature with one bit flipped does not", pub !== null && !rsaVerifyPss(pub, RSA_HASH_SHA256, RSA_PSS_SHA256_SALT_SIZE, client.verifyContent(), forged));
  t.eqI32("authenticate", client.authenticate(verifies), zero);
  t.eqI32("the client is connected", client.state, TLS_CLIENT_STATE_CONNECTED);
  const fin: u8[] = client.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("the server reads Finished", server.receive(TLS_LEVEL_HANDSHAKE, fin, zero, toI32(fin.length)), zero);
  t.eqI32("the server is connected", server.state, TLS_STATE_CONNECTED);
};

/** Without RSA-PSS on offer the RSA server has nothing to sign with, and the P-256 signer cannot use the RSA key. */
const schemeChecks = (t: Suite, key: Secret<u8[]>): void => {
  const ecdsaOnly: u8[] = clientHello(
    [0x1301],
    [
      extSupportedVersions([0x0304]),
      extSupportedGroups([0x001d]),
      extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      extKeyShare([0x001d], [clientShare()]),
    ]
  );
  t.eqI32(
    "a hello offering only ECDSA P-256 is refused with handshake_failure",
    sendHello(newServer(rsaConfig(tcpConfig(["h2"]))), ecdsaOnly),
    TLS_ALERT_HANDSHAKE_FAILURE
  );
  const server: TlsServer = newServer(rsaConfig(tcpConfig(["h2"])));
  const rsaHello: u8[] = clientHello(
    [0x1301],
    [
      extSupportedVersions([0x0304]),
      extSupportedGroups([0x001d]),
      extSignatureAlgorithms([TLS_SIGNATURE_RSA_PSS_RSAE_SHA256]),
      extKeyShare([0x001d], [clientShare()]),
    ]
  );
  t.eqI32("a hello offering only RSA-PSS is taken", sendHello(server, rsaHello), n32(0));
  const input: u8[] | null = server.signatureInput();
  t.ok(
    "the P-256 signer refuses the RSA key",
    input !== null && new TlsKeySigner(TLS_SIGNATURE_ECDSA_SECP256R1_SHA256).sign(key, input) === null
  );
};

/** A GET over HTTP/3 through `HttpServer.listenHttp3` under the RSA certificate. */
const h3Checks = (t: Suite, key: Secret<u8[]>): void => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/hello");
  const h = new HttpServer(new HttpServerLimits(), router);
  const udp: i32 = udpBind("127.0.0.1", n32(0), n32(0));
  const quic = h3QuicConfig(new H3Limits());
  quic.certificateChain = [rsaCertificate()];
  quic.signatureScheme = TLS_SIGNATURE_RSA_PSS_RSAE_SHA256;
  h.listenHttp3(udp, quic, h3Config(), n32(4), new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE));
  const c = new RsaQuicClient(h, netLocalPort(udp));
  t.ok("HTTP/3: the handshake, its RSA-PSS signature verified", c.connect("h3", h3ClientParams(new H3Limits()), key, rsaPublicKey()));
  c.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false);
  c.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false);
  c.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false);
  const names: string[] = [":method", ":scheme", ":authority", ":path"];
  const values: string[] = ["GET", "https", "localhost", "/hello"];
  c.send(n64(0), h3Frame(H3_FRAME_HEADERS, h3Section(new QpackEncoder(), names, values)), true);
  t.ok("HTTP/3: the GET is answered and ended", c.turnUntil(key, n64(0)));
  t.eqStr("HTTP/3: 200 hello", h3Answer(c.stream(n64(0))), "200 hello\n");
};

/** Serves `count` HTTP/1.1 connections over TLS from third-party clients, then exits. */
const serveH1 = (key: Secret<u8[]>, count: i32): i32 => {
  const listener: i32 = tcpListen("127.0.0.1", n32(0), n32(16));
  const server = new Http1TlsServer(rsaConfig(tcpConfig(["http/1.1"])), testConfig(), listener, n32(8));
  const loop: i32 = pollCreate();
  pollAdd(loop, listener, n32(1), LISTENER);
  console.log(`port ${netLocalPort(listener)}`);
  const ready: i32[] = new Array<i32>(32);
  const random: u8[] = new Array<u8>(32);
  const share: u8[] = new Array<u8>(32);
  const names: u8[][] = [ascii("content-type")];
  const values: u8[][] = [ascii("text/plain")];
  const hello: u8[] = ascii("hello\n");
  let closed: i32 = 0;
  while (closed < count) {
    const n: i32 = pollWait(loop, ready, n32(10000));
    if (n <= 0) {
      return 1;
    }
    for (let i: i32 = 0; i < n; i++) {
      const slot: i32 = ready[2 * i];
      const events: i32 = ready[2 * i + 1];
      if (slot === LISTENER) {
        let accepted: i32 = 0;
        while (accepted >= 0) {
          crypto.getRandomValues(random);
          crypto.getRandomValues(share);
          accepted = server.accept(random, share);
          if (accepted >= 0) {
            pollAdd(loop, server.fd(accepted), n32(1), accepted);
          }
        }
      } else if (server.holds(slot)) {
        let wants: i32 = (events & 5) !== 0 ? server.readable(slot) : server.writable(slot);
        if ((wants & TLS_RECORD_SIGN) !== 0) {
          server.signP256(slot, key);
        }
        const conn: Http1Connection = server.connection(slot);
        let event: i32 = server.next(slot);
        while (event !== H1_NEED_MORE && event !== H1_ERROR) {
          if (event === H1_REQUEST) {
            conn.respond(n32(200), names, values, toI32(hello.length));
            conn.write(hello, ZERO, toI32(hello.length));
            conn.end();
          }
          event = server.next(slot);
        }
        wants = server.flush(slot);
        if (server.holds(slot)) {
          if ((wants & H1_DONE) !== 0) {
            console.log(`closed: alpn ${server.alpn(slot) === "" ? "-" : server.alpn(slot)}`);
            server.close(slot);
            closed++;
          } else {
            pollModify(loop, server.fd(slot), wants & 3, slot);
          }
        } else {
          closed++;
        }
      }
    }
  }
  return 0;
};

/** Serves `count` HTTP/2 requests over TLS from third-party clients, then exits. */
const serveH2 = (key: Secret<u8[]>, count: i32): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/");
  router.add("GET", "/hello");
  const h = new HttpServer(new HttpServerLimits(), router);
  const listener: i32 = tcpListen("127.0.0.1", n32(0), n32(16));
  h.listenHttp2Tls(listener, rsaConfig(tcpConfig([H2_ALPN])), new Http2Config(), n32(8));
  console.log(`port ${netLocalPort(listener)}`);
  let answered: i32 = 0;
  for (let turn: i32 = 0; turn < 200000 && answered < count; turn++) {
    h.waitSigned(n32(50), key);
    while (h.ready()) {
      h.send(h.take(), n32(200), ascii("text/plain"), ascii("hello\n"), ZERO, n32(6));
      answered++;
      console.log(`answered ${answered}`);
    }
  }
  // Long enough for the last answer to leave and the client to hang up.
  for (let turn: i32 = 0; turn < 20; turn++) {
    turnServer(h, key);
  }
  return answered < count ? 1 : 0;
};

/** Serves the HTTP/3 listener until `count` QUIC connections have opened and closed, then exits. */
const serveH3 = (key: Secret<u8[]>, count: i32): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/hello");
  const h = new HttpServer(new HttpServerLimits(), router);
  const udp: i32 = udpBind("127.0.0.1", n32(0), n32(0));
  const quic = h3QuicConfig(new H3Limits());
  quic.certificateChain = [rsaCertificate()];
  quic.signatureScheme = TLS_SIGNATURE_RSA_PSS_RSAE_SHA256;
  h.listenHttp3(udp, quic, h3Config(), n32(4), new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE));
  console.log(`port ${netLocalPort(udp)}`);
  let opened: i32 = 0;
  let open: i32 = 0;
  // 9000 turns of up to 5 ms each, about 45 seconds: past the 30-second idle
  // timeout that closes a connection whose client left without a word.
  for (let turn: i32 = 0; turn < 9000; turn++) {
    turnServer(h, key);
    const now: i32 = h.connections();
    if (now > open) {
      opened = opened + (now - open);
      console.log(`open ${opened}`);
    }
    open = now;
    if (opened >= count && open === 0) {
      return 0;
    }
  }
  return 1;
};

export const main = (): i32 => {
  const key: Secret<u8[]> = loadKey();
  let code: i32 = 0;
  if (process.argv.length === 4 && process.argv[1] === "serve") {
    const count: i32 = decimal(process.argv[3]);
    const carrier: string = process.argv[2];
    if (count <= 0 || (carrier !== "h1" && carrier !== "h2" && carrier !== "h3")) {
      code = 2;
    } else if (carrier === "h3") {
      code = serveH3(key, count);
    } else {
      code = carrier === "h1" ? serveH1(key, count) : serveH2(key, count);
    }
  } else {
    const t = new Suite("net_tls_rsa_server");
    keyChecks(t, key);
    handshakeChecks(t, key);
    schemeChecks(t, key);
    h3Checks(t, key);
    code = t.done();
  }
  wipe(key);
  return code;
};
