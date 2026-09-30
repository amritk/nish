// NL1060: A module has no runtime object for `import.meta` to name; paths are resolved at compile time.
export const main = (): i32 => {
  const url: string = import.meta.url;
  return 0;
};
