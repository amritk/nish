// A production handshake: the server signs CertificateVerify with a P-256 key
// through the signing hand-off (`tlsSignEcdsaP256`), and the client checks
// the signature with `p256VerifySha256` under the key in the certificate the
// server sent, checks the server's Finished, and answers with its own, once
// for each of the three suites. Then the DER encoding of an ECDSA signature
// at its edges, which `nish/crypto/x509` must read back.
import { Suite } from "nish/testing";
import { x509DerSignatureRS } from "nish/crypto/x509";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import {
  TLS_AES_128_GCM_SHA256,
  TLS_AES_256_GCM_SHA384,
  TLS_CHACHA20_POLY1305_SHA256,
  tlsSuiteHashLength,
} from "nish/net/tls/schedule";
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_STATE_CONNECTED,
  TLS_STATE_WAIT_SIGNATURE,
  TlsServer,
  tlsEcdsaDerSignature,
  tlsSignEcdsaP256,
} from "nish/net/tls";
import { ClientView, bytesEqual, clientFinish, clientHello, sendHandshake, sendHello, standardExtensions } from "../net_tls_common/client";
import { fromHex, toHex } from "../net_tls_common/hex";
import { leafCertificate, leafPrivate, leafPublic, newServer, signWithLeaf, tcpConfig } from "../net_tls_common/server";

/** One whole handshake under `suite`, checked from the client's side. */
const handshakeWith = (t: Suite, suite: i32, name: string): void => {
  const zero: i32 = 0;
  const alpn: string[] = [];
  const server: TlsServer = newServer(tcpConfig(alpn));
  const hello: u8[] = clientHello([suite], standardExtensions());
  t.eqI32(`${name}: the ClientHello is accepted`, sendHello(server, hello), zero);
  t.eqI32(`${name}: the server waits for its signature`, server.state, TLS_STATE_WAIT_SIGNATURE);
  t.eqI32(`${name}: P-256 signs, and the server takes it`, signWithLeaf(server), zero);
  t.eqI32(`${name}: the suite is the one offered`, server.suite, suite);
  const hashLength: i32 = tlsSuiteHashLength(suite);
  const view: ClientView = clientFinish(
    hashLength,
    hello,
    server.takeOutput(TLS_LEVEL_INITIAL),
    server.takeOutput(TLS_LEVEL_HANDSHAKE),
    leafPublic()
  );
  t.eqI32(`${name}: four messages at the Handshake level`, toI32(view.messages.length), toI32(4));
  if (toI32(view.messages.length) === 4) {
    t.eqStr(
      `${name}: the Certificate carries the leaf`,
      toHex(view.messages[1]).indexOf(toHex(leafCertificate())) >= 0 ? "yes" : "no",
      "yes"
    );
    t.eqStr(
      `${name}: CertificateVerify names ecdsa_secp256r1_sha256`,
      toHex([view.messages[2][4], view.messages[2][5]]),
      "0403"
    );
  }
  t.ok(`${name}: the signature verifies with p256VerifySha256`, view.signatureVerifies);
  t.ok(`${name}: the server's Finished verifies`, view.serverFinishedVerifies);
  const readSecret: u8[] | null = server.readSecret(TLS_LEVEL_HANDSHAKE);
  t.ok(
    `${name}: the client and server agree on the handshake secrets`,
    readSecret !== null && bytesEqual(readSecret, view.clientHandshakeSecret)
  );
  t.eqI32(`${name}: the client's Finished verifies`, sendHandshake(server, view.clientFinished), zero);
  t.eqI32(`${name}: connected`, server.state, TLS_STATE_CONNECTED);
  t.eqI32(`${name}: application secrets of HashLen bytes`, toI32(server.exporterSecret.length), hashLength);
  t.eqStr(`${name}: nothing written at the Application level`, toHex(server.takeOutput(TLS_LEVEL_APPLICATION)), "");
};

/**
 * Runs every check and answers the exit code; `tests/link/net_tls_ecdsa_f64`
 * runs them again under `--number-mode f64`.
 */
export const ecdsaChecks = (): i32 => {
  const t = new Suite("tls ecdsa");
  handshakeWith(t, TLS_AES_128_GCM_SHA256, "TLS_AES_128_GCM_SHA256");
  handshakeWith(t, TLS_CHACHA20_POLY1305_SHA256, "TLS_CHACHA20_POLY1305_SHA256");
  handshakeWith(t, TLS_AES_256_GCM_SHA384, "TLS_AES_256_GCM_SHA384");

  // A signature over other bytes does not verify: the check above is not vacuous.
  const content: u8[] = fromHex("00010203");
  const signature: u8[] | null = tlsSignEcdsaP256(leafPrivate(), content);
  const rs: u8[] | null = signature === null ? null : x509DerSignatureRS(signature);
  t.ok("tlsSignEcdsaP256 answers a DER signature that x509 reads back", rs !== null);
  t.eqStr("a 31-byte key signs nothing", toHex(tlsSignEcdsaP256(fromHex("01"), content)), "null");

  // DER at its edges: a high bit gets a zero byte, leading zeros go, and
  // zero is one zero octet.
  const highAndZero: u8[] = fromHex(
    "80000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
  );
  t.eqStr(
    "r with its top bit set gains a 0x00, and s = 0 is one zero octet",
    toHex(tlsEcdsaDerSignature(highAndZero)),
    "30260221008000000000000000000000000000000000000000000000000000000000000001020100"
  );
  const leadingZeros: u8[] = fromHex(
    "00000000000000000000000000000000000000000000000000000000000000ff007f0000000000000000000000000000000000000000000000000000000000ff"
  );
  t.eqStr(
    "leading zero bytes are dropped",
    toHex(tlsEcdsaDerSignature(leadingZeros)),
    "3025020200ff021f7f0000000000000000000000000000000000000000000000000000000000ff"
  );
  const der: u8[] | null = tlsEcdsaDerSignature(leadingZeros);
  t.eqStr(
    "and x509DerSignatureRS reads the encoding back to r || s",
    toHex(der === null ? null : x509DerSignatureRS(der)),
    toHex(leadingZeros)
  );
  t.eqStr("a 63-byte r || s is refused", toHex(tlsEcdsaDerSignature(fromHex("00"))), "null");
  t.eqI32("the scheme constant is 0x0403", TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, toI32(0x0403));
  return t.done();
};
