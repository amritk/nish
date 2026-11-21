// --deny-panics reads a named integer constant as its value: a module `const`
// sizes `new Array` with no length check, and a divisor tested against
// `toU64(0)` or a function-level `const zero` divides with no zero test.
const N: i32 = 8;

const filled = (): u32[] => new Array<u32>(N);

const mod = (a: u64, b: u64): u64 => (b === toU64(0) ? a : a % b);

const rem = (a: u64, b: u64): u64 => {
  const zero: u64 = 0;
  return b === zero ? a : a % b;
};

export const main = (): number => {
  const max: u64 = 9007199254740991;
  console.log(filled().length);
  console.log(toI32(mod(toU64(17), toU64(5))));
  console.log(toI32(mod(toU64(17), toU64(0))));
  console.log(toI32(rem(toU64(max), toU64(7))));
  console.log(toI32(rem(toU64(9), toU64(0))));
  return 0;
};
