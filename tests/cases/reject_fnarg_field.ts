// WP29: a function type annotates a parameter of a top-level function and
// nothing else; a field of that type would hold a function value.
class Handler {
  run: (x: i32) => i32 = 0;
}

export const main = (): i32 => 0;
