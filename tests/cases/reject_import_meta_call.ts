// A call through `import.meta`, as a statement in a body, is the meta-property
// refused (NL1060), not a dynamic `import()` (NL1002) and not a syntax error.
export const main = (): i32 => {
  import.meta.resolve("./lib");
  return 0;
};
