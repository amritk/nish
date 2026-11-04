#!/usr/bin/env node
// WP38 S3's add-rotate-xor kernel: the ChaCha20 block permutation over four
// blocks, written with nish:simd's rotates against the same work in scalar
// Nish (docs/wp38-simd.md §3.2). It shows what the shifts and rotates of the
// ops stage buy; S3's bar itself is bench/simd-s3a.mjs's two rows.
//
//   npm run build && node bench/simd-arx.mjs [--runs N] [--compiler <nish>]
//     --runs N   timed rounds after one warm-up (default 15), rounded up to an
//                even number so each form leads equally
//
// bench/simd-arx/chacha-simd.ts and chacha-scalar.ts are built with
// `nish --link --profile speed`, and a byte-identical copy of the scalar binary
// runs as a third column: its ratio to the scalar form is the noise band. All
// three run in rotating rounds and must print the same checksum. The vector
// form's IR is refused untimed if it calls an llvm.x86 or llvm.aarch64
// intrinsic, so the speed-up is the portable lowering's.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const srcDir = path.join(root, "bench", "simd-arx")
const outDir = path.join(root, "build", "bench", "simd-arx")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/simd-arx.mjs: ${msg}`)
  process.exit(2)
}

const runsAt = nishc.rest.indexOf("--runs")
const asked = runsAt >= 0 ? Number(nishc.rest[runsAt + 1]) : 15
if (!Number.isInteger(asked) || asked < 1) {
  fail("--runs takes a positive integer")
}
const runs = asked + (asked % 2)

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    fail(`${cmd} ${args.join(" ")} exited ${r.status}:\n${r.stderr}`)
  }
  return r.stdout
}

fs.mkdirSync(outDir, { recursive: true })
const exes = {}
for (const form of ["simd", "scalar"]) {
  const src = path.join(srcDir, `chacha-${form}.ts`)
  const exe = path.join(outDir, `chacha-${form}`)
  run(nishc.cmd, [...nishc.prefix, src, "--link", exe, "--profile", "speed"])
  if (form === "simd") {
    const irDir = path.join(outDir, "ir")
    run(nishc.cmd, [...nishc.prefix, src, "-o", `${irDir}${path.sep}`, "--profile", "speed"])
    const ir = fs.readFileSync(path.join(irDir, "chacha-simd.ll"), "utf8")
    if (/llvm\.(x86|aarch64)\./.test(ir)) {
      fail("chacha-simd.ll calls a target intrinsic; the kernel must lower to portable vector IR")
    }
  }
  exes[form] = exe
}
exes.copy = path.join(outDir, "chacha-scalar-copy")
fs.copyFileSync(exes.scalar, exes.copy)
fs.chmodSync(exes.copy, 0o755)

const forms = Object.keys(exes)
const times = Object.fromEntries(forms.map((f) => [f, []]))
let checksum = null
const time = (form) => {
  const start = process.hrtime.bigint()
  const out = run(exes[form], []).trim()
  const ms = Number(process.hrtime.bigint() - start) / 1e6
  if (checksum !== null && out !== checksum) {
    fail(`${form} printed ${out}, the others ${checksum}`)
  }
  checksum = out
  return ms
}
for (const form of forms) {
  time(form)
}
for (let round = 0; round < runs; round++) {
  for (let k = 0; k < forms.length; k++) {
    const form = forms[(round + k) % forms.length]
    times[form].push(time(form))
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const label = { simd: "nish:simd", scalar: "scalar Nish", copy: "scalar Nish (copy)" }
console.log(`ChaCha20 permutation, 4 blocks x 2,000,000 passes; checksum ${checksum}; ${runs} rounds`)
console.log("| form | min ms | median ms | scalar / form (median) |")
console.log("| --- | ---: | ---: | ---: |")
const base = median(times.scalar)
for (const form of forms) {
  const m = median(times[form])
  console.log(
    `| ${label[form]} | ${Math.min(...times[form]).toFixed(1)} | ${m.toFixed(1)} | ${(base / m).toFixed(2)}x |`
  )
}
const band = Math.abs(median(times.copy) / base - 1)
console.log(`noise band (copy against scalar, median): ${(band * 100).toFixed(1)}%`)
