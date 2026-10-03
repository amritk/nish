// `export default f` (NL2129): `export` moves onto the declaration of `f`.
const f = (): i32 => 1

export default f
