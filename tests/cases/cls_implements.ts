interface Shape {
  width: number;
  height: number;
}

class Rect implements Shape {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  area(): number {
    return this.width * this.height;
  }
}

function perimeter(s: Shape): number {
  return 2 * (s.width + s.height);
}

function widest(a: Shape, b: Shape): Shape {
  return a.width >= b.width ? a : b;
}

function grow(r: Rect, by: number): Shape {
  r.width += by;
  return r;
}

export function main(): number {
  const r = new Rect(3, 4);
  console.log(perimeter(r));
  const s: Shape = r;
  console.log(s.width);
  console.log(widest(r, { width: 10, height: 1 }).width);
  console.log(grow(r, 2).width);
  console.log(r.area());
  return 0;
}
