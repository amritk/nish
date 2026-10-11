// `JsonWriter` from `nish/json`: a response body written into a buffer the
// caller reuses for every request. The writer puts in the comma and colon,
// allocates nothing, and reports a buffer that is too short through `failed`
// rather than a panic, so the answer is the body's length or `-1`.
import { JsonWriter } from "nish/json"

export const helloBody = (out: u8[], message: string): i32 => {
  const w = new JsonWriter(out, 0)
  w.beginObject()
  w.key("message")
  w.string(message)
  w.endObject()
  return w.complete() ? w.written() : -1
}
