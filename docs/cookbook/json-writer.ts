// `JsonWriter` from `nish/json`: a response body written into a buffer the
// server reuses for every request, by a writer it also keeps. `reset` starts
// the text over, the writer puts in the comma and colon and allocates
// nothing, and a buffer that is too short is reported through `failed`
// rather than a panic, so the answer is the body's length or `-1`.
// `prettyBody` is the same body indented by two spaces, as
// `JSON.stringify(v, null, 2)` writes it: the line breaks and indents are
// bytes the writer stores, so it allocates nothing more. The indent is a
// mode that `reset` keeps, so `prettyBody` sets it back to the minified text
// before it returns, and the next `helloBody` on the same writer is minified.
import { JsonWriter } from "nish/json"

export const helloBody = (w: JsonWriter, out: u8[], message: string): i32 => {
  w.reset(out, 0)
  w.beginObject()
  w.key("message")
  w.string(message)
  w.endObject()
  return w.complete() ? w.written() : -1
}

export const prettyBody = (w: JsonWriter, out: u8[], message: string): i32 => {
  w.setIndent(2)
  const written = helloBody(w, out, message)
  w.setIndent(0)
  return written
}
