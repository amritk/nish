// WP29: a method is not a top-level function, so it cannot be a template
// over its callee.
class Runner {
  run(f: (x: i32) => i32): i32 {
    return f(1);
  }
}

export const main = (): i32 => 0;
