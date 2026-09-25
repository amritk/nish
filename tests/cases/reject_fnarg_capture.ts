// WP29: an arrow argument is lifted into a function of its own, so reading a
// local of the function it is written in is a capture, and is refused by name.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const step = 3;
  return apply((x) => x + step, 2);
};
