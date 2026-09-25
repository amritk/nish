// WP32: nor an argument of a constructor.
class Box {
  v: i32;
  constructor(v: i32) {
    this.v = v;
  }
}
export const main = (): i32 => {
  const m = new Map<string, i32>();
  return new Box(m.get("a")).v;
};
