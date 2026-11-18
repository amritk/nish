// A default naming an earlier parameter has that parameter's type.
const f = (x: i32, y: f64 = x): f64 => {
  return y
};
export const main = (): void => {
  console.log(f(1))
};
