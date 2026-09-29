// The result is `u8[] | null`; it has to be narrowed before it is used.
export const size = (path: string): number => readFileBytesSync(path).length;
