// WP33 NL8001: a code compared with a literal of 128 or more names a character
// outside ASCII, and `charCodeAt` reads a UTF-8 byte here where TypeScript reads
// a UTF-16 unit, so `"é".charCodeAt(0)` is 195 natively and 233 under Node.
// The ASCII comparisons beside them mean the same in both and stay quiet.
const isAccented = (s: string, i: i32): boolean => s.charCodeAt(i) === 233;

const isLeadByte = (s: string, i: i32): boolean => {
  const c = s.charCodeAt(i);
  return c >= 192;
};

const isDigit = (s: string, i: i32): boolean => {
  const c = s.charCodeAt(i);
  return c >= 48 && c <= 57;
};

export const main = (): number => {
  const word = "é1";
  console.log(isAccented(word, 0) ? "accented" : "plain");
  console.log(isLeadByte(word, 0) ? "lead" : "not a lead");
  console.log(isDigit(word, 2) ? "digit" : "not a digit");
  return 0;
};
