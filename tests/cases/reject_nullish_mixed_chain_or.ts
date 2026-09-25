// WP32: a chain that mixes `??` and `||` more than once is one syntax error, and
// the `?? 3` after the mix is read on rather than blamed on the next statement.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const ok = m.get("a") ?? 1 || 2 ?? 3;
  return 0;
};
