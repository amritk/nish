// `export { ... }` (NL2128): the list goes, and `export` goes before each
// declaration it names, whatever kind of declaration that is.
function f(): i32 {
  return 1
}
const g = (): i32 => 2
interface P {
  x: i32
}
type N = i32
export { f, g, P, N }
