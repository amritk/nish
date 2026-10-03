// --deny-panics refuses `slice`, whose range check no proof removes yet, and
// names `substring`, which clamps instead.
export const middle = (s: string): string => s.slice(1, 3);
