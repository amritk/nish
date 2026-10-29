// Writes pkcs1v15_{2048,3072,4096,8192}.ts and pss.ts from Wycheproof's RSA
// signature files:
//
//   node tests/link/crypto_wycheproof_rsa/generate.mjs <dir with the JSON files>
//
// The directory is testvectors_v1/ at the commit below. Each test group's
// public key, hash and salt length are listed once and each case names its
// group's key by index; each case keeps its id, result, message and signature
// as upstream wrote them. A group is left out, whole, when it hashes with
// anything but SHA-256, SHA-384 or SHA-512 or its MGF1 hash differs from the
// message hash: only rsa_pss_misc_test.json has such groups. Every file's kept
// and left-out cases must add up to its numberOfTests.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const COMMIT = "3fa63dd0344abb611f1fb1d77e119938603ea230"
const HASHES = new Set(["SHA-256", "SHA-384", "SHA-512"])
const RUN_BY = "`tests/link/crypto_wycheproof_rsa` runs them. Generated: do not edit; run generate.mjs again."
const ACCEPTABLE =
  'The case each file marks "acceptable" (tcId 8, a DigestInfo without its NULL parameters) is kept.'

const dir = process.argv[2]
if (!dir) {
  console.error("usage: node generate.mjs <dir with the Wycheproof JSON files>")
  process.exit(2)
}
const here = path.dirname(fileURLToPath(import.meta.url))

/** rsa_signature_2048_sha256 → Pkcs2048Sha256, rsa_pss_2048_sha256_mgf1_32 → Pss2048Sha256Salt32. */
const camel = (stem) => {
  const p = stem.split("_")
  const cap = (s) => s[0].toUpperCase() + s.slice(1)
  if (p[1] === "signature") {
    return `Pkcs${p[2]}${cap(p[3])}`
  }
  if (p[2] === "misc") {
    return "PssMisc"
  }
  return `Pss${p[2]}${cap(p[3])}Salt${p[5]}`
}

/** `text` as `//` comment lines of at most `width` characters. */
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

const emit = (fname, stems, intro) => {
  const parts = []
  const counts = []
  for (const stem of stems) {
    const file = `${stem}_test.json`
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))
    const keys = []
    const cases = []
    let dropped = 0
    for (const g of json.testGroups) {
      if (!HASHES.has(g.sha) || (g.mgfSha ?? g.sha) !== g.sha) {
        dropped += g.tests.length
        continue
      }
      keys.push(`  { der: "${g.publicKeyAsn}", sha: "${g.sha}", sLen: ${g.sLen ?? -1} },\n`)
      for (const t of g.tests) {
        cases.push(
          `  { tcId: ${t.tcId}, key: ${keys.length - 1}, result: "${t.result}", msg: "${t.msg}", sig: "${t.sig}" },\n`,
        )
      }
    }
    if (cases.length + dropped !== json.numberOfTests) {
      throw new Error(`${file}: ${cases.length} kept and ${dropped} left out, but numberOfTests is ${json.numberOfTests}`)
    }
    if (stem !== "rsa_pss_misc" && dropped !== 0) {
      throw new Error(`${file}: ${dropped} cases left out of a file that should keep them all`)
    }
    counts.push({ stem, kept: cases.length, total: json.numberOfTests })
    const name = camel(stem)
    parts.push(
      `/** The public key (PKCS #1 DER, in hex), hash and salt length of each test group of ${file} kept here; the salt length is -1 for PKCS #1 v1.5. */\n` +
        `export const wycheproofRsa${name}Keys = (): WycheproofRsaKey[] => [\n${keys.join("")}];\n`,
    )
    parts.push(
      `/** The cases of ${file} kept here. */\n` +
        `export const wycheproofRsa${name}Cases = (): WycheproofRsaCase[] => [\n${cases.join("")}];\n`,
    )
  }
  const listing = counts
    .map(({ stem, kept, total }) =>
      kept === total ? `${stem}_test.json (${kept} cases)` : `${stem}_test.json (${kept} of its ${total} cases)`,
    )
    .join(", ")
  const head =
    "// Test vectors from Project Wycheproof (https://github.com/C2SP/wycheproof).\n" +
    "// Copyright 2016-2026 The Wycheproof Authors. Used under the Apache License,\n" +
    "// Version 2.0; see tests/link/crypto_wycheproof_rsa/LICENSE-wycheproof.\n" +
    "//\n" +
    wrap(
      `Taken from testvectors_v1/ at commit ${COMMIT}: ${listing}. And changed: ` +
        "the JSON is rewritten as Nish source by generate.mjs beside this file, each test group's public key " +
        "(its publicKeyAsn), hash and salt length are listed once and each case " +
        "names its group's key by index, and the per-case comments and flags are " +
        `left out. ${intro} Every value kept is as upstream wrote it. ${RUN_BY}`,
    ) +
    "\n\n" +
    'import { WycheproofRsaCase, WycheproofRsaKey } from "./types"\n\n'
  const target = path.join(here, fname)
  fs.writeFileSync(target, head + parts.join("\n"))
  console.log(`wrote ${target}: ${listing}`)
}

for (const bits of [2048, 3072, 4096, 8192]) {
  emit(
    `pkcs1v15_${bits}.ts`,
    [256, 384, 512].map((h) => `rsa_signature_${bits}_sha${h}`),
    `Every case is kept. ${ACCEPTABLE}`,
  )
}
emit(
  "pss.ts",
  [
    "rsa_pss_2048_sha256_mgf1_0",
    "rsa_pss_2048_sha256_mgf1_32",
    "rsa_pss_2048_sha384_mgf1_48",
    "rsa_pss_3072_sha256_mgf1_32",
    "rsa_pss_4096_sha256_mgf1_32",
    "rsa_pss_4096_sha384_mgf1_48",
    "rsa_pss_4096_sha512_mgf1_32",
    "rsa_pss_4096_sha512_mgf1_64",
    "rsa_pss_misc",
  ],
  "Every case is kept but those of rsa_pss_misc_test.json whose group hashes with SHA-1 or SHA-224, or " +
    "whose MGF1 hash differs from the message hash, which nish/crypto/rsa does not offer. " +
    'None of the files has a case whose result is "acceptable".',
)
