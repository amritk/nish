// The Node half of tests/link/std_compress_node: `judge` reads the program's
// `--emit` lines and inflates each with Node's zlib, in the framing the line
// names, against the input inputs.mjs builds; and `nodeRefusesBad` checks that
// Node refuses every bad stream in fixtures.ts, so that a fixture the program
// refuses is one zlib refuses too. tests/run.js calls both.
import fs from "node:fs"
import zlib from "node:zlib"
import { INPUTS } from "./inputs.mjs"

const inflaters = { gzip: zlib.gunzipSync, zlib: zlib.inflateSync, raw: zlib.inflateRawSync }

/** The problems with one `--emit` run's lines: empty when every line inflates to its input. */
export const judge = (stdout) => {
  const problems = []
  let lines = 0
  for (const line of stdout.split("\n").filter((l) => l.length > 0)) {
    const [format, level, input, hex = ""] = line.split(" ")
    const want = INPUTS[input]
    lines += 1
    if (want === undefined) {
      problems.push(`${line.slice(0, 40)}: no such input`)
      continue
    }
    try {
      const got = inflaters[format](Buffer.from(hex, "hex"))
      if (!got.equals(want)) {
        problems.push(`${format} ${level} ${input}: inflates to ${got.length} other bytes`)
      }
    } catch (e) {
      problems.push(`${format} ${level} ${input}: ${e.message}`)
    }
  }
  if (lines === 0) {
    problems.push("no lines")
  }
  return { lines, problems }
}

/** The bad streams of fixtures.ts that Node does not refuse. */
export const nodeRefusesBad = () => {
  const text = fs.readFileSync(new URL("fixtures.ts", import.meta.url), "utf8")
  const bad = text.slice(text.indexOf("badStreams"))
  const accepted = []
  let count = 0
  for (const m of bad.matchAll(/^ {2}("[^"]*"), "(\w+)", "([0-9a-f]*)", "\w+",$/gm)) {
    count += 1
    try {
      inflaters[m[2]](Buffer.from(m[3], "hex"))
      accepted.push(JSON.parse(m[1]))
    } catch {
      // refused, as it should be
    }
  }
  return { count, accepted }
}
