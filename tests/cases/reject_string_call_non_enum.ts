// `String` converts a string enum's value and nothing else: on a number it
// stays an unknown function, and the fix is the template literal.
export const main = (): i32 => {
  const n: i32 = 7;
  console.log(String(n));
  return 0;
};
