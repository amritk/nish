import { Leaf } from "./leaf";

export class Branch {
  leaf: Leaf;

  constructor(value: number) {
    this.leaf = new Leaf(value);
  }

  tip(): Leaf {
    return this.leaf;
  }
}
