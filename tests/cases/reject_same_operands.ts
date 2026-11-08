// `a.w === a.w` is always true: one side was meant to be `b.w` (NL2692).
class Size {
  w: i32;
  constructor(w: i32) {
    this.w = w;
  }
}

const sameWidth = (a: Size, b: Size): boolean => a.w === a.w && b.w > 0;

export const main = (): i32 => {
  console.log(`${sameWidth(new Size(1), new Size(2))}`);
  return 0;
};
