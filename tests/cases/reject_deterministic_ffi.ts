// --deterministic refuses `ffi` (NL3054): C code computes outside the guarantee.
declare function labs(n: i64): i64;

export const main = (): number => {
  const n: i64 = -9;
  console.log(labs(n));
  return 0;
};
