// WP32: the narrowing holds inside the `if`, and not after it, as for `null`.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const a = m.get("a");
  if (a !== undefined) {
    console.log(`${a}`);
  }
  return a;
};
