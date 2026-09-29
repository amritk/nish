// `fill` answers its receiver in JavaScript, which the program already holds,
// so in Nish it is a statement and its value cannot be taken.
export const main = (): i32 => {
  const a: u8[] = [0, 0];
  const r = a.fill(0);
  return 0;
};
