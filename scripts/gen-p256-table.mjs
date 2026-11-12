#!/usr/bin/env node
/**
 * Generate the fixed-base comb table of `std/crypto/p256.ts`.
 *
 *   node scripts/gen-p256-table.mjs           rewrite the table in std/crypto/p256.ts
 *   node scripts/gen-p256-table.mjs --check   exit 1 if the table there differs by a byte
 *
 * The table is the region of `p256.ts` between the `gen-p256-table:begin` and
 * `gen-p256-table:end` lines: the comb's shape, the recoding's two constants
 * and `p256BaseTable`, a signed all-bits-set comb (Hamburg, "Fast and compact
 * elliptic-curve cryptography", 2012). The scalar k is recoded to
 * m = (k + 2^BITS - 1) / 2 mod n, so that 2m - (2^BITS - 1) = k and every bit
 * of m stands for +1 (set) or -1 (clear) times its power of two. Comb `c`
 * reads `TEETH` bits of m `SPACING` apart; its top tooth picks the sign and
 * the others the entry, so `2^(TEETH - 1)` entries per comb cover every
 * digit, none of them the identity. Each entry is X then Y, eight 32-bit limbs
 * each, least significant first, in the Montgomery domain (x 2^256 mod p)
 * that fiat's arithmetic works in. The default shape, 11 combs of 6 teeth 4
 * apart, is 352 entries, 5,632 limbs, 22 KiB, and 44 additions with 3
 * doublings per multiplication.
 *
 * Computed here with BigInt from SEC 2 §2.4.2's p, b and G, by the textbook
 * affine formulas: the table is public, so nothing here needs to be constant
 * time. The region lives inside `p256.ts` rather than in a module of its own
 * because a file under `std/` is a public `nish/` module, listed as one by the
 * compiler and the release.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "std", "crypto", "p256.ts")

const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn
const G = {
  x: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  y: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
}

/**
 * The comb's shape: `TEETH` teeth `SPACING` bits apart in each of `COMBS`
 * combs, which together cover `TEETH * SPACING * COMBS` bit positions, at
 * least the scalar's 256. `P256_COMB` (`teeth,spacing,combs`) overrides it, to
 * measure another shape; the checked-in table is the default.
 */
const [TEETH, SPACING, COMBS] = (process.env.P256_COMB ?? "6,4,11").split(",").map(Number)
const BITS = TEETH * SPACING * COMBS
if (!(TEETH >= 2 && SPACING >= 1 && COMBS >= 1 && BITS >= 256)) {
  console.error(`gen-p256-table: ${COMBS} combs of ${TEETH} teeth ${SPACING} apart do not cover 256 bits`)
  process.exit(1)
}
const ENTRIES = 1 << (TEETH - 1)

/** The group order n (SEC 2 §2.4.2). */
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n

const mod = (a) => ((a % P) + P) % P

/** `a^-1 mod p`, by Fermat: p is prime. */
const inverse = (a) => {
  let result = 1n
  let base = mod(a)
  let e = P - 2n
  while (e > 0n) {
    if (e & 1n) {
      result = (result * base) % P
    }
    base = (base * base) % P
    e >>= 1n
  }
  return result
}

/** The affine sum of two points, `null` the identity. */
const add = (p, q) => {
  if (p === null) {
    return q
  }
  if (q === null) {
    return p
  }
  if (p.x === q.x) {
    if (mod(p.y + q.y) === 0n) {
      return null
    }
    const l = mod(3n * p.x * p.x - 3n) * inverse(2n * p.y)
    return finish(p, q, mod(l))
  }
  return finish(p, q, mod(mod(q.y - p.y) * inverse(q.x - p.x)))
}

const finish = (p, q, l) => {
  const x = mod(l * l - p.x - q.x)
  return { x, y: mod(l * (p.x - x) - p.y) }
}

/** `2^n p`. */
const shift = (p, n) => {
  let q = p
  for (let i = 0; i < n; i++) {
    q = add(q, q)
  }
  return q
}

const onCurve = (p) => mod(p.y * p.y) === mod(p.x * p.x * p.x - 3n * p.x + B)

/** The eight 32-bit limbs of `a 2^256 mod p`, least significant first. */
const montgomeryLimbs = (a) => {
  const m = mod(a << 256n)
  const limbs = []
  for (let i = 0n; i < 8n; i++) {
    limbs.push(Number((m >> (32n * i)) & 0xffffffffn))
  }
  return limbs
}

const negate = (p) => ({ x: p.x, y: mod(-p.y) })

const limbs = []
// The teeth of comb c, 2^(c TEETH SPACING + j SPACING) G for j = 0 to
// TEETH - 1: comb 0's from G, each later comb's TEETH SPACING doublings past
// the one before.
let teeth = []
for (let j = 0; j < TEETH; j++) {
  teeth.push(shift(G, SPACING * j))
}
for (let c = 0; c < COMBS; c++) {
  if (c > 0) {
    teeth = teeth.map((t) => shift(t, TEETH * SPACING))
  }
  for (let u = 0; u < ENTRIES; u++) {
    // The top tooth always counts +1; tooth j below it +1 when bit j of u is
    // set and -1 when it is clear.
    let point = teeth[TEETH - 1]
    for (let j = 0; j < TEETH - 1; j++) {
      point = add(point, (u >> j) & 1 ? teeth[j] : negate(teeth[j]))
    }
    if (point === null || !onCurve(point)) {
      throw new Error(`gen-p256-table: comb ${c}, entry ${u} is not a point of the curve`)
    }
    limbs.push(...montgomeryLimbs(point.x), ...montgomeryLimbs(point.y))
  }
}

/** `a^e mod n`. */
const powN = (a, e) => {
  let result = 1n
  let base = a % N
  while (e > 0n) {
    if (e & 1n) {
      result = (result * base) % N
    }
    base = (base * base) % N
    e >>= 1n
  }
  return result
}

// The recoding's two constants: 2^BITS - 1 mod n, which the scalar is moved
// by, and 2^-1 R mod n, which a scalar Montgomery multiply (a b R^-1) halves
// by. Both are public, functions of n and the shape alone.
const R = 1n << 256n
const OFFSET = ((1n << BigInt(BITS)) - 1n) % N
const HALF = (powN(2n, N - 2n) * R) % N
if ((((2n * HALF) % N) * powN(R, N - 2n)) % N !== 1n) {
  throw new Error("gen-p256-table: 2^-1 R mod n does not halve")
}

/** The lines of a function that writes the eight limbs of `a`, least significant first, into `out`. */
const setter = (name, doc, a) => {
  const out = [doc, `const ${name} = (out: u32[]): void => {`, "  p256SetLimbs(", "    out,"]
  for (let i = 0n; i < 8n; i++) {
    const limb = `0x${((a >> (32n * i)) & 0xffffffffn).toString(16).padStart(8, "0")}`
    out.push(`    ${limb}${i < 7n ? "," : ""}`)
  }
  out.push("  )", "}")
  return out
}

// Biome's layout for an array of numbers at two spaces of indent and 110 columns.
const PER_LINE = 9
const lines = []
for (let i = 0; i < limbs.length; i += PER_LINE) {
  const row = limbs.slice(i, i + PER_LINE).map((l) => `0x${l.toString(16).padStart(8, "0")},`)
  lines.push(`  ${row.join(" ")}`)
}

const BEGIN = "// gen-p256-table:begin"
const END = "// gen-p256-table:end"
const region = [
  `${BEGIN} -- generated by scripts/gen-p256-table.mjs; edit that, not this.`,
  "/** The fixed-base comb's shape: teeth per comb, bits between teeth, combs, and entries per comb. */",
  `const P256_COMB_TEETH: i32 = ${TEETH}`,
  `const P256_COMB_SPACING: i32 = ${SPACING}`,
  `const P256_COMBS: i32 = ${COMBS}`,
  `const P256_COMB_ENTRIES: i32 = ${ENTRIES}`,
  "",
  ...setter("p256BaseOffset", `/** \`2^${BITS} - 1 mod n\`, plain: the recoding adds it before it halves (ECC-7). */`, OFFSET),
  "",
  ...setter("p256BaseHalf", "/** `2^-1 R mod n`: a scalar Montgomery multiply by it halves mod n (ECC-7). */", HALF),
  "",
  "/**",
  ` * The signed comb table \`p256BaseMult\` reads: comb \`c\` (0 to ${COMBS - 1}), entry \`u\``,
  ` * (0 to ${ENTRIES - 1}) at limb \`(${ENTRIES}c + u) * 16\`, is the affine point`,
  ` * (2^${(TEETH - 1) * SPACING} + the sum over j < ${TEETH - 1} of (2u_j - 1) 2^(${SPACING}j)) 2^(${TEETH * SPACING}c) G,`,
  " * `u_j` bit `j` of `u`, as X then Y in the Montgomery domain. Public: a",
  " * function of G alone.",
  " */",
  "const p256BaseTable = (): u32[] => [",
  ...lines,
  "]",
  END,
].join("\n")

const source = fs.readFileSync(target, "utf8")
const from = source.indexOf(BEGIN)
const to = source.indexOf(END)
if (from < 0 || to < from) {
  console.error(`gen-p256-table: no ${BEGIN} ... ${END} region in ${path.relative(root, target)}`)
  process.exit(1)
}
const next = source.slice(0, from) + region + source.slice(to + END.length)

if (process.argv.includes("--check")) {
  if (next !== source) {
    console.error(
      `gen-p256-table: the table in ${path.relative(root, target)} is not what the generator writes; run node scripts/gen-p256-table.mjs`
    )
    process.exit(1)
  }
  console.log(`gen-p256-table: ${limbs.length} limbs, as generated`)
} else {
  fs.writeFileSync(target, next)
  console.log(`gen-p256-table: wrote ${limbs.length} limbs to ${path.relative(root, target)}`)
}
