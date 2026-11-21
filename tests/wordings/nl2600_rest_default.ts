// NL2600: A rest parameter has no default: leaving it out passes `[]`.
const f = (...xs: i32[] = [1]): i32 => {
  return xs.length
};
export const main = (): void => {
  console.log(f())
};
