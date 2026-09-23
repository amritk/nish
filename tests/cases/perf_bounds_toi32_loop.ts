// WP15 §2: only `toI32(w.length)` is a length. The conversion of anything
// else proves nothing about `w`, so each access below keeps its bounds check
// and warns, naming the guard. Both loops happen to stay in range, which the
// analysis does not know: it proves shapes, not arithmetic.
export const main = (): i32 => {
  const s = "hello";
  const xs = [3, 1, 2];

  // One less than a length is not a length.
  const lastIndex: i32 = toI32(s.length - 1);
  let codes: i32 = 0;
  let i: i32 = 0;
  while (i < lastIndex) {
    codes += toI32(s.charCodeAt(i));
    i += 1;
  }

  // An element of the array is not its length.
  const bound: i32 = toI32(xs[0]);
  let total: i32 = 0;
  let j: i32 = 0;
  while (j < bound) {
    total += xs[j];
    j += 1;
  }

  console.log(codes);
  console.log(total);
  return 0;
};
