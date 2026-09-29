// NL2061: `readFileBytesSync` takes the path and nothing else; there is no
// encoding to name, since the bytes come back as they are on disk.
export const size = (path: string): number => {
  const b = readFileBytesSync(path, "utf8");
  return b === null ? 0 : b.length;
};
