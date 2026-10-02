// The allocation under test, in a module of its own so the length crosses a call.
export const doubles = (n: number): f64[] => new Array<f64>(n);
