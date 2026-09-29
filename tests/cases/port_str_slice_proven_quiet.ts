// WP33 NL8002, the quiet side: a `slice` bound the WP15 proof places inside
// `[0, s.length]` — a literal 0, a guarded local, or a hoisted length — is one
// TypeScript's clamp would not have moved, so the two readings cut the same
// bytes and nothing is reported.
const head = (s: string, n: i32): string => {
  if (n >= 0 && n <= s.length) {
    return s.slice(0, n);
  }
  return s;
};

const rest = (s: string, from: i32): string => {
  const n = s.length;
  if (from >= 0 && from <= s.length) {
    return s.slice(from, n);
  }
  return "";
};

export const main = (): number => {
  const word = "abcdef";
  console.log(head(word, 3));
  console.log(rest(word, 4));
  console.log(word.slice(0));
  return 0;
};
