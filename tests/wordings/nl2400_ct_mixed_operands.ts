// NL2400: the mask and both candidates are one type.
export const main = (): i32 => {
  const m: u32 = 0;
  const a: u64 = 1;
  const r: u64 = ctSelect(m, a, a);
  return 0;
};
