// An append loop whose guards fail runs as written, so it panics where it
// always did. `pastEnd` reads `src[4]` of four after pushing two elements.
// `wraps` overflows the offset `at * 2`, which the copy's guard evaluates
// only once the loop is known to run, as the first iteration would; `test`
// hands the same offset to a loop that runs no iteration and does not panic.
// `arr_append_range_panic.c` runs each panicking call in a child and prints
// its message and exit status.
const append = (dst: u8[], src: u8[], at: i32, n: i32): i32 => {
  for (let j: i32 = 0; j < n; j++) {
    dst.push(src[at * 2 + j]);
  }
  return dst.length;
};

const four = (): u8[] => [1, 2, 3, 4];

export const pastEnd = (): i32 => append([], four(), 1, 3);

export const wraps = (): i32 => append([], four(), 1073741824, 1);

export const test = (): i32 => append([], four(), 0, 3) * 10 + append([], four(), 1073741824, 0);
