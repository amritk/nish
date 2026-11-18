// A numeric default fits only a numeric parameter: a string takes a string.
const label = (s: string = 5): i32 => {
  return s.length
};
export const main = (): void => {
  console.log(label("ab"))
};
