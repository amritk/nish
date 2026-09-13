// A field initializer is a literal; anything else is assigned in the constructor.
const one = (): number => 1;

export class Point {
  x: number = one();
}
