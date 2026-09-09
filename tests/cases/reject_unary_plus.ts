// `+x` is a conversion and this language has none: write `toI32(x)` or
// `toF64(x)` and say which one you meant. The message names the reason rather
// than only reporting an unsupported operator, which is the wording stage1 had
// and stage0 did not until `--parity` compared them (WP19 §A3).
export function main(): i32 {
  const s = 2;
  return +s;
}
