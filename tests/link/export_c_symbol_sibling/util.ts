// The helper module of `main.ts`: a module of the program's own package other
// than the entry, whose exports keep their names as their symbols just as the
// entry's do.
export const write = (path: string, n: i32): i32 => toI32(path.length) + n;
