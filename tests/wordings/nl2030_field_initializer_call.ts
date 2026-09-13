// NL2030: A field initializer is a literal; anything computed belongs in the constructor.
const one = (): i32 => 1;

class Point {
  x: i32 = one();
}
