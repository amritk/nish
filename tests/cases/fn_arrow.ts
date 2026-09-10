// WP22: the arrow form of a function declaration. A concise body (`=> expr`)
// means exactly what a block with one `return` means, and both lower to the
// instructions the `function` spelling lowers to.
const double = (n: i32): i32 => n * 2;

const describe = (n: i32): string => {
  if (n > 10) {
    return "big";
  }
  return "small";
};

const sumTo = (n: i32): i32 => (n <= 0 ? 0 : n + sumTo(n - 1));

export const main = (): number => {
  console.log(`${double(21)}`);
  console.log(describe(50));
  console.log(describe(1));
  console.log(`${sumTo(10)}`);
  return 0;
};
