// WP32 (docs/wp32-map.md §6.2): two exit edges no other case pins. A `break`
// out of a `switch` inside a walk leaves the switch, not the walk, so it must
// not close it; a `return` from inside the switch must. And the receiver is
// evaluated once, where the loop is entered, so a walk whose variable is
// reassigned mid-loop closes the table it opened, not the one the variable
// names by then. Each is run 300 times and every table's churn is then flat,
// which it is only when its count of live walks is back to zero.
const retInSwitch = (m: Map<i32, i32>): i32 => {
  for (const k of m.keys()) {
    switch (k) {
      case 2:
        return k * 7;
      case 1:
        break;
      default:
        continue;
    }
  }
  return -1;
};

const reassign = (a: Map<number, number>, b: Map<number, number>): number => {
  let m = a;
  let n = 0;
  for (const k of m.keys()) {
    n += k;
    m = b;
  }
  return n + m.size;
};

// Whether churn on `m` allocates nothing once warm: true only when its
// rebuilds compact, which they do only while no walk of `m` is counted open.
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

const churnsFlatI32 = (m: Map<i32, i32>): boolean => {
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
  const s = new Map<i32, i32>();
  const keys: i32[] = [1, 3, 2, 4];
  for (const k of keys) {
    s.set(k, k);
  }
  let r: i32 = 0;
  for (let i = 0; i < 300; i++) {
    r = retInSwitch(s);
  }
  const a = new Map<number, number>();
  const b = new Map<number, number>();
  a.set(1, 1).set(2, 2).set(3, 3);
  b.set(10, 10);
  let n = 0;
  for (let i = 0; i < 300; i++) {
    n = reassign(a, b);
  }
  console.log(`switch ${r} flat ${churnsFlatI32(s)}`);
  console.log(`reassign ${n} flat ${churnsFlat(a)} ${churnsFlat(b)}`);
  return 0;
};
