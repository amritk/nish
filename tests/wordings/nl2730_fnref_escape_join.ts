// NL2730: a call through a reference that can reach a function keeping its
// argument and one that does not. The dispatcher's facts are its arms' join,
// so every call would lose the argument's stack place.
class Point {
  x: i32;
  constructor(x: i32) {
    this.x = x;
  }
}

class Box {
  last: Point | null;
  constructor() {
    this.last = null;
  }
}

function u0(p: Point, b: Box): i32 {
  return p.x;
}

function u3(p: Point, b: Box): i32 {
  b.last = p;
  return p.x;
}

export const main = (): i32 => {
  let h = u0;
  if (Date.now() > 0) {
    h = u3;
  }
  return h(new Point(1), new Box());
};
