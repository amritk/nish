// `export { f, f }` asks for `export ` before `f` twice, at one offset. No
// order of the two makes that right, so `nish --fix` drops the whole fix, and
// the file is left as it was, the fix still reported.
const f = (): i32 => 1
export { f, f }
