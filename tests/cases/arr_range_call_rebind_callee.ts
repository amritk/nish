// WP15 §2.4: the callee rebinds the path before it reads it. Every call to
// `take` is entered with `this.v.length >= 6`, but `take` stores `this.v = []`
// before its access, and a store to `v` drops every fact on a path through
// it, the entry facts included. The check stays and panics with
// `index out of range: 2 >= 0`.
class Box {
  v: i32[];

  constructor() {
    this.v = new Array<i32>(6);
  }

  take(i: i32): i32 {
    this.v = [];
    return this.v[i];
  }
}

export const main = (): number => {
  const b = new Box();
  b.v = new Array<i32>(6);
  console.log(`${b.take(2)}`);
  return 0;
};
