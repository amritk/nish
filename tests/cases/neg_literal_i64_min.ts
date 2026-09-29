// The `i64` minimum cannot be written as a literal (past 2^53 the parser has
// already rounded it), so the widest negated `i64` literal, -2^53, stands in:
// it folds to its constant rather than a `sub nsw i64 0, <literal>`, and the
// minimum is reached from it by a shift the language defines.
export function main(): number {
  const lo: i64 = -9007199254740992;
  const hex: i64 = -0x20000000000000;
  const min: i64 = lo << 10;
  console.log(`${lo} ${hex === lo} ${min} ${min + 1}`);
  return 0;
}
