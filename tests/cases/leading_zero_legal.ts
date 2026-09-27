// A zero that leads a literal without another digit straight after it is
// legal: zero itself, a fraction, an exponent and a radix prefix, each the
// value it spells (issue #271). `0b…` and `0o…` lex here too, but their
// values are the literal-value path's (issue #267), not this case's.
export const main = (): i32 => {
  const zero: i32 = 0;
  const half: f64 = 0.5;
  const scaled: f64 = 0e1;
  const hex: i32 = 0x0F;
  console.log(`${zero} ${half} ${scaled} ${hex}`);
  return 0;
};
