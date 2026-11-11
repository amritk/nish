// Counting into a local is not reading it: `n++` on its own line stores and
// never uses the value, so a counter nothing reports is still unread (NL2712).
export const main = (): i32 => {
  const xs: i32[] = [4, 5, 6];
  let n: i32 = 0;
  for (const x of xs) {
    if (x > 4) {
      n++;
    }
  }
  console.log(`${xs.length}`);
  return 0;
};
