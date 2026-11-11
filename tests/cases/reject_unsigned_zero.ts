// A u32 is never negative, so this guard never fires: the bound was meant to
// be checked before the subtraction wrapped (NL2717).
const remaining = (have: u32, take: u32): u32 => {
  const left: u32 = have - take;
  if (left < 0) {
    return 0;
  }
  return left;
};

export const main = (): i32 => {
  console.log(`${remaining(toU32(5), toU32(3))}`);
  return 0;
};
