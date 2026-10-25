// The multicore Conduit server's direct JSON writers
// (bench/multicore/conduit/json-out.ts) against `JsonWriter`, which the
// server falls back to and which writes what `JSON.stringify` writes:
//
//   1. Every byte value alone, and a run of each between plain text, encodes
//      as `JsonWriter.stringBytes` encodes it, the escapes and UTF-8 included.
//   2. A `text[]` with no quoted element and no byte JSON escapes becomes the
//      JSON array of its elements; one with a quoted element, a NULL in any
//      case, a control byte, or no braces is refused, for `PgArrayWalker`.
//   3. The booleans and null.
import { JsonWriter } from "nish/json"
import { Suite } from "nish/testing"
import { jsonOutBool, jsonOutNull, jsonOutString, jsonOutTextArray, jsonOutWorst } from "../../../bench/multicore/conduit/json-out"

const ascii = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** What `JsonWriter.stringBytes` writes for `b[0, len)`. */
const reference = (b: u8[], len: i32): string => {
  const buf: u8[] = new Array<u8>(jsonOutWorst(len) + 16)
  const w = new JsonWriter(buf, 0)
  w.stringBytes(b, 0, len)
  return String.fromBytes(buf, 0, w.end)
}

/** What `jsonOutString` writes for `b[0, len)`. */
const direct = (b: u8[], len: i32): string => {
  const out: u8[] = new Array<u8>(jsonOutWorst(len))
  const n: i32 = jsonOutString(out, 0, b, 0, len)
  return String.fromBytes(out, 0, n)
}

/** `jsonOutTextArray` over the ASCII `text`, or "refused". */
const array = (text: string): string => {
  const b: u8[] = ascii(text)
  const out: u8[] = new Array<u8>(2 * toI32(b.length) + 2)
  const n: i32 = jsonOutTextArray(out, 0, b, 0, toI32(b.length))
  return n < 0 ? "refused" : String.fromBytes(out, 0, n)
}

export const main = (): i32 => {
  const t = new Suite("conduit json-out")

  let alone: i32 = -1
  let amid: i32 = -1
  for (let c: i32 = 0; c < 256; c++) {
    const one: u8[] = [toU8(c)]
    if (direct(one, 1) !== reference(one, 1) && alone < 0) {
      alone = c
    }
    // Long enough that the plain runs on either side go through the vector scan.
    const run: u8[] = new Array<u8>(40)
    for (let k: i32 = 0; k < 40; k++) {
      run[k] = toU8(k === 17 || k === 18 ? c : 97 + (k % 26))
    }
    if (direct(run, 40) !== reference(run, 40) && amid < 0) {
      amid = c
    }
  }
  t.eqI32("every byte alone encodes as JsonWriter encodes it (the first that does not)", alone, toI32(-1))
  t.eqI32("and twice between plain runs", amid, toI32(-1))
  const empty: u8[] = []
  t.eqStr("the empty string", direct(empty, 0), "\"\"")
  const accented: u8[] = [toU8(99), toU8(195), toU8(169), toU8(10)]
  t.eqStr("UTF-8 passes through and a line feed is \\n", direct(accented, 4), reference(accented, 4))

  t.eqStr("a plain array becomes its elements", array("{dragons,training}"), "[\"dragons\",\"training\"]")
  t.eqStr("an empty array", array("{}"), "[]")
  t.eqStr("one element", array("{x}"), "[\"x\"]")
  t.eqStr("a quoted element is refused", array("{\"a b\",c}"), "refused")
  t.eqStr("an unquoted NULL is refused", array("{a,NULL}"), "refused")
  t.eqStr("in any case", array("{nUlL}"), "refused")
  t.eqStr("a NULL-like word is an element", array("{NULLS,nul}"), "[\"NULLS\",\"nul\"]")
  t.eqStr("a control byte is refused", array("{a\u0001}"), "refused")
  t.eqStr("no braces is refused", array("a,b"), "refused")

  const bools: u8[] = new Array<u8>(16)
  let o: i32 = jsonOutBool(bools, 0, true)
  o = jsonOutBool(bools, o, false)
  o = jsonOutNull(bools, o)
  t.eqStr("true, false and null", String.fromBytes(bools, 0, o), "truefalsenull")
  return t.done()
}
