// WP27 S4.1: C fills a layout's fields, so typed JSON does not decode into one.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode } from "nish/json-typed"

declare class Point {
  x: i32
}

export const main = (): i32 => {
  const d = new JsonDecoder([], 0, 0, new JsonLimits())
  const p = new Point()
  return jsonDecode(d, p)
}
