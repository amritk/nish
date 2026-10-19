// WP27 S3.3: the `CPtr | null` argument rule holds for a call through a
// compile-time function parameter bound to a `declare function`, as it does
// for a call that names it (`reject_ffi_pointer_nullable_variable`).
declare function realpath(path: string, resolved: CPtr | null): CPtr | null;
declare function free(p: CPtr | null): void;

function via(f: (p: CPtr | null) => void): void {
  const p = realpath(".", null);
  f(p);
}

export function main(): i32 {
  via(free);
  return 0;
}
