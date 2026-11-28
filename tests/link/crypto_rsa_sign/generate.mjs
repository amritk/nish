// Writes vectors.ts from Wycheproof's RSAES-PKCS1-v1_5 decryption files, whose
// test groups carry a private key, for the signing side of nish/crypto/rsa:
//
//   node tests/link/crypto_rsa_sign/generate.mjs <dir with the JSON files>
//
// The directory is testvectors_v1/ at the commit below. From each of
// rsa_pkcs1_{2048,3072,4096}_test.json it keeps the first two test groups'
// keys, as their PKCS #8 DER (privateKeyPkcs8) with the offsets of the PKCS #1
// RSAPrivateKey inside it, and the first RAW_CASES valid cases of each: a
// ciphertext raised to the private exponent must give the PKCS #1 v1.5
// encryption block of the case's message, so they are known answers for the
// private operation alone. To each key it adds RSASSA-PSS-SHA256 known answers
// computed here, independently of std/: the salt is derived as
// nish/crypto/rsa-sign derives it, the message encoded by EMSA-PSS (RFC 8017
// §9.1.1) and raised to the private exponent with BigInt, and every signature
// must verify under node's OpenSSL with a salt of 32 bytes before it is
// written.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const COMMIT = "3fa63dd0344abb611f1fb1d77e119938603ea230"
const KEYS = 2
const RAW_CASES = [3, 1]
const LABEL = Buffer.from("nish rsa-pss-sha256 salt", "ascii")
const MESSAGES = [
  ["", ""],
  ["abc", Buffer.from("abc").toString("hex")],
  ["the 200 bytes 0..199", Buffer.from(Array.from({ length: 200 }, (_, i) => i)).toString("hex")],
]

const dir = process.argv[2]
if (!dir) {
  console.error("usage: node generate.mjs <dir with the Wycheproof JSON files>")
  process.exit(2)
}
const here = path.dirname(fileURLToPath(import.meta.url))

const sha256 = (...parts) => {
  const h = crypto.createHash("sha256")
  for (const p of parts) h.update(p)
  return h.digest()
}
const big = (buf) => (buf.length === 0 ? 0n : BigInt(`0x${buf.toString("hex")}`))
const bytes = (n, k) => Buffer.from(n.toString(16).padStart(2 * k, "0"), "hex")
const modPow = (b, e, m) => {
  let r = 1n
  b %= m
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m
    b = (b * b) % m
    e >>= 1n
  }
  return r
}

/** MGF1 with SHA-256 (RFC 8017 §B.2.1). */
const mgf1 = (seed, length) => {
  const out = []
  for (let c = 0; Buffer.concat(out).length < length; c++) {
    const counter = Buffer.alloc(4)
    counter.writeUInt32BE(c)
    out.push(sha256(seed, counter))
  }
  return Buffer.concat(out).subarray(0, length)
}

/** RSASSA-PSS-SIGN with SHA-256 and the given salt (RFC 8017 §8.1.1, §9.1.1). */
const pssSign = (n, d, bits, msg, salt) => {
  const k = Math.ceil(bits / 8)
  const emBits = bits - 1
  const emLen = Math.ceil(emBits / 8)
  const h = sha256(Buffer.alloc(8), sha256(msg), salt)
  const db = Buffer.concat([Buffer.alloc(emLen - salt.length - 32 - 2), Buffer.from([1]), salt])
  const mask = mgf1(h, db.length)
  for (let i = 0; i < db.length; i++) db[i] ^= mask[i]
  db[0] &= 0xff >> (8 * emLen - emBits)
  const em = Buffer.concat([db, h, Buffer.from([0xbc])])
  return bytes(modPow(big(em), d, n), k)
}

/** The offsets of the OCTET STRING's content that holds the RSAPrivateKey in a PKCS #8 PrivateKeyInfo. */
const innerKey = (der) => {
  // PrivateKeyInfo ::= SEQUENCE { version INTEGER, algorithm SEQUENCE, privateKey OCTET STRING }
  const len = (at) => {
    const first = der[at]
    if (first < 0x80) return [first, at + 1]
    let n = 0
    for (let i = 1; i <= (first & 0x7f); i++) n = n * 256 + der[at + i]
    return [n, at + 1 + (first & 0x7f)]
  }
  let [, at] = len(1) // into the outer SEQUENCE
  for (const tag of [0x02, 0x30]) {
    if (der[at] !== tag) throw new Error("unexpected PKCS #8 layout")
    const [n, body] = len(at + 1)
    at = body + n
  }
  if (der[at] !== 0x04) throw new Error("no OCTET STRING")
  const [n, body] = len(at + 1)
  return [body, body + n]
}

const keys = []
const raws = []
const psss = []
const listing = []
for (const bits of [2048, 3072, 4096]) {
  const file = `rsa_pkcs1_${bits}_test.json`
  const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))
  const used = []
  for (let g = 0; g < KEYS; g++) {
    const group = json.testGroups[g]
    if (group.keySize !== bits) throw new Error(`${file}: group ${g} is ${group.keySize} bits`)
    const der = Buffer.from(group.privateKeyPkcs8, "hex")
    const [start, end] = innerKey(der)
    const pk = group.privateKey
    const n = big(Buffer.from(pk.modulus, "hex"))
    const d = big(Buffer.from(pk.privateExponent, "hex"))
    const k = Math.ceil(bits / 8)
    const keyObject = crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" })
    const pub = crypto.createPublicKey(keyObject).export({ type: "pkcs1", format: "der" })
    const index = keys.length
    keys.push(`  { bits: ${bits}, pkcs8: "${group.privateKeyPkcs8}", start: ${start}, end: ${end}, pub: "${pub.toString("hex")}" },\n`)
    const valid = group.tests.filter((t) => t.result === "valid").slice(0, RAW_CASES[g])
    if (valid.length !== RAW_CASES[g]) throw new Error(`${file}: group ${g} has too few valid cases`)
    for (const t of valid) {
      raws.push(`  { key: ${index}, tcId: ${t.tcId}, ct: "${t.ct}", msg: "${t.msg}" },\n`)
    }
    used.push(`group ${g}, tcId${valid.length > 1 ? "s" : ""} ${valid.map((t) => t.tcId).join(", ")}`)
    const dk = bytes(d, k)
    for (const [what, hex] of g === 0 ? MESSAGES : MESSAGES.slice(1, 2)) {
      const msg = Buffer.from(hex, "hex")
      const salt = sha256(LABEL, dk, sha256(msg))
      const sig = pssSign(n, d, bits, msg, salt)
      const ok = crypto.verify(
        "sha256",
        msg,
        { key: keyObject, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
        sig,
      )
      if (!ok) throw new Error(`${file}: OpenSSL refuses the PSS answer for ${what}`)
      psss.push(`  { key: ${index}, msg: "${hex}", sig: "${sig.toString("hex")}" },\n`)
    }
  }
  listing.push(`${file} (${used.join("; ")})`)
}

const wrap = (text, width = 80) => {
  const lines = []
  let cur = "//"
  for (const w of text.split(" ")) {
    if (cur.length + 1 + w.length > width) {
      lines.push(cur)
      cur = `// ${w}`
    } else {
      cur += ` ${w}`
    }
  }
  lines.push(cur)
  return lines.join("\n")
}

const head =
  "// Test vectors from Project Wycheproof (https://github.com/C2SP/wycheproof).\n" +
  "// Copyright 2016-2026 The Wycheproof Authors. Used under the Apache License,\n" +
  "// Version 2.0; see tests/link/crypto_rsa_sign/LICENSE-wycheproof.\n" +
  "//\n" +
  wrap(
    `Taken from testvectors_v1/ at commit ${COMMIT}: the keys and valid cases of ${listing.join(", ")}. ` +
      "And changed: the JSON is rewritten as Nish source by generate.mjs beside this file; each key keeps " +
      "its privateKeyPkcs8 as upstream wrote it, with the offsets of its RSAPrivateKey and its public key " +
      "re-encoded as an RSAPublicKey by node; each case keeps its id, ciphertext and message, and the " +
      "comments and flags are left out. The PSS signatures are not Wycheproof's: generate.mjs computes " +
      "them and OpenSSL verifies each. `tests/link/crypto_rsa_sign` runs them. Generated: do not edit; " +
      "run generate.mjs again.",
  ) +
  "\n\n" +
  "/** A private key: its PKCS #8 DER in hex, where the PKCS #1 key starts and ends in it, and its RSAPublicKey DER in hex. */\n" +
  "export interface SignKey {\n  bits: number;\n  pkcs8: string;\n  start: number;\n  end: number;\n  pub: string;\n}\n\n" +
  "/** A Wycheproof decryption case: the ciphertext the private operation opens, and the message its PKCS #1 v1.5 block carries. */\n" +
  "export interface RawCase {\n  key: number;\n  tcId: number;\n  ct: string;\n  msg: string;\n}\n\n" +
  "/** A PSS known answer: the message and its RSASSA-PSS-SHA256 signature under the derived salt. */\n" +
  "export interface PssCase {\n  key: number;\n  msg: string;\n  sig: string;\n}\n\n"

const body =
  `/** The keys, ${keys.length} of them. */\nexport const signKeys = (): SignKey[] => [\n${keys.join("")}];\n\n` +
  `/** The private-operation known answers, ${raws.length} of them. */\nexport const rawCases = (): RawCase[] => [\n${raws.join("")}];\n\n` +
  `/** The PSS known answers, ${psss.length} of them. */\nexport const pssCases = (): PssCase[] => [\n${psss.join("")}];\n`

const target = path.join(here, "vectors.ts")
fs.writeFileSync(target, head + body)
console.log(`wrote ${target}: ${keys.length} keys, ${raws.length} raw cases, ${psss.length} PSS answers`)
