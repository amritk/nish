// `nish/net/tls` against RFC 8448 §3, "Simple 1-RTT Handshake", byte for
// byte. The server is handed the trace's server random and x25519 key, reads
// the trace's ClientHello, and must write the trace's ServerHello,
// EncryptedExtensions and Certificate, stop with the trace's CertificateVerify
// input, take the trace's RSA-PSS signature through the signing hand-off
// (RSA-PSS is not in the stack and is randomised, so it cannot be recomputed),
// write the trace's CertificateVerify and Finished, and accept the trace's
// client Finished. Every secret the trace prints is checked on the way: the
// schedule's own steps through `nish/net/tls/schedule`, and the traffic and
// exporter secrets as the server exposes them.
//
// The one value not printed by the RFC is the transcript hash CertificateVerify
// signs; `rfc8448CertificateTranscriptHash` was computed with Python's
// hashlib over the trace's four messages.
import { Suite } from "nish/testing";
import { x25519 } from "nish/crypto/x25519";
import { TLS_SIGNATURE_RSA_PSS_RSAE_SHA256 } from "nish/net/tls/codec";
import {
  TLS_AES_128_GCM_SHA256,
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
  TLS_STATE_WAIT_FINISHED,
  TLS_STATE_WAIT_SIGNATURE,
  TlsServer,
  TlsServerConfig,
} from "nish/net/tls";
import { toHex } from "../net_tls_common/hex";
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
    toHex(x25519(rfc8448ServerPrivate(), rfc8448ClientPublic())),
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

  // --- The client's Finished ------------------------------------------------
  const finished: u8[] = rfc8448ClientFinished();
  t.eqI32(
    "the trace's client Finished verifies",
    server.receive(TLS_LEVEL_HANDSHAKE, finished, zero, toI32(finished.length)),
    zero
  );
  t.eqI32("and the handshake is done", server.state, TLS_STATE_CONNECTED);
  t.eqStr("with nothing left to send", toHex(server.takeOutput(TLS_LEVEL_HANDSHAKE)), "");

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
  for (let k: i32 = 0; k < toI32(finished.length); k++) {
    alerts = alerts + split.receive(TLS_LEVEL_HANDSHAKE, finished, k, one);
  }
  t.eqI32("and so is the client Finished", alerts, zero);
  t.eqI32("which completes the handshake", split.state, TLS_STATE_CONNECTED);

  return t.done();
};
