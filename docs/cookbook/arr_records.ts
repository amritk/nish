interface Point {
  x: f64;
  y: f64;
}

// The whole array is one block of `Point`s, so the loop walks it with a single
// `getelementptr %struct.Point, ..., i64 %i` per element: no pointer to load,
// no second block to chase into, and two adjacent points on one cache line.
const centroidX = (ps: readonly Point[]): f64 => {
  let total: f64 = 0.0;
  for (const p of ps) {
    total = total + p.x;
  }
  return total / toF64(ps.length);
};

// `push` copies the record into the slot, which is why holding `ps[i]` across
// one is a compile error: `nish_array_grow` moves the block the pointer is in.
export const spread = (n: i32): f64 => {
  const ps: Point[] = [];
  let i = 0;
  while (i < n) {
    ps.push({ x: toF64(i), y: toF64(i) * 0.5 });
    i = i + 1;
  }
  return centroidX(ps);
};
