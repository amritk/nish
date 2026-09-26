// A braced escape above 0x10FFFF is refused as TypeScript refuses it. Before the
// limit, U+10000D800 wrapped round in i32 to 0xD800, a high surrogate, and was
// joined with the independently written low surrogate after it.
export const main = (): i32 => {
  console.log("\u{10000D800}\uDC00");
  return 0;
};
