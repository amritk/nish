#!/usr/bin/env node
// What nish/yaml-json's load costs beside the parse it starts from, on an
// OpenAPI-sized document: bench/yaml-json/main.ts's `parse` and `load`
// workloads over one generated YAML file. Hand-run; never part of `npm test`.
//
//   npm run build && node bench/yaml-json/run.mjs [options]
//     --rounds N        interleaved rounds (default 15)
//     --paths N         operations' paths in the generated document
//                       (default 1000, about 1.1 MB)
//     --mb N            megabytes each run parses (default 32), which sets
//                       the iteration count
//     --compiler <nish> the compiler under test (default build/nish)
//
// The document is generated, the same every time, so no network is needed: an
// OpenAPI 3 description with `--paths` paths of two operations each, their
// parameters and responses, and a component schema per path. Every operation
// merges a shared anchored map of responses (`<<: *errors`) and names a
// shared anchored parameter (`*limit`), so the load copies aliases and
// applies merge keys as a real description would.
//
// Main.ts builds with `--link --profile speed`. Each round runs both
// workloads on the binary and on a byte-identical copy, in an order rotated
// each round; the gap between the two binaries' medians for a workload is its
// noise band. Each run times its own loop with a monotonic clock, so start-up
// and reading the file are not in the figure.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"

const here = import.meta.dirname
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "yaml-json")
const nishc = compilerFrom(process.argv.slice(2))

const fail = (msg) => {
  console.error(`bench/yaml-json/run.mjs: ${msg}`)
  process.exit(2)
}

const opts = { rounds: 15, paths: 1000, mb: 32 }
for (let i = 0; i < nishc.rest.length; i++) {
  const arg = nishc.rest[i]
  if (arg === "--rounds" || arg === "--paths" || arg === "--mb") {
    opts[arg.slice(2)] = Number(nishc.rest[++i])
  } else {
    fail(`unknown option ${arg}`)
  }
}
if (![opts.rounds, opts.paths].every((n) => Number.isInteger(n) && n >= 1) || !(opts.mb > 0)) {
  fail("--rounds and --paths need positive integers, --mb a positive number")
}

/** The generated OpenAPI description, `paths` paths of two operations each. */
const generate = (paths) => {
  const out = [
    "openapi: 3.0.3",
    "info:",
    "  title: Generated",
    "  version: 1.0.0",
    "x-shared:",
    "  limit: &limit",
    "    name: limit",
    "    in: query",
    "    required: false",
    "    schema: {type: integer, minimum: 1, maximum: 0x3e8, default: 20}",
    "  errors: &errors",
    "    '400':",
    "      description: The request is not one the server reads.",
    "    '404':",
    "      description: Nothing is there.",
    "    '500':",
    "      description: The server failed.",
    "paths:",
  ]
  for (let i = 0; i < paths; i++) {
    out.push(
      `  /things${i}/{id}:`,
      "    get:",
      `      operationId: getThing${i}`,
      `      summary: Reads thing ${i}, with its fields and the links to its neighbours.`,
      "      parameters:",
      "        - name: id",
      "          in: path",
      "          required: true",
      "          schema:",
      "            type: string",
      `            pattern: '^[a-z]{${(i % 7) + 1}}[0-9]+$'`,
      "        - *limit",
      "      responses:",
      "        <<: *errors",
      "        '200':",
      "          description: The thing.",
      "          content:",
      "            application/json:",
      `              schema: {$ref: '#/components/schemas/Thing${i}'}`,
      "    put:",
      `      operationId: putThing${i}`,
      "      requestBody:",
      "        required: true",
      "        content:",
      "          application/json:",
      `            schema: {$ref: '#/components/schemas/Thing${i}'}`,
      "      responses:",
      "        <<: *errors",
      "        '204':",
      "          description: Stored."
    )
  }
  out.push("components:", "  schemas:")
  for (let i = 0; i < paths; i++) {
    out.push(
      `    Thing${i}:`,
      "      type: object",
      "      required: [id, name]",
      "      properties:",
      "        id: {type: string}",
      "        name: {type: string, maxLength: 120}",
      `        weight: {type: number, minimum: 0.5, maximum: ${i}.25}`,
      "        tags:",
      "          type: array",
      "          items: {type: string}",
      `        mode: {enum: [fast, slow, ${i % 2 === 0 ? "true" : "~"}]}`
    )
  }
  return `${out.join("\n")}\n`
}

const build = () => {
  fs.mkdirSync(outDir, { recursive: true })
  const exe = path.join(outDir, "main")
  const args = [
    ...nishc.prefix,
    path.join(here, "main.ts"),
    "-o",
    `${outDir}/`,
    "--link",
    exe,
    "--profile",
    "speed",
  ]
  const r = spawnSync(nishc.cmd, args, { encoding: "utf8" })
  if (r.error !== undefined || r.status !== 0) {
    fail(`building main.ts failed:\n${r.stdout}${r.stderr}`)
  }
  const copy = `${exe}-copy`
  fs.copyFileSync(exe, copy)
  if (!fs.readFileSync(exe).equals(fs.readFileSync(copy))) {
    fail("the copy is not byte-identical to the build")
  }
  return [
    { name: "nish", exe },
    { name: "copy", exe: copy },
  ]
}

const runOnce = (exe, workload, file, iterations) => {
  const r = spawnSync(exe, [workload, file, String(iterations)], { encoding: "utf8" })
  const lines = (r.stdout ?? "").trim().split("\n")
  const ns = /^ns (\d+)$/.exec(lines[1] ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null) {
    fail(`${exe} ${workload} exited ${r.status}:\n${r.stdout}${r.stderr}`)
  }
  return { checksum: lines[0], ns: Number(ns[1]) }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

const main = () => {
  const bins = build()
  const file = path.join(outDir, "openapi.yaml")
  fs.writeFileSync(file, generate(opts.paths))
  const bytes = fs.statSync(file).size
  const iterations = Math.max(1, Math.round((opts.mb * 1024 * 1024) / bytes))
  const runs = [
    { workload: "parse", bin: bins[0] },
    { workload: "parse", bin: bins[1] },
    { workload: "load", bin: bins[0] },
    { workload: "load", bin: bins[1] },
  ].map((r) => ({ ...r, ns: [], checksums: new Set() }))
  for (let round = 0; round < opts.rounds; round++) {
    process.stderr.write(`round ${round + 1} of ${opts.rounds}\n`)
    const shift = round % runs.length
    const order = [...runs.slice(shift), ...runs.slice(0, shift)]
    for (const r of round % 2 === 0 ? order : order.reverse()) {
      const once = runOnce(r.bin.exe, r.workload, file, iterations)
      r.ns.push(once.ns)
      r.checksums.add(once.checksum)
    }
  }
  const msPer = (r) => median(r.ns) / iterations / 1e6
  const mbps = (ms) => bytes / 1024 / 1024 / (ms / 1000)
  console.log(
    `${path.relative(root, file)}: ${bytes} bytes, ${iterations} iterations a run, ${opts.rounds} rounds`
  )
  for (const workload of ["parse", "load"]) {
    const [a, b] = runs.filter((r) => r.workload === workload)
    const ma = msPer(a)
    const mb = msPer(b)
    const band = (Math.abs(ma - mb) / Math.min(ma, mb)) * 100
    const seen = new Set([...a.checksums, ...b.checksums])
    if (seen.size > 1) {
      fail(`${workload}: the runs disagree: ${[...seen].join(" | ")}`)
    }
    console.log(
      `${workload.padEnd(5)}  ${ma.toFixed(3)} ms (copy ${mb.toFixed(3)} ms, band ${band.toFixed(1)}%)  ${mbps(ma).toFixed(1)} MB/s  ${[...seen][0]}`
    )
  }
  const parse = msPer(runs[0])
  const load = msPer(runs[2])
  console.log(
    `load costs ${(load / parse).toFixed(2)}x the parse alone (+${(load - parse).toFixed(3)} ms a document)`
  )
}

main()
