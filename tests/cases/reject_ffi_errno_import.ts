// WP27 S5: `cErrno` is a `nish:unsafe` export; naming it unimported is refused.
export function main(): i32 {
  return cErrno();
}
