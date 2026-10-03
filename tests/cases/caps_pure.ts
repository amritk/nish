// WP35: what is ambient reaches nothing. Printing, `process.argv`, arithmetic,
// a conversion and an array are all `none`, so the program is deterministic
// and its capabilities are the empty list.
export const total = (xs: i32[]): i32 => {
  let sum = 0;
  for (const x of xs) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): number => {
  console.log(process.argv.length > 0);
  console.log(total([1, 2, 3]));
  console.log(toF64(7) / 2.0);
  return 0;
};
