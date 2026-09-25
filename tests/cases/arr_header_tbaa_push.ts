// A header written by `push` in a callee, with class-field stores on either
// side. The callee pushes past the capacity, so `nish_array_grow` moves `data`
// as well as the length. The second `b.xs.length` and `b.xs[0]` have to be
// reloaded after the call: nothing the header tag says lets LLVM reuse the
// values it read before, because the callee's own `push` writes the header
// with the same tag, and the runtime's `nish_array_grow` is a call.
class Bag {
  xs: i32[];
  count: i32 = 0;
  next: Bag | null = null;

  constructor() {
    this.xs = [7];
  }
}

const fill = (b: Bag, n: i32): void => {
  for (let i = 0; i < n; i += 1) {
    b.xs.push(i + 10);
    b.count = b.count + 1;
  }
};

export const test = (): i32 => {
  const b = new Bag();
  const before = b.xs.length;
  const first = b.xs[0];
  b.count = 100;
  b.next = null;
  fill(b, 20);
  b.next = b;
  const after = b.xs.length;
  return before * 1000000 + after * 10000 + b.xs[0] * 1000 + b.xs[20] * 10 + first - b.count;
};
