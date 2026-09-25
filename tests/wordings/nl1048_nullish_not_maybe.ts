// NL1048: `??` whose left operand is not a `Map.get` result.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const p: string | null = null;
  return (p ?? "x").length;
};
