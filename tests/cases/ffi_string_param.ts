// WP27 S3.1: a `string` handed to a `declare function` is C's `const char *`,
// the address 8 bytes into the `nish_str`, borrowed for the length of the call.
// The golden below is also a link test against libc. A literal with no NUL in
// it passes its bytes with no check; any other string is searched for a NUL
// first, and holds the `ffi-nul` panic site `panics_ffi_nul` fires.
// `string | null` passes `NULL` for `null`; `strcmp` below takes one that is
// not null at run time, so the case reads the non-null arm of that branch.
import { getenv } from "nish:process";

declare function strlen(s: string): u64;
declare function atoi(s: string): i32;
declare function setenv(name: string, value: string, overwrite: i32): i32;
declare function unsetenv(name: string): i32;
declare function puts(s: string): i32;
declare function strcmp(a: string, b: string | null): i32;

function digits(n: i32): string {
  return `${n * 7}`;
}

export function main(): i32 {
  console.log(`${strlen("hello, world")}`);
  const built: string = "ab" + digits(6);
  console.log(`${strlen(built)}`);
  console.log(`${atoi(digits(11))}`);
  console.log(`${atoi("  -12x")}`);
  const name: string = "NISH_FFI_STRING_PARAM";
  if (setenv(name, `v=${digits(3)}`, 1) !== 0) {
    return 1;
  }
  const back: string | null = getenv(name);
  console.log(back === null ? "unset" : back);
  console.log(`${unsetenv(name)}`);
  console.log(getenv(name) === null ? "unset" : "still set");
  const other: string | null = built.length > 0 ? built : null;
  console.log(`${strcmp("ab42", other)}`);
  // `puts` writes through C's stdio buffer, which is flushed at exit, after
  // every `console.log` line above: it goes last so the order holds.
  puts("hello from puts");
  puts(built);
  return 0;
}
