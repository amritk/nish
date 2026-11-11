// NL2706: Node copies every own field of a class instance, so one is spread only into a
// type that declares each of them.
interface Point {
  x: i32;
}

class Tagged {
  x: i32 = 1;
  tag: i32 = 2;
}

export const main = (): i32 => {
  const p: Point = { ...new Tagged() };
  return p.x;
};
