// NL2486: every variant of a union typed JSON reads or writes is a class it
// can make; an interface is not one.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

enum Kind {
  A,
  B,
}
class A {
  readonly kind: Kind.A = Kind.A;
}
interface B {
  readonly kind: Kind.B;
}
type AB = A | B;
const make = (): AB => new A();

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, make());
  return w.failed;
};
