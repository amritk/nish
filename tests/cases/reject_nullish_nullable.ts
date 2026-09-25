// WP32: `??` on a `T | null` keeps the Phase 0 refusal; narrow with `!== null`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const p: string | null = null;
  return (p ?? "x").length;
};
