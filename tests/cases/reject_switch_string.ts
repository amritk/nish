// Only an integer `switch` lowers to a jump table, so the strict dialect
// rejects a string discriminant, naming `string-switch`: `--compat` admits it
// as a chain of string comparisons (tests/compat-erasure.js runs it there).
const f = (s: string): number => {
  switch (s) {
    case "a":
      return 1;
    default:
      return 0;
  }
};

export const main = (): void => {
  console.log(`${f("a")} ${f("b")}`);
};
