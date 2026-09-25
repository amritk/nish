// WP32: `V | undefined` is never in memory, so it cannot be stored in a field.
class Box {
  v: i32 = 0;
}
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const b = new Box();
  b.v = m.get("a");
  return b.v;
};
