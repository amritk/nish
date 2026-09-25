// WP32: assigning `get` to an existing `let` is refused as the `let` initialiser is.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let i = 0;
  i = m.get("a");
  return i;
};
