// Writes ecdsa_secp384r1.ts from Wycheproof's secp384r1 ECDSA files:
//
//   node tests/link/crypto_wycheproof_p384/generate.mjs <dir with the JSON files>
//
// The files are testvectors_v1/ecdsa_secp384r1_{sha384,sha384_p1363,sha256,
// sha512,sha512_p1363}_test.json at the commit below. Each case keeps its id,
// result, message and signature as upstream wrote them; each hash's group keys
// are listed once and a case names its key by index.
import fs from "node:fs"
import path from "node:path"

const COMMIT = "3fa63dd0344abb611f1fb1d77e119938603ea230"
const lists = [
  { file: "ecdsa_secp384r1_sha384_test.json", hash: "Sha384", name: "Sha384Cases" },
  { file: "ecdsa_secp384r1_sha384_p1363_test.json", hash: "Sha384", name: "Sha384P1363Cases" },
  { file: "ecdsa_secp384r1_sha256_test.json", hash: "Sha256", name: "Sha256Cases" },
  { file: "ecdsa_secp384r1_sha512_test.json", hash: "Sha512", name: "Sha512Cases" },
  { file: "ecdsa_secp384r1_sha512_p1363_test.json", hash: "Sha512", name: "Sha512P1363Cases" },
]

const dir = process.argv[2]
if (!dir) {
  console.error("usage: node generate.mjs <dir with the Wycheproof JSON files>")
  process.exit(2)
}

const keys = new Map()
const counts = []
const bodies = []
for (const list of lists) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, list.file), "utf8"))
  const hashKeys = keys.get(list.hash) ?? []
  keys.set(list.hash, hashKeys)
  const rows = []
  for (const group of json.testGroups) {
    if (group.publicKey.curve !== "secp384r1") {
      throw new Error(`${list.file}: a group on ${group.publicKey.curve}`)
    }
    let key = hashKeys.indexOf(group.publicKey.uncompressed)
    if (key < 0) {
      key = hashKeys.length
      hashKeys.push(group.publicKey.uncompressed)
    }
    for (const t of group.tests) {
      rows.push(`  { tcId: ${t.tcId}, key: ${key}, result: "${t.result}", msg: "${t.msg}", sig: "${t.sig}" },`)
    }
  }
  if (rows.length !== json.numberOfTests) {
    throw new Error(`${list.file}: ${rows.length} cases, but numberOfTests is ${json.numberOfTests}`)
  }
  counts.push(`${list.file} (${rows.length})`)
  const form = list.name.includes("P1363") ? "`r || s`" : "DER"
  bodies.push(
    `/** Every case of ${list.file}, signatures ${form}; \`key\` indexes \`wycheproofEcdsaP384${list.hash}Keys\`. */`,
    `export const wycheproofEcdsaP384${list.name} = (): WycheproofEcdsaCase[] => [`,
    ...rows,
    "];",
    "",
  )
}

const keyLists = []
for (const [hash, hashKeys] of keys) {
  keyLists.push(
    `/** The uncompressed public key of each test group of the ${hash.toLowerCase()} files, in hex. */`,
    `export const wycheproofEcdsaP384${hash}Keys = (): string[] => [`,
    ...hashKeys.map((k) => `  "${k}",`),
    "];",
    "",
  )
}

const out = [
  "// Test vectors from Project Wycheproof (https://github.com/C2SP/wycheproof).",
  "// Copyright 2016-2026 The Wycheproof Authors. Used under the Apache License,",
  "// Version 2.0; see tests/link/crypto_wycheproof_p384/LICENSE-wycheproof.",
  "//",
  `// Taken from five files of testvectors_v1/ at commit ${COMMIT}:`,
  ...counts.map((c) => `// ${c}`),
  "// And changed: the JSON is rewritten as Nish source by generate.mjs beside",
  "// this file, each hash's group public keys are listed once and each case names",
  "// its key by index, and the per-case comments and flags are left out. Every case",
  "// of every file is kept, and every value kept is as upstream wrote it. None of",
  '// the files has a case whose result is "acceptable". `tests/link/crypto_p384`',
  "// runs them. Generated: do not edit; run generate.mjs again.",
  "",
  "/** One `EcdsaVerify` case: its id, its group's key, the expected result, and the message and signature in hex. */",
  "export interface WycheproofEcdsaCase {",
  "  // `number` rather than `i32`, so the file compiles in either number mode.",
  "  tcId: number;",
  "  key: number;",
  "  result: string;",
  "  msg: string;",
  "  sig: string;",
  "}",
  "",
  ...keyLists,
  ...bodies,
]
const target = path.join(path.dirname(new URL(import.meta.url).pathname), "ecdsa_secp384r1.ts")
fs.writeFileSync(target, out.join("\n"))
console.log(`wrote ${target}`)
