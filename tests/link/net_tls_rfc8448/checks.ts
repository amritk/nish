// `nish/net/tls` against RFC 8448 §3, "Simple 1-RTT Handshake", byte for
// byte. The server is handed the trace's server random and x25519 key, reads
// the trace's ClientHello, and must write the trace's ServerHello,
// EncryptedExtensions and Certificate, stop with the trace's CertificateVerify
// input, take the trace's RSA-PSS signature through the signing hand-off
// (RSA-PSS is not in the stack and is randomised, so it cannot be recomputed),
// write the trace's CertificateVerify and Finished, and accept the trace's
// client Finished. Every secret the trace prints is checked on the way: the
// schedule's own steps through `nish/net/tls/schedule`, and the traffic,
// exporter and resumption secrets as the server exposes them.
//
// The one value not printed by the RFC is the transcript hash CertificateVerify
// signs; `rfc8448CertificateTranscriptHash` was computed with Python's
// hashlib over the trace's four messages.
import { Suite } from "nish/testing";
import { x25519Plain } from "../crypto_x25519/plain";
import { TLS_ALERT_DECRYPT_ERROR, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256 } from "nish/net/tls/codec";
import {
  TLS_AES_128_GCM_SHA256,
  TLS_AES_256_GCM_SHA384,
  TlsTranscript,
  tlsDeriveSecret,
  tlsEarlySecret,
  tlsEmptyHash,
  tlsFinishedVerifyData,
  tlsHandshakeSecret,
  tlsMasterSecret,
  tlsTrafficIv,
  tlsTrafficKey,
} from "nish/net/tls/schedule";
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_STATE_CONNECTED,
  TLS_STATE_FAILED,
  TLS_STATE_WAIT_FINISHED,
  TLS_STATE_WAIT_SIGNATURE,
  TlsServer,
  TlsServerConfig,
} from "nish/net/tls";
import { fromHex, toHex } from "../crypto_x509/hex";
import { clientHello, splitMessages, standardExtensions } from "../net_tls_common/client";
import {
  rfc8448Certificate,
  rfc8448CertificateDer,
  rfc8448CertificateTranscriptHash,
  rfc8448CertificateVerify,
  rfc8448ClientApplicationIv,
  rfc8448ClientApplicationKey,
  rfc8448ClientApplicationTraffic,
  rfc8448ClientFinished,
  rfc8448ClientHandshakeIv,
  rfc8448ClientHandshakeKey,
  rfc8448ClientHandshakeTraffic,
  rfc8448ClientHello,
  rfc8448ClientPublic,
  rfc8448DerivedForHandshake,
  rfc8448DerivedForMaster,
  rfc8448EarlySecret,
  rfc8448Ecdhe,
  rfc8448EncryptedExtensions,
  rfc8448ExporterSecret,
  rfc8448ExtraExtensions,
  rfc8448HandshakeSecret,
  rfc8448HelloHash,
  rfc8448MasterSecret,
  rfc8448ResumptionSecret,
  rfc8448RsaPssSignature,
  rfc8448ServerApplicationIv,
  rfc8448ServerApplicationKey,
  rfc8448ServerApplicationTraffic,
  rfc8448ServerFinished,
  rfc8448ServerHandshakeIv,
  rfc8448ServerHandshakeKey,
  rfc8448ServerHandshakeTraffic,
  rfc8448ServerHello,
  rfc8448ServerPrivate,
  rfc8448ServerRandom,
} from "./trace";

/** `a` followed by `b`, in a fresh array. */
export const concat = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = [];
  for (const x of a) {
    out.push(x);
  }
  for (const x of b) {
    out.push(x);
  }
  return out;
};

/** `bytes[from .. bytes.length)`. */
const tail = (bytes: u8[], from: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = from; k < toI32(bytes.length); k++) {
    out.push(bytes[k]);
  }
  return out;
};

/** The server configuration RFC 8448 §3's server runs with. */
export const rfc8448Config = (): TlsServerConfig => {
  const chain: u8[][] = [rfc8448CertificateDer()];
  const alpn: string[] = [];
  const none: u8[] = [];
  return {
    certificateChain: chain,
    signatureScheme: TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
    alpn: alpn,
    quic: false,
    quicTransportParameters: none,
    extraExtensions: rfc8448ExtraExtensions(),
  };
};

/** A server with the trace's randomness injected. */
export const rfc8448Server = (): TlsServer =>
  new TlsServer(rfc8448Config(), rfc8448ServerRandom(), rfc8448ServerPrivate());

/** `"TLS 1.3, server CertificateVerify"`'s bytes as hex. */
const CERTIFICATE_VERIFY_CONTEXT_HEX: string =
  "544c5320312e332c20736572766572204365727469666963617465566572696679";

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_tls_rfc8448_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const rfc8448Checks = (): i32 => {
  const t = new Suite("tls rfc8448");
  const h: i32 = 32;
  const zero: i32 = 0;
  const suite: i32 = TLS_AES_128_GCM_SHA256;

  // --- The key schedule, step by step ---------------------------------------
  const early: u8[] = tlsEarlySecret(h);
  t.eqStr('{server} extract secret "early"', toHex(early), toHex(rfc8448EarlySecret()));
  t.eqStr(
    '{server} derive secret for handshake "tls13 derived"',
    toHex(tlsDeriveSecret(h, early, "derived", tlsEmptyHash(h))),
    toHex(rfc8448DerivedForHandshake())
  );
  t.eqStr(
    "the ECDHE secret from the trace's two x25519 keys",
    toHex(x25519Plain(rfc8448ServerPrivate(), rfc8448ClientPublic())),
    toHex(rfc8448Ecdhe())
  );
  const handshake: u8[] = tlsHandshakeSecret(h, early, rfc8448Ecdhe());
  t.eqStr('{server} extract secret "handshake"', toHex(handshake), toHex(rfc8448HandshakeSecret()));
  t.eqStr(
    '{server} derive secret for master "tls13 derived"',
    toHex(tlsDeriveSecret(h, handshake, "derived", tlsEmptyHash(h))),
    toHex(rfc8448DerivedForMaster())
  );
  t.eqStr('{server} extract secret "master"', toHex(tlsMasterSecret(h, handshake)), toHex(rfc8448MasterSecret()));
  t.eqStr(
    '{server} derive secret "tls13 c hs traffic"',
    toHex(tlsDeriveSecret(h, handshake, "c hs traffic", rfc8448HelloHash())),
    toHex(rfc8448ClientHandshakeTraffic())
  );

  // --- The traffic keys and IVs ---------------------------------------------
  t.eqStr(
    "server handshake write key",
    toHex(tlsTrafficKey(suite, rfc8448ServerHandshakeTraffic())),
    toHex(rfc8448ServerHandshakeKey())
  );
  t.eqStr(
    "server handshake write iv",
    toHex(tlsTrafficIv(suite, rfc8448ServerHandshakeTraffic())),
    toHex(rfc8448ServerHandshakeIv())
  );
  t.eqStr(
    "client handshake write key",
    toHex(tlsTrafficKey(suite, rfc8448ClientHandshakeTraffic())),
    toHex(rfc8448ClientHandshakeKey())
  );
  t.eqStr(
    "client handshake write iv",
    toHex(tlsTrafficIv(suite, rfc8448ClientHandshakeTraffic())),
    toHex(rfc8448ClientHandshakeIv())
  );
  t.eqStr(
    "server application write key",
    toHex(tlsTrafficKey(suite, rfc8448ServerApplicationTraffic())),
    toHex(rfc8448ServerApplicationKey())
  );
  t.eqStr(
    "server application write iv",
    toHex(tlsTrafficIv(suite, rfc8448ServerApplicationTraffic())),
    toHex(rfc8448ServerApplicationIv())
  );
  t.eqStr(
    "client application write key",
    toHex(tlsTrafficKey(suite, rfc8448ClientApplicationTraffic())),
    toHex(rfc8448ClientApplicationKey())
  );
  t.eqStr(
    "client application write iv",
    toHex(tlsTrafficIv(suite, rfc8448ClientApplicationTraffic())),
    toHex(rfc8448ClientApplicationIv())
  );

  // --- The server, fed the trace's ClientHello ------------------------------
  const server: TlsServer = rfc8448Server();
  const hello: u8[] = rfc8448ClientHello();
  t.eqI32("the ClientHello is accepted", server.receive(TLS_LEVEL_INITIAL, hello, zero, toI32(hello.length)), zero);
  t.eqI32("the server stops for its signature", server.state, TLS_STATE_WAIT_SIGNATURE);
  t.eqI32("it chose TLS_AES_128_GCM_SHA256", server.suite, suite);
  t.eqStr("it read server_name", server.serverName, "server");
  t.eqStr("it negotiated no ALPN", server.alpn, "");
  t.eqStr("ServerHello, at the Initial level", toHex(server.takeOutput(TLS_LEVEL_INITIAL)), toHex(rfc8448ServerHello()));
  t.eqStr(
    "EncryptedExtensions and Certificate, at the Handshake level",
    toHex(server.takeOutput(TLS_LEVEL_HANDSHAKE)),
    toHex(concat(rfc8448EncryptedExtensions(), rfc8448Certificate()))
  );
  t.eqStr("nothing more at the Initial level", toHex(server.takeOutput(TLS_LEVEL_INITIAL)), "");
  t.eqStr(
    "server_handshake_traffic_secret is its Handshake write secret",
    toHex(server.writeSecret(TLS_LEVEL_HANDSHAKE)),
    toHex(rfc8448ServerHandshakeTraffic())
  );
  t.eqStr(
    "client_handshake_traffic_secret is its Handshake read secret",
    toHex(server.readSecret(TLS_LEVEL_HANDSHAKE)),
    toHex(rfc8448ClientHandshakeTraffic())
  );
  t.eqStr("no Application write secret before the signature", toHex(server.writeSecret(TLS_LEVEL_APPLICATION)), "null");
  t.eqStr("and no Initial secret at all", toHex(server.readSecret(TLS_LEVEL_INITIAL)), "null");
  const spaces: string[] = [];
  for (let k: i32 = 0; k < 64; k++) {
    spaces.push("20");
  }
  t.eqStr(
    "the CertificateVerify input: 64 spaces, the context string, 0, Hash(CH..Certificate)",
    toHex(server.signatureInput()),
    `${spaces.join("")}${CERTIFICATE_VERIFY_CONTEXT_HEX}00${toHex(rfc8448CertificateTranscriptHash())}`
  );

  // --- The signing hand-off, with the trace's RSA-PSS signature --------------
  t.eqI32("the trace's signature is taken", server.sign(rfc8448RsaPssSignature()), zero);
  t.eqI32("the server waits for the client's Finished", server.state, TLS_STATE_WAIT_FINISHED);
  t.eqStr("no signature input once signed", toHex(server.signatureInput()), "null");
  t.eqStr(
    "CertificateVerify and Finished, at the Handshake level",
    toHex(server.takeOutput(TLS_LEVEL_HANDSHAKE)),
    toHex(concat(rfc8448CertificateVerify(), rfc8448ServerFinished()))
  );
  // Both Finished messages again, from the schedule alone over the trace's
  // own messages, so the server's answer is not the only witness.
  const transcript = new TlsTranscript(h);
  const messages: u8[][] = [
    hello,
    rfc8448ServerHello(),
    rfc8448EncryptedExtensions(),
    rfc8448Certificate(),
    rfc8448CertificateVerify(),
  ];
  for (const m of messages) {
    transcript.update(m, zero, toI32(m.length));
  }
  t.eqStr(
    "the server's verify_data, from the schedule over the trace's transcript",
    toHex(tlsFinishedVerifyData(h, rfc8448ServerHandshakeTraffic(), transcript.hash())),
    toHex(tail(rfc8448ServerFinished(), 4))
  );
  const serverFinished: u8[] = rfc8448ServerFinished();
  transcript.update(serverFinished, zero, toI32(serverFinished.length));
  t.eqStr(
    "the client's verify_data, likewise",
    toHex(tlsFinishedVerifyData(h, rfc8448ClientHandshakeTraffic(), transcript.hash())),
    toHex(tail(rfc8448ClientFinished(), 4))
  );
  t.eqStr(
    "client_application_traffic_secret_0 is its Application read secret",
    toHex(server.readSecret(TLS_LEVEL_APPLICATION)),
    toHex(rfc8448ClientApplicationTraffic())
  );
  t.eqStr(
    "server_application_traffic_secret_0 is its Application write secret",
    toHex(server.writeSecret(TLS_LEVEL_APPLICATION)),
    toHex(rfc8448ServerApplicationTraffic())
  );
  t.eqStr("exporter_master_secret", toHex(server.exporterSecret), toHex(rfc8448ExporterSecret()));
  t.eqStr("no resumption_master_secret before the client's Finished", toHex(server.resumptionSecret), "");

  // --- The client's Finished ------------------------------------------------
  const finished: u8[] = rfc8448ClientFinished();
  t.eqI32(
    "the trace's client Finished verifies",
    server.receive(TLS_LEVEL_HANDSHAKE, finished, zero, toI32(finished.length)),
    zero
  );
  t.eqI32("and the handshake is done", server.state, TLS_STATE_CONNECTED);
  t.eqStr("with nothing left to send", toHex(server.takeOutput(TLS_LEVEL_HANDSHAKE)), "");
  t.eqStr(
    'resumption_master_secret, {server} derive secret "tls13 res master"',
    toHex(server.resumptionSecret),
    toHex(rfc8448ResumptionSecret())
  );
  // The same secret from the schedule alone, over the transcript through the
  // client's Finished, so the server's answer is not the only witness.
  transcript.update(finished, zero, toI32(finished.length));
  t.eqStr(
    "resumption_master_secret, from the schedule over the trace's transcript",
    toHex(tlsDeriveSecret(h, rfc8448MasterSecret(), "res master", transcript.hash())),
    toHex(rfc8448ResumptionSecret())
  );

  // --- A client Finished that does not verify -------------------------------
  // One bit of verify_data flipped: refused, and no resumption secret is
  // derived from a handshake that did not complete.
  const forged: TlsServer = rfc8448Server();
  forged.receive(TLS_LEVEL_INITIAL, hello, zero, toI32(hello.length));
  forged.sign(rfc8448RsaPssSignature());
  const tampered: u8[] = rfc8448ClientFinished();
  tampered[toI32(tampered.length) - 1] = toU8(toI32(tampered[toI32(tampered.length) - 1]) ^ 1);
  t.eqI32(
    "a client Finished with one bit flipped is decrypt_error",
    forged.receive(TLS_LEVEL_HANDSHAKE, tampered, zero, toI32(tampered.length)),
    TLS_ALERT_DECRYPT_ERROR
  );
  t.eqI32("and fails the handshake", forged.state, TLS_STATE_FAILED);
  t.eqStr("with no resumption_master_secret", toHex(forged.resumptionSecret), "");

  // --- The same ClientHello a byte at a time --------------------------------
  // A carrier hands over whatever a record or a CRYPTO frame held, so the
  // server must reassemble a message from any split.
  const split: TlsServer = rfc8448Server();
  const one: i32 = 1;
  let alerts: i32 = 0;
  for (let k: i32 = 0; k < toI32(hello.length); k++) {
    alerts = alerts + split.receive(TLS_LEVEL_INITIAL, hello, k, one);
  }
  t.eqI32("fed a byte at a time, the ClientHello is accepted", alerts, zero);
  t.eqStr(
    "and answered with the same ServerHello",
    toHex(split.takeOutput(TLS_LEVEL_INITIAL)),
    toHex(rfc8448ServerHello())
  );
  split.sign(rfc8448RsaPssSignature());
  split.takeOutput(TLS_LEVEL_HANDSHAKE);
  // A carrier wipes the handshake secrets once the flight is signed, before
  // the client's Finished arrives (TlsRecordServer and QUIC both do), so the
  // resumption secret cannot be derived from them afterwards.
  secureZero(split.handshakeSecret);
  secureZero(split.clientHandshakeSecret);
  for (let k: i32 = 0; k < toI32(finished.length); k++) {
    alerts = alerts + split.receive(TLS_LEVEL_HANDSHAKE, finished, k, one);
  }
  t.eqI32("and so is the client Finished", alerts, zero);
  t.eqI32("which completes the handshake", split.state, TLS_STATE_CONNECTED);
  t.eqStr(
    "with the trace's resumption_master_secret, though its carrier wiped the handshake secrets",
    toHex(split.resumptionSecret),
    toHex(rfc8448ResumptionSecret())
  );

  // --- The same server under TLS_AES_256_GCM_SHA384 -------------------------
  // RFC 8448 pins only the SHA-256 suite. Here the trace's server — its
  // random, x25519 key, certificate, extra extensions and injected signature —
  // answers a constructed ClientHello that offers only TLS_AES_256_GCM_SHA384,
  // and every value below was computed by an independent model in Python
  // (hashlib, hmac, cryptography's X25519), not by the schedule under test.
  const sha384: TlsServer = rfc8448Server();
  const offer384: u8[] = clientHello([TLS_AES_256_GCM_SHA384], standardExtensions());
  t.eqI32(
    "SHA-384: the ClientHello is accepted",
    sha384.receive(TLS_LEVEL_INITIAL, offer384, zero, toI32(offer384.length)),
    zero
  );
  t.eqStr(
    "SHA-384: the ServerHello (checked against Python)",
    toHex(sha384.takeOutput(TLS_LEVEL_INITIAL)),
    "020000560303a6af06a4121860dc5e6e60249cd34c95930c8ac5cb1434dac155772ed3e2692800130200002e00330024001d0020c9828876112095fe66762bdbf7c672e156d6cc253b833df1dd69b1b04e751f0f002b00020304"
  );
  t.eqStr(
    "SHA-384: client_handshake_traffic_secret (checked against Python)",
    toHex(sha384.readSecret(TLS_LEVEL_HANDSHAKE)),
    "4ebd28600abdc5615d6c1c8ba9e7ae8fe027e8978bd69a640c650935a806681876f099e4fb970e1eff12595cf8271394"
  );
  t.eqStr(
    "SHA-384: server_handshake_traffic_secret (checked against Python)",
    toHex(sha384.writeSecret(TLS_LEVEL_HANDSHAKE)),
    "55feae9ef957a1848583c75529a7843fbc003570a174d669678c3d98292b8e0e062a6d7aed5c7d8fc8daa8c463aa7752"
  );
  sha384.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("SHA-384: the trace's signature is taken", sha384.sign(rfc8448RsaPssSignature()), zero);
  const flight384: u8[][] = splitMessages(sha384.takeOutput(TLS_LEVEL_HANDSHAKE));
  t.eqStr(
    "SHA-384: the server's Finished (checked against Python)",
    toI32(flight384.length) === 2 ? toHex(flight384[1]) : "missing",
    "14000030a00d336b40c1affb20d7ce6d9c23c16a3c2dd63242a8c0490c3588f6e2588cf506b1370de508adcdd24e0d4b24dc1a4b"
  );
  t.eqStr(
    "SHA-384: client_application_traffic_secret_0 (checked against Python)",
    toHex(sha384.readSecret(TLS_LEVEL_APPLICATION)),
    "f02ede38e6a05af1e4273725ae3be408709cc23a80b16cc01346c0fa07a9d33f1b90e38321308a59d5faa922933bf9b1"
  );
  t.eqStr(
    "SHA-384: server_application_traffic_secret_0 (checked against Python)",
    toHex(sha384.writeSecret(TLS_LEVEL_APPLICATION)),
    "cbb7b8b8602a1e5dfb8950ef7048c1a2389862aa46ea18799d0d3bfdccf7f171e5827b3c142cb7cba1b97fb2782914c8"
  );
  const finished384: u8[] = fromHex(
    "14000030e007b7690dc21f97f747c151c43e9ef4f8003da112e3bff384013267caec2d022e46246a93055fc82d06973b1e049cc6"
  );
  t.eqI32(
    "SHA-384: the client Finished the model computes is accepted",
    sha384.receive(TLS_LEVEL_HANDSHAKE, finished384, zero, toI32(finished384.length)),
    zero
  );
  t.eqI32("SHA-384: connected", sha384.state, TLS_STATE_CONNECTED);
  t.eqStr(
    "SHA-384: resumption_master_secret (checked against Python)",
    toHex(sha384.resumptionSecret),
    "87842baad2ea6733dab276bf5d9c00fde9043f6e1c33019cfc57a36f0e415634272671a9189b01b0a547cfb6986001d1"
  );

  return t.done();
};
