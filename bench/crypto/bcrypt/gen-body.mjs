// Writes `bcryptBodyN` of std/crypto/bcrypt.ts for a width of 2 to 6:
// `bcryptBody4`'s interleave, lane for lane, with the lane count changed. Each
// lane's state is a flat P[18]+S[4][256] block of 1042 words at 1042k, its l and
// r are locals, and the lanes' half-rounds sit side by side so their S-box
// loads issue together. The output is pasted into the module as it is; this
// file is how it was made, so a change to the kernel's shape is made here and
// the bodies are written again. `bcryptBody4` is the hand-written original,
// with a longer doc comment; below that comment, width 4's output is its text.
// `--check` compares every width's output with the module and exits 1 on a
// difference, so a kernel edited by hand is caught.
//
// Usage: node bench/crypto/bcrypt/gen-body.mjs <width> | --check
import fs from "node:fs"

const S = 1042
const words = ["one", "two", "three", "four", "five", "six"]

const body = (W) => {
  const L = []
  const p = (s) => L.push(s)
  const lanes = [...Array(W).keys()]
  const end = S * W
  p(`/** \`bcryptBody4\`'s interleave on ${words[W - 1]} lanes. */`)
  p(`const bcryptBody${W} = (st: u32[]): void => {`)
  p(`  if (st.length < ${end}) {`)
  p("    return")
  p("  }")
  for (const k of lanes) {
    p(`  let l${k}: u32 = 0`)
    p(`  let r${k}: u32 = 0`)
  }
  p("  for (let i: i32 = 0; i + 1 < 1042; i += 2) {")
  for (const k of lanes) {
    p(`    l${k} ^= st[${S * k}]`)
  }
  p("    for (let n: i32 = 1; n < 17; n += 2) {")
  const half = (x, y, plus) => {
    for (const k of lanes) {
      for (const [c, sh] of [
        ["a", 24],
        ["b", 16],
        ["c", 8],
        ["d", 0],
      ]) {
        p(`      const ${x}${k}${c}: i32 = toI32(${sh ? `${x}${k} >>> ${sh}` : `${x}${k}`}) & 0xff`)
      }
    }
    for (const k of lanes) {
      const o = S * k
      const pn = o ? `${o} + n${plus}` : `n${plus}`
      p(
        `      ${y}${k} ^= st[${pn}] ^ (((st[${o + 18} + ${x}${k}a] + st[${o + 274} + ${x}${k}b]) ^ st[${o + 530} + ${x}${k}c]) + st[${o + 786} + ${x}${k}d])`
      )
    }
  }
  half("l", "r", "")
  half("r", "l", " + 1")
  p("    }")
  for (const k of lanes) {
    const o = S * k
    p(`    const t${k}: u32 = r${k}`)
    p(`    r${k} = l${k}`)
    p(`    l${k} = t${k} ^ st[${o + 17}]`)
    p(`    st[${o ? `${o} + i` : "i"}] = l${k}`)
    p(`    st[${o ? `${o} + i` : "i"} + 1] = r${k}`)
  }
  p("  }")
  p("}")

  return L
}

if (process.argv[2] === "--check") {
  const src = fs.readFileSync(new URL("../../../std/crypto/bcrypt.ts", import.meta.url), "utf8").split("\n")
  let bad = 0
  for (const W of [2, 3, 4, 5, 6]) {
    // The doc comment (the first line) is not compared: `bcryptBody4`'s is longer.
    const want = body(W).slice(1)
    const at = src.indexOf(want[0])
    const got = at < 0 ? [] : src.slice(at, at + want.length)
    const same = got.length === want.length && got.every((line, i) => line === want[i])
    console.log(`bcryptBody${W}: ${same ? "matches" : "differs from"} the generator`)
    if (!same) {
      bad++
    }
  }
  process.exit(bad ? 1 : 0)
}
const W = Number(process.argv[2])
if (![2, 3, 4, 5, 6].includes(W)) {
  console.error("usage: node bench/crypto/bcrypt/gen-body.mjs <2|3|4|5|6> | --check")
  process.exit(2)
}
console.log(body(W).join("\n"))
