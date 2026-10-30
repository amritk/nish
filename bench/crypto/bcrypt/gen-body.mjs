// Writes `bcryptBodyN` of std/crypto/bcrypt.ts for a width of 2, 3, 5 or 6:
// `bcryptBody4`'s interleave, lane for lane, with the lane count changed. Each
// lane's state is a flat P[18]+S[4][256] block of 1042 words at 1042k, its l and
// r are locals, and the lanes' half-rounds sit side by side so their S-box
// loads issue together. The output is pasted into the module as it is; this
// file is how it was made, so a change to the kernel's shape is made here and
// the bodies are written again.
//
// Usage: node bench/crypto/bcrypt/gen-body.mjs <width>
const W = Number(process.argv[2])
if (![2, 3, 5, 6].includes(W)) {
  console.error("usage: node bench/crypto/bcrypt/gen-body.mjs <2|3|5|6>")
  process.exit(2)
}
const S = 1042
const words = ["one", "two", "three", "four", "five", "six"]
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
console.log(L.join("\n"))
