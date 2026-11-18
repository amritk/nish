// `f` is declared twice, so which declaration `export` belongs on is not
// known: no fix.
const f = (): i32 => 1
function f(): i32 {
  return 2
}
export default f
