// NL2486 reached only through a `Map`'s value: a variant of the union the map
// holds is an interface, not a class.
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

class Doc {
  items: Map<string, AB>;
  constructor() {
    this.items = new Map<string, AB>();
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, new Doc());
  return w.failed;
};
