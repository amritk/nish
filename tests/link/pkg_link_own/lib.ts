// WP66 S7: the root's `nish.link` compiles `c/add.c` and passes `-lm`, so
// both of these resolve at link time.
declare function pkg_link_add(a: i32, b: i32): i32
declare function cbrt(x: f64): f64

export function add(a: i32, b: i32): i32 {
  return pkg_link_add(a, b)
}

export function cubeRoot(x: f64): f64 {
  return cbrt(x)
}
