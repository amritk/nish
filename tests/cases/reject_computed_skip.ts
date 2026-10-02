// A computed key cut short is one syntax error, and the literal goes on from
// the property after it: `b: 2` still parses, so nothing more is reported.
const o = {
  [,
  b: 2,
};
export const main = (): i32 => 0;
