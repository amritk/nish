// WP33 NL8003, the quiet side for an arrow argument: the arrow's body is a
// function of its own, so the second name it gives its own array (`ys = xs`)
// says nothing about the enclosing body's arrays. `as` is never read after the
// write to `a`, so nothing here differs from TypeScript.
interface Rec {
  x: i32;
}

const apply = (f: (n: i32) => i32): i32 => f(1);

export const main = (): number => {
  const as: Rec[] = [];
  const a: Rec = { x: 1 };
  as.push(a);
  const bs: Rec[] = [];
  console.log(
    apply((n: i32): i32 => {
      const xs: Rec[] = [];
      const ys: Rec[] = xs;
      return ys.length + n;
    })
  );
  a.x = 9;
  const b: Rec = { x: 2 };
  bs.push(b);
  console.log(bs[0].x);
  return 0;
};
