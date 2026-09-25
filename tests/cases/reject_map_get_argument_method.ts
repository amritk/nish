// WP32: nor an argument of a method.
class Box {
  use(x: i32): i32 {
    return x;
  }
}
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return new Box().use(m.get("a"));
};
