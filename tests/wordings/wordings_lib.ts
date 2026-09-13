// A module for the cases that need an import to say anything: a name imported
// from here and then used as a type is what NL2072 and NL2073 refuse.
export const one = (): i32 => 1;

export const LIMIT: i32 = 4;
