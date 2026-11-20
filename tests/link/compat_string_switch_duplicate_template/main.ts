// A template with no substitution is the same label as the literal it
// spells.
const pick = (s: string): i32 => {
  switch (s) {
    case `x`:
      return 2;
    case "y":
      return 3;
    case "x":
      return 4;
    default:
      return 0;
  }
};

export const main = (): i32 => pick("b");
