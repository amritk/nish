// Writes vectors.ts for tests/link/crypto_rsa_sign_interop: RSASSA-PSS-SHA256
// answers that other implementations computed, for nish/crypto/rsa-sign to
// match byte for byte.
//
//   node tests/link/crypto_rsa_sign_interop/generate.mjs <SigGenPSS_186-2.txt>
//
// The file is NIST CAVP's FIPS 186-2 RSASSA-PSS signature vectors (CAVS 11.4,
// salt length 20), as pyca/cryptography's cryptography_vectors package ships
// it at asymmetric/RSA/FIPS_186-2/SigGenPSS_186-2.txt. Three parts:
//
// - NIST: each 2048, 3072 and 4096-bit key with its ten SHA-256 entries. The
//   file gives n, e and d, so the primes are recovered here (RFC 8017 does not
//   need them, nish's key format does) and node writes the key as PKCS #1 DER
//   and PKCS #8 PEM; node's OpenSSL must verify each entry's S first. The
//   1024 and 1536-bit keys are kept as keys nish must refuse.
// - Keys made by other libraries: OpenSSL's `openssl genpkey`, Go's
//   crypto/rsa (interop.go) and pyca/cryptography (interop.py), each written
//   by that library as PKCS #1 DER and PKCS #8 PEM, at sizes that are not a
//   multiple of eight bits (2049, 2050, 2054, 3071, 4094: at 2049 the encoded
//   message is a byte shorter than the modulus) and with public exponents of
//   3 and 2^32 - 1. Under each key, five signatures: the derived salt over two
//   messages, a random 32-byte salt, the longest salt the key takes (emLen -
//   34 bytes), and an empty salt. Go signs the first four (it takes the salt
//   from the reader it is given); OpenSSL (through node) and pyca sign the
//   empty one, the one salt pyca lets a caller fix and Go cannot ask for. A
//   BigInt RSASSA-PSS-SIGN here must give the same bytes, and Go, node and
//   pyca must each verify every signature at its salt length. Go cannot load
//   a key whose exponent passes 2^31 - 1, so that key is left to the others.
// - Keys nish must refuse, made by the same tools: 2047 and 4097 bits, and a
//   2048-bit key with e = 2^32 + 1.
//
// Needs go, python3 with cryptography, and openssl on PATH. Keys are new on
// each run, so a rerun rewrites the whole file.
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const LABEL = Buffer.from("nish rsa-pss-sha256 salt", "ascii")
const NIST_SALT = 20

const nistPath = process.argv[2]
if (!nistPath) {
  console.error("usage: node generate.mjs <SigGenPSS_186-2.txt>")
  process.exit(2)
}
const here = path.dirname(fileURLToPath(import.meta.url))
const scratch = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "rsa-interop-"))

const sha256 = (...parts) => {
  const h = crypto.createHash("sha256")
  for (const p of parts) h.update(p)
  return h.digest()
}
const big = (buf) => (buf.length === 0 ? 0n : BigInt(`0x${buf.toString("hex")}`))
const bytes = (n, k) => Buffer.from(n.toString(16).padStart(2 * k, "0"), "hex")
const minimal = (n) => {
  const hex = n.toString(16)
  return Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex")
}
const bitLength = (n) => n.toString(2).length
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
const gcd = (a, b) => {
  while (b) [a, b] = [b, a % b]
  return a
}
const modInv = (a, m) => {
  let [r0, r1, s0, s1] = [a % m, m, 1n, 0n]
  while (r1) {
    const q = r0 / r1
    ;[r0, r1] = [r1, r0 - q * r1]
    ;[s0, s1] = [s1, s0 - q * s1]
  }
  if (r0 !== 1n) throw new Error("not invertible")
  return ((s0 % m) + m) % m
}

/** p and q from n, e and d (RFC 8017 does not say how; this is the usual way, from NIST SP 800-56B Appendix C). */
const factor = (n, e, d) => {
  const k = e * d - 1n
  let r = k
  let t = 0
  while ((r & 1n) === 0n) {
    r >>= 1n
    t++
  }
  for (let g = 2n; g < 1000n; g++) {
    let x = modPow(g, r, n)
    for (let i = 0; i < t; i++) {
      const y = (x * x) % n
      if (y === 1n && x !== 1n && x !== n - 1n) {
        const p = gcd(x - 1n, n)
        const q = n / p
        return p > q ? [p, q] : [q, p]
      }
      x = y
    }
  }
  throw new Error("no factor found")
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

/** RSASSA-PSS-SIGN with SHA-256 and the given salt (RFC 8017 §8.1.1, §9.1.1), by d alone. */
const pssSign = (n, d, msg, salt) => {
  const bits = bitLength(n)
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

const b64u = (n) => minimal(n).toString("base64url")
const fromB64u = (s) => big(Buffer.from(s, "base64url"))

/** A node key object from a key's numbers, by JWK. */
const keyOf = (n, e, d, p, q) =>
  crypto.createPrivateKey({
    format: "jwk",
    key: {
      kty: "RSA",
      n: b64u(n),
      e: b64u(e),
      d: b64u(d),
      p: b64u(p),
      q: b64u(q),
      dp: b64u(d % (p - 1n)),
      dq: b64u(d % (q - 1n)),
      qi: b64u(modInv(q, p)),
    },
  })

/** A key's numbers, read back through node from its PKCS #1 DER. */
const numbers = (pkcs1) => {
  const jwk = crypto.createPrivateKey({ key: pkcs1, format: "der", type: "pkcs1" }).export({ format: "jwk" })
  return { n: fromB64u(jwk.n), e: fromB64u(jwk.e), d: fromB64u(jwk.d), object: crypto.createPrivateKey({ key: pkcs1, format: "der", type: "pkcs1" }) }
}

const run = (cmd, args, input) => execFileSync(cmd, args, { cwd: here, input, maxBuffer: 1 << 26 }).toString()
const goCall = (req) => JSON.parse(run("go", ["run", "interop.go"], JSON.stringify(req)))
const pyCall = (req) => JSON.parse(run("python3", ["-I", "interop.py"], JSON.stringify(req)))

/** One key from `openssl genpkey`: its PKCS #8 PEM as written, and its PKCS #1 DER from `openssl rsa -traditional`. */
// OpenSSL 3.0 makes two primes of half the size rounded down, so it gives an
// odd size it is asked for (2049, 4095) a bit short; the sizes asked of it are
// even, and a key of another size is made again.
const opensslKey = (bits, e) => {
  const pem = path.join(scratch, `k${bits}-${e}.pem`)
  const der = path.join(scratch, `k${bits}-${e}.der`)
  for (let attempt = 0; attempt < 40; attempt++) {
    execFileSync("openssl", ["genpkey", "-algorithm", "RSA", "-pkeyopt", `rsa_keygen_bits:${bits}`, "-pkeyopt", `rsa_keygen_pubexp:${e}`, "-out", pem], { stdio: ["ignore", "ignore", "ignore"] })
    execFileSync("openssl", ["rsa", "-in", pem, "-outform", "DER", "-traditional", "-out", der], { stdio: ["ignore", "ignore", "ignore"] })
    const pkcs1 = fs.readFileSync(der)
    if (bitLength(numbers(pkcs1).n) === bits) return { pkcs1, pkcs8: fs.readFileSync(pem, "ascii") }
  }
  throw new Error(`openssl genpkey gives no ${bits}-bit key`)
}

const versions = {
  openssl: execFileSync("openssl", ["version"]).toString().trim(),
  node: `node ${process.version} (OpenSSL ${process.versions.openssl})`,
  go: execFileSync("go", ["version"]).toString().trim().replace(/^go version /, ""),
  pyca: `pyca/cryptography ${execFileSync("python3", ["-I", "-c", "import cryptography; print(cryptography.__version__)"]).toString().trim()}`,
}

// --- NIST ---------------------------------------------------------------

const nistText = fs.readFileSync(nistPath, "ascii")
const nistKeys = []
const nistRefused = []
const nistCases = []
{
  let cur = null
  let entry = {}
  const flush = () => {
    if (cur && entry.S && entry.SHAAlg === "SHA256") cur.cases.push(entry)
    entry = {}
  }
  const blocks = []
  for (const raw of nistText.split(/\r?\n/)) {
    const line = raw.trim()
    const mod = /^\[mod = (\d+)\]$/.exec(line)
    if (mod) {
      flush()
      cur = { bits: Number(mod[1]), cases: [] }
      blocks.push(cur)
      continue
    }
    const kv = /^(\w+) = ([0-9a-fA-F]*|SHA\w+)$/.exec(line)
    if (!kv || !cur) continue
    const [, name, value] = kv
    if (name === "n" || name === "e" || name === "d") cur[name] = big(Buffer.from(value.length % 2 ? `0${value}` : value, "hex"))
    else {
      if (name === "SHAAlg") flush()
      entry[name] = value
    }
  }
  flush()
  for (const b of blocks) {
    if (bitLength(b.n) !== b.bits) throw new Error(`NIST mod ${b.bits}: n has ${bitLength(b.n)} bits`)
    const [p, q] = factor(b.n, b.e, b.d)
    const object = keyOf(b.n, b.e, b.d, p, q)
    const pkcs1 = object.export({ type: "pkcs1", format: "der" })
    const pkcs8 = object.export({ type: "pkcs8", format: "pem" })
    if (b.bits < 2048) {
      nistRefused.push({ from: `NIST ${b.bits}`, bits: b.bits, pkcs1, pkcs8 })
      continue
    }
    if (b.cases.length !== 10) throw new Error(`NIST mod ${b.bits}: ${b.cases.length} SHA-256 entries`)
    const index = nistKeys.length
    nistKeys.push({ from: `NIST ${b.bits}`, bits: b.bits, e: b.e, pkcs1, pkcs8, pub: crypto.createPublicKey(object).export({ type: "pkcs1", format: "der" }) })
    for (const c of b.cases) {
      const msg = Buffer.from(c.Msg, "hex")
      const salt = Buffer.from(c.SaltVal, "hex")
      const sig = Buffer.from(c.S, "hex")
      if (salt.length !== NIST_SALT) throw new Error("NIST salt is not 20 bytes")
      const ok = crypto.verify("sha256", msg, { key: object, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: NIST_SALT }, sig)
      if (!ok) throw new Error(`NIST mod ${b.bits}: OpenSSL refuses an S`)
      if (!pssSign(b.n, b.d, msg, salt).equals(sig)) throw new Error(`NIST mod ${b.bits}: the BigInt signer disagrees`)
      nistCases.push({ key: index, msg, salt, sig })
    }
  }
}

// --- Keys from other libraries -----------------------------------------

const libKeys = []
const refusedKeys = [...nistRefused]
for (const [bits, e] of [
  [2048, 65537],
  [2050, 65537],
  [4094, 65537],
  [3072, 4294967295],
]) {
  libKeys.push({ from: `OpenSSL ${bits}${e === 65537 ? "" : `, e = ${e}`}`, bits, ...opensslKey(bits, e) })
}
for (const [bits, e] of [
  [2047, 65537],
  [2048, 4294967297],
]) {
  refusedKeys.push({ from: `OpenSSL ${bits}${e === 65537 ? "" : `, e = ${e}`}`, bits, ...opensslKey(bits, e) })
}
{
  const go = goCall({ keygen: [2049, 3071, 4096, 4097] })
  for (const k of go.keys) {
    const entry = { from: `Go ${k.bits}`, bits: k.bits, pkcs1: Buffer.from(k.pkcs1, "hex"), pkcs8: k.pkcs8 }
    ;(k.bits > 4096 ? refusedKeys : libKeys).push(entry)
  }
  const py = pyCall({ keygen: [{ bits: 2048, e: 3 }, { bits: 2054, e: 65537 }, { bits: 3072, e: 65537 }] })
  for (const k of py.keys) {
    libKeys.push({ from: `pyca ${k.bits}${k.bits === 2048 ? ", e = 3" : ""}`, bits: k.bits, pkcs1: Buffer.from(k.pkcs1, "hex"), pkcs8: k.pkcs8 })
  }
}

const long = Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 7 + 3) & 0xff))
const abc = Buffer.from("abc")
const libCases = []
const goVerify = []
const pyVerify = []
const goSign = []
const pySign = []
for (const [index, k] of libKeys.entries()) {
  const { n, e, d, object } = numbers(k.pkcs1)
  if (bitLength(n) !== k.bits) throw new Error(`${k.from}: n has ${bitLength(n)} bits`)
  // The PKCS #8 PEM must be the same key.
  const jwk8 = crypto.createPrivateKey(k.pkcs8).export({ format: "jwk" })
  if (fromB64u(jwk8.n) !== n || fromB64u(jwk8.d) !== d) throw new Error(`${k.from}: the PEM is another key`)
  k.e = e
  k.pub = crypto.createPublicKey(object).export({ type: "pkcs1", format: "der" })
  k.goLoads = e < 2n ** 31n
  const kBytes = Math.ceil(k.bits / 8)
  const emLen = Math.ceil((k.bits - 1) / 8)
  const derived = (msg) => sha256(LABEL, bytes(d, kBytes), sha256(msg))
  const cases = [
    { kind: "derived", msg: abc, salt: derived(abc) },
    { kind: "derived", msg: long, salt: derived(long) },
    { kind: "salt", msg: Buffer.alloc(0), salt: crypto.randomBytes(32) },
    { kind: "salt", msg: abc, salt: crypto.randomBytes(emLen - 34) },
    { kind: "salt", msg: long, salt: Buffer.alloc(0) },
  ]
  for (const c of cases) {
    c.key = index
    c.sig = pssSign(n, d, c.msg, c.salt)
    if (c.salt.length > 0) {
      if (k.goLoads) goSign.push(c)
    } else {
      const viaNode = crypto.sign("sha256", c.msg, { key: object, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 0 })
      if (!viaNode.equals(c.sig)) throw new Error(`${k.from}: OpenSSL's empty-salt signature differs`)
      pySign.push(c)
    }
    const ok = crypto.verify("sha256", c.msg, { key: object, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: c.salt.length }, c.sig)
    if (!ok) throw new Error(`${k.from}: OpenSSL refuses a signature`)
    if (k.goLoads) goVerify.push(c)
    pyVerify.push(c)
    libCases.push(c)
  }
}
const req = (list, pkcs1Of) => list.map((c) => ({ pkcs1: pkcs1Of(c).toString("hex"), msg: c.msg.toString("hex"), salt: c.salt.toString("hex"), saltLen: c.salt.length, sig: c.sig.toString("hex") }))
const pkcs1Of = (c) => libKeys[c.key].pkcs1
{
  const go = goCall({ sign: req(goSign, pkcs1Of), verify: req(goVerify, pkcs1Of) })
  goSign.forEach((c, i) => {
    if (go.sigs[i] !== c.sig.toString("hex")) throw new Error(`${libKeys[c.key].from}: Go's signature differs`)
  })
  goVerify.forEach((c, i) => {
    if (!go.verified[i]) throw new Error(`${libKeys[c.key].from}: Go refuses a signature`)
  })
  const py = pyCall({ sign: req(pySign, pkcs1Of), verify: req(pyVerify, pkcs1Of) })
  pySign.forEach((c, i) => {
    if (py.sigs[i] !== c.sig.toString("hex")) throw new Error(`${libKeys[c.key].from}: pyca's signature differs`)
  })
  pyVerify.forEach((c, i) => {
    if (!py.verified[i]) throw new Error(`${libKeys[c.key].from}: pyca refuses a signature`)
  })
}
for (const k of refusedKeys) {
  const n = numbers(k.pkcs1).n
  k.bits = bitLength(n)
}

// --- vectors.ts -----------------------------------------------------------

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
const str = (s) => JSON.stringify(s)
const hex = (b) => str(b.toString("hex"))
const keyLine = (k) =>
  `  { from: ${str(k.from)}, bits: ${k.bits}, e: ${k.e ? hex(minimal(k.e)) : '""'}, pkcs1: ${hex(k.pkcs1)}, pkcs8: ${str(k.pkcs8)}, pub: ${k.pub ? hex(k.pub) : '""'} },\n`

const goKeys = libKeys.filter((k) => k.goLoads).length
const head =
  wrap(
    "The NIST part of this file is from NIST's Cryptographic Algorithm Validation Program: the FIPS 186-2 " +
      "RSASSA-PSS signature vectors (SigGenPSS_186-2.txt, CAVS 11.4), a work of the United States Government " +
      "and in the public domain, as pyca/cryptography's cryptography_vectors package ships them. Taken: the " +
      `${nistKeys.length} keys of 2048 bits and over with their ${nistCases.length} SHA-256 entries, and the ` +
      `${nistRefused.length} keys under 2048 bits as keys to refuse. And changed: the primes are recovered from ` +
      "n, e and d and node writes each key as PKCS #1 DER and PKCS #8 PEM.",
  ) +
  "\n//\n" +
  wrap(
    `The other keys were made by ${versions.openssl} (openssl genpkey), ${versions.go} (crypto/rsa, interop.go) ` +
      `and ${versions.pyca} (interop.py), each written as PKCS #1 DER and PKCS #8 PEM by the library that made ` +
      `it. Their signatures: Go signed every salted one (under the ${goKeys} keys it loads), OpenSSL through ` +
      `${versions.node} and pyca signed the empty-salt ones, a BigInt RSASSA-PSS-SIGN in generate.mjs gave the ` +
      "same bytes for each, and Go (where it loads the key), node's OpenSSL and pyca each verified each at its " +
      "salt length before it was written. Generated by generate.mjs beside this file: do not edit; run it again.",
  ) +
  "\n\n" +
  "/** A key: who made it, its bit length, its public exponent in hex with no leading zero byte (empty for a key nish refuses), its PKCS #1 RSAPrivateKey DER in hex, its PKCS #8 PEM, and its RSAPublicKey DER in hex (empty for a refused key). */\n" +
  "export interface InteropKey {\n  from: string;\n  bits: number;\n  e: string;\n  pkcs1: string;\n  pkcs8: string;\n  pub: string;\n}\n\n" +
  "/** A signature under key `key` of `msg` with `salt`; `derived` when the salt is the one rsaSignPssSha256 derives. */\n" +
  "export interface InteropCase {\n  key: number;\n  derived: boolean;\n  msg: string;\n  salt: string;\n  sig: string;\n}\n\n"

const caseLine = (c, derived) => `  { key: ${c.key}, derived: ${derived}, msg: ${hex(c.msg)}, salt: ${hex(c.salt)}, sig: ${hex(c.sig)} },\n`
const body =
  `/** NIST's keys, ${nistKeys.length} of them. */\nexport const nistKeys = (): InteropKey[] => [\n${nistKeys.map(keyLine).join("")}];\n\n` +
  `/** NIST's SHA-256 entries, ${nistCases.length} of them, each with a ${NIST_SALT}-byte salt. */\nexport const nistCases = (): InteropCase[] => [\n${nistCases.map((c) => caseLine(c, false)).join("")}];\n\n` +
  `/** The keys other libraries made, ${libKeys.length} of them. */\nexport const libraryKeys = (): InteropKey[] => [\n${libKeys.map(keyLine).join("")}];\n\n` +
  `/** Their signatures, ${libCases.length} of them. */\nexport const libraryCases = (): InteropCase[] => [\n${libCases.map((c) => caseLine(c, c.kind === "derived")).join("")}];\n\n` +
  `/** Keys nish must refuse, ${refusedKeys.length} of them. */\nexport const refusedKeys = (): InteropKey[] => [\n${refusedKeys.map(keyLine).join("")}];\n`

const target = path.join(here, "vectors.ts")
fs.writeFileSync(target, head + body)
fs.rmSync(scratch, { recursive: true, force: true })
console.log(
  `wrote ${target}: ${nistKeys.length} NIST keys, ${nistCases.length} NIST cases, ${libKeys.length} library keys (${libKeys.map((k) => k.from).join("; ")}), ${libCases.length} library cases, ${refusedKeys.length} refused keys (${refusedKeys.map((k) => k.from).join("; ")})`,
)
