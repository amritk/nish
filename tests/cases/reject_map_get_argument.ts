// WP32 (§3.1 H): `V | undefined` does not cross a call, so it is no argument of a function.
const use = (x: i32): i32 => x;
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return use(m.get("a"));
};
