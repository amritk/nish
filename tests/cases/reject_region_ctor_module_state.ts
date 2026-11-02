// A constructor reached by `new` inside the region stores a field of `this`,
// a string the region allocated, into module state. The shape is
// unreachable because module state is immutable: the top-level `let` is
// refused first (NL2084), so region memory never outlives its region this way.
import { free, region } from "nish:region";

let lastName: string = "";

class Link {
  name: string;
  constructor(n: i32) {
    this.name = `link ${n}`;
    lastName = this.name;
  }
}

const make = (): Link => new Link(1);

export const main = (): i32 => {
  const r = region(make);
  free(r);
  return lastName.length;
};
