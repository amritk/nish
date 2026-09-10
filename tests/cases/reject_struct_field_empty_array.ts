// `[]` has no element type of its own and this position gives it none:
// `src/checker/arrays.ts`'s contextual walk names a variable declaration, a
// `return`, an assignment, an array element and a call argument, and an object
// literal's property is not one of them. Build the array first and name it, or
// annotate a local. stage1 was passing the field type down and compiling this.
interface Bag {
  xs: i32[];
}

export function main(): i32 {
  const bag: Bag = { xs: [] };
  return toI32(bag.xs.length);
}
