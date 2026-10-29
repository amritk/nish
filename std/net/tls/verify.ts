/**
 * `nish/net/tls/verify` — the TLS client's one authentication seam: whether
 * the server a `TlsRecordClient` reached is the one its `serverName` says,
 * decided at `TLS_RECORD_AUTH` and handed to the connection as its verdict.
 *
 *     const trust: TlsClientTrust = tlsClientSystemTrust();
 *     // when conn.interest() says TLS_RECORD_AUTH:
 *     const alert: i32 = tlsClientAuthenticate(conn, trust, toI64(Date.now()));
 *
 * **Two checks, both always made.** The CertificateVerify first: its scheme
 * must be one this client offered and fit the leaf's key — ECDSA P-256 with
 * SHA-256 on a P-256 key, ECDSA P-384 with SHA-384 on a P-384 key, RSA-PSS
 * (rsae, salt as long as the hash) on an RSA key of at least 2048 bits — and
 * the signature must verify over `TlsClient.verifyContent()` under that key
 * (RFC 8446 §4.4.3). Then the chain, from the leaf the server sent to a root
 * in `trust`, for the name the caller dialled. A server with no certificate
 * or a leaf that does not parse is `bad_certificate`, as is a leaf whose key
 * is of any other kind (Ed25519, a short RSA modulus); a signature that does
 * not verify, or a scheme that does not fit the key, is `decrypt_error`.
 * The signature goes first so a forged CertificateVerify reads as what it is
 * whatever the chain would have said.
 *
 * **The chain step refuses everything for now.** Path building, validity,
 * name matching and the rest live in `nish/crypto/pki`, which is not in the
 * tree yet; until it is, `tlsClientChain` answers `unknown_ca` for every
 * chain, so no server is ever authenticated and no connection opens. There
 * is no switch that skips the step and none is to be added: a client that
 * cannot check a chain must not pretend it did (`docs/security/tls.md`,
 * "The client carrier and verify").
 *
 * The verdict is the record client's to send: `tlsClientAuthenticate` calls
 * `authenticate(true)` or `reject(alert)` on it, so the refusal goes out as
 * a fatal alert under the handshake keys. Written from RFC 8446 §4.2.3 and
 * §4.4.3, not ported from another implementation.
 */
import { p256VerifySha256 } from "nish/crypto/p256"
import { p384VerifySha384 } from "nish/crypto/p384"
import { PkiRoots, pkiLoadSystemRoots } from "nish/crypto/pki-roots"
import {
  RSA_HASH_SHA256,
  RSA_HASH_SHA384,
  RSA_HASH_SHA512,
  RsaPublicKey,
  rsaParsePublicKey,
  rsaVerifyPss,
} from "nish/crypto/rsa"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE, SHA512_SIZE } from "nish/crypto/sha512"
import {
  X509Certificate,
  X509_KEY_P256,
  X509_KEY_P384,
  X509_KEY_RSA,
  x509DerSignatureRSWidth,
  x509ParseCertificate,
} from "nish/crypto/x509"
import {
  TLS_ALERT_BAD_CERTIFICATE,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_SIGNATURE_ECDSA_SECP384R1_SHA384,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA384,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA512,
} from "nish/net/tls/codec"
import { TlsClient } from "nish/net/tls/client"
import { TlsRecordClient } from "nish/net/tls/record-client"

/** `certificate_expired` (RFC 8446 §6.2): the leaf or a certificate above it is outside its validity. */
export const TLS_ALERT_CERTIFICATE_EXPIRED: i32 = 45

/** `unknown_ca` (RFC 8446 §6.2): no path from the chain reaches a root the client trusts. */
export const TLS_ALERT_UNKNOWN_CA: i32 = 48

/** The smallest RSA modulus a CertificateVerify is checked under, in bits: the Web PKI's floor. */
export const TLS_VERIFY_MIN_RSA_BITS: i32 = 2048

/** An ECDSA signature's `r` and `s` width on P-256, in bytes. */
const TLS_VERIFY_P256_WIDTH: i32 = 32

/** An ECDSA signature's `r` and `s` width on P-384, in bytes. */
const TLS_VERIFY_P384_WIDTH: i32 = 48

/**
 * The roots a client trusts, read once and shared by every connection made
 * with them. A class of its own, not `PkiRoots`, so the chain step can keep
 * its index of the roots here when it lands without the callers changing.
 */
export class TlsClientTrust {
  /** Every root, in the order the source gave them. */
  roots: X509Certificate[]

  constructor(roots: X509Certificate[]) {
    this.roots = roots
  }
}

/** The trust of `roots`, as `nish/crypto/pki-roots` read them. */
export const tlsClientTrust = (roots: PkiRoots): TlsClientTrust => new TlsClientTrust(roots.roots)

/** The trust of the system's roots (`pkiLoadSystemRoots`): what a client trusts unless it is given a store. */
export const tlsClientSystemTrust = (): TlsClientTrust => tlsClientTrust(pkiLoadSystemRoots())

/**
 * Whether `signature`, as a CertificateVerify carries it under `scheme`,
 * verifies over `content` under `leaf`'s key. `false` for a scheme that
 * does not fit the key's kind and for every scheme this client does not
 * offer.
 */
export const tlsVerifyCertificateVerify = (
  leaf: X509Certificate,
  scheme: i32,
  content: u8[],
  signature: u8[]
): boolean => {
  if (scheme === TLS_SIGNATURE_ECDSA_SECP256R1_SHA256) {
    if (leaf.keyType !== X509_KEY_P256) {
      return false
    }
    const rs: u8[] | null = x509DerSignatureRSWidth(signature, TLS_VERIFY_P256_WIDTH)
    return rs !== null && p256VerifySha256(leaf.publicKey, content, rs)
  }
  if (scheme === TLS_SIGNATURE_ECDSA_SECP384R1_SHA384) {
    if (leaf.keyType !== X509_KEY_P384) {
      return false
    }
    const rs: u8[] | null = x509DerSignatureRSWidth(signature, TLS_VERIFY_P384_WIDTH)
    return rs !== null && p384VerifySha384(leaf.publicKey, content, rs)
  }
  if (leaf.keyType !== X509_KEY_RSA) {
    return false
  }
  const key: RsaPublicKey | null = rsaParsePublicKey(leaf.publicKey)
  if (key === null) {
    return false
  }
  // RFC 8446 §4.2.3: the salt is as long as the digest.
  switch (scheme) {
    case TLS_SIGNATURE_RSA_PSS_RSAE_SHA256:
      return rsaVerifyPss(key, RSA_HASH_SHA256, SHA256_SIZE, content, signature)
    case TLS_SIGNATURE_RSA_PSS_RSAE_SHA384:
      return rsaVerifyPss(key, RSA_HASH_SHA384, SHA384_SIZE, content, signature)
    case TLS_SIGNATURE_RSA_PSS_RSAE_SHA512:
      return rsaVerifyPss(key, RSA_HASH_SHA512, SHA512_SIZE, content, signature)
    default:
      return false
  }
}

/** Whether `leaf`'s key is one a CertificateVerify is checked under: P-256, P-384, or RSA of at least `TLS_VERIFY_MIN_RSA_BITS`. */
const tlsVerifyKeyUsable = (leaf: X509Certificate): boolean => {
  if (leaf.keyType === X509_KEY_P256 || leaf.keyType === X509_KEY_P384) {
    return true
  }
  if (leaf.keyType !== X509_KEY_RSA) {
    return false
  }
  const key: RsaPublicKey | null = rsaParsePublicKey(leaf.publicKey)
  return key !== null && key.bits >= TLS_VERIFY_MIN_RSA_BITS
}

/**
 * The chain step: 0 when `chain` (DER, leaf first) leads to a root in
 * `trust` and names `serverName` at `nowMs`, else the alert —
 * `certificate_expired`, `unknown_ca` or `bad_certificate`.
 *
 * TODO(#1027): a stub that refuses every chain with `unknown_ca`
 * until `nish/crypto/pki`'s `pkiVerifyServer` is in the tree (#1027). It
 * must never answer 0 before then.
 */
export const tlsClientChain = (
  chain: u8[][],
  _serverName: string,
  _nowMs: i64,
  _trust: TlsClientTrust
): i32 => (toI32(chain.length) === 0 ? TLS_ALERT_BAD_CERTIFICATE : TLS_ALERT_UNKNOWN_CA)

/**
 * The verdict on `tls`'s server at `TLS_CLIENT_STATE_WAIT_AUTH`: 0 when the
 * CertificateVerify verifies under the leaf's key and the chain leads from
 * that leaf to a root in `trust` for the configured server name at `nowMs`
 * (milliseconds since 1970-01-01 UTC), else the alert to refuse with.
 */
export const tlsClientVerdict = (tls: TlsClient, trust: TlsClientTrust, nowMs: i64): i32 => {
  const chain: u8[][] = tls.peerCertificates()
  if (toI32(chain.length) === 0) {
    return TLS_ALERT_BAD_CERTIFICATE
  }
  const leaf: X509Certificate | null = x509ParseCertificate(chain[0])
  if (leaf === null || !tlsVerifyKeyUsable(leaf)) {
    return TLS_ALERT_BAD_CERTIFICATE
  }
  if (!tlsVerifyCertificateVerify(leaf, tls.verifyScheme(), tls.verifyContent(), tls.verifySignature())) {
    return TLS_ALERT_DECRYPT_ERROR
  }
  return tlsClientChain(chain, tls.config.serverName, nowMs, trust)
}

/**
 * Authenticates `client`'s server, while its interest says
 * `TLS_RECORD_AUTH`: `tlsClientVerdict`, then `client.authenticate(true)` on
 * 0 or `client.reject(alert)` otherwise, which seals the alert. Answers 0
 * or the alert the connection failed with.
 */
export const tlsClientAuthenticate = (client: TlsRecordClient, trust: TlsClientTrust, nowMs: i64): i32 => {
  const alert: i32 = tlsClientVerdict(client.tls, trust, nowMs)
  return alert === 0 ? client.authenticate(true) : client.reject(alert)
}
