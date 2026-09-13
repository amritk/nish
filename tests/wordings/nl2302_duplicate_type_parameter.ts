// NL2302: two type parameters of one name. The second could never be bound to
// anything the first was not, so the list says one thing twice.
const pair = <T, T>(a: T, b: T): T => a;

export const main = (): i32 => pair(1, 2);
