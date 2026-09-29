// WP34 N6: an f32 mask and f32 candidates are refused like f64 ones (NL2399).
export const pick = (mask: f32, a: f32, b: f32): f32 => ctSelect(mask, a, b);
