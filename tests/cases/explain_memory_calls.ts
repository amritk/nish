// --explain-memory on calls the pass walk charges and the report must too: a
// `new` whose constructor keeps what it allocates, run by a loop condition; a
// function that takes a function parameter, explained through its first
// instantiation; a function bracketed by its own `using a = arena()` and one
// whose every allocation is in a scoped pass, which keep nothing past the
// call; and a function line that names the line of what it keeps.
class Leaky {
  w: i32;
  constructor(k: i32) {
    let s = `a${k}`;
    s = `${s}b`;
    this.w = k;
  }
}

const each = (n: i32, g: (x: i32) => i32): i32 => {
  const held: string[] = [];
  for (let i = 0; i < n; i++) {
    held.push(`${g(i)}`);
  }
  return held.length;
};

const bracketed = (): i32 => {
  using a = arena();
  let s = `x`;
  s = `${s}y`;
  return s.length;
};

const scopedOnly = (n: i32): i32 => {
  let total = 0;
  for (let i = 0; i < n; i++) {
    let s = `a${i}`;
    s = `b${i}`;
    total = total + s.length;
  }
  return total;
};

const plain = (n: i32): i32 => {
  const held: string[] = [];
  for (let i = 0; i < n; i++) {
    held.push(`${i}`);
  }
  return held.length;
};

const twice = (x: i32): i32 => x * 2;

export const main = (): void => {
  let k = 0;
  while (new Leaky(k).w < 3) {
    k = k + 1;
  }
  console.log(`${each(3, twice)} ${bracketed()} ${scopedOnly(3)} ${plain(3)} ${k}`);
};
