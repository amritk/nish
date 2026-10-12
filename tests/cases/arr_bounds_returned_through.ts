// A helper may hand its fresh array to a function of the same module whose
// parameter keeps the length: one that only indexes it, reads its `.length`,
// pushes to it, or hands it on to another such parameter, recursion included.
// The call still starts the caller's array with the length the helper built.
const fillFrom = (xs: i32[], at: i32, v: i32): void => {
  if (at >= 0 && at < xs.length) {
    xs[at] = v;
    fillFrom(xs, at + 1, v + 1);
  }
};

const seed = (xs: i32[]): void => {
  fillFrom(xs, 0, 1);
  xs.push(xs.length);
};

const counted = (): i32[] => {
  const arr = new Array<i32>(6);
  seed(arr);
  return arr;
};

const ends = (): i32 => {
  const ys = counted();
  return ys[0] + ys[5];
};

export const main = (): number => {
  console.log(`${ends()}`);
  return 0;
};
