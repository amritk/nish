// WP27 S3.1: C reads a string to its first NUL byte, so a string handed to a
// `declare function` that holds one panics before the call (`ffi-nul`). A
// literal with no NUL is proved and is no site; any other string is one, and
// the `string | null` parameter checks only the non-null arm.
// `panics_ffi_nul.c` runs each in a child and prints its message and its exit
// status.
declare function strlen(s: string): u64;
declare function strcmp(a: string, b: string | null): i32;

const withNul = (head: string): string => head + String.fromCharCode(0) + ".txt";

export const literal = (): i32 => toI32(strlen("hello"));

export const clean = (): i32 => toI32(strlen(withNul("secret").slice(0, 6)));

export const holdsNul = (): i32 => toI32(strlen(withNul("secret")));

export const nullableNul = (): i32 => {
  const b: string | null = withNul("b");
  return strcmp("b", b);
};
