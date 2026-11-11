// NL2720 reached only through a `Map` of a `Map` whose value is an array of
// the union: its variants write their tag under different keys.
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
  static readonly json = { rename: { kind: "type" } };
  readonly kind: Kind.B = Kind.B;
}
type AB = A | B;

class Doc {
  groups: Map<string, Map<string, AB[]>>;
  constructor() {
    this.groups = new Map<string, Map<string, AB[]>>();
  }
}

export const main = (): i32 => jsonDecode(new JsonDecoder([], 0, 0, new JsonLimits()), new Doc());
