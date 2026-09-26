// WP31 §9: a `declare function` may not mention a range. The C side never
// promised it, so the parameter is declared `i32` and enters a range after.
declare function abs(x: integer<-100, 100>): i32

export const main = (): number => abs(-3)
