// One name of the list is already exported: no fix, so no `export export`.
export const f = (): i32 => 1
const g = (): i32 => 2
export { f, g }
