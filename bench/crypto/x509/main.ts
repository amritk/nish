// The x509 family's Nish program: a self-signed P-256 certificate minted and
// parsed with nish/crypto/x509, under the contract in bench/crypto/README.md.
// bench/crypto/run.mjs builds it with `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
// The inputs each kernel draws, and what each folds, are in this family's
// README.md.
import {
  X509Certificate,
  x509MintSelfSigned,
  x509ParseCertificate,
  x509VerifySignature,
} from "nish/crypto/x509"
import { Secret, secret, wipe } from "nish:secret"
import { Args, baseOf, fold, foldStart, Inputs, inputs, now, parseArgs, report, tweak } from "../lib/gen"

/** The subject's and issuer's common name. */
const COMMON_NAME: string = "bench.nish.dev"

/** notBefore: 2026-01-01T00:00:00Z, in milliseconds. */
const NOT_BEFORE_MS: i64 = 1767225600000

/** The validity, in days: the most x509MintSelfSigned writes. */
const DAYS: i32 = 14

/**
 * The certificate x509-parse reads: the DER x509-mint wrote for its first
 * iteration, signature and all, so every twin parses the same bytes. Its
 * length is the kernel's size.
 */
const FIXED_CERT: string =
  "3082014e3081f6a003020102021057a8a60ac6cf332f0d105dba046fb40d300a06082a8648ce3d04030230193117301506035504030c0e62656e63682e6e6973682e646576301e170d3236303130313030303030305a170d3236303131353030303030305a30193117301506035504030c0e62656e63682e6e6973682e6465763059301306072a8648ce3d020106082a8648ce3d030107034200046773f52bac85b0278dbc1c6ab010e6a63ab5cb19673672f3a66e3b53e5fc31fa6881cfb754e458be32e5c105f96ac0dc83f02224f7c4f0f56ec4f165496b0e53a320301e300c0603551d130101ff04023000300e0603551d0f0101ff040403020780300a06082a8648ce3d04030203470030440220706060f8d5a0c763dafd8f5a9a7cfd6131b7eba82739420235dcd9f91b2371f102207d9f5543446e841cc9029d83741fd9ed9753120cd1eefa51f098e6f60dc74742"

/** A fresh copy of `bytes`: what `secret` takes. */
const copyOf = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length)
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    if (i < toI32(out.length)) {
      out[i] = bytes[i]
    }
  }
  return out
}

/** One lowercase hex digit's value. */
const nibble = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48)

/** `text`, two lowercase hex digits a byte, as bytes. */
const fromHex = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length / 2)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8((nibble(text.charCodeAt(2 * i)) << 4) | nibble(text.charCodeAt(2 * i + 1)))
  }
  return out
}

/** Seconds since 1970 from milliseconds, as eight big-endian bytes. */
const secondsOf = (ms: i64): u8[] => {
  const s: i64 = ms / 1000
  const out: u8[] = new Array<u8>(8)
  for (let k: i32 = 0; k < 8; k++) {
    out[k] = toU8(toI32((s >> toI64(56 - 8 * k)) & 255))
  }
  return out
}

/**
 * The common name's value bytes in a Name of one RDN, `SEQUENCE { SET {
 * SEQUENCE { OID 2.5.4.3, string } } }`, every length in short form; `null` for
 * any other shape.
 */
const commonNameOf = (name: u8[]): u8[] | null => {
  // 30 L 31 L 30 L 06 03 55 04 03 <tag> <length> <value>, from offset 0
  if (name.length < 13 || name[0] !== toU8(0x30) || name[2] !== toU8(0x31) || name[4] !== toU8(0x30)) {
    return null
  }
  if (
    name[6] !== toU8(6) ||
    name[7] !== toU8(3) ||
    name[8] !== toU8(0x55) ||
    name[9] !== toU8(4) ||
    name[10] !== toU8(3)
  ) {
    return null
  }
  const length: i32 = toI32(name[12])
  if (length > 127 || 13 + length !== toI32(name.length)) {
    return null
  }
  const out: u8[] = new Array<u8>(length)
  for (let k: i32 = 0; k < length; k++) {
    if (k < toI32(out.length) && 13 + k < toI32(name.length)) {
      out[k] = name[13 + k]
    }
  }
  return out
}

/** What both kernels fold for a certificate: the common name, the validity, the point and the self-verify byte. */
const foldCertificate = (sum: u32, cert: X509Certificate, cn: u8[]): u32 => {
  const verdict: u8[] = [toU8(x509VerifySignature(cert, cert) ? 1 : 0)]
  return fold(
    fold(fold(fold(fold(sum, cn), secondsOf(cert.notBefore)), secondsOf(cert.notAfter)), cert.publicKey),
    verdict
  )
}

/**
 * Mints a certificate for each tweaked serial. The signatures are randomised in
 * the twins that randomise ECDSA, so the fold is what parsing each one back
 * gives, done after the clock stops and not timed.
 */
const mintLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, a.size)
  const priv: Secret<u8[]> = secret(copyOf(inp.key))
  const msg: u8[] = inp.msg
  const base: u8[] = baseOf(msg, 0)
  const certs: u8[][] = []
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    const serial: u8[] = copyOf(msg)
    // A positive INTEGER whose first octet is not zero, so it is encoded as it is.
    serial[0] = (serial[0] & toU8(0x3f)) | toU8(0x40)
    const der: u8[] | null = x509MintSelfSigned(priv, COMMON_NAME, NOT_BEFORE_MS, DAYS, serial)
    if (der === null) {
      writeError("x509: x509MintSelfSigned answered null\n")
      wipe(priv)
      return 1
    }
    certs.push(der)
  }
  const stopped: i64 = now()
  wipe(priv)
  let sum: u32 = foldStart()
  for (let i: i32 = 0; i < toI32(certs.length); i++) {
    const cert: X509Certificate | null = x509ParseCertificate(certs[i])
    const cn: u8[] | null = cert === null ? null : commonNameOf(cert.subject)
    if (cert === null || cn === null) {
      writeError("x509: a minted certificate did not parse back\n")
      return 1
    }
    sum = foldCertificate(fold(sum, cert.serial), cert, cn)
  }
  report(sum, started + (now() - stopped))
  return 0
}

/** Parses the fixed certificate and verifies its self-signature, each iteration. */
const parseLoop = (a: Args): i32 => {
  const der: u8[] = fromHex(FIXED_CERT)
  if (a.size !== toI32(der.length)) {
    writeError(`x509: x509-parse's size is ${der.length}, the fixed certificate's length\n`)
    return 2
  }
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const cert: X509Certificate | null = x509ParseCertificate(der)
    const cn: u8[] | null = cert === null ? null : commonNameOf(cert.subject)
    if (cert === null || cn === null) {
      writeError("x509: the fixed certificate did not parse\n")
      return 1
    }
    sum = foldCertificate(sum, cert, cn)
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("x509")
  if (a === null) {
    return 2
  }
  if (a.kernel === "x509-mint") {
    if (a.size < 4 || a.size > 20) {
      writeError("x509: x509-mint's size is the serial's length, 4 to 20 bytes\n")
      return 2
    }
    return mintLoop(a)
  }
  if (a.kernel === "x509-parse") {
    return parseLoop(a)
  }
  writeError(`x509: no kernel ${a.kernel}\n`)
  return 2
}
