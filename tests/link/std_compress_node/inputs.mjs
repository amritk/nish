// The inputs `main.ts` builds, built the same way here: both sides draw from
// one linear congruential generator, so the bytes agree without being stored.
// `fixtures.mjs` compresses them with Node's zlib, and tests/run.js inflates
// what the Nish program compresses and compares it with these.

/** The generator: x' = (x * 1103515245 + 12345) mod 2^31, answering x' >> 16. */
const lcg = (seed) => {
  let x = seed
  return () => {
    x = Number((BigInt(x) * 1103515245n + 12345n) % 2147483648n)
    return x >> 16
  }
}

const WORDS = "time year people way day man thing woman life child world school state family student group country problem hand part place case week company system program question work government number night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face others level office door health person art war history party result change morning reason research girl guy moment air teacher force education".split(" ")

const text = (n) => {
  const next = lcg(7)
  const out = []
  while (out.length < n) {
    const w = WORDS[next() % WORDS.length]
    for (let i = 0; i < w.length && out.length < n; i++) out.push(w.charCodeAt(i))
    if (out.length < n) out.push(next() % 11 === 0 ? 10 : 32)
  }
  return Buffer.from(out)
}

const json = (n) => {
  const next = lcg(11)
  let s = "["
  while (s.length < n) {
    s += `{"id":${next()},"user":"u${next() % 400}","ok":${next() % 2 === 0 ? "true" : "false"},"n":${next() % 1000}},`
  }
  return Buffer.from(s.slice(0, n), "latin1")
}

const noise = (n) => {
  const next = lcg(13)
  return Buffer.from(Array.from({ length: n }, () => next() & 255))
}

const mixed = () => {
  const a = noise(2000)
  const b = text(8000)
  return Buffer.concat([a, b, b.subarray(0, 4000), a])
}

/** Every input by name, as `main.ts`'s `inputOf` builds them. */
export const INPUTS = {
  empty: Buffer.alloc(0),
  one: Buffer.from([65]),
  text: text(12000),
  json: json(5221),
  noise: noise(2000),
  zeros: Buffer.alloc(70000),
  mixed: mixed(),
}
