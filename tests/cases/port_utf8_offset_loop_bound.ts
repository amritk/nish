// WP33 NL8001 (#629): an offset that bounds a loop over anything but a cursor
// into the string makes the loop run once per byte here and once per unit in
// TypeScript. A `for`, a `while` and a `do` condition are each one bound; the
// loop over `i` below that reads `word.charCodeAt(i)` counts in the string's
// own unit and stays quiet, and so does a cursor the bound moves by a
// constant to look ahead (`i + 1 < s.length`). A step counter moved the same
// way is no cursor. An offset bounded by another offset, or by a local that
// holds one, is quiet; a plain count against an offset is not.
export const main = (): number => {
  const word = "héllo";
  let steps = 0;
  for (let i = 0; i < word.length; i++) {
    steps = steps + 1;
  }
  let k = 0;
  while (k < word.indexOf("o")) {
    k = k + 1;
  }
  let d = 0;
  do {
    d = d + 1;
  } while (!(d >= word.length));
  let sum = 0;
  for (let i = 0; i < word.length; i++) {
    if (word.charCodeAt(i) === 108) {
      sum = sum + 1;
    }
  }
  let ahead = 0;
  while (ahead + 1 < word.length) {
    if (word.charCodeAt(ahead + 1) === 108) {
      sum = sum + 1;
    }
    ahead = ahead + 1;
  }
  for (let j = 0; j + 2 <= word.length; j++) {
    if (word.charCodeAt(j) === 104) {
      sum = sum + 1;
    }
  }
  let pairs = 0;
  for (let j = 0; j + 1 < word.length; j++) {
    pairs = pairs + 1;
  }
  let rest = word;
  while (rest.indexOf("l") < rest.length && rest.indexOf("l") >= 0) {
    rest = rest.substring(rest.indexOf("l") + 1, rest.length);
  }
  let at = word.indexOf("l");
  let rounds = 0;
  while (at < word.length) {
    rounds = rounds + 1;
    at = at + rounds;
  }
  let m = 0;
  while (m < word.length) {
    m = m + rounds;
  }
  console.log(steps + k + d);
  console.log(sum);
  console.log(pairs + rounds);
  console.log(rest);
  return 0;
};
