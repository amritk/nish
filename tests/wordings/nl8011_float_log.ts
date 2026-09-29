// NL8011: a double printed by `console.log` shows -0 as 0 here.
export const main = (): number => {
  const zero: f64 = -0.0;
  console.log(zero);
  return 0;
};
