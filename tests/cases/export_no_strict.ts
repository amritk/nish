// `--no-strict-exports` (see .args) puts back the old default: every function is
// an external C-ABI symbol, exported or not, so `helper` is callable from C and
// its name must be unique across the whole program. Compare
// `tests/cases/export_fn`, the same source under the default, where `helper` is
// `internal`.
export function double(n: number): number {
  return n * 2;
}

function helper(n: number): number {
  return n + 1;
}

export function next(n: number): number {
  return helper(double(n));
}
