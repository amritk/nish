// `f as g` exports a name no `export` on a declaration can spell: no fix.
const f = (): i32 => 1
export { f as g }
