// Under `--deterministic` `Number` and `parseFloat` of a string read it with
// one grammar on every target, the one `--emit-ts` reads: the call is to
// `std/math.ts`'s `numberExact` or `parseFloatExact`, which read a `0x`
// integer correctly rounded on any libc, a hex float as not a number
// (`Number`) or its integer prefix (`parseFloat`), and hand every other
// spelling to the runtime. `parseInt` already agrees, and stays the runtime's.
export const main = (): number => {
  console.log(Number("0x1p3"));
  console.log(parseFloat("0x1p3"));
  console.log(Number("0x10"));
  console.log(Number("0x1fffffffffffff1"));
  console.log(parseFloat(" 0.1e1x"));
  console.log(parseInt(" -42z"));
  console.log(parseFloat("+0x10"));
  console.log(Number("+0x10"));
  console.log(parseFloat("-0x1fffffffffffff1"));
  console.log(parseInt("+0x10"));
  console.log(parseInt("0x1fffffffffffff1"));
  return 0;
};
