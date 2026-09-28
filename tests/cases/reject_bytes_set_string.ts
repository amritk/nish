// NL2395: `set` copies bytes, so its receiver's elements are numbers; a
// `string[]` holds pointers, which a byte copy would share rather than copy.
export const main = (): i32 => {
  const a: string[] = ["x", "y"];
  const b: string[] = ["z"];
  a.set(b);
  return 0;
};
