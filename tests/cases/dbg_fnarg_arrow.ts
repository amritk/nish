// WP29 under `-g`: a lifted arrow gets a `DISubprogram` of its own, named as
// written and placed where the arrow starts, and the instantiation that calls
// it describes its one real parameter and not the function parameter.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  console.log(`${apply((x) => x + 1, 41)}`);
  return 0;
};
