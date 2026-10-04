// --deny-panics with the deprecated --wrapping: the entry package's operators
// wrap, so nothing is checked and nothing is a site, and an addition no proof
// bounds is accepted.
const sum = (a: i32, b: i32): i32 => a + b;

export const main = (): number => {
  console.log(sum(2147483647, process.argv.length));
  return 0;
};
