// A braced escape one past the last code point, 0x10FFFF, is refused with
// TypeScript's wording.
export const main = (): i32 => {
  console.log("\u{110000}");
  return 0;
};
