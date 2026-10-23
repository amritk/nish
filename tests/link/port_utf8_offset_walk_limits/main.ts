// WP33 NL8001 (#629): where the walk stops, an offset is quiet though it may
// reach an outside fact. It is followed four calls deep and no further, so the
// chain from `h1` is quiet while the one from `h2` is reported, and so is the
// returned chain from `r1` while the one from `r2` is reported. A recursive
// call ends the walk without hiding the caller: `deep` answers its parameter,
// and the call that prints it is reported. A generic callee, a function of
// another module, a parameter the callee never reads or reads only inside an
// arrow it passes on (`relay`), and the answer of a `spawn` body (`find`) are
// not crossed. Once the offset has crossed into another function, the string
// it counted is out of reach, so `scan` takes any string's method as the
// cursor its bound counts.
import { parallelMap, scope } from "nish/threads";
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

const r5 = (n: i32): i32 => n;
const r4 = (n: i32): i32 => r5(n);
const r3 = (n: i32): i32 => r4(n);
const r2 = (n: i32): i32 => r3(n);
const r1 = (n: i32): i32 => r2(n);

const spin = (n: i32, rounds: i32): i32 => {
  if (rounds <= 0) {
    return 0;
  }
  return spin(n, rounds - 1);
};

const deep = (n: i32, rounds: i32): i32 => {
  if (rounds <= 0) {
    return n;
  }
  return deep(n, rounds - 1);
};

const echo = <T>(x: T): void => {
  console.log(x);
};

const ignore = (n: i32, s: string): void => {
  console.log(s);
};

const relay = (n: i32): i32 => {
  const xs: i32[] = [1, 2, 3];
  const ys = parallelMap(xs, (k) => k + n);
  return ys[0];
};

const find = (w: string): i32 => w.indexOf("l");

const scan = (n: i32, t: string): i32 => {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum = sum + t.charCodeAt(i);
  }
  return sum;
};

export const main = (): number => {
  const word = "héllo";
  h1(word.length);
  h2(word.indexOf("l"));
  console.log(r1(word.length));
  console.log(r2(word.indexOf("l")));
  console.log(spin(word.length, 3));
  console.log(deep(word.indexOf("l"), 3));
  echo(word.length);
  ignore(word.length, word);
  show(word.indexOf("l"));
  console.log(relay(word.indexOf("l")));
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(find, word, out, 0);
  }
  console.log(out[0]);
  console.log(scan(word.length, "abcdef"));
  return 0;
};
