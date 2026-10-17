// A holder cannot be decoded into: the decoder would set its `Secret` field outside the constructor.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
class Holder {
  readonly k: Secret<u8[]>;
  constructor(seed: u8) {
    this.k = secret([seed, toU8(2)]);
  }
  wipe(): void {
    wipe(this.k);
  }
}
export const main = (): i32 => {
  const h = new Holder(toU8(1));
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  jsonDecode(d, h);
  h.wipe();
  return 0;
};
