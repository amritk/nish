// WP32: a `get` whose result is dropped is refused by the rule that lists its places.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.get("a");
  return 0;
};
