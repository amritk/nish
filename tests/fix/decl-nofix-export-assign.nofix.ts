// `export = f` is CommonJS's export, not a default one: no fix.
const f = (): i32 => 1
export = f
