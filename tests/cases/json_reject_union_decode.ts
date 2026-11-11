// NL2719: `jsonDecode` decodes into the object it is given, and a union's
// variant is known only once its tag is read.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

enum Kind {
  A,
  B,
}
class A {
  readonly kind: Kind.A = Kind.A;
}
class B {
  readonly kind: Kind.B = Kind.B;
}
type AB = A | B;
const make = (): AB => new A();

export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, make());
};
