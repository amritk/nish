// WP33 NL8001 (#629): where the walk stops, an offset is quiet though it may
// reach an outside fact. It is followed four calls deep and no further, so the
// chain from `h1` is quiet while the one from `h2` is reported; a recursive
// call ends there too. A generic callee, a function of another module, and a
// parameter the callee never reads are not crossed.
import { show } from "./show";

const h5 = (n: i32): void => {
  console.log(n);
};

const h4 = (n: i32): void => {
  h5(n);
};

const h3 = (n: i32): void => {
  h4(n);
};

const h2 = (n: i32): void => {
  h3(n);
};

const h1 = (n: i32): void => {
  h2(n);
};

const spin = (n: i32, rounds: i32): i32 => {
  if (rounds <= 0) {
    return 0;
  }
  return spin(n, rounds - 1);
};

const echo = <T>(x: T): void => {
  console.log(x);
};

const ignore = (n: i32, s: string): void => {
  console.log(s);
};

export const main = (): number => {
  const word = "héllo";
  h1(word.length);
  h2(word.indexOf("l"));
  console.log(spin(word.length, 3));
  echo(word.length);
  ignore(word.length, word);
  show(word.indexOf("l"));
  return 0;
};
