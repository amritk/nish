// Writes certs.ts and cases.ts from x509-limbo's limbo.json:
//
//   node tests/link/crypto_pki_limbo/generate.mjs <path to limbo.json>
//
// limbo.json is the file at the commit below, whose SHA-256 is checked; it is
// about 40 MB, so it is not kept here. A case is kept when it is one
// `nish/crypto/pki` claims: a SERVER case with one expected peer name and no
// CRL, no max_chain_depth, no ML-DSA key and no key usage or extended key
// usage but the ones `pkiVerifyServer` always asks of a server. Of BetterTLS's
// name-constraint cases (`bettertls::`), every BETTERTLS_STRIDE-th is kept, to
// keep the files small; `--all-bettertls` keeps them all, for a run by hand.
// Every left-out case is counted by its reason, and the counts and kept cases
// must add up to the file's SERVER and CLIENT cases.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const COMMIT = "1080e565f26e544bbe9cf99953be8a57c08e7e20"
const URL = `https://raw.githubusercontent.com/C2SP/x509-limbo/${COMMIT}/limbo.json`
const SHA256 = "611e337b9fb477b927bae65434650692cb9d2070ff5b05f975d0403510acd4de"
const BETTERTLS_STRIDE = 20
// The instant a case with no validation_time is judged at, 2026-10-01T00:00:00Z.
// Every such case's peer certificate is valid then (checked below); some
// cases hold an expired intermediate on purpose.
const DEFAULT_TIME = Date.parse("2026-10-01T00:00:00Z")
// Features `pkiVerifyServer` has no part of: revocation, ML-DSA and a caller's
// own path depth.
const UNCLAIMED = new Set(["has-crl", "has-mldsa", "max-chain-depth"])

const args = process.argv.slice(2)
const all = args.includes("--all-bettertls")
const file = args.find((a) => !a.startsWith("--"))
if (!file) {
  console.error("usage: node generate.mjs <path to limbo.json> [--all-bettertls]")
  process.exit(2)
}
const bytes = fs.readFileSync(file)
const digest = crypto.createHash("sha256").update(bytes).digest("hex")
if (digest !== SHA256) {
  throw new Error(`${file}: SHA-256 ${digest}, not the pinned ${SHA256}`)
}
const here = path.dirname(fileURLToPath(import.meta.url))
const limbo = JSON.parse(bytes.toString("utf8"))

/** Why `t` is left out, or null when it is kept. */
const leftOut = (t) => {
  if (t.validation_kind !== "SERVER") {
    return "a CLIENT case"
  }
  if (t.features.some((f) => UNCLAIMED.has(f)) || t.crls.length !== 0 || t.max_chain_depth !== null) {
    return "a CRL, an ML-DSA key or a max_chain_depth"
  }
  if (t.expected_peer_name === null || t.expected_peer_names.length !== 0) {
    return "no single expected peer name"
  }
  const eku = t.extended_key_usage.filter((u) => u !== "serverAuth")
  const ku = t.key_usage.filter((u) => u !== "digitalSignature")
  if (eku.length !== 0 || ku.length !== 0 || t.signature_algorithms.length !== 0) {
    return "a key usage, extended key usage or algorithm list of its own"
  }
  if (!all && t.id.startsWith("bettertls::") && Number(t.id.split("::tc")[1]) % BETTERTLS_STRIDE !== 0) {
    return `a BetterTLS case not in the 1-in-${BETTERTLS_STRIDE} sample`
  }
  return null
}

/** A PEM certificate's DER, in base64 on one line. */
const derBase64 = (pem) => new crypto.X509Certificate(pem).raw.toString("base64")

const certIndex = new Map()
const certs = []
const certOf = (pem) => {
  const b64 = derBase64(pem)
  if (!certIndex.has(b64)) {
    certIndex.set(b64, certs.length)
    certs.push(b64)
  }
  return certIndex.get(b64)
}

const reasons = new Map()
const lines = []
let success = 0
for (const t of limbo.testcases) {
  const why = leftOut(t)
  if (why !== null) {
    reasons.set(why, (reasons.get(why) ?? 0) + 1)
    continue
  }
  const at = t.validation_time === null ? DEFAULT_TIME : Date.parse(t.validation_time)
  if (t.validation_time === null) {
    const c = new crypto.X509Certificate(t.peer_certificate)
    if (Date.parse(c.validFrom) > at || Date.parse(c.validTo) < at) {
      throw new Error(`${t.id}: the peer certificate is not valid at the default time`)
    }
  }
  // Seconds and the milliseconds past them: each fits an i32 until 2038, so
  // the time compiles in either number mode.
  const atSec = Math.floor(at / 1000)
  if (!Number.isInteger(at) || atSec < 0 || atSec > 2147483647) {
    throw new Error(`${t.id}: validation time ${t.validation_time} is not before 2038`)
  }
  const ok = t.expected_result === "SUCCESS"
  success += ok ? 1 : 0
  // An empty list is `none()`: a bare `[]` has no element type to take.
  const list = (ps) => (ps.length === 0 ? "none()" : `[${ps.map(certOf).join(", ")}]`)
  lines.push(
    `  { id: ${JSON.stringify(t.id)}, host: ${JSON.stringify(t.expected_peer_name.value)}, atSec: ${atSec}, atMs: ${at - atSec * 1000}, success: ${ok}, ` +
      `peer: ${certOf(t.peer_certificate)}, untrusted: ${list(t.untrusted_intermediates)}, trusted: ${list(t.trusted_certs)} },\n`
  )
}
const server = limbo.testcases.length
const dropped = [...reasons.values()].reduce((a, b) => a + b, 0)
if (dropped + lines.length !== server) {
  throw new Error(`${lines.length} kept and ${dropped} left out of ${server}`)
}

const head =
  "// Test cases from x509-limbo (https://github.com/C2SP/x509-limbo), whose\n" +
  "// BetterTLS cases come from Netflix's BetterTLS (https://github.com/Netflix/bettertls).\n" +
  "// Copyright the x509-limbo authors. Used under the Apache License, Version 2.0;\n" +
  "// see tests/link/crypto_pki_limbo/LICENSE-x509-limbo.\n" +
  "//\n" +
  `// Taken from limbo.json at commit ${COMMIT}\n` +
  `// (${URL}, SHA-256 ${SHA256}),\n` +
  "// and changed: generate.mjs beside this file rewrites it as Nish source,\n" +
  "// keeps each certificate once, as base64 DER, and leaves out the cases'\n" +
  "// descriptions, keys and metadata and the cases it does not keep.\n" +
  "// Generated: do not edit; run generate.mjs again.\n"

const listing = [...reasons.entries()].map(([why, n]) => `//   ${n} for ${why}\n`).join("")
fs.writeFileSync(
  path.join(here, "certs.ts"),
  head +
    "\n" +
    `/** Every certificate the cases in cases.ts name, by index: ${certs.length} DER encodings in base64. */\n` +
    `export const limboCerts = (): string[] => [\n${certs.map((c) => `  "${c}",\n`).join("")}];\n`
)
fs.writeFileSync(
  path.join(here, "cases.ts"),
  head +
    "//\n" +
    `// Of the file's ${server} cases, ${lines.length} are kept (${success} expected to succeed) and\n` +
    `// ${dropped} left out:\n${listing}` +
    "\n" +
    'import { LimboCase } from "./types"\n' +
    "\n" +
    "/** No certificates. */\n" +
    "const none = (): number[] => [];\n" +
    "\n" +
    "/** The cases kept, in the file's order. */\n" +
    `export const limboCases = (): LimboCase[] => [\n${lines.join("")}];\n`
)
console.log(`${lines.length} cases kept, ${dropped} left out, ${certs.length} certificates`)
