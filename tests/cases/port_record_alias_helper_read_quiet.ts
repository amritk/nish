// #620's quiet side for helpers: `sum` only reads the elements it is handed,
// so passing `ps` writes nothing and the read of `p` after it agrees on both
// sides. No NL8003.
interface Rec {
  v: i32;
}

const sum = (xs: Rec[]): i32 => {
  let t: i32 = 0;
  for (let i = 0; i < xs.length; i++) {
    t = t + xs[i].v;
  }
  return t;
};

export const main = (): number => {
  const ps: Rec[] = [];
  const p: Rec = { v: 1 };
  ps.push(p);
  console.log(sum(ps));
  console.log(p.v);
  return 0;
};
