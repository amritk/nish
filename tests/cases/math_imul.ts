// Math.imul is one `mul i32` with no overflow check: the low 32 bits of the product, read
// signed, which is what JavaScript's answers. An i32 and a u32 are the same bits.
export const imul = (a: i32, b: i32): i32 => Math.imul(a, b);
export const imulU = (a: u32, b: u32): i32 => Math.imul(a, b);

// FNV-1a over a byte string, the idiom it exists for.
const fnv = (s: string): i32 => {
  let h = -2128831035;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h;
};

export const main = (): i32 => {
  console.log(`${imul(3, 4)} ${imul(2147483647, 2)} ${imul(-2147483648, -1)} ${imul(65537, 65537)}`);
  const all: u32 = 4294967295;
  console.log(`${imulU(all, toU32(5))} ${imulU(all, all)}`);
  console.log(`${fnv("")} ${fnv("nish")}`);
  return 0;
};
