// NL2606: `f(...xs)` is refused: pass the array to a parameter of array type.
const total = (...xs: i32[]): i32 => {
  return xs.length
};
export const main = (): void => {
  const a = [1, 2]
  console.log(total(...a))
};
