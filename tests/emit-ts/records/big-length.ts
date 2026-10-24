// `new Array<T>(n)` at an i64 length: the length goes through `Number` and the
// array is still filled with T's zero, at an i32 and at an i64 element type.
export const main = (): i32 => {
  const n: i64 = 3;
  const xs = new Array<i32>(n);
  const ys = new Array<i64>(n);
  xs[2] += 4;
  console.log(`${xs.length} ${xs[0]} ${xs[2]} ${ys.length} ${ys[1]}`);
  return 0;
};
