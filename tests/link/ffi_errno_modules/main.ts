// WP27 S5: naming `cErrno` in one module makes every foreign call of the
// program capture errno, including one in a module that does not name it
// (`Compilation.analyze` spreads `capturesErrno`). Without the spread, the
// `strtol` in digits.ts would not save errno and both lines would read 0.
import { cErrno } from "nish:unsafe";
import { digits } from "./digits";

export const main = (): i32 => {
  const big = digits("99999999999999999999999");
  console.log(`${big > 4000000000000000} ${cErrno()}`);
  const small = digits("42");
  console.log(`${small} ${cErrno()}`);
  return 0;
};
