// The fixed-seed malformed-input corpus of the X.509 security audit
// (docs/security/crypto-x509.md): every valid fixture `crypto_x509` holds —
// three certificates, two of their signatures, four private keys and four PEM
// files — cut short at every length, with every bit of the DER and a random
// bit of each PEM character flipped in turn, and put through random edits
// drawn from one fixed xorshift32 seed. Every input must come back from the
// parser without a panic (the process reaching its summary is that proof), and
// none may come back as something it should not be:
//
//   a cut DER          null
//   a certificate      null, or a certificate that is not the original
//                      signed bytes under a signature the original issuer's
//                      key accepts: no edit to the framing, the algorithm or
//                      the signature's encoding keeps a valid signature
//   an ECDSA signature null, or an `r || s` other than the original's: DER
//                      spells each value one way
//   a private key      null, or the original scalar: no edit yields another key
//   a cut PEM          null, or the blocks before the cut, unchanged
//   an edited PEM      null, or certificates each the original or not passing
//                      for it, and keys that are the original
//
// An edit inside tbsCertificate makes a different message, and a signature
// valid over it would be an ECDSA forgery rather than a parser's mistake, so
// only inputs whose TBS reads back unchanged are verified — the ones a parser
// that accepts a second spelling of the same certificate would let through.
//
// Each fixture's line counts what the parser did with its inputs, so a change
// to what it refuses moves a number here and has to say why. The seed and the
// edit counts are constants below; the run is the same on every machine.
import { Suite } from "nish/testing"
import {
  X509Certificate,
  derToPem,
  pemToDer,
  x509DerSignatureRS,
  x509ParseCertificate,
  x509ParseChain,
  x509VerifySignature,
} from "nish/crypto/x509"
import { x509ParseP256PrivateKeyPlain as x509ParseP256PrivateKey } from "../crypto_x509/plain"
import {
  A25_PRIVATE,
  CA_PEM,
  CA_PKCS8_PEM,
  CA_PRIVATE,
  CA_SEC1_PEM,
  GOLDEN_PEM,
  KEY_PKCS8,
  KEY_SEC1,
  LEAF_PEM,
} from "../crypto_x509/fixtures"
import { bytesOf, fromHex, sameBytes, textOf, toHex } from "../crypto_x509/hex"

const SEED: i32 = 0x2545f491
// Random edits per DER fixture and per PEM fixture.
const DER_EDITS: i32 = 600
const PEM_EDITS: i32 = 300

// What one input came to.
const REFUSED: i32 = 0
const HARMLESS: i32 = 1
const VIOLATION: i32 = 2

/** xorshift32 (Marsaglia 2003), one step. */
const xorshift = (x: i32): i32 => {
  let y: i32 = x ^ (x << 13)
  y = y ^ (y >>> 17)
  return y ^ (y << 5)
}

/** A draw in `[0, bound)` from a state, which the caller steps on. */
const below = (state: i32, bound: i32): i32 => (state >>> 1) % bound

/** Tallies one fixture's inputs by outcome. */
class Tally {
  inputs: i32 = 0
  refused: i32 = 0
  harmless: i32 = 0
  violations: i32 = 0

  add(outcome: i32): void {
    this.inputs = this.inputs + 1
    if (outcome === REFUSED) {
      this.refused = this.refused + 1
    } else if (outcome === HARMLESS) {
      this.harmless = this.harmless + 1
    } else {
      this.violations = this.violations + 1
    }
  }

  /** One check for the fixture: no violation, with the counts in its name. */
  report(t: Suite, name: string, harmless: string): i32 {
    t.eqI32(`${name}: ${this.inputs} inputs, ${this.refused} refused, ${this.harmless} ${harmless}`, this.violations, 0)
    return this.inputs
  }
}

/** The one block of `label` in `pem`, or an empty array. */
const onlyBlock = (pem: string, label: string): u8[] => {
  const blocks: u8[][] | null = pemToDer(pem, label)
  return blocks === null || toI32(blocks.length) !== 1 ? [] : blocks[0]
}

/** The certificate in `pem`, which the fixtures promise parses. */
const certOf = (pem: string): X509Certificate => {
  const cert: X509Certificate | null = x509ParseCertificate(onlyBlock(pem, "CERTIFICATE"))
  if (cert === null) {
    panic("a fixture certificate did not parse")
  }
  return cert
}

/** `der[0 .. n)`. */
const prefix = (der: u8[], n: i32): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < n && i < toI32(der.length); i++) {
    out.push(der[i])
  }
  return out
}

/** `der` with bit `bit` of octet `at` flipped. */
const flipped = (der: u8[], at: i32, bit: i32): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < toI32(der.length); i++) {
    out.push(i === at ? der[i] ^ toU8(1 << bit) : der[i])
  }
  return out
}

/**
 * `der` after one to four edits drawn from `state`: an octet set to a random
 * value or to one of DER's boundary values (0, 7F, 80, 81, 82, 84, FF), an
 * octet deleted, or one inserted. Deletion and insertion move every length
 * after the edit, which is what probes the length arithmetic. Never `der`
 * itself.
 */
const edited = (der: u8[], state: i32): u8[] => {
  const boundary: i32[] = [0x00, 0x7f, 0x80, 0x81, 0x82, 0x84, 0xff]
  let out: u8[] = prefix(der, toI32(der.length))
  let s: i32 = xorshift(state)
  const edits: i32 = 1 + below(s, 4)
  for (let e: i32 = 0; e < edits; e++) {
    s = xorshift(s)
    const op: i32 = below(s, 4)
    s = xorshift(s)
    const n: i32 = toI32(out.length)
    const at: i32 = n === 0 ? 0 : below(s, n)
    s = xorshift(s)
    const value: i32 = op === 1 ? boundary[below(s, 7)] : below(s, 256)
    const next: u8[] = []
    for (let i: i32 = 0; i <= n; i++) {
      if (i === at && op === 3) {
        next.push(toU8(value))
      }
      if (i < toI32(out.length) && !(i === at && op === 2)) {
        next.push(i === at && op < 2 ? toU8(value) : out[i])
      }
    }
    out = next
  }
  // Edits can undo each other; an input equal to the fixture is not malformed.
  return sameBytes(out, der) ? flipped(der, 0, 0) : out
}

/** How many inputs `mutant` derives from a fixture of `n` octets. */
const mutantCount = (n: i32, everyBit: boolean, edits: i32): i32 => n + (everyBit ? 8 * n : n) + edits

/**
 * The `i`-th malformed input derived from `fixture`: first every cut, `i`
 * octets long; then every bit flipped (`everyBit`) or one bit of each octet,
 * drawn from `state`; then random edits from `state`, which the caller steps
 * once an input.
 */
const mutant = (fixture: u8[], i: i32, state: i32, everyBit: boolean): u8[] => {
  const n: i32 = toI32(fixture.length)
  if (i < n) {
    return prefix(fixture, i)
  }
  const flip: i32 = i - n
  if (everyBit && flip < 8 * n) {
    return flipped(fixture, flip >> 3, flip & 7)
  }
  if (!everyBit && flip < n) {
    return flipped(fixture, flip, below(state, 8))
  }
  return edited(fixture, state)
}

/**
 * Whether `cert`, read from an edited input, would pass for `original`: its
 * TBS unchanged and its signature accepted by `issuer`.
 */
const passesFor = (cert: X509Certificate, original: X509Certificate, issuer: X509Certificate): boolean =>
  sameBytes(cert.tbs, original.tbs) && x509VerifySignature(cert, issuer)

/** A certificate input's outcome: refused, or read, not cut, and not passing for `original`. */
const certOutcome = (input: u8[], cut: boolean, original: X509Certificate, issuer: X509Certificate): i32 => {
  const cert: X509Certificate | null = x509ParseCertificate(input)
  if (cert === null) {
    return REFUSED
  }
  return cut || passesFor(cert, original, issuer) ? VIOLATION : HARMLESS
}

/** A signature input's outcome: refused, or read, not cut, and not the original's `r || s`. */
const signatureOutcome = (input: u8[], cut: boolean, rs: string): i32 => {
  const out: u8[] | null = x509DerSignatureRS(input)
  if (out === null) {
    return REFUSED
  }
  return cut || toHex(out) === rs ? VIOLATION : HARMLESS
}

/** A private-key PEM's outcome: refused, or the original scalar. */
const keyPemOutcome = (input: string, scalar: string): i32 => {
  const key: u8[] | null = x509ParseP256PrivateKey(input)
  if (key === null) {
    return REFUSED
  }
  return toHex(key) === scalar ? HARMLESS : VIOLATION
}

/** A private-key DER's outcome, put in a PEM block of `label`: refused, or not cut and the original scalar. */
const keyOutcome = (input: u8[], cut: boolean, label: string, scalar: string): i32 => {
  const outcome: i32 = keyPemOutcome(derToPem(input, label), scalar)
  return cut && outcome !== REFUSED ? VIOLATION : outcome
}

/**
 * A certificate PEM's outcome against the original `certs` and their
 * `issuers`, index for index: refused; or no more certificates than the
 * original, each the original's bytes or, unless `cut`, not passing for it.
 */
const chainOutcome = (input: string, cut: boolean, certs: X509Certificate[], issuers: X509Certificate[]): i32 => {
  const chain: X509Certificate[] | null = x509ParseChain(input)
  if (chain === null) {
    return REFUSED
  }
  for (let i: i32 = 0; i < toI32(chain.length); i++) {
    if (i >= toI32(certs.length) || i >= toI32(issuers.length)) {
      return VIOLATION
    }
    const original: X509Certificate = certs[i]
    const issuer: X509Certificate = issuers[i]
    if (!sameBytes(chain[i].der, original.der) && (cut || passesFor(chain[i], original, issuer))) {
      return VIOLATION
    }
  }
  return HARMLESS
}

// Each corpus runs every input between an `Arena.mark` and its `Arena.release`:
// what parsing one input allocates is gone before the next, so the corpus runs
// in the memory of one input rather than of all of them.

/** Every cut, every bit flip and `DER_EDITS` random edits of a certificate. */
const certCorpus = (t: Suite, name: string, cert: X509Certificate, issuer: X509Certificate, seed: i32): i32 => {
  const tally = new Tally()
  const n: i32 = toI32(cert.der.length)
  let s: i32 = seed
  for (let i: i32 = 0; i < mutantCount(n, true, DER_EDITS); i++) {
    s = xorshift(s)
    const mark: i64 = Arena.mark()
    tally.add(certOutcome(mutant(cert.der, i, s, true), i < n, cert, issuer))
    Arena.release(mark)
  }
  return tally.report(t, name, "read and not the original")
}

/** The same for a certificate's ECDSA-Sig-Value, read by `x509DerSignatureRS` alone. */
const signatureCorpus = (t: Suite, name: string, der: u8[], seed: i32): i32 => {
  const tally = new Tally()
  const rsOrNull: u8[] | null = x509DerSignatureRS(der)
  if (rsOrNull === null) {
    t.fail(name, "the fixture signature did not read")
    return 0
  }
  const rs: string = toHex(rsOrNull)
  const n: i32 = toI32(der.length)
  let s: i32 = seed
  for (let i: i32 = 0; i < mutantCount(n, true, DER_EDITS); i++) {
    s = xorshift(s)
    const mark: i64 = Arena.mark()
    tally.add(signatureOutcome(mutant(der, i, s, true), i < n, rs))
    Arena.release(mark)
  }
  return tally.report(t, name, "read as another r || s")
}

/** The same for a private key, each input put in a PEM block of `label`. */
const keyCorpus = (t: Suite, name: string, der: u8[], label: string, scalar: string, seed: i32): i32 => {
  const tally = new Tally()
  const n: i32 = toI32(der.length)
  let s: i32 = seed
  for (let i: i32 = 0; i < mutantCount(n, true, DER_EDITS); i++) {
    s = xorshift(s)
    const mark: i64 = Arena.mark()
    tally.add(keyOutcome(mutant(der, i, s, true), i < n, label, scalar))
    Arena.release(mark)
  }
  return tally.report(t, name, "the same key")
}

/**
 * Every cut, one random bit flipped in each character, and `PEM_EDITS` random
 * edits of a certificate PEM file. The DER corpus flips every bit; here most
 * flips only make a character base64 does not have.
 */
const chainCorpus = (
  t: Suite,
  name: string,
  text: string,
  certs: X509Certificate[],
  issuers: X509Certificate[],
  seed: i32
): i32 => {
  const tally = new Tally()
  const pem: u8[] = bytesOf(text)
  const n: i32 = toI32(pem.length)
  let s: i32 = seed
  for (let i: i32 = 0; i < mutantCount(n, false, PEM_EDITS); i++) {
    s = xorshift(s)
    const mark: i64 = Arena.mark()
    tally.add(chainOutcome(textOf(mutant(pem, i, s, false)), i < n, certs, issuers))
    Arena.release(mark)
  }
  return tally.report(t, name, "read as the original or not passing for it")
}

/** The same for a private-key PEM file: a cut or edited file answers null or the same key. */
const keyPemCorpus = (t: Suite, name: string, text: string, scalar: string, seed: i32): i32 => {
  const tally = new Tally()
  const pem: u8[] = bytesOf(text)
  const n: i32 = toI32(pem.length)
  let s: i32 = seed
  for (let i: i32 = 0; i < mutantCount(n, false, PEM_EDITS); i++) {
    s = xorshift(s)
    const mark: i64 = Arena.mark()
    tally.add(keyPemOutcome(textOf(mutant(pem, i, s, false)), scalar))
    Arena.release(mark)
  }
  return tally.report(t, name, "the same key")
}

export const main = (): i32 => {
  const t = new Suite("x509 malformed corpus")
  const golden: X509Certificate = certOf(GOLDEN_PEM)
  const ca: X509Certificate = certOf(CA_PEM)
  const leaf: X509Certificate = certOf(LEAF_PEM)
  let total: i32 = 0
  total = total + certCorpus(t, "golden certificate DER", golden, golden, SEED)
  total = total + certCorpus(t, "CA certificate DER", ca, ca, SEED ^ 1)
  total = total + certCorpus(t, "leaf certificate DER", leaf, ca, SEED ^ 2)
  total = total + signatureCorpus(t, "golden signature DER", golden.signature, SEED ^ 11)
  total = total + signatureCorpus(t, "leaf signature DER", leaf.signature, SEED ^ 12)
  total = total + keyCorpus(t, "A.2.5 SEC1 key DER", fromHex(KEY_SEC1), "EC PRIVATE KEY", A25_PRIVATE, SEED ^ 3)
  total = total + keyCorpus(t, "A.2.5 PKCS#8 key DER", fromHex(KEY_PKCS8), "PRIVATE KEY", A25_PRIVATE, SEED ^ 4)
  total = total + keyCorpus(t, "CA SEC1 key DER", onlyBlock(CA_SEC1_PEM, "EC PRIVATE KEY"), "EC PRIVATE KEY", CA_PRIVATE, SEED ^ 5)
  total = total + keyCorpus(t, "CA PKCS#8 key DER", onlyBlock(CA_PKCS8_PEM, "PRIVATE KEY"), "PRIVATE KEY", CA_PRIVATE, SEED ^ 6)
  total = total + chainCorpus(t, "golden PEM", GOLDEN_PEM, [golden], [golden], SEED ^ 7)
  total = total + chainCorpus(t, "leaf and CA PEM", `${LEAF_PEM}${CA_PEM}`, [leaf, ca], [ca, ca], SEED ^ 8)
  total = total + keyPemCorpus(t, "CA SEC1 key PEM", CA_SEC1_PEM, CA_PRIVATE, SEED ^ 9)
  total = total + keyPemCorpus(t, "CA PKCS#8 key PEM", CA_PKCS8_PEM, CA_PRIVATE, SEED ^ 10)
  t.ok(`${total} malformed inputs in all, at least 10,000`, total >= 10000)
  return t.done()
}
