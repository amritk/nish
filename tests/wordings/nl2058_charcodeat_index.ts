// NL2058: A string index is a number; the message names the method it belongs to.
export const main = (): i32 => {
  return "abc".charCodeAt("x");
};
