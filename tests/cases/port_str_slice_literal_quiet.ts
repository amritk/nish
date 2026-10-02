// WP33 NL8002, the quiet side for a receiver whose text is known (#326): an
// ASCII literal, a `const` bound to one, a `const` copied from that, or a module
// constant has a fixed length, and every bound below is a literal or a `const`
// inside `[0, length]`, so neither the check here nor TypeScript's clamp moves
// it and nothing is reported.
const GREETING: string = "hello";

export const main = (): number => {
  console.log("abcdef".slice(1, 3));
  const t = "abcdef";
  console.log(t.slice(1, 3));
  console.log(t.slice(6));
  const u = t;
  console.log(u.slice(0, 6));
  const from = 2;
  console.log(t.slice(from, 4));
  console.log(GREETING.slice(1, 5));
  return 0;
};
