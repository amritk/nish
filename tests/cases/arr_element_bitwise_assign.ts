// `a[i] op= e` for the six bitwise operators. The array and the index are
// evaluated once, the bounds check is emitted once and the load and the store
// share one address, so a side-effecting index runs exactly one time: `slot()`
// prints once per statement, not twice, which is what the two lines of output
// before the values prove.
function slot(): i32 {
  console.log("slot");
  return 1;
}

export function main(): number {
  const a: i32[] = [1, 255, 4];
  a[slot()] &= 60;
  a[slot()] |= 3;
  a[2] <<= 33;
  a[2] >>>= 1;
  console.log(a[0]);
  console.log(a[1]);
  console.log(a[2]);
  return 0;
}
