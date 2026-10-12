// What the suite's modules share: a text as the bytes the decoder reads, a
// decode that answers its decoder, and an encode that answers its text.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

/** The bytes of `s`, as the decoder reads them. */
export const jtBytes = (s: string): u8[] => {
  const out = new Array<u8>(toI32(s.length));
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i += 1) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

/** A decoder over `text`, after decoding it into `out`; its `failed` and `errorAt` are the answer. */
export const jtDecode = <T>(text: string, out: T, limits: JsonLimits, ignoreUnknown: boolean): JsonDecoder => {
  const src = jtBytes(text);
  const d = new JsonDecoder(src, 0, toI32(src.length), limits);
  d.ignoreUnknown = ignoreUnknown;
  jsonDecode(d, out);
  return d;
};

/** `value` encoded, or `error <code>` when the writer failed. */
export const jtEncode = <T>(value: T, size: i32): string => {
  const w = new JsonWriter(new Array<u8>(size), 0);
  jsonEncode(w, value);
  return w.failed === 0 ? w.text() : `error ${w.failed}`;
};

