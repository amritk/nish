// #386: the packed owner and mode is an i64 in either number mode, since the
// owner alone fills 32 bits; an i32 cannot hold it.
export const test = (): number => {
  const om: i32 = lstatOwnerModeSync("x");
  return 0;
};
