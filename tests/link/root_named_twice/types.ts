// The module named twice: a class and a function, each of which was a second
// declaration of itself when this file loaded as two modules.
export class Base {
  y: f64 = 0.5;
  x: i32 = 7;
}

export const read = (b: Base): i32 => b.x;
