// NL2720 reached only through a `Map` whose value is the union with `| null`.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

enum Kind {
  A,
  B,
}
class A {
  static readonly json = { tag: "same" };
  readonly kind: Kind.A = Kind.A;
}
class B {
  static readonly json = { tag: "same" };
  readonly kind: Kind.B = Kind.B;
}
type AB = A | B;

class Doc {
  slots: Map<string, AB | null>;
  constructor() {
    this.slots = new Map<string, AB | null>();
  }
}

export const main = (): i32 => jsonDecode(new JsonDecoder([], 0, 0, new JsonLimits()), new Doc());
