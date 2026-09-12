// NL2258: An object literal sets fields; a method in one has no slot to live in.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const p: Point = {
    x(): i32 {
      return 1;
    },
  };
  return p.x;
};
