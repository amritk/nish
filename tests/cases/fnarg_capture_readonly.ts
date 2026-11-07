// A parameter an arrow only reads is `readonly nocapture` in the function
// that wrote the arrow, and on the `%cap.1` the instance forwards it through:
// the arrow's own facts for that parameter say so, and nothing on the way to
// the arrow can do anything with the value but pass it on.

class Point {
  x: i32;
  y: i32;

  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

class Acc {
  t: i32;

  constructor() {
    this.t = 0;
  }
}

const each = (xs: i32[], f: (x: i32) => void): void => {
  for (const x of xs) {
    f(x);
  }
};

const sum = (p: Point, xs: i32[], acc: Acc): void => {
  each(xs, (x) => {
    acc.t = acc.t + p.x * x + p.y;
  });
};

export const main = (): void => {
  const acc = new Acc();
  sum(new Point(2, 1), [1, 2, 3], acc);
  console.log(`${acc.t}`);
};
