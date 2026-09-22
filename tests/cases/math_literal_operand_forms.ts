// `-5` and `(5)` count as the literal (docs/LANGUAGE.md, "Numeric literals"), so a
// signed or parenthesised literal on the *left* of a binary operator takes the other
// operand's type exactly as a bare one does. stage1 matched only the bare spelling and
// refused every line below, on a shape two whole programs of
// tests/differential/corpus already wrote (WP19 §A9, the sixth entry in §A5's series).
export const main = (): number => {
  const z: f64 = 2;
  const big: i64 = 3000000000;
  console.log(`${-1 / z} ${(1) / z} ${-1 * z} ${-1 - z}`);
  console.log(`${-1 * big} ${-1 + big}`);
  console.log(`${-1 < z} ${-1 === z} ${(-2) >= z}`);
  return 0;
};
