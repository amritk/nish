// The X.509 DER reader (`nish/crypto/x509`) over a peer's bytes, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is `null`, so a panic here is a finding (docs/security/crypto-x509.md).
//
// The whole input is read twice, with no framing: once as one Certificate and
// once as an ECDSA-Sig-Value, so a seed is a bare DER certificate or a bare DER
// signature. A certificate that parses goes on as a caller would take it: its
// signatureValue is read as an ECDSA-Sig-Value too, and when it is P-256 with
// ecdsa-with-SHA256 its signature is checked against its own key, as a
// self-signed certificate is.
import { X509Certificate, x509DerSignatureRS, x509ParseCertificate, x509VerifySignature } from "nish/crypto/x509"

/** What a caller does with a certificate it has read: the signature's `r || s`, and a self-signed check. */
const useCertificate = (cert: X509Certificate): void => {
  x509DerSignatureRS(cert.signature)
  if (cert.p256 && cert.ecdsaSha256) {
    x509VerifySignature(cert, cert)
  }
}

export const fuzzOne = (data: u8[]): void => {
  x509DerSignatureRS(data)
  const cert: X509Certificate | null = x509ParseCertificate(data)
  if (cert !== null) {
    useCertificate(cert)
  }
}
