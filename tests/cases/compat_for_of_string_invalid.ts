// WP28 C1, `for-of-string`: a string that is not valid UTF-8. A pass takes a
// lead byte and only the continuation bytes (`10xxxxxx`) that follow it, so a
// lead byte with none stands alone and the next byte gets its own pass, and a
// sequence cut short by the end of the string is one pass of what is left.
// The counts match Node, whose string iterator takes one pass per UTF-16 code
// point of the same characters.
const count = (s: string): number => {
  let n = 0;
  for (const _c of s) {
    n = n + 1;
  }
  return n;
};

export const main = (): void => {
  console.log(`${count(String.fromCharCode(200) + "abc")}`);
  console.log(`${count("x" + String.fromCharCode(240) + "yz")}`);
  console.log(`${count(String.fromCharCode(128) + String.fromCharCode(191))}`);
  console.log(`${count("é" + String.fromCharCode(226))}`);
};
