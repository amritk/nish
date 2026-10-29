// The X.509 path walk (`nish/crypto/x509-path`) over a peer's chain, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is an `X509_PATH_*` code, so a panic here is a finding
// (docs/security/crypto-x509.md).
//
// The input is the certificates of a TLS Certificate message and then a trust
// anchor: the first byte's low two bits plus one is how many certificates the
// chain holds, each a two-byte big-endian length and that many DER bytes; what
// is left is the anchor's DER, and a store with no anchor when it does not
// parse. A chain that runs out early is cut where it ran out. The chain is
// validated twice, for `example.com` and for `EXAMPLE.Com`, which RFC 6125
// §6.4.1 says are one name: the two answers must agree, be one of the codes,
// and have a reason.
import { X509Certificate, x509ParseCertificate } from "nish/crypto/x509"
import { X509TrustStore, X509_PATH_UNSUPPORTED_NAME_CONSTRAINT, x509PathReason, x509ValidatePath } from "nish/crypto/x509-path"

/** 2027-01-01T00:00:00Z, inside the seeds' validity: a fixed clock, so an input answers the same each run. */
const FUZZ_NOW: i64 = 1798761600

/** The `count` bytes of `data` from `from`, copied. */
const copyRange = (data: u8[], from: i32, count: i32): u8[] => {
  const out: u8[] = []
  for (let k: i32 = from; k >= 0 && k < from + count && k < toI32(data.length); k++) {
    out.push(data[k])
  }
  return out
}

export const fuzzOne = (data: u8[]): void => {
  if (toI32(data.length) < 1) {
    return
  }
  const want: i32 = (toI32(data[0]) & 3) + 1
  const chain: u8[][] = []
  let at: i32 = 1
  while (toI32(chain.length) < want && at >= 0 && at + 1 < toI32(data.length)) {
    const size: i32 = (toI32(data[at]) << 8) | toI32(data[at + 1])
    chain.push(copyRange(data, at + 2, size))
    at = at + 2 + size
  }
  const trust = new X509TrustStore()
  const anchor: X509Certificate | null = x509ParseCertificate(copyRange(data, at, toI32(data.length) - at))
  if (anchor !== null) {
    trust.anchors.push(anchor)
  }
  const lower: i32 = x509ValidatePath(chain, trust, "example.com", FUZZ_NOW)
  const mixed: i32 = x509ValidatePath(chain, trust, "EXAMPLE.Com", FUZZ_NOW)
  if (lower !== mixed) {
    panic("x509-path: the host's case changed the answer")
  }
  if (lower < 0 || lower > X509_PATH_UNSUPPORTED_NAME_CONSTRAINT || toI32(x509PathReason(lower).length) === 0) {
    panic("x509-path: an answer outside the codes")
  }
}
