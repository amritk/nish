// A `new` initializer's arguments are literals: it reads nothing, not even a
// module constant, so pass a computed value in the constructor instead.
const START: i32 = 3;

class Leaf {
  value: i32;

  constructor(value: i32) {
    this.value = value;
  }
}

export class Tree {
  left: Leaf = new Leaf(START);
}
