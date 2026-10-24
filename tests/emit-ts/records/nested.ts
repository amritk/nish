// `a[b[i]]` with neither index proven: both reads are checked, the inner
// one first, and a store and a compound store through a checked slot keep
// the order of evaluation. The indices come from an array, so no caller
// proves them. A compound store hoists its element-read index into a const,
// since --emit-ts will not read such a target twice.
const pick = (a: i32[], b: i32[], i: i32): i32 => a[b[i]];

const bump = (a: i32[], b: i32[], i: i32): i32 => {
  const k = b[i];
  a[k] += 10;
  a[i] -= 1;
  a[b[i]] = a[i] * 2;
  return a[b[i]];
};

export const main = (): number => {
  const a = [5, 6, 7];
  const b = [2, 0, 1];
  const ks = [0, 2, 1];
  console.log(`${pick(a, b, ks[0])} ${pick(a, b, ks[1])}`);
  console.log(`${bump(a, b, ks[2])} ${a[0]} ${a[1]} ${a[2]}`);
  const last = a.pop();
  console.log(`${last} ${a.length}`);
  return 0;
};
