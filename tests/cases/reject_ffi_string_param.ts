// WP27 S1 crosses the boundary with scalars only: `string` is a pointer to a
// length-prefixed struct, and marshalling it to a `char *` is S3's question.
declare function f(s: string): i32;

export function main(): i32 {
  return 0;
}
