// `satisfies` is a type-level assertion Phase 1 has no meaning for.
export const run = (n: number): number => {
  const t = n satisfies number;
  return t;
};
