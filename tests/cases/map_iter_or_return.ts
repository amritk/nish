// WP32 (docs/wp32-map.md §6.2): `orReturn()` is an exit edge too. An error it
// propagates from inside a walk leaves the walk, which is closed on that edge
// as on a `return`, so churn afterwards compacts rather than growing.
const check = (v: i32): Result<i32, string> => {
  if (v < 0) {
    return Err(`negative ${v}`);
  }
  return Ok(v);
};

const total = (m: Map<i32, i32>): Result<i32, string> => {
  let sum: i32 = 0;
  for (const v of m.values()) {
    sum += check(v).orReturn();
  }
  return Ok(sum);
};

const churnsFlat = (m: Map<i32, i32>): boolean => {
  for (let i: i32 = 0; i < 20000; i++) {
    m.set(100000 + i, i);
    m.delete(100000 + i);
  }
  const before = Arena.used();
  for (let i: i32 = 0; i < 40000; i++) {
    m.set(200000 + i, i);
    m.delete(200000 + i);
  }
  return Arena.used() === before;
};

export const main = (): i32 => {
  const m = new Map<i32, i32>();
  m.set(1, 5).set(2, -3).set(3, 7);
  const r = total(m);
  if (r.ok) {
    console.log(`ok ${r.value}`);
  } else {
    console.log(`err ${r.error}`);
  }
  m.set(2, 3);
  const s = total(m);
  console.log(`${s.ok} flat ${churnsFlat(m)}`);
  return 0;
};
