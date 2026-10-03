// WP33 NL8002, the quiet side for a receiver whose text is known (#326): an
// ASCII literal, a `const` bound to one, a `const` copied from that, or a module
// constant has a fixed length. Every bound below is placed inside `[0, length]`:
// a literal, a `const`, a `let` whose initialiser bounds it, or a parameter a
// guard bounds. So neither the check here nor TypeScript's clamp moves it, and
// nothing is reported. A pair the length facts alone prove (`fromGuard`) stays
// quiet as it did before the literal proof.
const GREETING: string = "hello";

const middle = (k: number): string => {
  const word = "abcdef";
  if (k >= 0 && k <= 4) {
    return word.slice(k, 5);
  }
  return word;
};

const fromGuard = (i: number): string => {
  const s = "abcdef";
  if (i >= 0 && i < s.length && s.length >= 6) {
    return s.slice(i, 6);
  }
  return s;
};

export const main = (): number => {
  console.log("abcdef".slice(1, 3));
  const t = "abcdef";
  console.log(t.slice(1, 3));
  console.log(t.slice(6));
  const u = t;
  console.log(u.slice(0, 6));
  const from = 2;
  console.log(t.slice(from, 4));
  let to: number = 3;
  console.log(t.slice(1, to));
  to = to + 1;
  console.log(middle(2));
  console.log(fromGuard(2));
  console.log(GREETING.slice(1, 5));
  return to - 4;
};
