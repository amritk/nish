// WP27 S3.2: a `string` cannot hold C's `NULL`, so a `declare function`
// declared to return `string` that answers `NULL` panics after the call
// (`ffi-null`); `getenv` answers `NULL` for a name that is not set. A result
// declared `string | null` reads the same answer as `null` and is no site:
// `strchr` below finds nothing. `panics_ffi_null.c` runs the panic in a child
// and prints its message and its exit status.
declare function getenv(name: string): string;
declare function strchr(s: string, c: i32): string | null;

export const present = (): i32 => getenv("HOME").length > 0 ? 1 : 0;

export const nullable = (): i32 => strchr("abc", 122) === null ? 1 : 0;

export const absent = (): i32 => getenv("NISH_FFI_NULL_NEVER_SET").length;
