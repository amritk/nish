// `JsonDocument` from `nish/json-value`: one field of a body whose shape is
// not declared, read without a string being made. A `JsonValue` is an `i32`
// handle, so `get` and `isU64` are plain calls on the document with a handle
// in and a handle or a flag out, and the key is a constant string.
import { JsonDocument } from "nish/json-value"

export const userId = (doc: JsonDocument, body: u8[], n: i32): u64 => {
  const root = doc.parse(body, 0, n)
  const id = doc.get(root, "user")
  return doc.isU64(id) ? doc.u64(id) : toU64(0)
}
