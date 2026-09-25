// WP29: `U` is left to the arrow, and a block body has many returns and no
// single type to take, so it has to be annotated.
const map = <T, U>(xs: T[], f: (x: T) => U): U[] => [];

export const main = (): i32 => {
  const out = map([1, 2], (x) => {
    return x + 1;
  });
  return out.length;
};
