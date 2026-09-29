// `**` in a template that nothing instantiates is refused all the same: the
// pass 1 sweep reads every body, where pass 2 checks a template's only once
// per instantiation.
export const power = <T>(value: T, n: i32): i32 => n ** 2

export const main = (): i32 => 0
