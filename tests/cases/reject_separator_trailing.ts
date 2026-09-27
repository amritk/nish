// A separator at the end of a literal; tsc: TS6188.
export const main = (): i32 => {
  const ten: i32 = 10_;
  console.log(`${ten}`);
  return 0;
};
