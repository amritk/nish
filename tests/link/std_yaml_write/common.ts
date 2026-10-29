// Helpers the std/yaml-write checks share: strings from bytes, a document to
// build into, and a text shown on one line.
import { JsonDocument } from "../../../std/json-value";
import { JsonLimits } from "../../../std/json-tokenizer";

/** A string of the bytes `codes`, for the characters a literal cannot hold. */
export const ywBytes = (codes: i32[]): string => {
  const bytes: u8[] = [];
  for (const c of codes) {
    bytes.push(toU8(c));
  }
  return String.fromBytes(bytes, 0, toI32(bytes.length));
};

/** A fresh document to build into. */
export const ywDocument = (): JsonDocument => new JsonDocument(new JsonLimits());

/** `text` on one line, its breaks written `\n`, for naming a check. */
export const ywShow = (text: string): string => {
  const out: string[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    const c: i32 = toI32(text.charCodeAt(i));
    if (c === 10) {
      out.push("\\n");
    } else if (c < 32 || c > 126) {
      out.push(`<${c}>`);
    } else {
      out.push(text.substring(i, i + 1));
    }
  }
  return out.join("");
};
