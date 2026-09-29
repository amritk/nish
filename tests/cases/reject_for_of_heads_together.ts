// The pass 1 sweep for `for...of` heads recovers per declaration, as pass 1
// does, so two functions with a refused head each give two diagnostics.
export const first = (xs: i32[]): i32 => {
  for await (const x of xs) {
    return x;
  }
  return 0;
};

export const second = (xs: i32[]): i32 => {
  let x: i32 = 0;
  for (x of xs) {
  }
  return x;
};
