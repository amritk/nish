// Pass 1 recovers per *declaration*, not per member: `docs/LANGUAGE.md`,
// "Diagnostics and debugging flags". Both fields of each class here are
// refused, and only the first of each is reported, so the count is two and not
// four — which is what the `2 errors` fragment in the `.err` pins, since a
// fragment list cannot assert that a sentence is absent. The second class pins
// the other half of the same rule: the silence ends at the declaration, so
// `Trio` is reported although `Pair` already failed.
//
// Why the compiler stops at the first bad member rather than naming both is
// written beside the member loop in `self/structs.ts` (#94), and so is what it
// would take to change it.
export class Pair {
  first: i32 = "one";
  second: i32 = "two";
}

export class Trio {
  a: i32 = "a";
  b: i32 = "b";
}
