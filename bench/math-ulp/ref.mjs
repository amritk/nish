// JavaScript's own answer for each line `bench/math-ulp/operands.ts` prints,
// one 64-bit pattern per line: `node ref.mjs <operands-output> <out>`.
// `ulp.py` runs it and holds every special value to it bit for bit.
import fs from "node:fs"
import readline from "node:readline"

const view = new DataView(new ArrayBuffer(8))
const f = (s) => {
  view.setBigInt64(0, BigInt(s))
  return view.getFloat64(0)
}
const bits = (x) => {
  view.setFloat64(0, x)
  return view.getBigInt64(0).toString()
}

const lines = readline.createInterface({ input: fs.createReadStream(process.argv[2]) })
const out = fs.createWriteStream(process.argv[3])
for await (const line of lines) {
  const p = line.split(" ")
  let r
  if (p[0] === "T") {
    r = Math.tan(f(p[1]))
  } else if (p[0] === "A") {
    r = Math.atan2(f(p[1]), f(p[2]))
  } else {
    r = Math.hypot(f(p[1]), f(p[2]))
  }
  out.write(`${bits(r)}\n`)
}
out.end()
