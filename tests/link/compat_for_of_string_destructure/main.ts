// A walk of a string binds each code point to a name: a destructuring head
// walks an array only.
export const main = (): i32 => {
  let n: i32 = 0;
  for (const [c] of "abc") {
    n = n + 1;
  }
  return n - 3;
};
