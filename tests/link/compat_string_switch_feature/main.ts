// A dialect without `string-switch` refuses a `switch` over a `string`, and
// the refusal names the feature that admits it.
const pick = (s: string): i32 => {
  switch (s) {
    case "a":
      return 1;
    default:
      return 0;
  }
};

export const main = (): i32 => pick("b");
