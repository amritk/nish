// `nish/crypto/x509` for wasm32: it compiles, because the module imports
// nothing that reaches the operating system — its key and serial are the
// caller's, and `nish/crypto/x509-random`, which draws them, is a module of
// its own (X509-6). tests/run.js compiles this file for wasm32.
import { Secret } from "nish:secret"
import { X509Certificate, x509MintSelfSigned, x509ParseCertificate, x509VerifySignature } from "nish/crypto/x509"

/** Mint with the caller's key and serial, then read the certificate back and check it under itself. */
export const mintAndVerify = (priv: Secret<u8[]>, serial: u8[], notBeforeMs: i64): boolean => {
  const der: u8[] | null = x509MintSelfSigned(priv, "localhost", notBeforeMs, 14, serial)
  if (der === null) {
    return false
  }
  const cert: X509Certificate | null = x509ParseCertificate(der)
  return cert !== null && x509VerifySignature(cert, cert)
}
