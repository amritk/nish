// A compound store whose right side shrinks the array: the index is proven
// for the read, but the store checks it again after the right side ran, so
// it panics rather than writing past the end, as native does.
const shrink = (xs: i32[]): i32 => {
  xs.pop();
  return 1;
};

export const main = (): i32 => {
  const ys: i32[] = [4, 5];
  if (ys.length > 1) {
    ys[1] += shrink(ys);
  }
  console.log("unreachable");
  return 0;
};
