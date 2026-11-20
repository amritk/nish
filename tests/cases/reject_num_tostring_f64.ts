// An `f64` gets the same hint as an integer, and the parentheses around the
// receiver are not part of the spelling it names (#1632).
export const main = (): i32 => {
  const ratio: f64 = 1.5;
  console.log((ratio).toString());
  return 0;
};
