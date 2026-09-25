// A store to a field named on the path forgets what a check on that path
// proved, through `this` or through any other holder of a struct with that
// field name, because the walk cannot tell whether `other` is `this`. Each
// repeat keeps its check. A store into an element leaves the path alone.
class Holder {
  v: i32[];

  constructor(v: i32[]) {
    this.v = v;
  }

  rebind(i: i32, fresh: i32[]): i32 {
    const a = this.v[i];
    this.v = fresh;
    return a + this.v[i];
  }

  rebindThrough(i: i32, other: Holder, fresh: i32[]): i32 {
    const a = this.v[i];
    other.v = fresh;
    return a + this.v[i];
  }

  elementStore(i: i32): i32 {
    const a = this.v[i];
    this.v[0] = a;
    return a + this.v[i];
  }
}

export const test = (): number => {
  const h = new Holder([1, 2, 3]);
  const r = h.rebind(2, [4, 5, 6]);
  return r + h.rebindThrough(1, h, [7, 8, 9]) + h.elementStore(2);
};
