// A loop that pushes `src[at + j]` for each `j` below `n` is one `memcpy`
// (`emitAppendRange` in src/emit-arrays.ts): the guards check the loop runs,
// `at + j` and `at + n - 1` fit and index `src`, and the result fits, then
// the capacity grows to the final length up front and the length is stored
// once. A guard that fails runs the loop as written (`append.slow`).
const append = (dst: u8[], src: u8[], at: i32, n: i32): void => {
  for (let j: i32 = 0; j < n; j++) {
    dst.push(src[at + j]);
  }
};

export const test = (): i32 => {
  const src: u8[] = [1, 2, 3, 4, 5, 6, 7, 8];
  const dst: u8[] = [9];
  append(dst, src, 2, 5); // 9 3 4 5 6 7
  append(dst, src, 7, 0); // runs no iteration: unchanged
  append(dst, dst, 1, 3); // 9 3 4 5 6 7 3 4 5: reads below the old length
  let sum: i32 = 0;
  for (let i: i32 = 0; i < dst.length; i++) {
    sum = sum * 3 + toI32(dst[i]);
  }
  return dst.length * 100000 + sum;
};
