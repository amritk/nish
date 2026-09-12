// NL1032: `Symbol` in a type position has a Phase 0 rule of its own, separate from `Symbol` as a value.
export const main = (): i32 => {
  const s: Symbol = 1;
  return 0;
};
