// `JsonTokenizer` from `nish/json-tokenizer`: the `"message"` of a request
// body, validated whole and copied into a buffer the caller owns: its length,
// or -1 for a body that is malformed (`tok.failed` says how) or holds no
// top-level string `"message"`. Nothing is allocated per call.
import { JSON_TOK_END, JSON_TOK_KEY, JSON_TOK_STRING, JsonTokenizer } from "nish/json-tokenizer"

export const messageInto = (tok: JsonTokenizer, body: u8[], out: u8[]): i32 => {
  tok.reset(body, 0, toI32(body.length))
  let length: i32 = -1
  let k: i32 = tok.next()
  while (k > 0) {
    if (k === JSON_TOK_KEY && tok.depth === 1 && tok.keyEquals("message")) {
      k = tok.next()
      if (k === JSON_TOK_STRING) {
        length = tok.stringInto(out, 0)
      } else if (k > 0) {
        k = tok.skipValue()
      }
    }
    if (k > 0) {
      k = tok.next()
    }
  }
  return k === JSON_TOK_END ? length : -1
}
