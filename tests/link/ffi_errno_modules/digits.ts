// The foreign call lives here, in a module that never names `cErrno`.
declare function strtol(s: string, end: CPtr | null, base: i32): i64;

export function digits(s: string): i64 {
  return strtol(s, null, 10);
}
