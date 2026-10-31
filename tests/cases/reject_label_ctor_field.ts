// A `break` out of a labelled block skips the rest of it, so a field the block
// assigns after the `break` is not definitely assigned when the constructor
// returns.
class Point {
  x: number;
  constructor(early: boolean) {
    init: {
      if (early) {
        break init;
      }
      this.x = 1;
    }
  }
}

export function test(): number {
  return new Point(false).x;
}
