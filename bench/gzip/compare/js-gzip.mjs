// bench/gzip/compare's JavaScript comparator: node:zlib's gzipSync and
// gunzipSync, the one-shot API Node and Bun both have, and under Bun also
// Bun.gzipSync and Bun.gunzipSync, Bun's own. Same arguments and row format
// as bench/gzip/main.ts, with the runtime's name first: compare.mjs reads the
// lines.
//
//   node js-gzip.mjs <body> <calls> <gzip -1 stream> <gzip -6 stream>
//   bun js-gzip.mjs <body> <calls> <gzip -1 stream> <gzip -6 stream>
import fs from "node:fs"
import zlib from "node:zlib"

const body = fs.readFileSync(process.argv[2])
const calls = Number(process.argv[3])
const [gz1, gz6] = process.argv.slice(4, 6).map((p) => fs.readFileSync(p))
const runtime = typeof Bun === "undefined" ? "node" : "bun"
const now = () => process.hrtime.bigint()

/** Times `calls` compressions and decompressions at each level and prints the four rows. */
const run = (name, gzip, gunzip) => {
  for (const [level, stream] of [
    [1, gz1],
    [6, gz6],
  ]) {
    let out
    for (let i = 0; i < 200; i++) {
      out = gzip(body, level)
    }
    let t = now()
    for (let i = 0; i < calls; i++) {
      out = gzip(body, level)
    }
    console.log(`${name} gzip -${level} ${body.length} ${out.length} ${now() - t} ${calls}`)
    for (let i = 0; i < 200; i++) {
      gunzip(stream)
    }
    t = now()
    for (let i = 0; i < calls; i++) {
      if (gunzip(stream).length !== body.length) {
        throw new Error("gunzip length")
      }
    }
    console.log(`${name} gunzip -${level} ${body.length} ${stream.length} ${now() - t} ${calls}`)
  }
}

run(
  `${runtime}-zlib`,
  (b, level) => zlib.gzipSync(b, { level }),
  (s) => zlib.gunzipSync(s)
)
if (runtime === "bun") {
  const bytes = new Uint8Array(body)
  run(
    "bun-native",
    (_b, level) => Bun.gzipSync(bytes, { level }),
    (s) => Bun.gunzipSync(new Uint8Array(s))
  )
}
