// WP33 NL8004: an element reference points into the array's block, so a store
// over its slot is what it reads from then on natively, while in TypeScript it
// still holds the object the slot held before. Reported at the store, naming
// the reference and the line it is read on: straight-line, over the variable
// of a `for ... of`, and in a loop whose store at the bottom reaches a read at
// the top on the next pass.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): number => {
  const ps: Point[] = [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ];
  const r = ps[0];
  const q: Point = { x: 9, y: 9 };
  ps[0] = q;
  console.log(r.x);

  for (const e of ps) {
    ps[1] = { x: e.x + 5, y: 0 };
    console.log(e.x);
  }

  const first = ps[0];
  for (let i = 0; i < 2; i = i + 1) {
    console.log(first.y);
    ps[0] = { x: i, y: i + 10 };
  }
  return 0;
};
