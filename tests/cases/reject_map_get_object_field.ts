// WP32: nor in an object literal's field.
interface Pair {
  v: i32;
}
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const p: Pair = { v: m.get("a") };
  return p.v;
};
