// Error recovery, which the oracle cannot judge: the `typescript` parser
// recovers differently by design. `src/parser.ts` never throws, so a
// failed parse is a `NodeKind.Error` node and a diagnostic, and the caller decides
// where to pick up — that is the §3a D1 tax, visible.
function ok(a: number): number {
  return a;
}

function broken(a: number): number {
  return a +
}

function alsoOk(b: number): number {
  return b * 2;
}
