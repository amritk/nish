// `name` with a NUL and a suffix after it: the shape of a path that passes a
// program's `endsWith(".txt")` check while the kernel reads only `name`.
export const withNul = (name: string, suffix: string): string => `${name}${String.fromCharCode(0)}${suffix}`;
