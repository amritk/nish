// #385: `secureZero(bytes)` sets every byte of a u8[] to zero through
// `nish_wipe`, whose stores no optimisation may drop. A key wiped through a
// parameter, a key wiped where it was made, and an empty array, which is a
// call that clears nothing. That the stores survive `-O2` and `-flto` when
// nothing reads the buffer again is the LTO probe in tests/runtime-test.c.
const sum = (b: u8[]): i32 => {
  let s = 0;
  for (const x of b) {
    s = s + toI32(x);
  }
  return s;
};

// The array is a parameter the call writes through, so it must not be
// declared `readonly` in the IR.
const forget = (key: u8[]): void => {
  secureZero(key);
};

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3, 250, 251, 252];
  console.log(sum(key));
  forget(key);
  console.log(sum(key));
  const scalar = new Array<u8>(32);
  scalar.fill(165);
  console.log(sum(scalar));
  secureZero(scalar);
  console.log(sum(scalar));
  console.log(scalar.length);
  const empty = new Array<u8>(0);
  secureZero(empty);
  console.log(empty.length);
  return 0;
};
