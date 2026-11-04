// Writes `bcryptBodyN` of std/crypto/bcrypt.ts for a width of 2 to 6:
// `bcryptBody4`'s interleave, lane for lane, with the lane count changed. Each
// lane's state is a flat P[18]+S[4][256] block of 1042 words at 1042k, its l and
// r are locals, and the lanes' half-rounds sit side by side so their S-box
// loads issue together. The output is pasted into the module as it is; this
// file is how it was made, so a change to the kernel's shape is made here and
// the bodies are written again. `bcryptBody4` is the hand-written original,
// with a longer doc comment; below that comment, width 4's output is its text.
// `--check` compares every width's output with the module and exits 1 on a
// difference, so a kernel edited by hand is caught. `--unroll` writes the 8
// round pairs out with literal P indexes, freeing the loop counter's register;
// `--rotated` writes the extraction the module had before the paired one: one
// opaque copy of the word rotated right by 8 gives bytes 1 and 2, and bytes 0
// and 3 are shifted out of the word itself, seven instructions where the
// paired way takes six; `extract.mjs` counts and times it against the module.
// `--module <out.ts>` writes a copy of the module with every width's body
// written again, which `unroll.mjs` and `extract.mjs` time against the module.
//
// Usage: node bench/crypto/bcrypt/gen-body.mjs <width> [--unroll] [--rotated] | --check | --module <out.ts> [--unroll] [--rotated]
import fs from "node:fs"

const S = 1042
const words = ["one", "two", "three", "four", "five", "six"]

const body = (W, unroll = false, rotated = false) => {
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
  // `n` is the round pair's first P index: the loop's counter, or a literal
  // when `unroll` writes the 8 pairs out and the names take the pair's number.
  const update = (x, y, n, plus, pad, tag, k) => {
    const o = S * k
    const nIndex = `${o ? `${o} + ` : ""}n${plus ? " + 1" : ""}`
    const pn = typeof n === "number" ? `${o + n + plus}` : nIndex
    p(
      `${pad}${y}${k} ^= st[${pn}] ^ (((st[${o + 18} + ${x}${k}a${tag}] + st[${o + 274} + ${x}${k}b${tag}]) ^ st[${o + 530} + ${x}${k}c${tag}]) + st[${o + 786} + ${x}${k}d${tag}])`
    )
  }
  // From three lanes up, each lane's half-round is written whole before the
  // next lane's, and its bytes come in two pairs, each the low and second
  // byte of a copy behind the value barrier (`ctSelect(v, ~0, 0)` is `v`,
  // opaque): one copy of the word gives bytes 0 and 1, and that copy moved
  // down by 16, a second copy, gives bytes 2 and 3. The second byte is one
  // `movzx` from `ah`, `bh`, `ch` or `dh`, so a lane takes its four bytes in
  // six instructions; without the barriers LLVM folds the pairs back into
  // shifts of the word. A second byte needs its copy in one of the four
  // registers that have one, which constrains the register allocator: up to
  // five lanes it fits, but all six paired spilled more than they saved
  // (counted, not derived), so at six lanes the sixth lane keeps the
  // previous way, one copy moved down by 8 for bytes 1 and 2 and two shifts
  // of the word for 0 and 3.
  // `rotated` (`--rotated`) gives every lane that previous way, rotating the
  // copy at three to five lanes, which a BMI2 target does in one `rorx`.
  // Two lanes keep the four shifts of the word itself, every lane's bytes
  // before any lane's update: the copy measured slower there
  // (docs/security/crypto-bcrypt.md, "Cascade Lake").
  const copied = W >= 3
  const paired = (k) => !rotated && copied && k < Math.min(W, 5)
  const copy = (v) => (W === 6 ? `${v} >>> 8` : `(${v} >>> 8) | (${v} << 24)`)
  const half = (x, y, n, plus, pad, tag) => {
    for (const k of lanes) {
      const v = `${x}${k}`
      if (paired(k)) {
        p(`${pad}const ${v}e${tag}: u32 = ctSelect(${v}, 0xffffffff, 0)`)
        p(`${pad}const ${v}d${tag}: i32 = toI32(${v}e${tag}) & 0xff`)
        p(`${pad}const ${v}c${tag}: i32 = toI32(${v}e${tag} >>> 8) & 0xff`)
        p(`${pad}const ${v}f${tag}: u32 = ctSelect(${v}e${tag} >>> 16, 0xffffffff, 0)`)
        p(`${pad}const ${v}b${tag}: i32 = toI32(${v}f${tag}) & 0xff`)
        p(`${pad}const ${v}a${tag}: i32 = toI32(${v}f${tag} >>> 8) & 0xff`)
        update(x, y, n, plus, pad, tag, k)
        continue
      }
      if (copied) {
        p(`${pad}const ${v}e${tag}: u32 = ctSelect(${copy(v)}, 0xffffffff, 0)`)
        p(`${pad}const ${v}a${tag}: i32 = toI32(${v} >>> 24) & 0xff`)
        p(`${pad}const ${v}b${tag}: i32 = toI32(${v}e${tag} >>> 8) & 0xff`)
        p(`${pad}const ${v}c${tag}: i32 = toI32(${v}e${tag}) & 0xff`)
        p(`${pad}const ${v}d${tag}: i32 = toI32(${v}) & 0xff`)
        update(x, y, n, plus, pad, tag, k)
        continue
      }
      for (const [c, sh] of [
        ["a", 24],
        ["b", 16],
        ["c", 8],
        ["d", 0],
      ]) {
        p(`${pad}const ${v}${c}${tag}: i32 = toI32(${sh ? `${v} >>> ${sh}` : v}) & 0xff`)
      }
    }
    if (!copied) {
      for (const k of lanes) {
        update(x, y, n, plus, pad, tag, k)
      }
    }
  }
  if (unroll) {
    for (let n = 1; n < 17; n += 2) {
      half("l", "r", n, 0, "    ", `${n >> 1}`)
      half("r", "l", n, 1, "    ", `${n >> 1}`)
    }
  } else {
    p("    for (let n: i32 = 1; n < 17; n += 2) {")
    half("l", "r", "n", 0, "      ", "")
    half("r", "l", "n", 1, "      ", "")
    p("    }")
  }
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

const module = new URL("../../../std/crypto/bcrypt.ts", import.meta.url)

if (process.argv[2] === "--module") {
  // A copy of the module with every width's body written again, unrolled
  // with `--unroll` and in the previous extraction with `--rotated`: the
  // experiments `unroll.mjs` and `extract.mjs` time against the module.
  const to = process.argv[3]
  if (!to || to.startsWith("--")) {
    console.error("usage: node bench/crypto/bcrypt/gen-body.mjs --module <out.ts> [--unroll] [--rotated]")
    process.exit(2)
  }
  const src = fs.readFileSync(module, "utf8").split("\n")
  for (const W of [2, 3, 4, 5, 6]) {
    const was = body(W).slice(1)
    const at = src.indexOf(was[0])
    if (at < 0 || !was.every((line, i) => src[at + i] === line)) {
      console.error(`bcryptBody${W} differs from the generator; run --check`)
      process.exit(1)
    }
    const again = body(W, process.argv.includes("--unroll"), process.argv.includes("--rotated"))
    src.splice(at, was.length, ...again.slice(1))
  }
  fs.writeFileSync(to, src.join("\n"))
  process.exit(0)
}
if (process.argv[2] === "--check") {
  const src = fs.readFileSync(module, "utf8").split("\n")
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
const width = Number(process.argv[2])
if (![2, 3, 4, 5, 6].includes(width)) {
  console.error(
    "usage: node bench/crypto/bcrypt/gen-body.mjs <2|3|4|5|6> [--unroll] [--rotated] | --check | --module <out.ts> [--unroll] [--rotated]"
  )
  process.exit(2)
}
console.log(body(width, process.argv.includes("--unroll"), process.argv.includes("--rotated")).join("\n"))
