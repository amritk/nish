// WP51: a field may have a function type, a function reference, and its
// initializer is checked against it: `0` is not a function.
class Handler {
  run: (x: i32) => i32 = 0;
}

export const main = (): i32 => 0;
