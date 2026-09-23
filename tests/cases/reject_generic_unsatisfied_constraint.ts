// WP18 §8 message 1, the function half: a call's type argument is inferred,
// so the request is the call, and `i32` is not a class that implements `Shape`.
interface Shape {
  area: i32;
}

const areaOf = <T extends Shape>(shape: T): i32 => shape.area;

export const test = (): number => areaOf(7);
