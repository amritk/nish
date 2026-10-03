// A `const` bound to an arrow that goes on to bind a second name: `export`
// on it would export `g` as well, so no fix.
const f = (): i32 => 1,
  g = (): i32 => 2
export default f
