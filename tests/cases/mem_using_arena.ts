// `using a = arena()` marks the arena where it is declared and releases to the
// mark when its block ends, so the strings and the array storage the block
// allocates are gone afterwards and the arena is the same height as before it
// (the `Point` is a stack slot, which needs no release). The golden is the
// bracket: `nish_arena_mark` at the declaration, kept in the binding's slot,
// and `nish_arena_release` of it as the block falls through.
class Point {
  x: i32;
  y: i32;

  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

export const main = (): void => {
  const before = Arena.used();
  let total = 0;
  {
    using a = arena();
    const label = `point ${total}`;
    const xs: i32[] = [];
    for (let i = 0; i < 100; i++) {
      xs.push(i);
    }
    const p = new Point(xs.length, label.length);
    total = p.x + p.y;
  }
  const after = Arena.used();
  console.log(`${total}`);
  console.log(after === before ? "released" : "kept");
};
