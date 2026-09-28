// NL2395: `set` and `fill` copy bytes, so the receiver's elements are numbers.
export const main = (): i32 => {
  const a: string[] = ["x"];
  a.fill("y");
  return 0;
};
