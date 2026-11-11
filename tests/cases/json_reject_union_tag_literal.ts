// NL2722: a variant's `tag` is written on the wire as a string, read from the
// class's text.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

enum Kind {
  A,
  B,
}
class A {
  static readonly json = { tag: 1 };
  readonly kind: Kind.A = Kind.A;
}
class B {
  readonly kind: Kind.B = Kind.B;
}
type AB = A | B;
const make = (): AB => new A();

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, make());
  return w.failed;
};
