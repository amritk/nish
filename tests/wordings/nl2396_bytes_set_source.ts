// NL2396: `set` copies from an array of the receiver's own element type.
export const main = (): i32 => {
  const a: f64[] = [0.0];
  const b: u8[] = [1];
  a.set(b);
  return 0;
};
