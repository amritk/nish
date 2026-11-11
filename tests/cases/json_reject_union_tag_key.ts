// NL2720: the variants of one union write their tag under different keys, so a
// decoder could not find the tag before it knows the variant.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

enum Kind {
  A,
  B,
}
class A {
  readonly kind: Kind.A = Kind.A;
}
class B {
  static readonly json = { rename: { kind: "type" } };
  readonly kind: Kind.B = Kind.B;
}
type AB = A | B;
const make = (): AB => new A();

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, make());
  return w.failed;
};
