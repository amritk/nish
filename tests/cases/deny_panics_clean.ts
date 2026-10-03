// --deny-panics (docs/LANGUAGE.md, "The no-panic scope"): a module whose every
// check is proven away compiles under the flag, and its IR has no panic path
// left. Each function is one proof: a guarded index, a guarded and a constant
// divisor, a guarded `pop`, a guarded range entry, and `readFileSyncOrNull`
// where `readFileSync` would exit.
type Digit = integer<0, 9>;

const at = (xs: i32[], i: i32): i32 => {
  if (i >= 0 && i < xs.length) {
    return xs[i];
  }
  return -1;
};

const ratio = (a: i32, d: i32): i32 => {
  if (d !== 0 && d !== -1) {
    return a / d;
  }
  return 0;
};

const half = (a: i32): i32 => a / 2 + a % 10;

const last = (xs: i32[]): i32 => {
  if (xs.length > 0) {
    return xs.pop();
  }
  return 0;
};

const digit = (n: i32): Digit => {
  if (n >= 0 && n <= 9) {
    return n;
  }
  return 0;
};

const size = (path: string): i32 => {
  const text = readFileSyncOrNull(path);
  if (text === null) {
    return -1;
  }
  return text.length;
};

export const main = (): number => {
  const xs: i32[] = [3, 5, 7];
  console.log(at(xs, 1));
  console.log(at(xs, 9));
  console.log(ratio(17, 5));
  console.log(ratio(17, 0));
  console.log(half(37));
  console.log(last(xs));
  console.log(digit(4));
  console.log(size("build/test/deny_panics_clean.missing"));
  return 0;
};
