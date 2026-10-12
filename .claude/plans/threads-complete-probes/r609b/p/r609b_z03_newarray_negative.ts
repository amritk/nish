const neg = (): i32 => -1;
export const main = (): i32 => {
  const a = new Array<i32>(neg());
  console.log(`${a.length}`);
  return 0;
};
