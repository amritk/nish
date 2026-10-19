// WP27 S3.1 lets a `string` cross into C as a borrowed `const char *`, and
// stops there: a `string[]` would be C's `char **`, an array of borrowed
// pointers the compiler would have to build for every call (docs/wp27-ffi.md
// §8f), so it is refused by name like every other non-foreign type.
declare function execvp(file: string, argv: string[]): i32;

export function main(): i32 {
  return 0;
}
