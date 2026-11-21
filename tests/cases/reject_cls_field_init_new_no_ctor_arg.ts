// A class with no constructor is built with no arguments.
class Leaf {
  n: i32 = 0;
}

export class Holder {
  leaf: Leaf = new Leaf(3);
}
