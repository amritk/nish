// NL1021: `Function(...)` called without `new` is refused by its own Phase 0 rule, not by the `new Function` one.
export const main = (): i32 => {
  const s: string = Function("return 1");
  return 0;
};
