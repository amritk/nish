#!/usr/bin/env node
// What reading a string costs a program written back out with `--emit-ts`,
// beside the same program built for wasm32-wasi and natively: a YAML load and
// a JSON parse that take their input as a `string` (bench/emit-ts-strings/
// main.ts), each over a generated document of about 100 KB and about 3 MB.
// Hand-run; never part of `npm test`.
//
//   npm run build && node bench/emit-ts-strings/run.mjs [options]
//     --rounds N         interleaved rounds (default 5)
//     --mb N             megabytes each run reads (default 3), which sets the
//                        iteration count: 3 MB is 1 iteration of the large
//                        document and about 30 of the small one
//     --timeout S        seconds one run may take (default 120); a side that
//                        takes longer is reported as over it and not run again
//     --only <name,...>  run only these sides (native, wasm, emit-ts)
//     --against <file>   also run the emit-ts output against this copy of
//                        runtime/core/strings.mjs, in the same rounds, as
//                        `emit-ts@against`: the before beside the after
//     --compiler <nish>  the compiler under test (default build/nish)
//
// The documents are generated, the same every time: the OpenAPI description
// bench/yaml-json/run.mjs loads (its generator is copied below, because that
// script runs its bench when imported), and the same description as JSON. Every
// emit-ts side runs against its own copy of the runtime's modules under
// build/emit-ts-strings/<side>/node_modules/nish, so `--against` can set one
// side's strings.mjs without touching the tree.
//
// Each side is run twice a round, the second time from a byte-identical copy
// (the binary, the .wasm, or the emitted tree with its runtime), in an order
// rotated each round; the gap between the two copies' medians is that side's
// noise band. Each run times its own loop with a monotonic clock, so start-up,
// compiling the wasm and reading the file are not in the figure; an emit-ts
// run's figure does include the engine warming up, as a user's first call does.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { NODE_FLAGS } from "../../tests/differential/emit-ts.js"
import { compileArgv, compilerFrom } from "../compiler.mjs"

const here = import.meta.dirname
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "emit-ts-strings")
const nishc = compilerFrom(process.argv.slice(2))

const fail = (msg) => {
  console.error(`bench/emit-ts-strings/run.mjs: ${msg}`)
  process.exit(2)
}

const SIDES = ["native", "wasm", "emit-ts"]
const opts = { rounds: 5, mb: 3, timeout: 120, only: SIDES, against: null }
for (let i = 0; i < nishc.rest.length; i++) {
  const arg = nishc.rest[i]
  const value = nishc.rest[++i]
  if (value === undefined) {
    fail(`${arg} needs a value`)
  }
  if (arg === "--rounds" || arg === "--mb" || arg === "--timeout") {
    opts[arg.slice(2)] = Number(value)
  } else if (arg === "--only") {
    opts.only = value.split(",")
    const bad = opts.only.filter((s) => !SIDES.includes(s))
    if (bad.length > 0) {
      fail(`--only names no side ${bad.join(", ")}`)
    }
  } else if (arg === "--against") {
    opts.against = path.resolve(value)
    if (!fs.existsSync(opts.against)) {
      fail(`no ${value}`)
    }
  } else {
    fail(`unknown option ${arg}`)
  }
}
if (!Number.isInteger(opts.rounds) || opts.rounds < 1 || !(opts.mb > 0) || !(opts.timeout > 0)) {
  fail("--rounds needs a positive integer, --mb and --timeout positive numbers")
}

/** bench/yaml-json/run.mjs's OpenAPI description, `paths` paths of two operations each. */
const generateYaml = (paths) => {
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

/** The same description as JSON, with the anchors written out where they are used. */
const generateJson = (paths) => {
  const limit = {
    name: "limit",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 1000, default: 20 },
  }
  const errors = {
    400: { description: "The request is not one the server reads." },
    404: { description: "Nothing is there." },
    500: { description: "The server failed." },
  }
  const doc = {
    openapi: "3.0.3",
    info: { title: "Generated", version: "1.0.0" },
    paths: {},
    components: { schemas: {} },
  }
  for (let i = 0; i < paths; i++) {
    // biome-ignore lint/style/useNamingConvention: OpenAPI's reference key
    const ref = { $ref: `#/components/schemas/Thing${i}` }
    doc.paths[`/things${i}/{id}`] = {
      get: {
        operationId: `getThing${i}`,
        summary: `Reads thing ${i}, with its fields and the links to its neighbours.`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", pattern: `^[a-z]{${(i % 7) + 1}}[0-9]+$` },
          },
          limit,
        ],
        responses: {
          ...errors,
          200: { description: "The thing.", content: { "application/json": { schema: ref } } },
        },
      },
      put: {
        operationId: `putThing${i}`,
        requestBody: { required: true, content: { "application/json": { schema: ref } } },
        responses: { ...errors, 204: { description: "Stored." } },
      },
    }
    doc.components.schemas[`Thing${i}`] = {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string" },
        name: { type: "string", maxLength: 120 },
        weight: { type: "number", minimum: 0.5, maximum: i + 0.25 },
        tags: { type: "array", items: { type: "string" } },
        mode: { enum: ["fast", "slow", i % 2 === 0 ? true : null] },
      },
    }
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

/** The fewest paths whose document is at least `bytes` long. */
const pathsFor = (generate, bytes) => {
  const per = generate(100).length / 100
  let paths = Math.max(1, Math.floor(bytes / per))
  while (generate(paths).length < bytes) {
    paths += 1
  }
  return paths
}

/** The program's runtime modules copied with `strings` as its strings.mjs, as package `nish` under `dir`. */
const runtimeCopy = (dir, strings) => {
  const pkg = path.join(dir, "node_modules", "nish")
  fs.mkdirSync(pkg, { recursive: true })
  fs.writeFileSync(path.join(dir, "package.json"), `{ "private": true, "type": "module" }\n`)
  fs.copyFileSync(path.join(root, "package.json"), path.join(pkg, "package.json"))
  fs.cpSync(path.join(root, "runtime"), path.join(pkg, "runtime"), {
    recursive: true,
    filter: (src) => fs.statSync(src).isDirectory() || src.endsWith(".mjs"),
  })
  fs.copyFileSync(strings, path.join(pkg, "runtime", "core", "strings.mjs"))
}

const compile = (args, what) => {
  const env = { ...process.env }
  if (env.WASI_SYSROOT === undefined && fs.existsSync("/usr/lib/wasm32-wasi")) {
    env.WASI_SYSROOT = "/usr"
  }
  const r = spawnSync(nishc.cmd, compileArgv(nishc, [path.join(here, "main.ts"), ...args]), {
    encoding: "utf8",
    env,
  })
  if (r.error !== undefined || r.status !== 0) {
    fail(`building ${what} failed:\n${r.stdout}${r.stderr}`)
  }
}

/** Every side to run, each as `{ name, argv }` twice: the build and its byte-identical copy. */
const build = () => {
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const sides = []
  const twin = (name, file, argv) => {
    const copy = `${file}-copy`
    fs.cpSync(file, copy, { recursive: true })
    sides.push({ name, copy: false, argv: argv(file) }, { name, copy: true, argv: argv(copy) })
  }
  if (opts.only.includes("native")) {
    const exe = path.join(outDir, "native")
    compile(["-o", path.join(outDir, "native-ll") + path.sep, "--link", exe, "--profile", "speed"], "native")
    twin("native", exe, (f) => [f])
  }
  if (opts.only.includes("wasm")) {
    const wasm = path.join(outDir, "main.wasm")
    compile(["-o", path.join(outDir, "wasm-ll") + path.sep, "--link", wasm, "--profile", "wasi"], "wasm")
    const host = path.join(root, "examples", "wasi-host.mjs")
    twin("wasm", wasm, (f) => [process.execPath, "--no-warnings", host, path.relative(root, f)])
  }
  if (opts.only.includes("emit-ts")) {
    const emitted = path.join(outDir, "emitted")
    compile(["--emit-ts", emitted], "--emit-ts")
    const strings = path.join(root, "runtime", "core", "strings.mjs")
    for (const [name, file] of [
      ["emit-ts", strings],
      ...(opts.against === null ? [] : [["emit-ts@against", opts.against]]),
    ]) {
      const dir = path.join(outDir, name)
      fs.cpSync(emitted, path.join(dir, "out"), { recursive: true })
      runtimeCopy(dir, file)
      twin(name, dir, (f) => [process.execPath, ...NODE_FLAGS, path.join(f, "out", "entry.ts")])
    }
  }
  return sides
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

const main = () => {
  const sides = build()
  const inputs = []
  for (const [workload, generate, ext] of [
    ["yaml", generateYaml, "yaml"],
    ["json", generateJson, "json"],
  ]) {
    for (const [size, bytes] of [
      ["100KB", 100 * 1024],
      ["3MB", 3 * 1024 * 1024],
    ]) {
      const file = path.join(outDir, `${workload}-${size}.${ext}`)
      fs.writeFileSync(file, generate(pathsFor(generate, bytes)))
      const length = fs.statSync(file).size
      const iterations = Math.max(1, Math.round((opts.mb * 1024 * 1024) / length))
      inputs.push({ workload, size, file: path.relative(root, file), length, iterations })
    }
  }
  const runs = inputs.flatMap((input) =>
    sides.map((side) => ({ input, side, ns: [], checksums: new Set(), over: false }))
  )
  for (let round = 0; round < opts.rounds; round++) {
    process.stderr.write(`round ${round + 1} of ${opts.rounds}\n`)
    const shift = round % runs.length
    const order = [...runs.slice(shift), ...runs.slice(0, shift)]
    for (const r of round % 2 === 0 ? order : order.reverse()) {
      if (r.over) {
        continue
      }
      const [cmd, ...args] = r.side.argv
      const p = spawnSync(cmd, [...args, r.input.workload, r.input.file, String(r.input.iterations)], {
        cwd: root,
        encoding: "utf8",
        timeout: opts.timeout * 1000,
      })
      if (p.error?.code === "ETIMEDOUT") {
        process.stderr.write(
          `  ${r.side.name} ${r.input.workload} ${r.input.size}: over ${opts.timeout} s, not run again\n`
        )
        for (const same of runs) {
          if (same.input === r.input && same.side.name === r.side.name) {
            same.over = true
          }
        }
        continue
      }
      const lines = (p.stdout ?? "").trim().split("\n")
      const ns = /^ns (\d+)$/.exec(lines[1] ?? "")
      if (p.error !== undefined || p.status !== 0 || ns === null) {
        fail(`${r.side.argv.join(" ")} ${r.input.workload} exited ${p.status}:\n${p.stdout}${p.stderr}`)
      }
      r.ns.push(Number(ns[1]))
      r.checksums.add(lines[0])
    }
  }
  console.log(
    `node ${process.version}, ${opts.rounds} rounds, ms per document (median; band: the gap to the copy)`
  )
  const names = [...new Set(sides.map((s) => s.name))]
  console.log(
    ["input", "bytes", "iters", ...names, ...(names.includes("wasm") ? ["emit-ts/wasm"] : [])].join(" | ")
  )
  for (const input of inputs) {
    const mine = runs.filter((r) => r.input === input)
    const seen = new Set(mine.flatMap((r) => [...r.checksums]))
    if (seen.size > 1) {
      fail(`${input.workload} ${input.size}: the runs disagree: ${[...seen].join(" | ")}`)
    }
    const ms = {}
    const cells = names.map((name) => {
      const [a, b] = mine.filter((r) => r.side.name === name)
      if (a.over || b.over) {
        return `over ${opts.timeout} s`
      }
      const ma = median(a.ns) / input.iterations / 1e6
      const mb = median(b.ns) / input.iterations / 1e6
      ms[name] = ma
      return `${ma.toFixed(3)} (±${((Math.abs(ma - mb) / Math.min(ma, mb)) * 100).toFixed(1)}%)`
    })
    const ratio =
      ms.wasm !== undefined && ms["emit-ts"] !== undefined ? [`${(ms["emit-ts"] / ms.wasm).toFixed(1)}x`] : []
    console.log(
      [`${input.workload} ${input.size}`, input.length, input.iterations, ...cells, ...ratio].join(" | ")
    )
  }
}

main()
