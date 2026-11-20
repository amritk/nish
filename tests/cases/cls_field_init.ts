// `[]` and `new C(args)` as field initializers: each object gets its own
// fresh array and child, stored before the constructor's body in
// declaration order, or at `new` for a class without a constructor.
enum Shade {
  Light,
  Dark,
}

class Leaf {
  tag: string;
  value: i32;
  shade: Shade;

  constructor(value: i32, tag: string = "leaf", shade: Shade = Shade.Light) {
    this.value = value;
    this.tag = tag;
    this.shade = shade;
  }
}

// No constructor: the initializers are stored at `new`.
class Bag {
  items: i32[] = [];
  names: string[] = [];
  count: i32 = 0;
}

// A constructor: the initializers are stored before its first statement,
// so the body sees them already there.
class Tree {
  kind: i32[] = [];
  left: Leaf = new Leaf(7);
  right: Leaf | null = new Leaf(-3, "right", Shade.Dark);
  bag: Bag = new Bag();

  constructor(first: i32) {
    this.kind.push(first);
    this.left.value = this.left.value + first;
  }
}

// Nested: a class whose initializer constructs a class with initializers.
class Forest {
  trees: Tree[] = [];
  root: Tree = new Tree(1);
}

export const main = (): i32 => {
  const a = new Bag();
  const b = new Bag();
  a.items.push(1);
  a.items.push(2);
  b.names.push("only");
  console.log(a.items.length);
  console.log(b.items.length);
  console.log(b.names[0]);

  const t = new Tree(5);
  console.log(t.kind.length);
  console.log(t.kind[0]);
  console.log(t.left.value);
  console.log(t.left.tag);
  const right = t.right;
  if (right !== null) {
    console.log(right.value);
    console.log(right.tag);
    console.log(right.shade === Shade.Dark);
  }
  t.bag.items.push(9);
  console.log(new Tree(2).bag.items.length);
  console.log(t.bag.items.length);

  const f = new Forest();
  f.trees.push(f.root);
  console.log(f.trees.length);
  console.log(f.root.left.value);
  return 0;
};
