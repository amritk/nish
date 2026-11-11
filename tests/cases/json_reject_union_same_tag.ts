// NL2720: two variants of one union write their tag as the same string, so a
// decoder could not tell them apart.
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
  static readonly json = { tag: "A" };
  readonly kind: Kind.B = Kind.B;
}
type AB = A | B;
const make = (): AB => new A();

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, make());
  return w.failed;
};
