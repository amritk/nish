// #181's other half: joining the `continue` edges into the `for` update and the
// `do/while` condition costs no proof where no `continue` branch disturbs one.
// Both loops `continue` past an even element with the guard's facts intact,
// so `xs[i]` in the update and in the condition keeps its proof: the golden
// has no `nish_panic_index` in `for.inc` or in the `do` condition.
const sumOdd = (xs: i32[]): i32 => {
  let s = 0;
  let last = 0;
  let i = -1;
  for (let n = 0; n < 100; last = xs[i]) {
    n = n + 1;
    i = i + 1;
    if (i < 0 || i >= xs.length) {
      break;
    }
    if (xs[i] % 2 === 0) {
      continue;
    }
    s = s + xs[i];
  }
  return s + last * 0;
};

const countOdd = (xs: i32[]): i32 => {
  let odd = 0;
  let i = -1;
  do {
    i = i + 1;
    if (i < 0 || i >= xs.length) {
      break;
    }
    if (xs[i] % 2 === 0) {
      continue;
    }
    odd = odd + 1;
  } while (xs[i] > 0);
  return odd;
};

export const main = (): number => {
  const xs: i32[] = [3, 1, 4, 1, 5, 0, 9];
  console.log(`${sumOdd(xs)} ${countOdd(xs)}`);
  return 0;
};
