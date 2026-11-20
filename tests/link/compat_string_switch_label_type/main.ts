// Every label of a `string` switch is a `string`: a number label could never
// equal the subject, so it is refused.
const pick = (s: string): i32 => {
  switch (s) {
    case "a":
      return 1;
    case 2:
      return 2;
    default:
      return 0;
  }
};

export const main = (): i32 => pick("b");
