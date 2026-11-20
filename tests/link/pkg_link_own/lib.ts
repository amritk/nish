// WP66 S7: the root's `nish.link` compiles `c/add.c`, which defines
// `pkg_link_add`. `cbrt` is libm's, and scripts/build.sh links libm into every
// program, so `"libraries": ["m"]` here shows a listed library is accepted, not
// that it is needed; the `package-link` check in tests/run.js that builds its
// own shared library is what shows `-l<name>` reaches the linker.
declare function pkg_link_add(a: i32, b: i32): i32
declare function cbrt(x: f64): f64

export const add = (a: i32, b: i32): i32 => {
  return pkg_link_add(a, b)
};

export const cubeRoot = (x: f64): f64 => {
  return cbrt(x)
};
