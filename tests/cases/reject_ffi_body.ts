// WP27 S1: a `declare function` names a C function this program calls, so a
// body is a contradiction rather than an extra.
declare function h(): i32 {
  return 1;
}

export function main(): i32 {
  return 0;
}
