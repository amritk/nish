// --deterministic refuses `Number` of a string (NL2697): strtod natively and
// JavaScript under Node read `0b101` and `0x1p3` differently.
export const main = (): number => {
  console.log(Number("0b101"));
  return 0;
};
