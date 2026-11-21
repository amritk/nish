// `panic` ends the path; it is not an expression with a value.
const f = (n: number): number => {
  return panic("nope");
};
