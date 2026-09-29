// NL2399: the constant-time builtins take the unsigned words u32 and u64 only.
export const main = (): i32 => {
  const a: i32 = 1;
  const m: i32 = ctEq(a, a);
  return m;
};
