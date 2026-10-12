// `String.fromBytes(bytes, start, end)`: the bytes of `[start, end)` as one
// string, one bounds check, one allocation and one copy. A range that ends at
// `bytes.length` and an empty range are in range; the bytes are not validated
// as UTF-8, so a multi-byte character copied whole prints as itself. A string
// a helper returns is the caller's, so it outlives the helper's arena scope.
const word = (bytes: u8[], start: i32, end: i32): string => String.fromBytes(bytes, start, end);

const fixed = (bytes: readonly u8[]): string => String.fromBytes(bytes, 0, 2);

export const main = (): number => {
  const bytes: u8[] = [104, 101, 108, 108, 111, 32, 195, 169];
  console.log(word(bytes, 0, 5));
  console.log(word(bytes, 6, 8));
  const empty = word(bytes, 3, 3);
  console.log(`[${empty}] ${empty.length}`);
  console.log(word(bytes, 0, toI32(bytes.length)).length);
  console.log(fixed(bytes));
  return 0;
};
