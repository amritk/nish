// An exported class with no constructor whose initializers construct another
// module's exported classes: `main.ts`'s `new Crate()` runs them there.
import { Leaf, Tally } from "./leaf"

export class Crate {
  leaf: Leaf = new Leaf(9, "crate")
  tally: Tally = new Tally()
}
