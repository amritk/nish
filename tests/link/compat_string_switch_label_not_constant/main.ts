// A `string` switch compares its subject with constant labels only: a label
// read from a local is refused (NL2799), as an integer switch refuses one.
const pick = (s: string, other: string): i32 => {
  switch (s) {
    case "a":
      return 1;
    case other:
      return 2;
    default:
      return 0;
  }
};

export const main = (): i32 => pick("b", "c");
