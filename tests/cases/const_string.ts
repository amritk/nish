// `+` on two string constants folds too, and the result is interned once even
// though it is used twice.
const GREETING: string = "hello, " + "world";

export function test(): number {
  console.log(GREETING);
  console.log(GREETING);
  return 0;
}
