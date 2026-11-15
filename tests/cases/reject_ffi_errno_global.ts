// WP27 S5: errno is not reachable as a foreign global. glibc and musl spell it
// as a macro over `__errno_location()`, Darwin over `__error()`, so there is no
// `errno` symbol to link against, and Nish has no `declare let` to name one.
// `cErrno()` from `nish:unsafe` is how a program reads it.
declare let errno: i32;

export function main(): i32 {
  return errno;
}
