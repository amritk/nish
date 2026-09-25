// WP32 (§3.1 I): a `let` cannot hold `V | undefined`: only a `const` is narrowed.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let i = m.get("a");
  return 0;
};
