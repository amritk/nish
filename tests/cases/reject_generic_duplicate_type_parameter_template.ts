// NL2302 in a template nothing instantiates: the rule needs no type, so the
// pass 1 sweep asks it, and a body pass 2 never checks is refused too.
const lookup = <K, V, K>(key: K, value: V): V => value;

export const main = (): i32 => 0;
