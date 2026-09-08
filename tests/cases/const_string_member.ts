// A string constant is a value, so it is a receiver like any other string;
// `.length` is the folded literal's byte length.
const NAME: string = "static";

export function test(): number {
  return NAME.length;
}
