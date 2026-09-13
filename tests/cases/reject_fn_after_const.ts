// A module constant and a function share one declaration namespace, whichever
// came first. stage0 used to accept this order and refuse the other.
const value: number = 1;

export const value = (): number => 2;
