// Objects that may outlive their function stay in the arena (WP6): returned,
// stored into a field, pushed into an array, assigned to another local,
// handed to a callee that captures its parameter, or held by a reassigned `let`.
class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class Box {
  item: Point;

  constructor(item: Point) {
    this.item = item;
  }
}

const keep = (p: Point): Point => {
  return p;
};

const make = (): Point => {
  return new Point(1, 2); // returned
};

const boxed = (): Box => {
  return new Box(new Point(3, 4)); // the Point is stored by the constructor; the Box is returned
};

const stash = (xs: Point[]): void => {
  xs.push(new Point(5, 6)); // pushed
};

const field = (b: Box): void => {
  b.item = new Point(7, 8); // stored into a field
};

const captured = (): number => {
  const p = new Point(9, 10);
  const q = keep(p); // `keep` captures (returns) its parameter
  return q.x;
};

const reassigned = (flag: boolean): number => {
  let p = new Point(11, 12);
  if (flag) {
    p = new Point(13, 14); // both objects are held by a reassigned `let`
  }
  return p.x;
};

const aliased = (): number => {
  const p = new Point(15, 16);
  let q = p; // `let q = p` is an assignment-style alias: conservative, arena
  return q.y;
};

export const main = (): number => {
  const xs: Point[] = [];
  stash(xs);
  const b = boxed();
  field(b);
  console.log(make().x + xs[0].y + b.item.x + captured() + reassigned(true) + aliased());
  return 0;
};
