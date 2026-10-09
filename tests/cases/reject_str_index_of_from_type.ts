// The start of `indexOf` is a number; a string there is not converted.
function f(s: string): number {
  return s.indexOf("a", "1");
}
