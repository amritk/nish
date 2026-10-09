// WP33 NL8001 on `s.indexOf(sub, from)`: the answer is an offset like the
// one-argument form's, so printing it is reported, and one step past an ASCII
// needle is not a fact from outside, so cutting there is quiet. The start
// handed in is an offset given to a string method, which is quiet too. On
// "café: a: b" the second colon is at 8 here and 7 under Node.
const printSecond = (line: string): void => {
  console.log(line.indexOf(":", line.indexOf(":") + 1));
};

const afterSecond = (line: string): string =>
  line.substring(line.indexOf(":", line.indexOf(":") + 1) + 1, line.length);

export const main = (): number => {
  const line = "café: a: b";
  printSecond(line);
  console.log(afterSecond(line));
  return 0;
};
