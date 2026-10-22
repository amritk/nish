// WP33 NL8001 (#629): an offset that bounds a loop over anything but a cursor
// into the string makes the loop run once per byte here and once per unit in
// TypeScript. A `for`, a `while` and a `do` condition are each one bound; the
// loop over `i` below that reads `word.charCodeAt(i)` counts in the string's
// own unit and stays quiet.
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
  console.log(steps + k + d);
  console.log(sum);
  return 0;
};
