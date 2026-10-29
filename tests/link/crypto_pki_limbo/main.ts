// `nish/crypto/pki` against x509-limbo's server-authentication cases
// (cases.ts says which are kept): each case's chain, trusted certificates,
// peer name and time go through `pkiTrustStore` and `pkiVerifyServer`, and
// one line per case prints the verdict and the reason for a refusal. A case
// whose verdict is not limbo's must be listed in divergences.ts, with the
// finding of docs/security/crypto-pki.md that keeps it, and a listed case must
// still diverge; the exit code counts the cases that break that rule.
import { base64StdPadDecode } from "nish/crypto/base64url"
import {
  PKI_ERR_BAD_SIGNATURE,
  PKI_ERR_BUDGET,
  PKI_ERR_CHAIN_TOO_LONG,
  PKI_ERR_EXPIRED,
  PKI_ERR_EXT_KEY_USAGE,
  PKI_ERR_HOSTNAME,
  PKI_ERR_KEY_USAGE,
  PKI_ERR_MALFORMED,
  PKI_ERR_NAME_CONSTRAINTS,
  PKI_ERR_NOT_CA,
  PKI_ERR_NOT_YET_VALID,
  PKI_ERR_PATH_LENGTH,
  PKI_ERR_UNKNOWN_CRITICAL,
  PKI_ERR_UNSUPPORTED_ALGORITHM,
  PKI_ERR_UNTRUSTED,
  PKI_ERR_WEAK_KEY,
  PKI_OK,
  PkiResult,
  pkiTrustStore,
  pkiVerifyServer,
} from "nish/crypto/pki"
import { X509Certificate, x509ParseCertificate } from "nish/crypto/x509"
import { limboCases } from "./cases"
import { limboCerts } from "./certs"
import { limboDivergences } from "./divergences"
import { LimboCase, LimboDivergence } from "./types"

/** The constant's name for a `pkiVerifyServer` code, without its `PKI_` prefix. */
const codeName = (code: i32): string => {
  const names: string[] = [
    "OK",
    "ERR_MALFORMED",
    "ERR_EXPIRED",
    "ERR_NOT_YET_VALID",
    "ERR_UNTRUSTED",
    "ERR_BAD_SIGNATURE",
    "ERR_NOT_CA",
    "ERR_PATH_LENGTH",
    "ERR_KEY_USAGE",
    "ERR_EXT_KEY_USAGE",
    "ERR_UNKNOWN_CRITICAL",
    "ERR_NAME_CONSTRAINTS",
    "ERR_HOSTNAME",
    "ERR_WEAK_KEY",
    "ERR_UNSUPPORTED_ALGORITHM",
    "ERR_CHAIN_TOO_LONG",
    "ERR_BUDGET",
  ]
  return code >= 0 && code < toI32(names.length) ? names[code] : `code ${code}`
}

/** Certificate `index` of `certs`, as DER; empty if its base64 does not decode, which `pkiVerifyServer` refuses as malformed. */
const der = (certs: string[], index: number): u8[] => {
  const bytes: u8[] | null = base64StdPadDecode(certs[toI32(index)])
  if (bytes === null) {
    const empty: u8[] = []
    return empty
  }
  return bytes
}

export const main = (): i32 => {
  // The names above are the codes' order; a renumbered code fails here.
  const order: i32[] = [
    PKI_OK,
    PKI_ERR_MALFORMED,
    PKI_ERR_EXPIRED,
    PKI_ERR_NOT_YET_VALID,
    PKI_ERR_UNTRUSTED,
    PKI_ERR_BAD_SIGNATURE,
    PKI_ERR_NOT_CA,
    PKI_ERR_PATH_LENGTH,
    PKI_ERR_KEY_USAGE,
    PKI_ERR_EXT_KEY_USAGE,
    PKI_ERR_UNKNOWN_CRITICAL,
    PKI_ERR_NAME_CONSTRAINTS,
    PKI_ERR_HOSTNAME,
    PKI_ERR_WEAK_KEY,
    PKI_ERR_UNSUPPORTED_ALGORITHM,
    PKI_ERR_CHAIN_TOO_LONG,
    PKI_ERR_BUDGET,
  ]
  let failures: i32 = 0
  for (let i: i32 = 0; i < toI32(order.length); i++) {
    if (order[i] !== i) {
      console.log(`FAIL the PKI_ codes are not numbered as main.ts names them, at ${i}`)
      failures = failures + 1
    }
  }
  const certs: string[] = limboCerts()
  const kept: LimboDivergence[] = limboDivergences()
  const seen: boolean[] = []
  for (let k: i32 = 0; k < toI32(kept.length); k++) {
    seen.push(false)
  }
  let agree: i32 = 0
  let diverge: i32 = 0
  let accepted: i32 = 0
  const cases: LimboCase[] = limboCases()
  for (const c of cases) {
    const roots: X509Certificate[] = []
    for (const t of c.trusted) {
      const root: X509Certificate | null = x509ParseCertificate(der(certs, t))
      if (root !== null) {
        roots.push(root)
      }
    }
    const chain: u8[][] = [der(certs, c.peer)]
    for (const u of c.untrusted) {
      chain.push(der(certs, u))
    }
    const nowMs: i64 = toI64(c.atSec) * toI64(1000) + toI64(c.atMs)
    const r: PkiResult = pkiVerifyServer(chain, c.host, nowMs, pkiTrustStore(roots))
    const ok: boolean = r.code === PKI_OK
    accepted = accepted + (ok ? 1 : 0)
    const verdict: string = ok ? "SUCCESS" : `FAILURE ${codeName(r.code)}`
    let listed: i32 = -1
    for (let k: i32 = 0; k < toI32(kept.length); k++) {
      if (kept[k].id === c.id) {
        listed = k
      }
    }
    if (ok === c.success) {
      agree = agree + 1
      if (listed >= 0) {
        console.log(`FAIL ${c.id}: ${verdict}, as limbo says, but divergences.ts lists it`)
        failures = failures + 1
      } else {
        console.log(`${c.id}: ${verdict}`)
      }
    } else {
      diverge = diverge + 1
      const want: string = c.success ? "SUCCESS" : "FAILURE"
      if (listed >= 0) {
        seen[listed] = true
        console.log(`${c.id}: ${verdict}, limbo says ${want}: kept, ${kept[listed].finding}`)
      } else {
        console.log(`FAIL ${c.id}: ${verdict}, limbo says ${want}`)
        failures = failures + 1
      }
    }
  }
  for (let k: i32 = 0; k < toI32(kept.length); k++) {
    if (!seen[k]) {
      console.log(`FAIL ${kept[k].id}: listed in divergences.ts, but no kept case diverges so`)
      failures = failures + 1
    }
  }
  console.log(
    `x509-limbo: ${toI32(cases.length)} cases, ${accepted} accepted, ${agree} as limbo says, ${diverge} divergences kept`
  )
  return failures
}
