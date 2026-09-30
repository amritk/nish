// NL2302 on a module constant bound to an arrow: the arrow's list is swept
// like a function's.
const pair = <T, T>(a: T, b: T): T => a;

export const main = (): i32 => pair(1, 2);
