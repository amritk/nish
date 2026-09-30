// NL2268: the argument is a path, so it is a string; there is no reading from
// a file descriptor.
export const size = (fd: i32): number => {
  const b = readFileBytesSync(fd);
  return b === null ? 0 : b.length;
};
