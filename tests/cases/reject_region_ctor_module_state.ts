// NL2609: a constructor reached by `new` inside the region stores a field of
// `this`, a string the region allocated, into module state, which outlives
// the region.
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
