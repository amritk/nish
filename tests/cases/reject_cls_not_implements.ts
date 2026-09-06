interface Shape {
  width: number;
}

class Rect {
  width: number = 1;
}

function area(s: Shape): number {
  return s.width;
}

function test(): number {
  return area(new Rect());
}
