// WP50 §5.2: the wasm loader answers a program's module storage as `layout`
// and `views` beside its exports, so in a wasm program with storage an
// exported function of either name would be shadowed. A program with no
// storage keeps both names.
const SCORES = new Int32Array(8)

export const views = (i: u32): i32 => SCORES[i]
