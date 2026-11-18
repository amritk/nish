// The bytes are a `u8[]`: a string goes through `writeFileSync`, and a wider
// element type is not converted.
export const main = (): number => {
  const words: i32[] = [1, 2];
  return writeFileBytesSync("build/test/a", words);
};
