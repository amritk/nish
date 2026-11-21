// What a constructor-less class's allocating initializer stores outlives the
// function that ran `new`: the `[]` or `new` it allocated is the object's,
// and a field read hands it on. The debug-arena run unmaps every released
// block, so a function that released it would trap here.
class Leaf {
  n: i32 = 0;
}

class Outer {
  child: Leaf = new Leaf();
}

class Bag {
  items: i32[] = [];
}

class C {
  n: i32 = 0;
}

class B {
  c: C = new C();
}

class A {
  b: B = new B();
}

class Holder {
  leaf: Leaf | null = null;
}

// The `new` initializer, returned.
const makeLeaf = (): Leaf => {
  const o = new Outer();
  o.child.n = 4242;
  return o.child;
};

// The `[]` initializer, returned.
const makeItems = (): i32[] => {
  const b = new Bag();
  b.items.push(17);
  return b.items;
};

// Two levels down.
const makeDeep = (): C => {
  const a = new A();
  a.b.c.n = 31;
  return a.b.c;
};

// Stored into an object the caller holds.
const fill = (h: Holder): void => {
  const o = new Outer();
  o.child.n = 55;
  h.leaf = o.child;
};

// Handed to a callee that keeps it.
const keep = (into: Leaf[], leaf: Leaf): void => {
  into.push(leaf);
};

const share = (into: Leaf[]): void => {
  const o = new Outer();
  o.child.n = 66;
  keep(into, o.child);
};

// Captured by a closure that stores it where the caller reads it.
const each = (f: () => void): void => {
  f();
};

const capture = (into: Leaf[]): void => {
  const o = new Outer();
  o.child.n = 77;
  each((): void => {
    into.push(o.child);
  });
};

const churn = (): i32 => {
  let sum = 0;
  for (let i = 0; i < 64; i++) {
    const xs: i32[] = [i, i + 1, i + 2, i + 3];
    sum = sum + xs[3];
  }
  return sum;
};

export const main = (): i32 => {
  const leaf = makeLeaf();
  const items = makeItems();
  const deep = makeDeep();
  const h = new Holder();
  fill(h);
  const kept: Leaf[] = [];
  share(kept);
  capture(kept);

  // A loop pass's object, kept past the pass.
  let last: Leaf | null = null;
  for (let i = 0; i < 3; i++) {
    const o = new Outer();
    o.child.n = 100 + i;
    last = o.child;
  }

  console.log(churn());
  console.log(leaf.n);
  console.log(items.length);
  console.log(items[0]);
  console.log(deep.n);
  const stored = h.leaf;
  if (stored !== null) {
    console.log(stored.n);
  }
  console.log(kept[0].n);
  console.log(kept[1].n);
  if (last !== null) {
    console.log(last.n);
  }
  return 0;
};
