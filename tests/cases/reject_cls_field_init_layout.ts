// A C struct layout (`declare class`) is not built by an initializer.
declare class Point {
  x: i32;
  y: i32;
}

class Holder {
  point: Point = new Point();
}

export const main = (): i32 => {
  return new Holder().point.x;
};
