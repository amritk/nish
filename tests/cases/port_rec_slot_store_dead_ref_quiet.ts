// WP33 NL8004, the quiet side: a store over a slot is only reported while an
// element reference into the same array is live and read after it. Nothing
// below is: a reference last read before the store, one whose block ended
// before it, one taken afresh on each pass of the loop that stores, one into an
// array of another record, and a field store into the element, which the
// reference sees in both readings.
interface Point {
  x: i32;
  y: i32;
}

interface Size {
  w: i32;
  h: i32;
}

export const main = (): number => {
  const ps: Point[] = [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ];
  const r = ps[0];
  console.log(r.x);
  ps[0] = { x: 3, y: 3 };

  if (ps.length > 1) {
    const inner = ps[1];
    console.log(inner.x);
  }
  ps[1] = { x: 4, y: 4 };

  for (let i = 0; i < 2; i = i + 1) {
    const each = ps[i];
    console.log(each.y);
    ps[i] = { x: i, y: i };
  }

  const sizes: Size[] = [{ w: 1, h: 1 }];
  const at = ps[0];
  sizes[0] = { w: 5, h: 5 };
  console.log(at.x + sizes[0].w);

  const held = ps[1];
  ps[1].x = 8;
  console.log(held.x);
  return 0;
};
