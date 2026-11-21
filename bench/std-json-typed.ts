// Typed JSON decoding (std/json-typed.ts) under an instruction count: one
// document of a nested object, an array of records and a string, decoded `n`
// times into fresh objects. It reaches the number and array paths whose
// panic sites the std/ ratchet counts, so a fix to one of them shows here as
// a count that holds or falls. It prints the sum of what it decoded.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode } from "nish/json-typed"

export class Point {
  x: i32 = 0
  y: i64 = 0
  w: f64 = 0.0
}

export class Doc {
  name: string = ""
  count: u32 = 0
  ok: boolean = false
  origin: Point = new Point()
  points: Point[] = []
  tags: string[] = []
}

const bytes = (s: string): u8[] => {
  const out = new Array<u8>(toI32(s.length))
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i++) {
    out[i] = toU8(s.charCodeAt(i))
  }
  return out
}

const document = (): string => {
  const points: string[] = []
  for (let i: i32 = 0; i < 32; i++) {
    points.push(`{"x":${i},"y":${i * 1000003},"w":${i}.25}`)
  }
  return `{"name":"bench","count":4000000000,"ok":true,"origin":{"x":-7,"y":9007199254740991,"w":1.5e3},"points":[${points.join(",")}],"tags":["a","bc","def","\\u00e9"]}`
}

export const main = (): i32 => {
  const n: i32 = 2000 // bench:n
  const src = bytes(document())
  let sum: f64 = 0.0
  for (let round: i32 = 0; round < n; round++) {
    const doc = new Doc()
    const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits())
    jsonDecode(d, doc)
    if (d.failed !== 0) {
      console.log(`failed ${d.failed} at ${d.errorAt}`)
      return 1
    }
    sum += toF64(doc.count) + toF64(doc.origin.y) + toF64(doc.tags.length)
    for (const p of doc.points) {
      sum += toF64(p.x) + toF64(p.y) + p.w
    }
  }
  console.log(`${sum}`)
  return 0
}
