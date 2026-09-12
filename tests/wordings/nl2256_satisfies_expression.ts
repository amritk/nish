// NL2256: `satisfies` is still in the not-implemented-yet bucket, and reports as a Phase 1 gap.
export const main = (): i32 => {
  const x = 1 satisfies i32;
  return 0;
};
