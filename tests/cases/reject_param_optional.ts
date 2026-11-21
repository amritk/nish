// `x?: T` stays refused: a parameter a call may leave out has a default.
const f = (x: i32, y?: i32): i32 => {
  return x
};
export const main = (): void => {
  console.log(f(1))
};
