// The result is `string | null`; it has to be narrowed before it is used.
const f = (path: string): number => {
  return readFileSyncOrNull(path).length;
};
