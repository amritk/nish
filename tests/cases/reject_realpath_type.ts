// The path is a string; there is no conversion from a number. Nothing is bound
// to the result, so stage0 has no poisoned declaration to cascade from and the
// two compilers report the same one error — which is what this case is for.
export function main(): number {
  return realpathSync(7) === null ? 1 : 0;
}
