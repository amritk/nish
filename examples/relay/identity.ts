/**
 * Where the relay's certificate comes from, and what the game server is told
 * about it: a port of cs's `services/relay/src/tls.rs`.
 *
 * Two arrangements, not variations of each other. A **self-signed** relay is
 * reachable only through `serverCertificateHashes`, which takes ECDSA P-256,
 * at most fourteen days, and the exact certificate named by its SHA-256: so
 * the relay mints one with `nish/crypto/x509` for `SELF_SIGNED_DAYS` and
 * writes the hash to the `--cert-out` file the game server reads. A **real**
 * certificate is a PEM chain and its P-256 key (`--cert`, `--key`), which a
 * browser validates the ordinary way; the `--cert-out` file then says there is
 * nothing to pin, because a hash left behind by an earlier self-signed run
 * would go on being handed out and every client would pin a certificate the
 * relay no longer has. The pair is re-read when either file's modification
 * time changes, and a pair that does not load — missing, or half-written
 * during a renewal — keeps the identity already serving (`RelayWatch`).
 *
 * One difference from tls.rs: `nish/crypto/x509` mints a certificate with no
 * extensions, so the self-signed one names `CN=localhost` and no
 * subjectAltName. `serverCertificateHashes` pins it by hash, not by name, so
 * the names a `--san` adds are printed and not written; Chrome accepting the
 * minted hash is K6's open gate (`docs/wp34-hosting-cs.md` §5).
 *
 * The key is a `Secret` and so may not be a field (NL2430): each loader
 * answers it, and the caller holds it in a local and wipes it.
 */
import { readFileSyncOrNull, statMtimeSync } from "nish:fs"
import { Secret, secret, wipe } from "nish:secret"
import { p256PublicKey } from "nish/crypto/p256"
import { pemToDer, x509CertificateHash, x509MintSelfSigned, x509ParseP256PrivateKey } from "nish/crypto/x509"

/**
 * Days a self-signed certificate is minted for: thirteen rather than the
 * fourteen a browser accepts, so a disagreement about "now" cannot put the
 * relay on the wrong side of the boundary (tls.rs's `SELF_SIGNED_DAYS`).
 */
export const SELF_SIGNED_DAYS: i32 = 13

/** Milliseconds in a day. */
export const MILLIS_PER_DAY: i64 = 86400000

/** The common name the self-signed certificate carries. */
const RELAY_COMMON_NAME: string = "localhost"

/** Whether `t` is a time `statMtimeSync` answered: NaN, its answer for a path it cannot stat, compares false. */
const relayIsTime = (t: f64): boolean => t >= 0

/** Which arrangement the relay runs, from `--cert` and `--key`, or why it cannot. */
export class RelaySource {
  /** Whether a PEM pair is named; otherwise the relay mints its own. */
  pem: boolean = false
  cert: string = ""
  key: string = ""
  /** Why the options name no arrangement, or "". */
  error: string = ""
}

/**
 * The source `--cert` and `--key` name, each "" when not given. One without
 * the other is an error rather than a quiet self-signed fallback: a
 * deployment that believes it serves a real certificate would otherwise
 * serve one no browser trusts and nothing pins.
 */
export const relaySourceFrom = (cert: string, key: string): RelaySource => {
  const s = new RelaySource()
  s.cert = cert
  s.key = key
  s.pem = cert.length > 0 && key.length > 0
  if (cert.length > 0 && key.length === 0) {
    s.error = "--cert needs --key: a certificate is not a key pair"
  } else if (key.length > 0 && cert.length === 0) {
    s.error = "--key needs --cert: a key is not a certificate"
  }
  return s
}

/** An identity's certificate chain and the note that travels with it; the key is its loader's answer. */
export class RelayIdentity {
  /** The DER chain, leaf first, as `QuicServerConfig.certificateChain` takes it. */
  chain: u8[][]
  /** Whether the certificate is pinned by hash (self-signed), and the hash and expiry if so. */
  pinned: boolean = false
  hash: string = ""
  expiresAt: i64 = 0
  /** Why the last load failed, or "". */
  error: string = ""

  constructor() {
    this.chain = []
  }
}

/** `bytes` as dotted lowercase hex, `ab:cd:…`, as `serverCertificateHashes`' readers take it. */
export const relayDottedHex = (bytes: u8[]): string => {
  const digits: string = "0123456789abcdef"
  const parts: string[] = []
  for (let k: i32 = 0; k < toI32(bytes.length); k++) {
    const v: i32 = toI32(bytes[k])
    parts.push(`${digits.substring(v >> 4, (v >> 4) + 1)}${digits.substring(v & 15, (v & 15) + 1)}`)
  }
  return parts.join(":")
}

/**
 * A fresh P-256 key and a self-signed certificate for it, valid from `wall`
 * for `SELF_SIGNED_DAYS`, into `id` with its hash: the key, or `null` with
 * `id.error` set.
 */
export const relayMintIdentity = (wall: i64, id: RelayIdentity): Secret<u8[]> | null => {
  for (let attempt: i32 = 0; attempt < 8; attempt++) {
    const raw: u8[] = new Array<u8>(32)
    crypto.getRandomValues(raw)
    const key: Secret<u8[]> = secret(raw)
    // A scalar of zero or past the order is no key; one in 2^32 draws.
    if (p256PublicKey(key) === null) {
      wipe(key)
      continue
    }
    const serial: u8[] = new Array<u8>(16)
    crypto.getRandomValues(serial)
    serial[0] = toU8((toI32(serial[0]) & 0x7f) | 0x01)
    const der: u8[] | null = x509MintSelfSigned(key, RELAY_COMMON_NAME, wall, SELF_SIGNED_DAYS, serial)
    if (der === null) {
      wipe(key)
      id.error = "could not mint a self-signed certificate"
      return null
    }
    id.chain = [der]
    id.pinned = true
    id.hash = relayDottedHex(x509CertificateHash(der))
    id.expiresAt = wall + toI64(SELF_SIGNED_DAYS) * MILLIS_PER_DAY
    id.error = ""
    return key
  }
  id.error = "could not mint a self-signed certificate: no key in eight draws"
  return null
}

/**
 * The PEM pair `source` names, into `id`: the key, or `null` with `id.error`
 * saying why. A chain file that holds no certificate — created and not yet
 * filled, the renewal window tls.rs's guard is for — is an error, not an
 * identity that cannot complete a handshake.
 */
export const relayLoadPem = (source: RelaySource, id: RelayIdentity): Secret<u8[]> | null => {
  const certText: string | null = readFileSyncOrNull(source.cert)
  const keyText: string | null = readFileSyncOrNull(source.key)
  if (certText === null || keyText === null) {
    id.error = `could not load ${source.cert} and ${source.key}: ${certText === null ? source.cert : source.key} cannot be read`
    return null
  }
  const chain: u8[][] | null = pemToDer(certText, "CERTIFICATE")
  if (chain === null || toI32(chain.length) === 0) {
    id.error = `${source.cert} holds no certificate; it is empty or still being written`
    return null
  }
  const key: Secret<u8[]> | null = x509ParseP256PrivateKey(keyText)
  if (key === null) {
    id.error = `could not load ${source.cert} and ${source.key}: ${source.key} holds no P-256 private key`
    return null
  }
  id.chain = chain
  id.pinned = false
  id.hash = ""
  id.expiresAt = 0
  id.error = ""
  return key
}

/**
 * What goes in the `--cert-out` file: the hash and when it dies, or, for a
 * real certificate, a file with no hash in it, which is what overwrites a
 * stale pin (tls.rs's `cert_out_body`, byte for byte).
 */
export const relayCertOutBody = (id: RelayIdentity): string =>
  id.pinned ? `{"hash":"${id.hash}","expiresAt":${id.expiresAt}}` : `{"trusted":true}`

/**
 * When the certificate files were last written, for noticing a renewal
 * (tls.rs's `stamp`). Either file unreadable reads as "unchanged", as tls.rs
 * reads it: mid-renewal a file can be absent for a moment, and that is no
 * reason to drop a certificate that works.
 */
export class RelayWatch {
  source: RelaySource
  certTime: f64 = 0
  keyTime: f64 = 0
  /** Whether `certTime` and `keyTime` are a pair that loaded. */
  seen: boolean = false

  constructor(source: RelaySource) {
    this.source = source
  }

  /** Records the files' times as the pair now serving. */
  mark(): boolean {
    const cert: f64 = statMtimeSync(this.source.cert)
    const key: f64 = statMtimeSync(this.source.key)
    if (!relayIsTime(cert) || !relayIsTime(key)) {
      return false
    }
    this.certTime = cert
    this.keyTime = key
    this.seen = true
    return true
  }

  /** Whether both files can be read and either has changed since `mark`. */
  changed(): boolean {
    const cert: f64 = statMtimeSync(this.source.cert)
    const key: f64 = statMtimeSync(this.source.key)
    if (!relayIsTime(cert) || !relayIsTime(key)) {
      return false
    }
    return !this.seen || cert !== this.certTime || key !== this.keyTime
  }
}

/**
 * A renewal, looked for: when the PEM pair `watch` follows has changed and
 * loads, its key, with the new chain in `fresh` and the pair marked seen;
 * otherwise `null`, with `fresh.error` saying why when it changed and did
 * not load. Only a pair that loaded is marked, so a half-written one is tried
 * again at the next poll rather than skipped for having been seen.
 */
export const relayRenew = (watch: RelayWatch, fresh: RelayIdentity): Secret<u8[]> | null => {
  fresh.error = ""
  if (!watch.changed()) {
    return null
  }
  const key: Secret<u8[]> | null = relayLoadPem(watch.source, fresh)
  if (key !== null) {
    watch.mark()
  }
  return key
}
