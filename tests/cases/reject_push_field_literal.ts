// `xs.push(3)` gives the literal the element type, and that rule reaches only a
// receiver that is a plain name: stage0 finds it through the callee's dotted
// name, which `b.xs.push` does not have. So in f64 mode this pushes an f64 onto
// an `i32[]` — `toI32(0)` is the way to write it — where `ys.push(0)` on a
// local is fine. stage1 applied the element type to both (WP19 §A3).
class Bag {
  xs: i32[];
  constructor() {
    this.xs = [];
  }
}

export function main(): i32 {
  const b = new Bag();
  b.xs.push(0);
  return toI32(b.xs.length);
}
