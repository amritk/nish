// The X.509 DER reader (`nish/crypto/x509`) over a peer's bytes, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is `null`, so a panic here is a finding (docs/security/crypto-x509.md).
//
// The whole input is read three times, with no framing: once as one
// Certificate and as an ECDSA-Sig-Value at P-256's and P-384's widths, so a
// seed is a bare DER certificate or a bare DER signature. A certificate that
// parses goes on as a caller would take it: its signatureValue is read at both
// widths, its issuer and each directoryName constraint are matched against its
// subject as Names, and when it is P-256 with ecdsa-with-SHA256 its signature
// is checked against its own key, as a self-signed certificate is.
//
// A certificate that parses is checked against what the reader promises of
// its decoded extensions: a path length of -1 or more, a keyUsage of -1 or
// bits 0 to 8, and iPAddresses of 4 or 16 octets with a mask as long as each
// constraint's address.
import {
  X509Certificate,
  X509GeneralSubtree,
  X509_GN_DIR,
  X509_GN_IP,
  x509DerSignatureRS,
  x509DerSignatureRSWidth,
  x509NameIsPrefix,
  x509ParseCertificate,
  x509VerifySignature,
} from "nish/crypto/x509"

/** Whether `ip` has an address family's width. */
const ipWidth = (ip: u8[]): boolean => toI32(ip.length) === 4 || toI32(ip.length) === 16

/** Panics unless every subtree is what `X509GeneralSubtree` promises, and matches each directoryName as a caller would. */
const useSubtrees = (cert: X509Certificate, trees: X509GeneralSubtree[]): void => {
  for (const s of trees) {
    if (s.kind === X509_GN_IP && (!ipWidth(s.ip) || s.ip.length !== s.mask.length)) {
      panic("x509-der: an iPAddress constraint of the wrong width")
    }
    if (s.kind === X509_GN_DIR) {
      x509NameIsPrefix(s.dirName, cert.subject)
    }
  }
}

/** What a caller does with a certificate it has read, with the reader's promises checked on the way. */
const useCertificate = (cert: X509Certificate): void => {
  x509DerSignatureRS(cert.signature)
  x509DerSignatureRSWidth(cert.signature, 48)
  x509NameIsPrefix(cert.issuer, cert.subject)
  if (cert.bcPathLen < -1 || cert.keyUsage < -1 || cert.keyUsage > 511) {
    panic("x509-der: a basicConstraints or keyUsage out of its range")
  }
  for (const ip of cert.sanIp) {
    if (!ipWidth(ip)) {
      panic("x509-der: a subjectAltName iPAddress of the wrong width")
    }
  }
  useSubtrees(cert, cert.ncPermitted)
  useSubtrees(cert, cert.ncExcluded)
  if (cert.p256 && cert.ecdsaSha256) {
    x509VerifySignature(cert, cert)
  }
}

export const fuzzOne = (data: u8[]): void => {
  x509DerSignatureRS(data)
  x509DerSignatureRSWidth(data, 48)
  const cert: X509Certificate | null = x509ParseCertificate(data)
  if (cert !== null) {
    useCertificate(cert)
  }
}
