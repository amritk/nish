function total(xs: Float64Array): f64 { let s: f64 = 0; for (const x of xs) { s += x; } return s; }
function f(): f64 { const xs: Int32Array = [1, 2, 3]; return total(xs); }
