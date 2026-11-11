// NL2719 reached only through a `Map`'s value: two variants of the union a
// map holds write their tag as the same string.
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
