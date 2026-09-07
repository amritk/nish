// Error recovery, which the oracle cannot judge: the `typescript` parser
// recovers differently by design. `self/parser.ts` has no exceptions, so a
// failed parse is an `N_ERROR` node and a diagnostic, and the caller decides
// where to pick up — which is the §3a D1 tax, visible.
function ok(a: number): number {
  return a;
}

function broken(a: number): number {
  return a +
}

function alsoOk(b: number): number {
  return b * 2;
}
