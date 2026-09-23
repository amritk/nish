// #180's rule, scoped to what the store can reach: `rs[i % n] = { ... }`
// rewrites one inline `Rec` slot, and the only thing that can point into that
// slot is a value declared `Rec`. `g.src` is read off a `Grid`, which is a
// class and never inline, so its header stays lifted into the preheader while
// the loop stores whole records on every pass. `arr_header_hoist_record_store`
// is the path through a `Rec` view that must not hoist.
interface Rec {
  a: i32;
  b: i32;
}

class Grid {
  src: i32[];
  constructor(src: i32[]) {
    this.src = src;
  }
}

export const stamp = (g: Grid, rs: Rec[]): i32 => {
  let t: i32 = 0;
  const n: i32 = rs.length;
  for (let i: i32 = 0; i < g.src.length; i = i + 1) {
    t = t + g.src[i];
    rs[i % n] = { a: i, b: t };
  }
  return t;
};

export const main = (): number => {
  const rs: Rec[] = [
    { a: 0, b: 0 },
    { a: 0, b: 0 },
  ];
  const t = stamp(new Grid([10, 20, 30, 40, 50]), rs);
  console.log(`${t} ${rs[0].a} ${rs[0].b} ${rs[1].a} ${rs[1].b}`);
  return 0;
};
