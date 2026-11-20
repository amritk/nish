// Two labels of the same text are refused, a module constant included: the
// second clause could never be chosen.
const A: string = "a";

const pick = (s: string): i32 => {
  switch (s) {
    case "a":
      return 1;
    case A:
      return 2;
    default:
      return 0;
  }
};

export const main = (): i32 => pick("b");
