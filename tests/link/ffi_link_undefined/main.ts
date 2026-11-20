// NL3063: a `declare function` that no linked library or C file defines.
// No `nish.link` names one, so the link leaves `absent_c_function` undefined
// and the compile reports it at this declaration instead of a bare linker
// failure.
declare function absent_c_function(a: i32): i32

export const main = (): i32 => absent_c_function(2)
