// The rewrites of `sha256Compress` that README.md's "Trying to close the gap"
// times, as edits to std/crypto/sha256.ts's text rather than as copies of it,
// so that each variant is the file it is run against with one thing changed.
// run.mjs's --variant builds main.ts against one; each part below says what it
// changes, and parts combine with `+` (`locals+maj+nested`).
//
// Every edit states how many places it must change and refuses a file where it
// finds another number, so a reshaped sha256.ts is reported, not half-edited.

/** Replaces each match of `re` in `text` with `to`, which must happen `want` times. */
const edit = (text, re, to, want, what) => {
  let n = 0
  const out = text.replace(re, (...m) => {
    n += 1
    return typeof to === "function" ? to(...m) : to
  })
  if (n !== want) {
    throw new Error(`variant ${what}: ${n} matches in sha256.ts, not ${want}`)
  }
  return out
}

/** `sha256Compress`'s text: from its declaration to its panic, the span the body edits touch. */
const compressSpan = (text) => {
  const from = text.indexOf("const sha256Compress = ")
  const to = text.indexOf('panic("Sha256: a block outside its buffer")', from)
  if (from < 0 || to < 0) {
    throw new Error("variant: sha256.ts has no sha256Compress of the shape this script edits")
  }
  return [from, to]
}

/** Applies `f` to `sha256Compress`'s text only. */
const inCompress = (text, f) => {
  const [from, to] = compressSpan(text)
  return text.slice(0, from) + f(text.slice(from, to)) + text.slice(to)
}

/** Each part: what it changes and the edit. */
export const PARTS = {
  // The schedule in 16 rolling locals instead of `w[]`: word t lives in
  // w(t mod 16), which round t + 16 overwrites only after reading it. A bench
  // variant only: HMAC wipes `w`, and locals are out of the wipe's reach.
  locals: {
    what: "the schedule in 16 rolling locals instead of `w[]`",
    apply: (text) =>
      inCompress(text, (body) => {
        const withLocals = edit(
          body,
          /^( {4})const base: integer<0, 2147483583> = at\n/m,
          (_m, ind) =>
            `${ind}const base: integer<0, 2147483583> = at\n` +
            Array.from({ length: 16 }, (_, k) => `${ind}let w${k}: u32 = 0\n`).join(""),
          1,
          "locals"
        )
        return edit(withLocals, /\bw\[(\d+)\]/g, (_, t) => `w${Number(t) % 16}`, 16 * 2 + 48 * 6, "locals")
      }),
  },
  // Maj(x, y, z) = y ^ ((x ^ y) & (y ^ z)), and this round's y ^ z is the last
  // round's x ^ y, so one AND and two XORs a round instead of two and two.
  maj: {
    what: "Maj as `y ^ (xy & yz)`, carrying `x ^ y` into the next round",
    apply: (text) =>
      inCompress(text, (body) => {
        const carried = edit(
          body,
          /^( {4})let t1: u32 = 0\n/m,
          (_, ind) => `${ind}let t1: u32 = 0\n${ind}let ab: u32 = 0\n${ind}let bc: u32 = b ^ c\n`,
          1,
          "maj"
        )
        return edit(
          carried,
          /^( +)(\w+) = t1 \+ sha256BigSigma0\((\w+)\) \+ sha256Majority\(\3, (\w+), \w+\)$/gm,
          (_, ind, dst, x, y) =>
            `${ind}ab = ${x} ^ ${y}\n${ind}${dst} = t1 + sha256BigSigma0(${x}) + (${y} ^ (ab & bc))\n${ind}bc = ab`,
          64,
          "maj"
        )
      }),
  },
  // Σ as three nested rotates: ROTR^6(ROTR^5(ROTR^14(x) ^ x) ^ x) is
  // ROTR^25 ^ ROTR^11 ^ ROTR^6, two XORs and three rotates as before but one
  // live copy of x fewer.
  nested: {
    what: "Σ0 and Σ1 as three nested rotates (`rotr(rotr(rotr(e, 14) ^ e, 5) ^ e, 6)`)",
    apply: (text) => {
      const s0 = edit(
        text,
        /^const sha256BigSigma0 = .*$/m,
        "const sha256BigSigma0 = (x: u32): u32 => sha256Rotr(sha256Rotr(sha256Rotr(x, 9) ^ x, 11) ^ x, 2)",
        1,
        "nested"
      )
      return edit(
        s0,
        /^const sha256BigSigma1 = .*$/m,
        "const sha256BigSigma1 = (x: u32): u32 => sha256Rotr(sha256Rotr(sha256Rotr(x, 14) ^ x, 5) ^ x, 6)",
        1,
        "nested"
      )
    },
  },
  // σ the same way: ROTR^7(ROTR^11(x) ^ x) is ROTR^18 ^ ROTR^7.
  snested: {
    what: "σ0 and σ1 as two nested rotates",
    apply: (text) => {
      const s0 = edit(
        text,
        /^const sha256SmallSigma0 = .*$/m,
        "const sha256SmallSigma0 = (x: u32): u32 => sha256Rotr(sha256Rotr(x, 11) ^ x, 7) ^ (x >>> 3)",
        1,
        "snested"
      )
      return edit(
        s0,
        /^const sha256SmallSigma1 = .*$/m,
        "const sha256SmallSigma1 = (x: u32): u32 => sha256Rotr(sha256Rotr(x, 2) ^ x, 17) ^ (x >>> 10)",
        1,
        "snested"
      )
    },
  },
  // Not an edit: the build gets `--cpu x86-64-v3`, which allows `rorx`.
  v3: { what: "built with `--cpu x86-64-v3` (`rorx`)", apply: (text) => text },
}

/**
 * A variant spelled `part+part+…` (`base` alone is no edit): `{ name, source,
 * flags }`, the sha256.ts to build against and the compiler flags it adds.
 */
export const variantOf = (spec, base) => {
  const parts = spec === "base" ? [] : spec.split("+")
  let source = base
  for (const p of parts) {
    if (PARTS[p] === undefined) {
      throw new Error(`variant ${spec}: no part ${p} (${Object.keys(PARTS).join(", ")})`)
    }
    source = PARTS[p].apply(source)
  }
  return { name: spec, source, flags: parts.includes("v3") ? ["--cpu", "x86-64-v3"] : [] }
}
