// X509-9's live check: a TLS 1.3 handshake through `nish/net/tls` whose server
// presents a certificate `x509MintSelfSigned` has just minted, extensions and
// all, and a scripted client that accepts it the way a client pinning its hash
// does — the Certificate carries exactly the minted DER, that DER parses, and
// CertificateVerify verifies under the key read out of it, not under a key the
// client already knew. The `nish/net` cases present a frozen certificate
// (`net_tls_common/server.ts` says why), so this is where a minted one meets a
// handshake.
import { Suite } from "nish/testing"
import { X509Certificate, x509ParseCertificate } from "nish/crypto/x509"
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec"
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule"
import { TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TLS_STATE_CONNECTED, TlsServer, TlsServerConfig } from "nish/net/tls"
import { ClientView, bytesFrom, clientFinish, clientHello, sendHandshake, sendHello, splitMessages, standardExtensions } from "../net_tls_common/client"
import { leafPrivate, serverPrivate, serverRandom, signWithLeaf } from "../net_tls_common/server"
import { x509MintSelfSignedPlain } from "./plain"
import { toHex } from "./hex"

/** The minted certificate's two extensions, as `main.ts` pins them. */
const EXTENSIONS: string = "a320301e300c0603551d130101ff04023000300e0603551d0f0101ff040403020780"

/** `bytes[from, from + count)`, or nothing when that is not inside `bytes`. */
const span = (bytes: u8[], from: i32, count: i32): u8[] => {
  const rest: u8[] = bytesFrom(bytes, from)
  const out: u8[] = []
  for (let i: i32 = 0; i < count && count <= toI32(rest.length); i++) {
    out.push(rest[i])
  }
  return out
}

export const handshakeSuite = (): i32 => {
  const t = new Suite("x509 mint in a TLS handshake")
  const zero: i32 = 0
  // The `net_tls_common` leaf key, so `signWithLeaf` signs for it; one day from 2026-01-01, serial 2.
  const minted: u8[] | null = x509MintSelfSignedPlain(leafPrivate(), "localhost", 1767225600000, 1, [toU8(2)])
  if (minted === null) {
    t.fail("the certificate mints", "null")
    return t.done()
  }
  const none: u8[] = []
  const alpn: string[] = []
  const config: TlsServerConfig = {
    certificateChain: [minted],
    alpn: alpn,
    quicTransportParameters: none,
    extraExtensions: none,
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    quic: false,
  }
  const server = new TlsServer(config, serverRandom(), serverPrivate())
  const hello: u8[] = clientHello([TLS_AES_128_GCM_SHA256], standardExtensions())
  t.eqI32("the server takes the ClientHello", sendHello(server, hello), zero)
  t.eqI32("and signs with the minted certificate's key", signWithLeaf(server), zero)
  const initial: u8[] = server.takeOutput(TLS_LEVEL_INITIAL)
  const flight: u8[] = server.takeOutput(TLS_LEVEL_HANDSHAKE)
  const messages: u8[][] = splitMessages(flight)
  if (toI32(messages.length) !== 4) {
    t.fail("the flight is EncryptedExtensions, Certificate, CertificateVerify, Finished", `${messages.length} messages`)
    return t.done()
  }
  // Certificate: header (4), empty context (1), list length (3), entry length (3), then the DER.
  const length: i32 = toI32(minted.length)
  t.eqStr("the Certificate carries the minted DER, octet for octet", toHex(span(messages[1], 11, length)), toHex(minted))
  const cert: X509Certificate | null = x509ParseCertificate(minted)
  if (cert === null) {
    t.fail("the client parses it", "null")
    return t.done()
  }
  t.pass("the client parses it")
  t.eqStr("with the two critical extensions at the end of its TBS", toHex(span(cert.tbs, toI32(cert.tbs.length) - 34, 34)), EXTENSIONS)
  const view: ClientView = clientFinish(32, hello, initial, flight, cert.publicKey)
  t.ok("CertificateVerify verifies under the key read from the certificate", view.signatureVerifies)
  t.ok("the server's Finished verifies", view.serverFinishedVerifies)
  t.eqI32("the server takes the client's Finished", sendHandshake(server, view.clientFinished), zero)
  t.eqI32("connected", server.state, TLS_STATE_CONNECTED)
  return t.done()
}
