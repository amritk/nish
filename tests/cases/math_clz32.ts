// Math.clz32 is llvm.ctlz.i32 with `i1 false`, so a zero answers 32 as JavaScript's
// does. An i32 and a u32 are the same bits, the ones ToUint32 gives, so -1 answers 0.
// `lowestBit` is the idiom it exists for: the index of a word's lowest set bit.
export const clz = (x: i32): i32 => Math.clz32(x);
export const clzU = (x: u32): i32 => Math.clz32(x);

const lowestBit = (word: u32): i32 => 31 - Math.clz32(word & (0 - word));

export const main = (): i32 => {
  console.log(`${clz(0)} ${clz(1)} ${clz(-1)} ${clz(65536)} ${clz(2147483647)}`);
  const top: u32 = 2147483648;
  const all: u32 = 4294967295;
  console.log(`${clzU(top)} ${clzU(all)} ${clzU(toU32(255))}`);
  console.log(`${lowestBit(toU32(40))} ${lowestBit(top)} ${lowestBit(toU32(1))}`);
  return 0;
};
