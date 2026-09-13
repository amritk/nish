// WP15 §2a: an array of records is one contiguous block, so `ps[i]` is an
// interior `getelementptr` and a field read is one more, with no pointer to
// chase in between. The golden pins the stride (8 = sizeof(Point)) and the
// absence of a load between the two GEPs.
//
// It also pins something §2a did not put there: `ps[1]` on a two-element
// literal is proved in range by §2.1/§2.2, so the golden has no length load,
// no `bounds.fail` block and no `@nish_panic_index` declaration at all — the
// two items compose, and an index that is both a record slot and a proven one
// costs neither the pointer chase nor the check. `arr_struct_push_copy` is the
// control: its index is not provable, and it keeps its check.
interface Point {
  x: number;
  y: number;
}

export const test = (): number => {
  const ps: Point[] = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
  ];
  ps[1].x = 10;
  let sum = 0;
  for (const p of ps) {
    sum = sum + p.x + p.y;
  }
  return sum;
};
