// Two separators in a row; tsc: TS6189.
export const main = (): i32 => {
  const ten: i32 = 1__0;
  console.log(`${ten}`);
  return 0;
};
