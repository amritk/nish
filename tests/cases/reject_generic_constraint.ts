// WP18 G6: a constraint names a declared class or interface. A scalar has no
// members to lend a type parameter, and a constraint that mentions another
// type parameter would mean something different at every instantiation.
const widen = <T extends i32>(a: T): T => a;

const pick = <T, U extends T>(a: T, b: U): T => a;

export const test = (): number => 0;
