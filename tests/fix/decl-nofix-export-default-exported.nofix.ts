// `export default f` where `f` is already exported: no fix.
export const f = (): i32 => 1
export default f
