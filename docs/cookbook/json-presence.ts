// Typed JSON's `presence` option: `hasV` records whether the input gave the
// key `v`. The decoder already keeps a `seen` flag per field for the
// duplicate and the missing checks; recording it costs one `store i1` of that
// flag into `hasV` when the object closes, and nothing is allocated.
import { JsonDecoder, jsonDecode } from "nish/json-typed"

class Patch {
  static readonly json = { optional: ["v"], presence: { v: "hasV" } }
  v: i32 = 0
  hasV: boolean = false
}

export const given = (d: JsonDecoder): boolean => {
  const p = new Patch()
  return jsonDecode(d, p) === 0 && p.hasV
}
