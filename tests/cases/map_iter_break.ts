// WP32 (docs/wp32-map.md §6.2): `break` leaves a walk through the same edge as
// the fall-through, which closes it, so the table's count of live walks is
// back to zero and churn afterwards compacts rather than growing.

// Whether churn on `m` — each insert paired with a delete — allocates nothing
// once it has warmed up: true only when its rebuilds compact, which they do
// only while no walk of `m` is still counted open.
const churnsFlat = (m: Map<number, number>): boolean => {
  for (let i = 0; i < 20000; i++) {
    m.set(100000 + i, i);
    m.delete(100000 + i);
  }
  const before = Arena.used();
  for (let i = 0; i < 40000; i++) {
    m.set(200000 + i, i);
    m.delete(200000 + i);
  }
  return Arena.used() === before;
};

export const main = (): i32 => {
  const m = new Map<number, number>();
  for (let i = 0; i < 10; i++) {
    m.set(i, i * 2);
  }
  let seen = 0;
  for (const v of m.values()) {
    if (v === 8) {
      break;
    }
    seen++;
  }
  for (const k of m.keys()) {
    if (k === 1) {
      continue;
    }
    seen += 10;
  }
  console.log(`seen ${seen} flat ${churnsFlat(m)} size ${m.size}`);
  return 0;
};
