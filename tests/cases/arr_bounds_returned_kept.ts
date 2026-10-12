// Helpers whose returned length the rule does not read. Each function below
// keeps its one bounds check: a size the call does not fix, a size the body
// computes, a generic helper, a body with an arrow in it, a method, and a
// store whose receiver is a `let`.
const filled = (n: i32): i32[] => {
  const arr = new Array<i32>(n);
  return arr;
};

const computed = (): i32[] => {
  const k = 4;
  const arr = new Array<i32>(k);
  return arr;
};

const shadowed = (n: i32): i32[] => {
  const arr = new Array<i32>(n);
  for (let i = 0; i < 1; i++) {
    const n = i;
    arr[0] = n;
  }
  return arr;
};

const generic = <T>(v: T): T[] => {
  const arr = new Array<T>(4);
  arr[0] = v;
  return arr;
};

const twice = (f: (x: i32) => i32, v: i32): i32 => f(f(v));

const arrowed = (): i32[] => {
  const arr = new Array<i32>(4);
  arr[0] = twice((x) => x + 1, 0);
  return arr;
};

class Box {
  items: i32[];

  constructor() {
    this.items = [];
  }

  make(): i32[] {
    const arr = new Array<i32>(4);
    return arr;
  }
}

const unknownSize = (n: i32): i32 => {
  const xs = filled(n);
  return xs[3];
};

const computedSize = (): i32 => {
  const xs = computed();
  return xs[3];
};

const shadowedSize = (): i32 => {
  const xs = shadowed(4);
  return xs[3];
};

const genericSize = (): i32 => {
  const xs = generic(1);
  return xs[3];
};

const arrowSize = (): i32 => {
  const xs = arrowed();
  return xs[3];
};

const methodSize = (b: Box): i32 => {
  const xs = b.make();
  return xs[3];
};

const letReceiver = (): i32 => {
  let b = new Box();
  b.items = filled(4);
  return b.items[3];
};

export const main = (): number => {
  const total =
    unknownSize(parseInt("4")) +
    computedSize() +
    shadowedSize() +
    genericSize() +
    arrowSize() +
    methodSize(new Box()) +
    letReceiver();
  console.log(`${total}`);
  return 0;
};
