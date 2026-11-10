// Under `--deterministic` `Number`, `parseFloat` and `parseInt` read a string
// with one grammar on every target, the one `--emit-ts` reads: a `0x` integer
// is read in the runtime, correctly rounded on any libc, and a hex float is
// not a number (`Number`) or its integer prefix (`parseFloat`). The flag adds
// 4 to the parse mode passed to `nish_parse_number`.
export const main = (): number => {
  console.log(Number("0x1p3"));
  console.log(parseFloat("0x1p3"));
  console.log(Number("0x10"));
  console.log(Number("0x1fffffffffffff1"));
  console.log(parseFloat(" 0.1e1x"));
  console.log(parseInt(" -42z"));
  return 0;
};
