// `throw` is forbidden by Phase 0 (WP16): it aborted rather than unwinding, so
// it was an abort wearing the syntax of error handling. A failure a caller
// should see is a `Result<T, E>`; an invariant that cannot hold is `panic`.
function checkedDiv(a: number, b: number): number {
  if (b === 0) {
    throw 1;
  }
  return a / b;
}

export function test(): number {
  return checkedDiv(84, 2);
}
